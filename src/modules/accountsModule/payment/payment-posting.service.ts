import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { deriveVoucherTotals } from '../accountVoucherHeader/voucher-totals.helper';
import { assertVoucherBooksReconcile } from '../vouchers/voucher-books.helper';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../common/txn-status-log/txn-status-log.helper';
import {
  DEFAULT_ACTOR,
  throwAccountsBadRequest,
  throwAccountsConflict,
} from 'src/common/utils/module-service.utils';
import { takeNextLeaf, type TakenLeaf } from '../vouchers/cheque-book.helper';
import { logChequeStatus } from '../cheques/cheques.utils';
import {
  allocate,
  AllocationError,
  pdcVoucherKey,
  RECEIPT_VOUCHER_KEY,
  type AllocationAdjustment,
  type AllocationBill,
  type AllocationCredit,
  type AllocationResult,
  type VoucherKey,
} from '../receipt/allocation-engine';
import { money, sum, toAmount, toDateString, todayUtc, ZERO } from '../receipt/receipt.utils';
import { PaymentService, statusOf, type StoredHeader } from './payment.service';
import { PaymentOpenItemsService } from './payment-open-items.service';
import { ledgerForRole, requirePaymentRoleLedgers } from './payment-ledger-roles';
import { rehydratePaymentDraft } from './payment-draft-lines';
import {
  normalisePaymentOtherLines,
  normalisePaymentTenders,
  type NormalisedPaymentOtherLine,
  type NormalisedPaymentTender,
} from './payment-lines';
import { loadPaymentTdsFacts, type PaymentTdsComputed } from './payment-tds';
import {
  accYearOf,
  assertAccYearWritable,
  assertHeaderScope,
  assertPayableUsable,
  assertVoucherPartitionExists,
  loadPayee,
  lockBills,
  type PaymentParty,
} from './payment.guards';
import type { PaymentSettings } from './payment.settings';
import { PostPaymentDto } from './dto/post-payment.dto';
import {
  BillType,
  debitRouting,
  DrCr,
  PAYMENT_ADVANCE_SRC_DOC_TYPE,
  PAYMENT_REDUCTION_ROLE,
  PAYMENT_SRC_MODULE,
  PaymentLedgerRole,
  PdcInstrumentType,
  PdcPostingMode,
  PdcStatus,
  PdcTraType,
  VoucherStatus,
} from './types/payment-enum';
import type { PaymentErrorDetail, PaymentPostPayload } from './types/payment-api.types';

/**
 * §5.2 — THE transaction, direction OUT. `receipt-posting.service.ts` step for
 * step; what the payment adds sits where the plan (§5) puts it:
 *
 *   1  lock the payment, refuse a status that may not post
 *   2  re-validate the draft — the payee is not cash / bank, TDS is re-seeded
 *   3  lock every bill and debit named, read what is pending NOW
 *   4–5  the identity and the engine, `direction: 'OUT'`
 *   6  the numbers, the PDC voucher headers
 *   7  the LEAVES — `takeNextLeaf` per cheque row, under the book's row lock,
 *      written onto `td_ref_no`, then the register rows (`apd_tra_type 'P'`)
 *   8  the legs — CR each instrument gross of its charge, DR the party
 *   9  the adjustment rows, the ADVANCE (DR) bills, the instrument links
 *  10  the bill caches, the TDS register row
 *  11  the headers become POSTED — LAST
 *  12  the trail: POSTED on the payment, a step per leaf; then the books check
 */

const POST_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };

interface PlannedVoucher {
  key: VoucherKey;
  tenderRowNo: number | null;
  voucherDate: Date;
  accYear: string;
  docAmount: Prisma.Decimal;
  voucherId: string;
  voucherNo: bigint;
  voucherRefno: string;
}

