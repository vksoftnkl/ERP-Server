import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { DEFAULT_ACTOR, throwAccountsConflict } from 'src/common/utils/module-service.utils';
import { flipSide, todayUtc } from '../receipt/receipt.utils';
import { PaymentOpenItemsService } from './payment-open-items.service';
import {
  PaymentService,
  STORED_HEADER_SELECT,
  statusOf,
  type StoredHeader,
} from './payment.service';
import { PaymentPostingService, rethrowAllocationError } from './payment-posting.service';
import {
  assertAdvancesUntouched,
  assertIssuedChequesStillHeld,
  assertNoSettledTransfer,
} from './payment-unwind.guards';
import { paymentChequeFilter, paymentPdcVoucherWhere } from './payment-cheque-links';
import { assertAccYearWritable, assertHeaderScope } from './payment.guards';
import { AmendPaymentDto } from './dto/amend-payment.dto';
import { DrCr, PaymentSettingKey, PdcStatus, VoucherStatus } from './types/payment-enum';
import type { PaymentAmendPayload, PaymentErrorDetail } from './types/payment-api.types';

/**
 * R20 — `POST /payments/amend`, editing a POSTED payment WHOLE, behind
 * `accounts.allow_posted_amend` (default OFF). `receipt-amend.service.ts`
 * step for step; see it for why the header goes back to DRAFT in the middle,
 * why nothing is dropped, and why the party is not amendable.
 *
 * What the payment adds to the unwind: the TDS register rows of the old post
 * are reversed (filed against the payment itself, as the adjustments are),
 * and the re-apply writes a fresh one from the new payload.
 */

const AMEND_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
const AMEND_AUDIT_SCREEN = 'Payment';

interface UnwindTally {
  adjustmentsReversed: number;
  legsRemoved: number;
  pdcVouchersRemoved: number;
  chequesRemoved: number;
  advanceBillsRemoved: number;
  tendersRemoved: number;
  tdsReversed: number;
}

