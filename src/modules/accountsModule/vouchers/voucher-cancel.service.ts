import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { DocRegisterService } from '../../../common/posting/doc-register.service';
import { VoucherPostingService } from '../../../common/posting/voucher-posting.service';
import {
  appendTxnStatusLog,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { assertVoucherPartitionExists } from '../receipt/receipt.guards';
import { receiptChequeFilter, receiptPdcVoucherWhere } from '../receipt/receipt-cheque-links';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import type { BillKey } from '../billBalance/bill-balance-recompute.service';
import type { CancelPayload } from './types/vouchers-api.types';
import type { CancelVoucherDto } from './dto/voucher-payload.dto';
import { otherVoucherOnRaisedBills, reverseVoucherAllocations } from './voucher-billwise.helper';
import { assertVoucherBooksReconcile } from './voucher-books.helper';
import { statusDocType, VoucherRegisterService } from './voucher-register.service';
import { VoucherTypesService } from './voucher-types.service';
import { throwMissing, throwRefused, throwRight, throwState, VCH } from './vouchers.errors';

const TX = { maxWait: 15_000, timeout: 120_000 };

/**
 * §8.3 — cancel = a reversal under the `Rev` type (decision C).
 *
 * Reverse, never delete. The original keeps its number, its legs and its
 * audit trail; the `Rev` mirror is a real, numbered, POSTED voucher dated the
 * original's date (C2); its own allocations get negative counter-rows; the
 * bill it raised is closed (soft-deleted); the GST document is CANCELLED and
 * the TDS register gets a reversal row. Both vouchers stay on every list and
 * in every balance, and net to zero.
 *
 * notes (54): a Receipt Voucher that took instruments is cancelled only while
 * every cheque of it is still HELD (`VCH_CHEQUE_MOVED` otherwise — a cheque
 * that has left the drawer is unwound on the Received Cheques screen first).
 * Its HELD register rows go CANCELLED, its tender rows are retired, and every
 * post-dated cheque's own voucher is reversed with it, in the same transaction.
 */
@Injectable()
export class VoucherCancelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly register: VoucherRegisterService,
    private readonly types: VoucherTypesService,
    private readonly posting: VoucherPostingService,
    private readonly docRegister: DocRegisterService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async cancel(dto: CancelVoucherDto): Promise<CancelPayload> {
    const userId = this.requestContext.getUserId();
    const actor = userId ?? DEFAULT_ACTOR;
    const reason = dto.reason.trim();
    return this.prisma.$transaction(async (tx) => {
      // 1 · the voucher, locked; the right on ITS type's menu; its state
      const stored = await this.register.lockHeader(tx, dto.voucherId, dto.accYear);
      if (!stored) {
        throwMissing(`No voucher ${dto.voucherId} in ${dto.accYear}`, VCH.NOT_FOUND);
      }
      this.register.assertScope(stored, dto);
      const type = await this.types.loadTypeById(tx, stored.avh_voucher_type_id);
      if (!type || !type.inRegister) {
        throwState(
          'Only a Voucher Register voucher is cancelled here',
          VCH.TYPE_NOT_REGISTER,
          'voucherId',
        );
      }
      const rights = await this.types.rightsFor(tx, userId, type);
      if (!rights.cancel) {
        throwRight('This user may not cancel on this voucher type’s menu', VCH.RIGHT_CANCEL);
      }
      if (stored.avh_voucher_status === 'DRAFT') {
        throwState(`${dto.voucherId} is a DRAFT — delete it instead`, VCH.NOT_POSTED);
      }
      if (stored.avh_voucher_status !== 'POSTED' || stored.avh_reversal_voucher_id) {
        throwState(
          `${stored.avh_voucher_refno ?? dto.voucherId} is already ${stored.avh_voucher_status}`,
          VCH.CANCELLED,
        );
      }
      if (stored.avh_against_voucher_id) {
        // A post-dated cheque's own voucher is part of the voucher that took
        // the cheque; cancelling it alone would leave that one claiming money
        // with no voucher behind it.
        throwState(
          `${stored.avh_voucher_refno ?? dto.voucherId} carries a post-dated cheque of ${stored.against_refno ?? 'another voucher'} — cancel that voucher and both are reversed together`,
          VCH.NOT_POSTED,
        );
      }

      // notes (54): the post-dated cheques' own vouchers, reversed with this one
      const pdcVouchers = await tx.accVoucherHeader.findMany({
        where: {
          ...receiptPdcVoucherWhere({
            avhVoucherId: stored.avh_voucher_id,
            avhVoucherTypeId: stored.avh_voucher_type_id,
          }),
          avhVoucherStatus: 'POSTED',
        },
        select: {
          avhVoucherId: true,
          avhAccYear: true,
          avhVoucherRefno: true,
          avhVoucherDate: true,
          avhPartyId: true,
        },
      });
      const vouchers = [
        {
          voucherId: stored.avh_voucher_id,
          accYear: stored.avh_acc_year,
          refno: stored.avh_voucher_refno,
          date: stored.avh_voucher_date,
        },
        ...pdcVouchers.map((v) => ({
          voucherId: v.avhVoucherId,
          accYear: v.avhAccYear.trim(),
          refno: v.avhVoucherRefno,
          date: v.avhVoucherDate,
        })),
      ];

      // the calendar, as of the cancel date (today) and each voucher's own year
      const today = new Date().toISOString().slice(0, 10);
      for (const v of vouchers) {
        const [fy] = await tx.$queryRaw<{ fy_status: string; fy_lock_date: Date | null }[]>`
          SELECT fy_status, fy_lock_date FROM public.fiscal_years
           WHERE comp_id = ${stored.avh_company_id}::uuid AND fy_year_name = ${v.accYear}::char(9)
             AND is_deleted = false LIMIT 1`;
        if (fy && fy.fy_status.trim().toUpperCase() !== 'OPEN') {
          throwRefused(
            `Accounting year ${v.accYear} is ${fy.fy_status.trim()}`,
            VCH.YEAR_CLOSED,
            'accYear',
          );
        }
        const lock = fy?.fy_lock_date ? fy.fy_lock_date.toISOString().slice(0, 10) : null;
        const voucherDate = v.date.toISOString().slice(0, 10);
        if (lock && (today <= lock || voucherDate <= lock)) {
          throwRefused(`${v.accYear} is locked up to ${lock}`, VCH.PERIOD_LOCKED, 'voucherId');
        }
        await assertVoucherPartitionExists(tx, v.accYear, 'accYear');
      }

      // 2 · a bill this voucher raised, settled by somebody else → release it there first
      // …on today's voucher, or — notes (57) — on a post-dated cheque's own,
      // where that line's advance is kept.
      const elsewhere = (
        await Promise.all(vouchers.map((v) => otherVoucherOnRaisedBills(tx, v.voucherId, v.accYear)))
      ).flat();
      if (elsewhere.length > 0) {
        const who = elsewhere
          .map((e) => `${e.voucherRefno ?? 'another voucher'} (bill ${e.billRefno})`)
          .join(', ');
        throwState(
          `${stored.avh_voucher_refno} raised a bill that ${who} has already settled against — release that allocation first`,
          VCH.ALLOCATED_ELSEWHERE,
        );
      }

      // notes (54): every cheque of this voucher must still be in the drawer
      const chequeFilter = await receiptChequeFilter(tx, {
        receiptVoucherId: stored.avh_voucher_id,
        voucherIds: vouchers.map((v) => v.voucherId),
      });
      const moved = await tx.accPdcRegister.findMany({
        where: { ...chequeFilter, apdIsDeleted: false, apdStatus: { not: 'HELD' } },
        select: { apdInstrumentNo: true, apdStatus: true, apdTraType: true },
      });
      if (moved.length > 0) {
        // notes (55): a payment's cheque is ours, and lives on Issued Cheques
        const screen =
          moved[0].apdTraType.trim() === 'P'
            ? 'Issued Cheques screen (menu 52)'
            : 'Received Cheques screen (menu 51)';
        throwState(
          `Cheque ${moved[0].apdInstrumentNo} is ${moved[0].apdStatus}. Once an instrument has left the drawer the voucher behind it cannot be unmade — unwind it on the ${screen} first`,
          VCH.CHEQUE_MOVED,
        );
      }

      // the TDS row: a deduction already deposited by challan is a 26Q revision, not a cancel
      const tdsRows = await tx.$queryRaw<
        {
          atd_id: string;
          atd_challan_no: string | null;
          atd_base_amount: Prisma.Decimal;
          atd_tax_amount: Prisma.Decimal;
        }[]
      >`
        SELECT t.atd_id, t.atd_challan_no, t.atd_base_amount, t.atd_tax_amount
          FROM accounts.acc_tds_register t
         WHERE t.atd_voucher_id = ${stored.avh_voucher_id}::uuid
           AND t.atd_voucher_acc_year = ${stored.avh_acc_year}::char(9)
           AND t.atd_is_deleted = false AND t.atd_reversal_of_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                            WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`;
      const deposited = tdsRows.find((r) => r.atd_challan_no);
      if (deposited) {
        throwState(
          `The TDS on ${stored.avh_voucher_refno} was deposited under challan ${deposited.atd_challan_no} — correct it with a 26Q revision, not a cancel`,
          VCH.TDS_DEPOSITED,
        );
      }

      // the GST document: an IRN on it is the e-invoice screen's to cancel
      const gdrId = await this.docRegister.registerIdOfVoucher(
        tx,
        stored.avh_voucher_id,
        stored.avh_acc_year,
      );
      if (gdrId) {
        const [irn] = await tx.$queryRaw<{ gde_irn: string | null; gde_status: string }[]>`
          SELECT gde_irn, gde_status::text AS gde_status FROM accounts.acc_voucher_doc_einvoice
           WHERE gde_gdr_id = ${gdrId}::uuid AND gde_acc_year = ${stored.avh_acc_year}::char(9)
           LIMIT 1`;
        if (
          irn?.gde_irn &&
          !['CANCELLED', 'CANCELED', 'NA'].includes(irn.gde_status.toUpperCase())
        ) {
          throwState(
            `${stored.avh_voucher_refno} carries IRN ${irn.gde_irn} — cancel it on the e-invoice screen first`,
            VCH.IRN_LIVE,
          );
        }
      }

      // 4 · the reversal voucher(s): the lifted reverseLegs, as it is (type Rev,
      //     its own series, dated the original, linked both ways; the original
      //     goes CANCELLED first). Today's voucher, then each post-dated one.
      const now = new Date();
      const touched: BillKey[] = [];
      let allocationsReversed = 0;
      const mirrors: { of: string; accYear: string; mirrorId: string }[] = [];
      for (const v of vouchers) {
        const mirror = await this.posting.reverseLegs(tx, v.voucherId, v.accYear, reason, actor);
        if (!mirror) {
          throwState(`${v.refno ?? v.voucherId} is already reversed`, VCH.CANCELLED);
        }
        await tx.$executeRaw`
          UPDATE accounts.acc_voucher_header
             SET avh_status_by = ${actor}::uuid
           WHERE avh_voucher_id = ${v.voucherId}::uuid AND avh_acc_year = ${v.accYear}::char(9)`;
        mirrors.push({ of: v.voucherId, accYear: v.accYear, mirrorId: mirror.voucherId });

        // 3 · its own allocations reversed by counter-rows, never deleted
        const reversed = await reverseVoucherAllocations(tx, {
          voucherId: v.voucherId,
          accYear: v.accYear,
          reversalVoucherId: mirror.voucherId,
          reason,
          actor,
          now,
        });
        allocationsReversed += reversed.count;
        touched.push(...reversed.touched);
      }
      if (touched.length > 0) {
        await this.recompute.recomputeBills(tx, touched, now);
      }
      // the raised bill closed — and, notes (57), the ADVANCE a remainder
      // kept, on today's voucher or on a post-dated cheque's own
      let closed = 0;
      for (const v of vouchers) {
        closed += await tx.$executeRaw`
          UPDATE accounts.acc_bill_balance
             SET abl_is_deleted = true, abl_is_active = false,
                 abl_modified_on = ${now}, abl_modified_by = ${actor}
           WHERE abl_voucher_id = ${v.voucherId}::uuid AND abl_acc_year = ${v.accYear}::char(9)
             AND abl_is_deleted = false`;
      }

      // notes (54): the cheques → CANCELLED (ux_apd_instrument then frees the
      // number for a re-entry); the tender rows retired
      const held = await tx.accPdcRegister.findMany({
        where: { ...chequeFilter, apdIsDeleted: false, apdStatus: 'HELD' },
        select: { apdId: true, apdAccYear: true },
      });
      for (const c of held) {
        await tx.accPdcRegister.update({
          where: { apdId_apdAccYear: { apdId: c.apdId, apdAccYear: c.apdAccYear } },
          data: {
            apdStatus: 'CANCELLED',
            apdCancelReason: reason.slice(0, 250),
            apdCancelDate: now,
            apdStatusOn: now,
            apdStatusBy: actor,
            apdModifiedOn: now,
            apdModifiedBy: actor,
          },
        });
      }
      await tx.accTenderDetail.updateMany({
        where: { tdSrcDocId: stored.avh_voucher_id, tdIsDeleted: false },
        data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
      });

      // 5 · the GST document
      let gstDocCancelled = false;
      if (gdrId) {
        gstDocCancelled =
          (await this.docRegister.cancel(tx, gdrId, stored.avh_acc_year, reason, actor)) > 0;
      }

      // 6 · the TDS register: a reversal row per live row, never a delete
      const todayMirror = mirrors[0].mirrorId;
      for (const t of tdsRows) {
        await tx.$executeRaw`
          INSERT INTO accounts.acc_tds_register (
            atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
            atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
            atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
            atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_reversal_of_id,
            atd_remarks, atd_created_by
          )
          SELECT o.atd_company_id, o.atd_branch_id, o.atd_tenant_id, o.atd_acc_year, o.atd_quarter, o.atd_direction,
                 o.atd_party_id, o.atd_pan, o.atd_party_name, o.atd_deductee_type, o.atd_section, o.atd_rate,
                 o.atd_rate_source, o.atd_base_amount, -o.atd_tax_amount,
                 ${todayMirror}::uuid, o.atd_voucher_acc_year,
                 o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
                 ${`Reversal of ${stored.avh_voucher_refno ?? ''}: ${reason}`.slice(0, 250)}, ${actor}
            FROM accounts.acc_tds_register o WHERE o.atd_id = ${t.atd_id}::uuid`;
      }

      // 7 · the trail, then the trial-mode books check over every ledger touched
      await appendTxnStatusLog(tx, {
        companyId: stored.avh_company_id,
        branchId: stored.avh_branch_id,
        tenantId: stored.avh_tenant_id,
        accYear: stored.avh_acc_year,
        srcModule: TxnStatusSrcModule.ACCOUNTS,
        srcDocType: statusDocType(type),
        srcDocId: stored.avh_voucher_id,
        srcDocRefno: stored.avh_voucher_refno,
        event: TxnStatusEvent.CANCELLED,
        fromStatus: 'POSTED',
        toStatus: 'CANCELLED',
        changedBy: actor,
        changedOn: now,
        remarks: reason,
      });
      const ledgers = await tx.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT av_ledger_id AS id FROM accounts.acc_vouchers
         WHERE (av_voucher_id, av_acc_year) IN (${Prisma.join(
           vouchers.map((v) => Prisma.sql`(${v.voucherId}::uuid, ${v.accYear}::char(9))`),
         )})`;
      await assertVoucherBooksReconcile(tx, {
        companyId: stored.avh_company_id,
        accYear: stored.avh_acc_year,
        ledgerIds: [stored.avh_party_id, ...ledgers.map((l) => l.id)],
      });

      const [rev] = await tx.$queryRaw<{ avh_voucher_refno: string | null }[]>`
        SELECT avh_voucher_refno FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${todayMirror}::uuid AND avh_acc_year = ${stored.avh_acc_year}::char(9)`;
      return {
        voucherId: stored.avh_voucher_id,
        accYear: stored.avh_acc_year,
        voucherRefno: stored.avh_voucher_refno,
        reversalVoucherId: todayMirror,
        reversalRefno: rev?.avh_voucher_refno ?? null,
        cancelledOn: now.toISOString(),
        billsClosed: closed,
        allocationsReversed,
        gstDocCancelled,
        tdsReversed: tdsRows.length,
        chequesCancelled: held.length,
        pdcVouchersReversed: pdcVouchers.length,
      };
    }, TX);
  }
}
