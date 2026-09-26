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
import { assertBooksReconcile } from '../reconcile/books-reconcile.guard';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import type { CancelPayload } from './types/vouchers-api.types';
import type { CancelVoucherDto } from './dto/voucher-payload.dto';
import { otherVoucherOnRaisedBills, reverseVoucherAllocations } from './voucher-billwise.helper';
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

      // the calendar, as of the cancel date (today) and the original's year
      const today = new Date().toISOString().slice(0, 10);
      const [fy] = await tx.$queryRaw<{ fy_status: string; fy_lock_date: Date | null }[]>`
        SELECT fy_status, fy_lock_date FROM public.fiscal_years
         WHERE comp_id = ${stored.avh_company_id}::uuid AND fy_year_name = ${stored.avh_acc_year}::char(9)
           AND is_deleted = false LIMIT 1`;
      if (fy && fy.fy_status.trim().toUpperCase() !== 'OPEN') {
        throwRefused(
          `Accounting year ${stored.avh_acc_year} is ${fy.fy_status.trim()}`,
          VCH.YEAR_CLOSED,
          'accYear',
        );
      }
      const lock = fy?.fy_lock_date ? fy.fy_lock_date.toISOString().slice(0, 10) : null;
      const voucherDate = stored.avh_voucher_date.toISOString().slice(0, 10);
      if (lock && (today <= lock || voucherDate <= lock)) {
        throwRefused(
          `${stored.avh_acc_year} is locked up to ${lock}`,
          VCH.PERIOD_LOCKED,
          'voucherId',
        );
      }
      await assertVoucherPartitionExists(tx, stored.avh_acc_year, 'accYear');

      // 2 · a bill this voucher raised, settled by somebody else → release it there first
      const elsewhere = await otherVoucherOnRaisedBills(
        tx,
        stored.avh_voucher_id,
        stored.avh_acc_year,
      );
      if (elsewhere.length > 0) {
        const who = elsewhere
          .map((e) => `${e.voucherRefno ?? 'another voucher'} (bill ${e.billRefno})`)
          .join(', ');
        throwState(
          `${stored.avh_voucher_refno} raised a bill that ${who} has already settled against — release that allocation first`,
          VCH.ALLOCATED_ELSEWHERE,
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

      // 4 · the reversal voucher: the lifted reverseLegs, as it is (type Rev, its own series,
      //     dated the original, linked both ways; the original goes CANCELLED first)
      const now = new Date();
      const mirror = await this.posting.reverseLegs(
        tx,
        stored.avh_voucher_id,
        stored.avh_acc_year,
        reason,
        actor,
      );
      if (!mirror) {
        throwState(`${stored.avh_voucher_refno} is already reversed`, VCH.CANCELLED);
      }
      await tx.$executeRaw`
        UPDATE accounts.acc_voucher_header
           SET avh_status_by = ${actor}::uuid
         WHERE avh_voucher_id = ${stored.avh_voucher_id}::uuid AND avh_acc_year = ${stored.avh_acc_year}::char(9)`;

      // 3 · its own allocations reversed by counter-rows, the bills re-derived, the raised bill closed
      const reversed = await reverseVoucherAllocations(tx, {
        voucherId: stored.avh_voucher_id,
        accYear: stored.avh_acc_year,
        reversalVoucherId: mirror.voucherId,
        reason,
        actor,
        now,
      });
      if (reversed.touched.length > 0) {
        await this.recompute.recomputeBills(tx, reversed.touched, now);
      }
      const closed = await tx.$executeRaw`
        UPDATE accounts.acc_bill_balance
           SET abl_is_deleted = true, abl_is_active = false,
               abl_modified_on = ${now}, abl_modified_by = ${actor}
         WHERE abl_voucher_id = ${stored.avh_voucher_id}::uuid AND abl_acc_year = ${stored.avh_acc_year}::char(9)
           AND abl_is_deleted = false`;

      // 5 · the GST document
      let gstDocCancelled = false;
      if (gdrId) {
        gstDocCancelled =
          (await this.docRegister.cancel(tx, gdrId, stored.avh_acc_year, reason, actor)) > 0;
      }

      // 6 · the TDS register: a reversal row per live row, never a delete
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
                 ${mirror.voucherId}::uuid, o.atd_voucher_acc_year,
                 o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
                 ${`Reversal of ${stored.avh_voucher_refno ?? ''}: ${reason}`.slice(0, 250)}, ${actor}
            FROM accounts.acc_tds_register o WHERE o.atd_id = ${t.atd_id}::uuid`;
      }

      // 7 · the trail, then the trial-mode books check
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
      await assertBooksReconcile(tx, {
        companyId: stored.avh_company_id,
        accYear: stored.avh_acc_year,
        ledgerIds: [stored.avh_party_id],
        vouchers: [
          { voucherId: stored.avh_voucher_id, accYear: stored.avh_acc_year },
          { voucherId: mirror.voucherId, accYear: stored.avh_acc_year },
        ],
      });

      const [rev] = await tx.$queryRaw<{ avh_voucher_refno: string | null }[]>`
        SELECT avh_voucher_refno FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${mirror.voucherId}::uuid AND avh_acc_year = ${stored.avh_acc_year}::char(9)`;
      return {
        voucherId: stored.avh_voucher_id,
        accYear: stored.avh_acc_year,
        voucherRefno: stored.avh_voucher_refno,
        reversalVoucherId: mirror.voucherId,
        reversalRefno: rev?.avh_voucher_refno ?? null,
        cancelledOn: now.toISOString(),
        billsClosed: closed,
        allocationsReversed: reversed.count,
        gstDocCancelled,
        tdsReversed: tdsRows.length,
      };
    }, TX);
  }
}