@Injectable()
export class PaymentAmendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly postingService: PaymentPostingService,
    private readonly openItemsService: PaymentOpenItemsService,
    private readonly recompute: BillBalanceRecomputeService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async amend(dto: AmendPaymentDto): Promise<PaymentAmendPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(
        (tx) => this.amendInTransaction(tx, dto, actor),
        AMEND_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      throw rethrowAllocationError(error);
    }
  }

  private async amendInTransaction(
    tx: Prisma.TransactionClient,
    dto: AmendPaymentDto,
    actor: string,
  ): Promise<PaymentAmendPayload> {
    // ── 1 · The payment, locked ────────────────────────────────────────────
    await tx.$queryRaw`
      SELECT avh_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid AND avh_acc_year = ${dto.avhAccYear}::bpchar
         FOR UPDATE`;
    const header = await this.paymentService.loadHeaderOrThrow(
      tx,
      dto.avhVoucherId,
      dto.avhAccYear,
    );
    assertHeaderScope(header, {
      companyId: dto.avhCompanyId,
      branchId: dto.avhBranchId,
      accYear: dto.avhAccYear,
      voucherId: dto.avhVoucherId,
    });
    const settings = await this.openItemsService.loadSettings(
      header.avhCompanyId,
      header.avhBranchId,
    );
    this.assertAmendPermitted(settings.allowPostedAmend);
    this.assertStatusMayAmend(header);
    await this.assertPartyUnchanged(tx, header, dto.avhPartyId);
    this.assertRevisionIsCurrent(header, dto.baseRevision);

    // ── 2 · Everything refused on the FACTS, before anything is written ────
    const pdcHeaders: StoredHeader[] = (
      await tx.accVoucherHeader.findMany({
        where: paymentPdcVoucherWhere(header),
        select: STORED_HEADER_SELECT,
      })
    ).map((row) => ({ ...row, avhPartyId: row.avhPartyId ?? header.avhPartyId }));
    const vouchers = [header, ...pdcHeaders];
    const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
    const years = [...new Set(vouchers.map((voucher) => voucher.avhAccYear))];
    for (const voucher of vouchers) {
      await assertAccYearWritable(tx, voucher.avhCompanyId, voucher.avhAccYear, 'avhAccYear');
    }
    await assertIssuedChequesStillHeld(
      tx,
      { receiptVoucherId: header.avhVoucherId, voucherIds },
      'amended',
    );
    await assertNoSettledTransfer(tx, header.avhVoucherId, 'amended');
    const advanceBills = await assertAdvancesUntouched(tx, voucherIds, years, 'amended');

    // ── 3 · The unwind, in place ───────────────────────────────────────────
    const before = await this.paymentService.loadFullPayment(tx, header);
    const tendersBefore = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      select: { tdId: true },
    });
    const unwound = await this.unwind(tx, {
      header,
      vouchers,
      advanceBills,
      editRemark: dto.editRemark,
      actor,
    });

    // ── 4 · The bills, brought back up to date ─────────────────────────────
    await this.recompute.recomputeBills(tx, unwound.touchedBills, todayUtc());

    // ── 5 · The re-apply, from the NEW payload ─────────────────────────────
    await this.paymentService.saveInTransaction(tx, { ...dto, replace: true }, actor);
    const posted = await this.postingService.postInTransaction(tx, dto, actor);
    const tendersRemoved = await tx.accTenderDetail.count({
      where: { tdId: { in: tendersBefore.map((row) => row.tdId) }, tdIsDeleted: true },
    });

    // ── 6 · The revision, the trail and the audit ──────────────────────────
    const now = new Date();
    const toRevision = header.avhRevisionNo + 1;
    await tx.accVoucherHeader.update({
      where: {
        avhVoucherId_avhAccYear: {
          avhVoucherId: header.avhVoucherId,
          avhAccYear: header.avhAccYear,
        },
      },
      data: { avhRevisionNo: toRevision, avhModifiedOn: now, avhModifiedBy: actor },
    });
    await this.writeTrail(tx, { header, dto, actor, now, toRevision });
    const after = await this.paymentService.loadHeaderOrThrow(
      tx,
      header.avhVoucherId,
      header.avhAccYear,
    );
    const tally: UnwindTally = { ...unwound.tally, tendersRemoved };
    await this.writeAuditRows(tx, { header, after, before, dto, actor, tally, toRevision });

    return {
      ...posted,
      // The header as it stands AFTER the revision moved. `posted.header` was
      // read inside the post, before it, and still says the old revision — a
      // client that sent that back as its next baseRevision would be refused
      // with a 409 for an amend nobody else made.
      header: await this.paymentService.toHeaderPayload(tx, after),
      fromRevision: dto.baseRevision,
      toRevision,
      editRemark: dto.editRemark,
      unwound: tally,
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 1 — the gates a cancel does not have
  // ═════════════════════════════════════════════════════════════════════════

  private assertAmendPermitted(allowed: boolean): void {
    if (allowed) {
      return;
    }
    throwAccountsConflict<PaymentErrorDetail>('Payment cannot be amended', [
      {
        field: PaymentSettingKey.ALLOW_POSTED_AMEND,
        message:
          'Editing a posted payment is switched off for this company ' +
          `(${PaymentSettingKey.ALLOW_POSTED_AMEND} is false). Cancel the payment and re-enter it, ` +
          'or switch the setting on if the person who keys a payment is also the person accountable for it.',
      },
    ]);
  }

  private assertStatusMayAmend(header: StoredHeader): void {
    const status = statusOf(header);
    if (status !== VoucherStatus.POSTED) {
      throwAccountsConflict<PaymentErrorDetail>('Payment cannot be amended', [
        {
          field: 'avhVoucherId',
          message:
            `${header.avhVoucherRefno ?? header.avhVoucherId} is ${status}. Only a POSTED payment is amended` +
            (status === VoucherStatus.DRAFT
              ? ' — a draft is edited with /payments/create.'
              : status === VoucherStatus.CANCELLED
                ? ' — a cancelled payment is history, and re-entering is the way back.'
                : '.'),
        },
      ]);
    }
    if (header.avhAgainstVoucherId) {
      throwAccountsConflict<PaymentErrorDetail>('Payment cannot be amended', [
        {
          field: 'avhVoucherId',
          message:
            'This is a post-dated cheque voucher, not a payment. Amend the payment it belongs to and its ' +
            'cheques are rewritten with it.',
        },
      ]);
    }
  }

  /** The party is not amendable — a payment to the WRONG PARTY is cancelled, not restated. */
  private async assertPartyUnchanged(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    partyId: string,
  ): Promise<void> {
    if (header.avhPartyId === partyId) {
      return;
    }
    const names = await tx.accLedgerMaster.findMany({
      where: { ledId: { in: [header.avhPartyId, partyId] } },
      select: { ledId: true, ledName: true },
    });
    const nameOf = (id: string): string => names.find((row) => row.ledId === id)?.ledName ?? id;
    throwAccountsConflict<PaymentErrorDetail>('Payment cannot be amended', [
      {
        field: 'avhPartyId',
        message:
          `${header.avhVoucherRefno ?? header.avhVoucherId} was paid to "${nameOf(header.avhPartyId)}" and an amend ` +
          `cannot move it to "${nameOf(partyId)}". The payment keeps its number and the supplier's advice ` +
          'carries it — cancel this payment and enter a new one for the right party.',
      },
    ]);
  }

  private assertRevisionIsCurrent(header: StoredHeader, baseRevision: number): void {
    if (header.avhRevisionNo === baseRevision) {
      return;
    }
    throwAccountsConflict<PaymentErrorDetail>('Payment cannot be amended', [
      {
        field: 'baseRevision',
        message:
          `This payment has been amended since you opened it (now revision ${header.avhRevisionNo}, ` +
          `you sent ${baseRevision}). Reload it and make the change again.`,
      },
    ]);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 3 — the unwind
  // ═════════════════════════════════════════════════════════════════════════

  private async unwind(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      vouchers: readonly StoredHeader[];
      advanceBills: ReadonlyArray<{ ablId: string; ablAccYear: string }>;
      editRemark: string;
      actor: string;
    },
  ): Promise<{
    tally: Omit<UnwindTally, 'tendersRemoved'>;
    touchedBills: Array<{ billId: string; accYear: string }>;
  }> {
    const { header, vouchers, actor } = params;
    const now = new Date();
    const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);

    // a · out of POSTED, so the legs may go
    for (const voucher of vouchers) {
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: voucher.avhVoucherId,
            avhAccYear: voucher.avhAccYear,
          },
        },
        data: { avhVoucherStatus: VoucherStatus.DRAFT },
      });
    }
    // b · a negative row per live adjustment
    const adjustmentsReversed = await this.reverseAdjustments(tx, {
      header,
      voucherIds,
      years: [...new Set(vouchers.map((voucher) => voucher.avhAccYear))],
      editRemark: params.editRemark,
      actor,
    });
    // c · the advances, retired
    if (params.advanceBills.length > 0) {
      await tx.accBillBalance.updateMany({
        where: {
          OR: params.advanceBills.map((bill) => ({
            ablId: bill.ablId,
            ablAccYear: bill.ablAccYear,
          })),
        },
        data: { ablIsDeleted: true, ablIsActive: false, ablModifiedOn: now, ablModifiedBy: actor },
      });
    }
    // d · the register rows, CANCELLED — exactly as /cancel leaves them, and
    //     never soft-deleted (notes 62 C1). A leaf is our own stationery: a
    //     deleted row is an unexplained gap in the book on Issued Cheques
    //     (menu 52 lists live rows only), and ux_apd_issued_leaf guards live
    //     rows only, so the database would stop guarding the number. The leaf
    //     stays used; the re-apply takes a fresh one. Only HELD rows reach
    //     here — assertIssuedChequesStillHeld refused anything the bank has seen.
    //     apdAmendedIntoRevision marks the row as this amend's own (notes 63):
    //     the guard skips it, so the payment can still be cancelled or amended
    //     again. Without it the row reads as a cheque stopped on menu 52.
    const chequesRemoved = await tx.accPdcRegister.updateMany({
      where: {
        ...(await paymentChequeFilter(tx, { receiptVoucherId: header.avhVoucherId, voucherIds })),
        apdIsDeleted: false,
        apdStatus: PdcStatus.HELD,
      },
      data: {
        apdStatus: PdcStatus.CANCELLED,
        apdAmendedIntoRevision: header.avhRevisionNo + 1,
        apdCancelReason: `Amended into revision ${header.avhRevisionNo + 1}`,
        apdCancelDate: now,
        apdStatusOn: now,
        apdStatusBy: actor,
        apdModifiedOn: now,
        apdModifiedBy: actor,
      },
    });
    // e · the legs, retired
    const legsRemoved = await tx.accVoucher.updateMany({
      where: { avVoucherId: { in: voucherIds }, avIsDeleted: false },
      data: { avIsDeleted: true, avModifiedOn: now, avModifiedBy: actor },
    });
    // f · the old cheque vouchers, retired
    let pdcVouchersRemoved = 0;
    for (const voucher of vouchers) {
      if (voucher.avhVoucherId === header.avhVoucherId) {
        continue;
      }
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: voucher.avhVoucherId,
            avhAccYear: voucher.avhAccYear,
          },
        },
        data: { avhIsDeleted: true, avhModifiedOn: now, avhModifiedBy: actor },
      });
      pdcVouchersRemoved += 1;
    }
    // g · the TDS register rows of the old post, reversed against the payment
    const tdsReversed = await this.reverseTds(tx, header, params.editRemark, actor);

    const touched = await this.billsTouchedBy(tx, voucherIds);
    return {
      tally: {
        adjustmentsReversed,
        legsRemoved: legsRemoved.count,
        pdcVouchersRemoved,
        chequesRemoved: chequesRemoved.count,
        advanceBillsRemoved: params.advanceBills.length,
        tdsReversed,
      },
      touchedBills: touched,
    };
  }

  private async reverseAdjustments(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      voucherIds: readonly string[];
      years: readonly string[];
      editRemark: string;
      actor: string;
    },
  ): Promise<number> {
    const rows = await tx.accBillAdjustment.findMany({
      where: {
        abjVoucherId: { in: [...params.voucherIds] },
        abjVoucherAccYear: { in: [...params.years] },
        abjIsDeleted: false,
      },
      orderBy: { abjRowNo: 'asc' },
    });
    const alreadyReversed = new Set(
      rows.map((row) => row.abjReversalOfId).filter((id): id is string => id !== null),
    );
    const live = rows.filter(
      (row) => row.abjReversalOfId === null && !alreadyReversed.has(row.abjId),
    );
    if (live.length === 0) {
      return 0;
    }
    const highest = rows.reduce((max, row) => Math.max(max, row.abjRowNo), 0);
    await tx.accBillAdjustment.createMany({
      data: live.map((row, index) => ({
        abjCompanyId: row.abjCompanyId,
        abjBranchId: row.abjBranchId,
        abjTenantId: row.abjTenantId,
        abjAccYear: row.abjAccYear,
        abjBillId: row.abjBillId,
        abjBillAccYear: row.abjBillAccYear,
        abjPartyId: row.abjPartyId,
        abjRowNo: highest + index + 1,
        abjAgainstBillId: row.abjAgainstBillId,
        abjAgainstBillAccYear: row.abjAgainstBillAccYear,
        abjVoucherId: params.header.avhVoucherId,
        abjVoucherAccYear: params.header.avhAccYear,
        abjAdjType: row.abjAdjType,
        abjAdjDate: row.abjAdjDate,
        abjIsPostDated: row.abjIsPostDated,
        abjDrCr: flipSide(row.abjDrCr, DrCr.DR, DrCr.CR),
        abjAmount: row.abjAmount.negated(),
        abjSettlementMode: row.abjSettlementMode,
        abjSettlementLedgerId: row.abjSettlementLedgerId,
        abjTenderId: row.abjTenderId,
        abjTenderAccYear: row.abjTenderAccYear,
        abjChequeId: row.abjChequeId,
        abjChequeAccYear: row.abjChequeAccYear,
        abjApprovedBy: row.abjApprovedBy,
        abjReversalOfId: row.abjId,
        abjReversalReason: `Amended: ${params.editRemark}`.slice(0, 250),
        abjUserId: row.abjUserId,
        abjSessionId: row.abjSessionId,
        abjCreatedBy: params.actor,
      })),
    });
    return live.length;
  }

  /** The old post's TDS rows, reversed in place — the same voucher, a negative tax, `atd_reversal_of_id`. */
  private async reverseTds(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    editRemark: string,
    actor: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ atd_id: string; atd_challan_no: string | null }[]>`
      SELECT t.atd_id, t.atd_challan_no
        FROM accounts.acc_tds_register t
       WHERE t.atd_voucher_id = ${header.avhVoucherId}::uuid
         AND t.atd_voucher_acc_year = ${header.avhAccYear}::char(9)
         AND t.atd_is_deleted = false
         AND t.atd_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                          WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`;
    const deposited = rows.find((row) => row.atd_challan_no);
    if (deposited) {
      throwAccountsConflict<PaymentErrorDetail>('Payment cannot be amended', [
        {
          field: 'avhVoucherId',
          message:
            `The TDS on ${header.avhVoucherRefno} was deposited under challan ${deposited.atd_challan_no} — ` +
            'correct it with a 26Q revision, not an amend',
        },
      ]);
    }
    for (const row of rows) {
      // A reversal negates the TAX and keeps the BASE: ck_atd_base refuses a
      // negative base, ck_atd_reversal_sign wants the tax <= 0, and the annual
      // base (loadTdsAnnualBase) skips a row that has a live reversal. The
      // Voucher Register's cancel writes it the same way.
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
               o.atd_voucher_id, o.atd_voucher_acc_year,
               o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
               ${`Amended: ${editRemark}`.slice(0, 250)}, ${actor}
          FROM accounts.acc_tds_register o WHERE o.atd_id = ${row.atd_id}::uuid`;
    }
    return rows.length;
  }

  private async billsTouchedBy(
    tx: Prisma.TransactionClient,
    voucherIds: readonly string[],
  ): Promise<Array<{ billId: string; accYear: string }>> {
    const rows = await tx.accBillAdjustment.findMany({
      where: { abjVoucherId: { in: [...voucherIds] }, abjIsDeleted: false },
      select: { abjBillId: true, abjBillAccYear: true },
    });
    const seen = new Map<string, { billId: string; accYear: string }>();
    for (const row of rows) {
      seen.set(`${row.abjBillId}|${row.abjBillAccYear}`, {
        billId: row.abjBillId,
        accYear: row.abjBillAccYear,
      });
    }
    return [...seen.values()];
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 6 — the trail and the audit
  // ═════════════════════════════════════════════════════════════════════════

  private async writeTrail(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      dto: AmendPaymentDto;
      actor: string;
      now: Date;
      toRevision: number;
    },
  ): Promise<void> {
    const { header, dto, actor, now } = params;
    const common = {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      tenantId: header.avhTenantId,
      accYear: header.avhAccYear,
      srcModule: TxnStatusSrcModule.ACCOUNTS,
      srcDocType: TxnStatusDocType.PAYMENT,
      srcDocId: header.avhVoucherId,
      srcDocRefno: header.avhVoucherRefno,
      changedBy: actor,
      changedOn: now,
      deviceId: this.requestContext.getDeviceId() ?? header.avhDeviceId,
      sessionId: header.avhSessionId,
    };
    await appendTxnStatusLog(tx, {
      ...common,
      event: TxnStatusEvent.AMENDED,
      fromStatus: VoucherStatus.POSTED,
      toStatus: TxnStatusEvent.AMENDED,
      remarks: dto.editRemark,
    });
    await appendTxnStatusLog(tx, {
      ...common,
      event: TxnStatusEvent.POSTED,
      fromStatus: TxnStatusEvent.AMENDED,
      toStatus: VoucherStatus.POSTED,
      remarks: `Re-posted as revision ${params.toRevision}`,
    });
  }

  private async writeAuditRows(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      after: StoredHeader;
      before: Awaited<ReturnType<PaymentService['loadFullPayment']>>;
      dto: AmendPaymentDto;
      actor: string;
      tally: UnwindTally;
      toRevision: number;
    },
  ): Promise<void> {
    const { header, dto, actor, tally } = params;
    const after = await this.paymentService.loadFullPayment(tx, params.after);
    const displayName = header.avhVoucherRefno ?? header.avhVoucherId;
    const notes =
      `Payment amended to revision ${params.toRevision}: ${dto.editRemark} ` +
      `(${tally.adjustmentsReversed} adjustment(s) reversed, ${tally.legsRemoved} leg(s), ` +
      `${tally.chequesRemoved} cheque(s), ${tally.pdcVouchersRemoved} PDC voucher(s), ` +
      `${tally.advanceBillsRemoved} advance bill(s), ${tally.tdsReversed} TDS row(s), ${tally.tendersRemoved} tender row(s) replaced)`;
    const tables: ReadonlyArray<{ tableName: string; original: unknown; modified: unknown }> = [
      { tableName: 'acc_voucher_header', original: params.before.header, modified: after.header },
      {
        tableName: 'acc_vouchers',
        original: { legs: params.before.legs, pdcVouchers: params.before.pdcVouchers },
        modified: { legs: after.legs, pdcVouchers: after.pdcVouchers },
      },
      {
        tableName: 'acc_bill_adjustment',
        original: {
          allocations: params.before.allocations,
          creditsApplied: params.before.creditsApplied,
          advanceBills: params.before.advanceBills,
        },
        modified: {
          allocations: after.allocations,
          creditsApplied: after.creditsApplied,
          advanceBills: after.advanceBills,
        },
      },
      {
        tableName: 'acc_pdc_register',
        original: { cheques: params.before.chequesIssued, tenders: params.before.tenders },
        modified: { cheques: after.chequesIssued, tenders: after.tenders },
      },
    ];
    for (const table of tables) {
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: table.tableName,
          screenName: AMEND_AUDIT_SCREEN,
          screenType: 'transaction',
          pk: header.avhVoucherId,
          displayName,
          accYear: header.avhAccYear,
          originalRecord: table.original,
          modifiedRecord: table.modified,
          userId: actor,
          branchId: header.avhBranchId,
          notes,
        },
        tx,
      );
    }
  }
}