@Injectable()
export class PaymentPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly openItemsService: PaymentOpenItemsService,
    private readonly recompute: BillBalanceRecomputeService,
  ) {}

  async post(dto: PostPaymentDto): Promise<PaymentPostPayload> {
    const actor = this.requestContext.getUserId() ?? DEFAULT_ACTOR;
    try {
      return await this.prisma.$transaction(
        (tx) => this.postInTransaction(tx, dto, actor),
        POST_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      throw rethrowAllocationError(error);
    }
  }

  /** The steps, inside a transaction the CALLER owns. Public for `/payments/amend`. */
  async postInTransaction(
    tx: Prisma.TransactionClient,
    dto: PostPaymentDto,
    actor: string,
  ): Promise<PaymentPostPayload> {
    // ── 1 · The payment, locked ────────────────────────────────────────────
    await this.lockHeader(tx, dto.avhVoucherId, dto.avhAccYear);
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
    this.assertStatusMayPost(header);

    // ── 2 · Everything §5.1 checked, checked again ─────────────────────────
    await assertAccYearWritable(tx, header.avhCompanyId, header.avhAccYear, 'avhAccYear');
    await assertVoucherPartitionExists(tx, header.avhAccYear, 'avhAccYear');
    await this.paymentService.assertPostable(tx, header, settings);

    const party = await loadPayee(tx, header.avhCompanyId, header.avhPartyId);
    const paymentDate = startOfDay(header.avhVoucherDate);
    const { tenders, otherLines, tds } = await this.rebuildLines(
      tx,
      header,
      paymentDate,
      settings,
      party,
    );

    // ── 3 · Lock every open item, and read what is pending NOW ─────────────
    const locked = await lockBills(tx, [
      ...dto.allocations.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
      ...dto.creditsApplied.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
    ]);
    const bills: AllocationBill[] = dto.allocations.map((row, index) => {
      const bill = assertPayableUsable(locked.get(`${row.billId}|${row.billAccYear}`), {
        billId: row.billId,
        partyId: header.avhPartyId,
        companyId: header.avhCompanyId,
        kind: 'PAYABLE',
        field: `allocations.${index}.billId`,
      });
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        docRefno: bill.ablDocRefno,
        amount: money(row.amount),
        discount: money(row.discount ?? 0),
        writeoff: money(row.writeoff ?? 0),
        roundoff: money(row.roundoff ?? 0),
        pendingAmount: bill.ablPendingAmount,
        writeoffApprovedBy: row.writeoffApprovedBy ?? null,
      };
    });
    const credits: AllocationCredit[] = dto.creditsApplied.map((row, index) => {
      const bill = assertPayableUsable(locked.get(`${row.billId}|${row.billAccYear}`), {
        billId: row.billId,
        partyId: header.avhPartyId,
        companyId: header.avhCompanyId,
        kind: 'DEBIT',
        field: `creditsApplied.${index}.billId`,
      });
      const routing = debitRouting(bill.ablBillType as BillType);
      return {
        billId: bill.ablId,
        billAccYear: bill.ablAccYear,
        billType: bill.ablBillType as BillType,
        docRefno: bill.ablDocRefno,
        amount: money(row.amount),
        pendingAmount: bill.ablPendingAmount,
        adjType: routing.adjType,
        settlementMode: routing.settlementMode,
      };
    });
    this.assertWriteoffsApproved(bills, settings.writeoffApprovalAbove);

    // ── 4 & 5 · The identity and the engine, money OUT ─────────────────────
    const plan = allocate({
      receiptDate: paymentDate,
      direction: 'OUT',
      bills,
      credits,
      otherLines: otherLines.map((line) => ({
        lineNo: line.lineNo,
        role: line.role,
        ledgerId: line.ledgerId,
        drCr: line.drCr,
        amount: line.amount,
        settlesBill: line.settlesBill,
        settlementMode: line.settlementMode,
        isInstrumentSplit: line.isInstrumentSplit,
        // Lands on abj_approved_by: the draft line that held it is cleared at post.
        approvedBy: line.approvedBy,
      })),
      tenders: tenders.map((tender) => ({
        tenderRowNo: tender.rowNo,
        amount: tender.amount,
        isCheque: tender.isCheque,
        isPostDated: tender.isPdc,
        instrumentDate: tender.instrumentDate,
        settlementMode: tender.settlementMode,
      })),
      pins: dto.otherLineBills.map((pin) => ({
        lineNo: pin.lineNo,
        billId: pin.billId,
        billAccYear: pin.billAccYear,
        amount: money(pin.amount),
      })),
      claimedOnAccount: money(dto.onAccount),
    });

    // ── 6 · Vouchers, numbered ─────────────────────────────────────────────
    const vouchers = await this.planVouchers(tx, header, tenders, plan, actor);
    const byKey = new Map(vouchers.map((voucher) => [voucher.key, voucher]));

    // ── 7 · The leaves, then the register rows ─────────────────────────────
    const tenderIdByRow = await this.tenderIdsByRow(tx, header.avhVoucherId);
    const leaves = await this.takeLeaves(tx, header, tenders, tenderIdByRow, actor);
    const registerByTenderRow = await this.writeRegisterRows(tx, {
      header,
      tenders,
      vouchers: byKey,
      leaves,
      paymentDate,
      actor,
      postingMode: settings.pdcPostingMode,
    });

    // ── 8 · The legs ───────────────────────────────────────────────────────
    await this.writeLegs(tx, { header, tenders, otherLines, bills, plan, vouchers: byKey, actor });

    // ── 9 · The adjustment rows, the advances, the instrument links ────────
    await this.writeAdjustments(tx, {
      header,
      plan,
      vouchers: byKey,
      tenderIdByRow,
      registerByTenderRow,
      otherLines,
      actor,
    });
    await this.writeAdvanceBills(tx, { header, plan, vouchers: byKey, actor });
    await this.linkInstruments(tx, {
      header,
      tenders,
      vouchers: byKey,
      tenderIdByRow,
      registerByTenderRow,
    });

    // ── 10 · The bill caches and the TDS register ──────────────────────────
    const touched = [
      ...bills.map((bill) => ({ billId: bill.billId, accYear: bill.billAccYear })),
      ...credits.map((credit) => ({ billId: credit.billId, accYear: credit.billAccYear })),
    ];
    const recomputed = await this.recompute.recomputeBills(tx, touched, todayUtc());
    const paymentVoucher = byKey.get(RECEIPT_VOUCHER_KEY)!;
    if (tds) {
      await this.writeTdsRegister(tx, {
        header,
        party,
        tds,
        refno: paymentVoucher.voucherRefno,
        actor,
      });
    }

    // ── 11 · POSTED, last ──────────────────────────────────────────────────
    await this.postHeaders(tx, { header, vouchers, plan, tenders, actor });

    // ── 12 · The trail ─────────────────────────────────────────────────────
    await appendTxnStatusLog(tx, {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      tenantId: header.avhTenantId,
      accYear: header.avhAccYear,
      srcModule: TxnStatusSrcModule.ACCOUNTS,
      srcDocType: TxnStatusDocType.PAYMENT,
      srcDocId: header.avhVoucherId,
      srcDocRefno: paymentVoucher.voucherRefno,
      event: TxnStatusEvent.POSTED,
      fromStatus: header.avhVoucherStatus,
      toStatus: VoucherStatus.POSTED,
      changedBy: actor,
      deviceId: header.avhDeviceId,
      sessionId: header.avhSessionId,
    });
    const now = new Date();
    for (const tender of tenders.filter((row) => row.isCheque)) {
      const register = registerByTenderRow.get(tender.rowNo);
      const leaf = leaves.get(tender.rowNo);
      if (!register || !leaf) {
        continue;
      }
      await logChequeStatus(
        tx,
        {
          apdId: register.apdId,
          apdAccYear: register.apdAccYear,
          apdCompanyId: header.avhCompanyId,
          apdBranchId: header.avhBranchId,
          apdTenantId: header.avhTenantId,
          apdInstrumentNo: leaf.leaf,
          apdTraType: PdcTraType.PAID,
        },
        {
          fromStatus: null,
          toStatus: PdcStatus.HELD,
          remarks: `Issued on payment ${paymentVoucher.voucherRefno}: leaf ${leaf.leaf} of book ${leaf.bookNo}`,
          actor,
          changedOn: now,
          sessionId: header.avhSessionId,
        },
      );
    }

    // The trial check (notes 47): the party's bills = its ledger, over every
    // ledger the vouchers moved — through the Voucher Register's helper and
    // NOT the shared guard, because the shared guard has no allowance for a
    // post-dated cheque. Its voucher is POSTED today with the cheque's date, so
    // fn_ledger_book_balance already counts it while the bill's post-dated row
    // does not count until the cheque matures: the two sides differ by exactly
    // the un-matured settlement, and the shared guard refused every payment
    // carrying a post-dated cheque with a 422 (notes 54 settled this for the
    // register). With no post-dated row the two checks are the same check.
    const movedLedgers = await tx.accVoucher.findMany({
      where: {
        avVoucherId: { in: vouchers.map((voucher) => voucher.voucherId) },
        avIsDeleted: false,
      },
      select: { avLedgerId: true },
      distinct: ['avLedgerId'],
    });
    await assertVoucherBooksReconcile(tx, {
      companyId: header.avhCompanyId,
      accYear: header.avhAccYear,
      ledgerIds: [header.avhPartyId, ...movedLedgers.map((leg) => leg.avLedgerId)],
    });

    const posted = await this.paymentService.loadHeaderOrThrow(
      tx,
      header.avhVoucherId,
      header.avhAccYear,
    );
    const full = await this.paymentService.loadFullPayment(tx, posted);
    const held = await this.postDatedHeldByBill(tx, touched);

    return {
      ...full,
      numberedVouchers: vouchers.map((voucher) => ({
        voucherId: voucher.voucherId,
        accYear: voucher.accYear,
        voucherRefno: voucher.voucherRefno,
        voucherDate: toDateString(voucher.voucherDate)!,
        docAmount: toAmount(voucher.docAmount),
        adjustAmount: toAmount(plan.adjustAmountByVoucher.get(voucher.key) ?? ZERO),
        isPdcVoucher: voucher.tenderRowNo !== null,
      })),
      billsAfter: recomputed.map((bill) => ({
        billId: bill.billId,
        billAccYear: bill.accYear,
        docRefno:
          bills.find((row) => row.billId === bill.billId)?.docRefno ??
          credits.find((row) => row.billId === bill.billId)?.docRefno ??
          '',
        billAmount: toAmount(bill.billAmount),
        pendingAmount: toAmount(bill.pendingAmount),
        postDatedHeld: toAmount(held.get(`${bill.billId}|${bill.accYear}`) ?? ZERO),
      })),
      totalOnAccount: toAmount(plan.totalOnAccount),
      cheques: tenders
        .filter((tender) => tender.isCheque && leaves.has(tender.rowNo))
        .map((tender) => {
          const leaf = leaves.get(tender.rowNo)!;
          const register = registerByTenderRow.get(tender.rowNo)!;
          return {
            tdRowNo: tender.rowNo,
            apdId: register.apdId,
            apdAccYear: register.apdAccYear,
            leaf: leaf.leaf,
            bookNo: leaf.bookNo,
          };
        }),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 1 — the lock and the gate
  // ═════════════════════════════════════════════════════════════════════════

  private async lockHeader(
    tx: Prisma.TransactionClient,
    voucherId: string,
    accYear: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT avh_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${voucherId}::uuid AND avh_acc_year = ${accYear}::bpchar
         FOR UPDATE`;
  }

  private assertStatusMayPost(header: StoredHeader): void {
    const status = statusOf(header);
    if (status === VoucherStatus.DRAFT) {
      return;
    }
    throwAccountsConflict<PaymentErrorDetail>('Payment cannot be posted', [
      {
        field: 'avhVoucherId',
        message:
          `${header.avhVoucherRefno ?? header.avhVoucherId} is ${status}, and only a DRAFT may be posted.` +
          (status === VoucherStatus.POSTED
            ? ' It has already been posted — cancel it and re-enter if the money was wrong.'
            : ''),
      },
    ]);
  }

  private assertWriteoffsApproved(
    bills: readonly AllocationBill[],
    threshold: Prisma.Decimal,
  ): void {
    bills.forEach((bill, index) => {
      if (bill.writeoff.lessThanOrEqualTo(0)) {
        return;
      }
      if (bill.writeoff.greaterThan(threshold) && !bill.writeoffApprovedBy) {
        throwAccountsBadRequest<PaymentErrorDetail>('Validation failed', [
          {
            field: `allocations.${index}.writeoffApprovedBy`,
            message:
              `Writing back ${bill.writeoff.toFixed(2)} on ${bill.docRefno} needs an approver ` +
              `(accounts.writeoff_approval_above is ${threshold.toFixed(2)})`,
          },
        ]);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 2 — re-validating the draft
  // ═════════════════════════════════════════════════════════════════════════

  private async rebuildLines(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    paymentDate: Date,
    settings: PaymentSettings,
    party: PaymentParty,
  ): Promise<{
    tenders: NormalisedPaymentTender[];
    otherLines: NormalisedPaymentOtherLine[];
    tds: PaymentTdsComputed | null;
  }> {
    const draft = rehydratePaymentDraft(header.avhDraftLines);
    const stored = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
      orderBy: { tdRowNo: 'asc' },
    });

    const tenders = await normalisePaymentTenders(tx, {
      tenders: stored.map((row) => {
        const cheque = draft.cheques[row.tdRowNo];
        const beneficiary = draft.beneficiaries[row.tdRowNo];
        return {
          tdId: row.tdId,
          tdRowNo: row.tdRowNo,
          tdTenderId: row.tdTenderId,
          tdTenderTypeId: row.tdTenderTypeId,
          tdTenderLedgerId: row.tdTenderLedgerId,
          // The columns' Decimals, as they are — never through a float.
          tdAmount: row.tdAmount,
          tdReceivedAmt: row.tdReceivedAmt,
          tdChangeAmt: row.tdChangeAmt,
          tdMdrAmt: row.tdMdrAmt,
          // A cheque's number is the leaf, taken below — never what the row holds.
          tdRefNo: cheque ? null : row.tdRefNo,
          tdBankName: row.tdBankName,
          tdPayerVpa: row.tdPayerVpa,
          tdInstrumentDate: toDateString(row.tdInstrumentDate),
          tdNotes: row.tdNotes,
          cheque: cheque
            ? {
                chequeBookId: cheque.chequeBookId,
                favouring: cheque.favouring,
                acPayee: cheque.acPayee,
                bankBranch: cheque.bankBranch,
                ifsc: cheque.ifsc,
                micr: cheque.micr,
                drawerName: cheque.drawerName,
              }
            : undefined,
          beneficiary: beneficiary
            ? { name: beneficiary.name, accountNo: beneficiary.accountNo, ifsc: beneficiary.ifsc }
            : undefined,
        };
      }),
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      paymentDate,
      partyName: party.ledName,
    });

    const roles = new Set<string>(
      draft.otherLines.map((line) => line.role).filter((role): role is string => role !== null),
    );
    if (tenders.some((tender) => tender.mdrAmt.greaterThan(0))) {
      roles.add(PaymentLedgerRole.BANK_CHARGES);
    }
    if (party.ledIsTdsApplicable) {
      roles.add(PaymentLedgerRole.TDS_PAYABLE);
    }
    const roleLedgers = await requirePaymentRoleLedgers(tx, [...roles], {
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
    });
    const tdsFacts = await loadPaymentTdsFacts(tx, {
      companyId: header.avhCompanyId,
      party,
      accYear: header.avhAccYear,
      date: toDateString(paymentDate)!,
    });

    const { lines, tds } = await normalisePaymentOtherLines(tx, {
      lines: draft.otherLines.map((line) => ({
        role: line.role ?? undefined,
        ledgerId: line.role ? undefined : line.ledgerId,
        drCr: line.drCr,
        amount: line.amount,
        settlesBill: line.settlesBill,
        narration: line.narration,
        approvedBy: line.approvedBy,
      })),
      tenders,
      companyId: header.avhCompanyId,
      branchId: header.avhBranchId,
      party,
      partyId: header.avhPartyId,
      settings,
      tds: tdsFacts,
      ledgerForRole: (role) => {
        const resolved = ledgerForRole(roleLedgers, role);
        return resolved ? { ledgerId: resolved.ledgerId, ledgerName: resolved.ledgerName } : null;
      },
    });
    return { tenders, otherLines: lines, tds };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 6 — the vouchers
  // ═════════════════════════════════════════════════════════════════════════

  private async planVouchers(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    tenders: readonly NormalisedPaymentTender[],
    plan: AllocationResult,
    actor: string,
  ): Promise<PlannedVoucher[]> {
    const vouchers: PlannedVoucher[] = [];
    const number = header.avhVoucherRefno
      ? {
          voucherNo: header.avhVoucherNo!,
          voucherSlno: header.avhVoucherSlno!,
          voucherRefno: header.avhVoucherRefno,
        }
      : await this.paymentService.allocateNumber(tx, {
          companyId: header.avhCompanyId,
          branchId: header.avhBranchId,
          accYear: header.avhAccYear,
          voucherTypeId: header.avhVoucherTypeId,
          voucherDate: header.avhVoucherDate,
        });
    if (!header.avhVoucherRefno) {
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: {
            avhVoucherId: header.avhVoucherId,
            avhAccYear: header.avhAccYear,
          },
        },
        data: {
          avhVoucherNo: number.voucherNo,
          avhVoucherSlno: number.voucherSlno,
          avhVoucherRefno: number.voucherRefno,
        },
      });
    }
    vouchers.push({
      key: RECEIPT_VOUCHER_KEY,
      tenderRowNo: null,
      voucherDate: header.avhVoucherDate,
      accYear: header.avhAccYear,
      docAmount: sum(tenders.filter((tender) => !tender.isPdc).map((tender) => tender.amount)),
      voucherId: header.avhVoucherId,
      voucherNo: number.voucherNo,
      voucherRefno: number.voucherRefno,
    });

    for (const tender of tenders.filter((row) => row.isPdc)) {
      const voucherDate = tender.instrumentDate!;
      const accYear = accYearOf(voucherDate);
      await assertAccYearWritable(tx, header.avhCompanyId, accYear, 'tenders.tdInstrumentDate');
      await assertVoucherPartitionExists(tx, accYear, 'tenders.tdInstrumentDate');
      const pdcNumber = await this.paymentService.allocateNumber(tx, {
        companyId: header.avhCompanyId,
        branchId: header.avhBranchId,
        accYear,
        voucherTypeId: header.avhVoucherTypeId,
        voucherDate,
      });
      const created = await tx.accVoucherHeader.create({
        data: {
          avhCompanyId: header.avhCompanyId,
          avhBranchId: header.avhBranchId,
          avhTenantId: header.avhTenantId,
          avhAccYear: accYear,
          avhVoucherTypeId: header.avhVoucherTypeId,
          avhVoucherNo: pdcNumber.voucherNo,
          avhVoucherSlno: pdcNumber.voucherSlno,
          avhVoucherRefno: pdcNumber.voucherRefno,
          avhVoucherDate: voucherDate,
          avhPartyId: header.avhPartyId,
          avhEmployeeId: header.avhEmployeeId,
          avhDocAmount: tender.amount,
          avhUsrRefno: header.avhUsrRefno,
          avhRemarks: `Post-dated ${tender.tenderName} on payment ${number.voucherRefno}`.trim(),
          avhAgainstVoucherId: header.avhVoucherId,
          avhAgainstAccYear: header.avhAccYear,
          avhDeviceType: header.avhDeviceType,
          avhDeviceId: header.avhDeviceId,
          avhSessionId: header.avhSessionId,
          avhUserId: header.avhUserId,
          avhVoucherStatus: VoucherStatus.DRAFT,
          avhCreatedBy: actor,
        },
        select: { avhVoucherId: true },
      });
      vouchers.push({
        key: pdcVoucherKey(tender.rowNo),
        tenderRowNo: tender.rowNo,
        voucherDate,
        accYear,
        docAmount: tender.amount,
        voucherId: created.avhVoucherId,
        voucherNo: pdcNumber.voucherNo,
        voucherRefno: pdcNumber.voucherRefno,
      });
    }

    for (const key of plan.partyCreditByVoucher.keys()) {
      if (!vouchers.some((voucher) => voucher.key === key)) {
        throwAccountsBadRequest<PaymentErrorDetail>('Allocation could not be completed', [
          {
            field: 'tenders',
            message: `The allocation names a voucher "${key}" that has no instrument`,
          },
        ]);
      }
    }
    return vouchers;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 7 — the leaves and the register
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * notes (55) §5.2 step 6 — each cheque row takes its book's next leaf HERE,
   * under the book's row lock, in tender-row order. Two concurrent posts on one
   * book wait on each other and get consecutive leaves; a rolled-back post
   * gives its leaf back with everything else. The leaf becomes the cheque's
   * number on the tender row from now on.
   */
  private async takeLeaves(
    tx: Prisma.TransactionClient,
    header: StoredHeader,
    tenders: readonly NormalisedPaymentTender[],
    tenderIdByRow: ReadonlyMap<number, string>,
    actor: string,
  ): Promise<Map<number, TakenLeaf>> {
    const leaves = new Map<number, TakenLeaf>();
    for (const tender of tenders.filter((row) => row.isCheque && row.cheque)) {
      const taken = await takeNextLeaf(tx, tender.cheque!.chequeBookId, actor);
      if (!taken) {
        throwAccountsConflict<PaymentErrorDetail>('Cheque book has no leaf to give', [
          {
            field: `tenders.${tender.rowNo}.cheque.chequeBookId`,
            message: `Book ${tender.cheque!.bookNo} has no leaf left — start a new book (Cheque Books, menu 263)`,
          },
        ]);
      }
      leaves.set(tender.rowNo, taken);
      const tenderId = tenderIdByRow.get(tender.rowNo);
      if (tenderId) {
        await tx.$executeRaw`
          UPDATE accounts.acc_tender_detail
             SET td_ref_no = ${taken.leaf}, td_bank_name = ${tender.cheque!.bankName.slice(0, 150)}
           WHERE td_id = ${tenderId}::uuid AND td_acc_year = ${header.avhAccYear}::char(9)`;
      }
    }
    return leaves;
  }

  /** One `acc_pdc_register` row per cheque we issue — `apd_tra_type 'P'`, the row Issued Cheques (52) works on. */
  private async writeRegisterRows(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      tenders: readonly NormalisedPaymentTender[];
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      leaves: ReadonlyMap<number, TakenLeaf>;
      paymentDate: Date;
      actor: string;
      postingMode: PdcPostingMode;
    },
  ): Promise<Map<number, { apdId: string; apdAccYear: string }>> {
    const written = new Map<number, { apdId: string; apdAccYear: string }>();
    const now = new Date();
    for (const tender of params.tenders.filter((row) => row.isCheque && row.cheque)) {
      const voucher = tender.isPdc
        ? params.vouchers.get(pdcVoucherKey(tender.rowNo))!
        : params.vouchers.get(RECEIPT_VOUCHER_KEY)!;
      const leaf = params.leaves.get(tender.rowNo)!;
      const cheque = tender.cheque!;
      const created = await tx.accPdcRegister.create({
        data: {
          apdCompanyId: params.header.avhCompanyId,
          apdBranchId: params.header.avhBranchId,
          apdTenantId: params.header.avhTenantId,
          apdAccYear: voucher.accYear,
          apdTraType: PdcTraType.PAID,
          apdPartyId: params.header.avhPartyId,
          apdSalesmanId: params.header.avhEmployeeId[0] ?? null,
          apdInstrumentType: PdcInstrumentType.CHEQUE,
          apdInstrumentNo: leaf.leaf,
          apdInstrumentDate: tender.instrumentDate!,
          apdAmount: tender.amount,
          apdBankName: cheque.bankName,
          apdBankBranch: cheque.bankBranch,
          apdIfsc: cheque.ifsc,
          apdMicr: cheque.micr,
          apdDrawerName: cheque.drawerName,
          // issued on
          apdReceivedOn: params.paymentDate,
          // the account it is drawn on
          apdBankLedgerId: cheque.bankLedgerId,
          apdChequeBookId: cheque.chequeBookId,
          apdFavouring: cheque.favouring,
          apdAcPayee: cheque.acPayee,
          apdPostingMode: params.postingMode,
          apdVoucherId: voucher.voucherId,
          apdVoucherAccYear: voucher.accYear,
          apdStatus: PdcStatus.HELD,
          apdStatusOn: now,
          apdStatusBy: params.actor,
          apdCreatedBy: params.actor,
        },
        select: { apdId: true, apdAccYear: true },
      });
      written.set(tender.rowNo, created);
    }
    return written;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 8 — the legs
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * §5.6, per voucher: CR each instrument for its full amount (the bank pays
   * gross of its charge; BANK_CHARGES is the DR half), the other-ledger band
   * (DR the extras, CR the deductions), CR the three reductions, and ONE DR
   * party leg whose amount the engine derived from the bill side.
   */
  private async writeLegs(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      tenders: readonly NormalisedPaymentTender[];
      otherLines: readonly NormalisedPaymentOtherLine[];
      bills: readonly AllocationBill[];
      plan: AllocationResult;
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      actor: string;
    },
  ): Promise<void> {
    const { header, plan, vouchers } = params;
    for (const voucher of vouchers.values()) {
      const rows: Prisma.AccVoucherUncheckedCreateInput[] = [];
      let rowNo = 1;
      const push = (
        drCr: DrCr,
        ledgerId: string,
        amount: Prisma.Decimal,
        role: string | null,
        remarks: string | null,
      ): void => {
        if (amount.lessThanOrEqualTo(0)) {
          return;
        }
        rows.push({
          avVoucherId: voucher.voucherId,
          avCompanyId: header.avhCompanyId,
          avBranchId: header.avhBranchId,
          avTenantId: header.avhTenantId,
          avAccYear: voucher.accYear,
          avVoucherTypeId: header.avhVoucherTypeId,
          avVoucherNo: voucher.voucherNo,
          avRowNo: rowNo++,
          avVoucherDate: voucher.voucherDate,
          avVoucherRefno: voucher.voucherRefno,
          avDrCr: drCr,
          avLedgerId: ledgerId,
          avAmount: amount,
          avRole: role,
          avRemarks: remarks,
          avSessionId: header.avhSessionId,
          avUserId: header.avhUserId,
          avCreatedBy: params.actor,
        });
      };

      // ONE DR party leg first, so the daybook reads "paid to X" before the money.
      push(
        DrCr.DR,
        header.avhPartyId,
        plan.partyCreditByVoucher.get(voucher.key) ?? ZERO,
        null,
        null,
      );

      if (voucher.tenderRowNo === null) {
        for (const line of params.otherLines) {
          push(line.drCr, line.ledgerId, line.amount, line.role, line.narration);
        }
        await this.pushReduction(
          tx,
          push,
          params,
          PAYMENT_REDUCTION_ROLE.discount,
          (bill) => bill.discount,
        );
        await this.pushReduction(
          tx,
          push,
          params,
          PAYMENT_REDUCTION_ROLE.writeoff,
          (bill) => bill.writeoff,
        );
        await this.pushReduction(
          tx,
          push,
          params,
          PAYMENT_REDUCTION_ROLE.roundoff,
          (bill) => bill.roundoff,
        );
      }

      const tendersHere = params.tenders.filter((tender) =>
        voucher.tenderRowNo === null ? !tender.isPdc : tender.rowNo === voucher.tenderRowNo,
      );
      for (const tender of tendersHere) {
        push(
          DrCr.CR,
          tender.clearingLedgerId ?? tender.tenderLedgerId,
          tender.amount,
          null,
          tender.refNo ? `${tender.tenderName} ${tender.refNo}` : tender.tenderName,
        );
      }

      if (rows.length > 0) {
        await tx.accVoucher.createMany({ data: rows });
      }
    }
  }

  private async pushReduction(
    tx: Prisma.TransactionClient,
    push: (
      drCr: DrCr,
      ledgerId: string,
      amount: Prisma.Decimal,
      role: string | null,
      remarks: string | null,
    ) => void,
    params: { bills: readonly AllocationBill[]; header: StoredHeader },
    role: PaymentLedgerRole,
    pick: (bill: AllocationBill) => Prisma.Decimal,
  ): Promise<void> {
    const total = sum(params.bills.map(pick));
    if (total.lessThanOrEqualTo(0)) {
      return;
    }
    const resolved = await requirePaymentRoleLedgers(tx, [role], {
      companyId: params.header.avhCompanyId,
      branchId: params.header.avhBranchId,
    });
    const ledger = ledgerForRole(resolved, role)!;
    // A reduction of what we owe is INCOME — CR, the mirror of the receipt's DR.
    push(DrCr.CR, ledger.ledgerId, total, role, null);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 9 — the adjustment rows, the advances, the links
  // ═════════════════════════════════════════════════════════════════════════

  private async writeAdjustments(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      plan: AllocationResult;
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      tenderIdByRow: ReadonlyMap<number, string>;
      registerByTenderRow: ReadonlyMap<number, { apdId: string; apdAccYear: string }>;
      otherLines: readonly NormalisedPaymentOtherLine[];
      actor: string;
    },
  ): Promise<void> {
    const { header, plan } = params;
    const ledgerByLineNo = new Map(params.otherLines.map((line) => [line.lineNo, line.ledgerId]));
    const rowNoByVoucher = new Map<VoucherKey, number>();
    const rows: Prisma.AccBillAdjustmentUncheckedCreateInput[] = plan.adjustments.map(
      (adjustment: AllocationAdjustment) => {
        const voucher = params.vouchers.get(adjustment.voucherKey)!;
        const rowNo = (rowNoByVoucher.get(adjustment.voucherKey) ?? 0) + 1;
        rowNoByVoucher.set(adjustment.voucherKey, rowNo);
        const register =
          adjustment.tenderRowNo === null
            ? undefined
            : params.registerByTenderRow.get(adjustment.tenderRowNo);
        return {
          abjCompanyId: header.avhCompanyId,
          abjBranchId: header.avhBranchId,
          abjTenantId: header.avhTenantId,
          abjAccYear: voucher.accYear,
          abjBillId: adjustment.billId,
          abjBillAccYear: adjustment.billAccYear,
          abjPartyId: header.avhPartyId,
          abjRowNo: rowNo,
          abjAgainstBillId: adjustment.againstBill?.billId ?? null,
          abjAgainstBillAccYear: adjustment.againstBill?.billAccYear ?? null,
          abjVoucherId: voucher.voucherId,
          abjVoucherAccYear: voucher.accYear,
          abjAdjType: adjustment.adjType,
          abjAdjDate: adjustment.adjDate,
          abjDrCr: adjustment.drCr,
          abjAmount: adjustment.amount,
          abjSettlementMode: adjustment.settlementMode,
          abjSettlementLedgerId:
            adjustment.otherLineNo === null
              ? null
              : (ledgerByLineNo.get(adjustment.otherLineNo) ?? null),
          abjTenderId:
            adjustment.tenderRowNo === null
              ? null
              : (params.tenderIdByRow.get(adjustment.tenderRowNo) ?? null),
          abjTenderAccYear: adjustment.tenderRowNo === null ? null : header.avhAccYear,
          abjChequeId: register?.apdId ?? null,
          abjChequeAccYear: register?.apdAccYear ?? null,
          abjIsPostDated: adjustment.isPostDated,
          abjApprovedBy: adjustment.approvedBy,
          abjRemarks: adjustment.remarks,
          abjUserId: header.avhUserId,
          abjSessionId: header.avhSessionId,
          abjCreatedBy: params.actor,
        };
      },
    );
    if (rows.length > 0) {
      await tx.accBillAdjustment.createMany({ data: rows });
    }
  }

  /**
   * R7, mirrored — a remainder is ALWAYS an ADVANCE bill, DR on the party: what
   * the supplier now holds of ours, which the next purchase bill's adjust
   * panel spends. On the party's own account, not on an ADVANCE_PAID ledger:
   * the party leg already carries it, and a leg elsewhere would leave the
   * party's ledger short of its bills (see the README).
   */
  private async writeAdvanceBills(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      plan: AllocationResult;
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      actor: string;
    },
  ): Promise<void> {
    for (const entry of params.plan.onAccount) {
      if (entry.amount.lessThanOrEqualTo(0)) {
        continue;
      }
      const voucher = params.vouchers.get(entry.voucherKey)!;
      await tx.accBillBalance.create({
        data: {
          ablCompanyId: params.header.avhCompanyId,
          ablBranchId: params.header.avhBranchId,
          ablTenantId: params.header.avhTenantId,
          ablAccYear: voucher.accYear,
          ablPartyId: params.header.avhPartyId,
          ablSalesmanId: params.header.avhEmployeeId[0] ?? null,
          ablBillType: BillType.ADVANCE,
          ablSrcModule: PAYMENT_SRC_MODULE,
          ablSrcDocType: PAYMENT_ADVANCE_SRC_DOC_TYPE,
          ablSrcDocId: voucher.voucherId,
          ablSrcAccYear: voucher.accYear,
          ablVoucherId: voucher.voucherId,
          ablVoucherTypeId: params.header.avhVoucherTypeId,
          ablVoucherNo: voucher.voucherNo,
          ablVoucherDate: voucher.voucherDate,
          ablVoucherRefno: voucher.voucherRefno,
          ablDocRefno: voucher.voucherRefno,
          ablDocDate: voucher.voucherDate,
          ablDueDate: null,
          // DR — the party owes us. The side is what keeps this off the
          // payables list and on the held-debits list.
          ablDrCr: DrCr.DR,
          ablBillAmount: entry.amount,
          ablNarration: `Advance paid on payment ${voucher.voucherRefno}`,
          ablCreatedBy: params.actor,
        },
      });
    }
  }

  private async linkInstruments(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      tenders: readonly NormalisedPaymentTender[];
      vouchers: ReadonlyMap<VoucherKey, PlannedVoucher>;
      tenderIdByRow: ReadonlyMap<number, string>;
      registerByTenderRow: ReadonlyMap<number, { apdId: string; apdAccYear: string }>;
    },
  ): Promise<void> {
    for (const tender of params.tenders) {
      const voucher = tender.isPdc
        ? params.vouchers.get(pdcVoucherKey(tender.rowNo))!
        : params.vouchers.get(RECEIPT_VOUCHER_KEY)!;
      const tenderId = params.tenderIdByRow.get(tender.rowNo);
      if (!tenderId) {
        continue;
      }
      await tx.accTenderDetail.update({
        where: { tdId_tdAccYear: { tdId: tenderId, tdAccYear: params.header.avhAccYear } },
        data: { tdVoucherId: voucher.voucherId },
      });
      const register = params.registerByTenderRow.get(tender.rowNo);
      if (register) {
        await tx.accPdcRegister.update({
          where: { apdId_apdAccYear: { apdId: register.apdId, apdAccYear: register.apdAccYear } },
          data: { apdTenderId: tenderId },
        });
      }
    }
  }

  private async tenderIdsByRow(
    tx: Prisma.TransactionClient,
    voucherId: string,
  ): Promise<Map<number, string>> {
    const rows = await tx.accTenderDetail.findMany({
      where: { tdSrcDocId: voucherId, tdIsDeleted: false },
      select: { tdId: true, tdRowNo: true },
    });
    return new Map(rows.map((row) => [row.tdRowNo, row.tdId]));
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 10 — the TDS register
  // ═════════════════════════════════════════════════════════════════════════

  /** One DEDUCTED row per payment — a below-threshold row too: it is what the annual threshold counts. */
  private async writeTdsRegister(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      party: PaymentParty;
      tds: PaymentTdsComputed;
      refno: string;
      actor: string;
    },
  ): Promise<void> {
    const { header, party, tds } = params;
    const date = toDateString(header.avhVoucherDate)!;
    await tx.$executeRaw`
      INSERT INTO accounts.acc_tds_register (
        atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
        atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
        atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
        atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_remarks, atd_created_by
      ) VALUES (
        ${header.avhCompanyId}::uuid, ${header.avhBranchId}::uuid, ${header.avhTenantId}::uuid,
        ${header.avhAccYear}::char(9), ${quarterOf(date)}::bpchar, 'DEDUCTED',
        ${party.ledId}::uuid, ${party.ledPanNo}, ${party.ledName.slice(0, 150)},
        ${tds.registerDeductee}, ${tds.section}, ${tds.rate.toFixed(3)}::numeric,
        ${tds.rateSource}, ${tds.base.toFixed(2)}::numeric, ${tds.tax.toFixed(2)}::numeric,
        ${header.avhVoucherId}::uuid, ${header.avhAccYear}::char(9),
        ${params.refno.slice(0, 50)}, ${date}::date,
        NULL, NULL,
        ${tds.reason?.slice(0, 250) ?? null}, ${params.actor}
      )`;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  Step 11 — POSTED, last
  // ═════════════════════════════════════════════════════════════════════════

  private async postHeaders(
    tx: Prisma.TransactionClient,
    params: {
      header: StoredHeader;
      vouchers: readonly PlannedVoucher[];
      plan: AllocationResult;
      tenders: readonly NormalisedPaymentTender[];
      actor: string;
    },
  ): Promise<void> {
    const now = new Date();
    for (const voucher of params.vouchers) {
      const totals = await deriveVoucherTotals(tx, voucher.voucherId, voucher.accYear);
      if (!totals.difference.isZero()) {
        throwAccountsBadRequest<PaymentErrorDetail>('The voucher does not balance', [
          {
            field: 'avhVoucherId',
            message:
              `${voucher.voucherRefno} is out by ${totals.difference.toFixed(2)} ` +
              `(debit ${totals.totalDebit.toFixed(2)}, credit ${totals.totalCredit.toFixed(2)})`,
          },
        ]);
      }
      const instrumentLedgers = new Set(
        params.tenders
          .filter((tender) =>
            voucher.tenderRowNo === null ? !tender.isPdc : tender.rowNo === voucher.tenderRowNo,
          )
          .map((tender) => tender.clearingLedgerId ?? tender.tenderLedgerId),
      );
      await tx.accVoucherHeader.update({
        where: {
          avhVoucherId_avhAccYear: { avhVoucherId: voucher.voucherId, avhAccYear: voucher.accYear },
        },
        data: {
          avhDocAmount: voucher.docAmount,
          avhAdjustAmount: params.plan.adjustAmountByVoucher.get(voucher.key) ?? ZERO,
          avhOppositeLedgerId: instrumentLedgers.size === 1 ? [...instrumentLedgers][0] : null,
          avhRoundOff: ZERO,
          avhVoucherStatus: VoucherStatus.POSTED,
          avhStatusOn: now,
          avhStatusBy: params.actor,
          avhPostedOn: now,
          avhDraftLines: Prisma.DbNull,
          avhModifiedOn: now,
          avhModifiedBy: params.actor,
        },
      });
    }
  }

  private async postDatedHeldByBill(
    tx: Prisma.TransactionClient,
    bills: readonly { billId: string; accYear: string }[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (bills.length === 0) {
      return new Map();
    }
    const rows = await tx.accBillAdjustment.findMany({
      where: {
        abjIsDeleted: false,
        abjIsPostDated: true,
        abjAdjDate: { gt: todayUtc() },
        OR: bills.map((bill) => ({ abjBillId: bill.billId, abjBillAccYear: bill.accYear })),
      },
      select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
    });
    const held = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const key = `${row.abjBillId}|${row.abjBillAccYear}`;
      held.set(key, (held.get(key) ?? ZERO).plus(row.abjAmount));
    }
    return held;
  }
}

/** The engine's two failure kinds, mapped ONCE to a 400 / 409. Shared with `/payments/amend`. */
export function rethrowAllocationError(error: unknown): unknown {
  if (error instanceof AllocationError) {
    if (error.kind === 'CONFLICT') {
      throwAccountsConflict<PaymentErrorDetail>(error.message, error.details);
    }
    throwAccountsBadRequest<PaymentErrorDetail>(error.message, error.details);
  }
  return error;
}

/** The Indian FY quarter an ISO date falls in — `acc_tds_register.atd_quarter`. */
function quarterOf(iso: string): string {
  const m = Number(iso.slice(5, 7));
  if (m >= 4 && m <= 6) return 'Q1';
  if (m >= 7 && m <= 9) return 'Q2';
  if (m >= 10) return 'Q3';
  return 'Q4';
}

function startOfDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}
