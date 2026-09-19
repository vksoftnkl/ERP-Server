import { Prisma } from '@prisma/client';
import { throwAccountsBadRequest } from 'src/common/utils/module-service.utils';
import {
  allocate,
  RECEIPT_VOUCHER_KEY,
  type AllocationBill,
  type AllocationResult,
} from '../receipt/allocation-engine';
import { lockBills, assertBillUsable } from '../receipt/receipt.guards';
import {
  ADVANCE_SRC_DOC_TYPE,
  BillAdjType,
  BillSettlementMode,
  BillType,
  DrCr,
  RECEIPT_SRC_MODULE,
  RECEIVABLE_BILL_TYPES,
} from '../receipt/types/receipt-enum';
import { money, sum, toAmount, toDateString, ZERO } from '../receipt/receipt.utils';
import type { ChequeBillRef, ChequeErrorDetail } from './types/cheque-api.types';
import type { LockedCheque } from './cheques.guards';
import type { ChequeAllocationDto } from './dto/cheque-keys.dto';

/**
 * Pouring one cheque's money into a party's bills — the shared half of the
 * ON_CLEARING clearing (§4.3) and of both re-issues (§4.5, §4.6).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE ENGINE IS THE RECEIPT'S, AND THAT IS THE POINT (§3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `allocation-engine.ts` is the only place in this system that decides how
 * money fills bills, and this module does not get a second one. A cheque
 * clearing under ON_CLEARING settles bills by exactly the rules a receipt
 * settles them by — due-date first, a bill never over-settled, the remainder
 * held as an ADVANCE — because it IS a receipt, arriving three weeks late.
 *
 * What this file is, then, is an ADAPTER: it turns "one cheque, some bills"
 * into the engine's input, which is shaped for a receipt that may carry six
 * tenders, four other-ledger lines and three credits at once. Here there is
 * exactly one tender and nothing else, so:
 *
 *   · `otherLines` is empty — no TDS, no discount, no surcharge. Those were
 *     agreed when the money was taken, not when a cheque matured.
 *   · `credits` is empty — spending an advance is a receipt-screen act. A
 *     cheque clearing is money arriving, not credit being moved about.
 *   · the identity collapses to `amount = Σ allocations + onAccount`, which is
 *     what `claimedOnAccount` is computed as rather than asked for.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  AN EMPTY `allocations` MEANS AUTO-FIFO, NOT "SETTLE NOTHING"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Money that has arrived always goes somewhere. A screen that sends no
 * allocations has not decided; it has not declined. So the party's open
 * receivables are read in due-date order and filled until the cheque runs out,
 * and whatever is left becomes an ADVANCE — the same answer the operator would
 * have got by pressing "auto" on the receipt screen.
 */

export interface ChequeAllocationScope {
  voucherId: string;
  accYear: string;
  /**
   * `ck_abl_voucher`: a non-OPENING bill must name its voucher AND its voucher
   * TYPE. The ADVANCE this may raise is a non-OPENING bill, so the type has to
   * travel with the id — an advance written without it is refused by the
   * constraint at the moment an operator is banking a cheque.
   */
  voucherTypeId: number;
  voucherNo: bigint;
  voucherRefno: string | null;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  partyId: string;
  salesmanId: string | null;
  userId: string;
  sessionId: string | null;
  actor: string;
  /** The date the bills are settled ON — the clearing date, or the re-issue date. */
  adjDate: Date;
  /**
   * Is the settlement in the FUTURE? True only on a re-issue of a cheque dated
   * later than today (§4.6): the rows are written now, `abj_is_post_dated` is
   * set, and the bill stays open until the date arrives. Nothing is re-posted
   * on the day; the row was always there, it simply started counting.
   */
  isPostDated: boolean;
  /** `abj_cheque_id` — every row this writes names the instrument behind it. */
  cheque: LockedCheque;
  /** The tender row, when there is one. Null on a cheque never posted. */
  tenderId: string | null;
  tenderAccYear: string | null;
}

export interface ChequeAllocationOutcome {
  plan: AllocationResult;
  /** Which bills were touched, for the recompute the caller runs. */
  bills: Array<{ billId: string; accYear: string }>;
  /** What the caller reports back, with pending amounts filled in afterwards. */
  refs: ChequeBillRef[];
  /** Σ of what actually landed on bills — the party CR leg the voucher needs. */
  partyCredit: Prisma.Decimal;
  onAccount: Prisma.Decimal;
}

/**
 * Plan the allocation and WRITE its rows: the adjustment rows and, if there is
 * a remainder, the ADVANCE bill.
 *
 * The caller has already locked the cheque and written the voucher; this runs
 * inside the same transaction and locks the bills itself, because which bills
 * they are is not known until the auto-FIFO list has been read.
 */
export async function allocateChequeMoney(
  tx: Prisma.TransactionClient,
  scope: ChequeAllocationScope,
  requested: readonly ChequeAllocationDto[],
): Promise<ChequeAllocationOutcome> {
  const amount = money(scope.cheque.apdAmount);

  const bills =
    requested.length > 0
      ? await loadNamedBills(tx, scope, requested)
      : await autoFifoBills(tx, scope, amount);

  const allocated = sum(bills.map((bill) => bill.amount));
  if (allocated.greaterThan(amount)) {
    throwAccountsBadRequest<ChequeErrorDetail>('Validation failed', [
      {
        field: 'allocations',
        message:
          `The allocations come to ${allocated.toFixed(2)} but ${scope.cheque.apdInstrumentNo} ` +
          `is for ${amount.toFixed(2)}.`,
      },
    ]);
  }

  const plan = allocate({
    receiptDate: scope.adjDate,
    bills,
    credits: [],
    otherLines: [],
    tenders: [
      {
        tenderRowNo: 1,
        amount,
        isCheque: true,
        // Not the engine's "post-dated" — that means "dated after the receipt",
        // and the receipt here IS the cheque. The date the rows carry is
        // decided by `adjDate` below, and `scope.isPostDated` is applied to the
        // rows as they are written.
        isPostDated: false,
        instrumentDate: scope.cheque.apdInstrumentDate,
        settlementMode: BillSettlementMode.CHEQUE,
      },
    ],
    pins: [],
    // Derived, not asked for. With one tender and nothing else the identity is
    // `amount = Σ allocations + onAccount`, so there is only one value this can
    // take and making the client send it would only create a way to be wrong.
    claimedOnAccount: amount.minus(allocated),
  });

  await writeAdjustments(tx, scope, plan);
  await writeAdvanceBill(tx, scope, plan);

  return {
    plan,
    bills: bills.map((bill) => ({ billId: bill.billId, accYear: bill.billAccYear })),
    refs: bills.map((bill) => ({
      billId: bill.billId,
      billAccYear: bill.billAccYear,
      billType: '',
      docRefno: bill.docRefno,
      docDate: '',
      dueDate: null,
      billAmount: 0,
      pendingAmount: 0,
      settledByThisCheque: toAmount(bill.amount),
    })),
    partyCredit: plan.partyCreditByVoucher.get(RECEIPT_VOUCHER_KEY) ?? ZERO,
    onAccount: plan.totalOnAccount,
  };
}

/**
 * The bills the caller named, locked and checked.
 *
 * `assertBillUsable` is the receipt's, and it enforces the four ways a
 * well-formed request can settle somebody else's invoice: a dead bill, another
 * party's, another company's, or one on the wrong side of the account.
 */
async function loadNamedBills(
  tx: Prisma.TransactionClient,
  scope: ChequeAllocationScope,
  requested: readonly ChequeAllocationDto[],
): Promise<AllocationBill[]> {
  const locked = await lockBills(
    tx,
    requested.map((row) => ({ billId: row.billId, billAccYear: row.billAccYear })),
  );

  return requested.map((row, index) => {
    const bill = assertBillUsable(locked.get(`${row.billId}|${row.billAccYear}`), {
      billId: row.billId,
      partyId: scope.partyId,
      companyId: scope.companyId,
      kind: 'RECEIVABLE',
      field: `allocations.${index}.billId`,
    });
    return {
      billId: bill.ablId,
      billAccYear: bill.ablAccYear,
      docRefno: bill.ablDocRefno,
      amount: money(row.amount),
      discount: money(row.discount ?? 0),
      writeoff: money(row.writeoff ?? 0),
      // A cheque does not round anything off. Rounding happens at the counter
      // when the money is taken; clearing an instrument weeks later settles
      // the face value or it does not settle at all.
      roundoff: ZERO,
      pendingAmount: bill.ablPendingAmount,
      writeoffApprovedBy: row.writeoffApprovedBy ?? null,
    };
  });
}

/**
 * Nobody decided, so due-date first until the money runs out.
 *
 * The bill list is read and THEN locked, which is the right way round: the
 * candidate set is a question about what is open, and the lock is what makes
 * the answer stable. A bill that closed between the two reads simply takes
 * nothing, because the locked `abl_pending_amount` is what the engine is
 * given.
 *
 * The bounce-charge bill this module raises is a JOURNAL receivable, so it is
 * in this list like any other — §7: "the bounce-charge bill is allocatable".
 */
async function autoFifoBills(
  tx: Prisma.TransactionClient,
  scope: ChequeAllocationScope,
  amount: Prisma.Decimal,
): Promise<AllocationBill[]> {
  const candidates = await tx.accBillBalance.findMany({
    where: {
      ablPartyId: scope.partyId,
      ablCompanyId: scope.companyId,
      ablIsDeleted: false,
      ablDrCr: DrCr.DR,
      ablBillType: { in: [...RECEIVABLE_BILL_TYPES] },
      ablStatus: { not: 'CLOSED' },
    },
    orderBy: [{ ablDueDate: 'asc' }, { ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
    select: { ablId: true, ablAccYear: true },
    take: 500,
  });

  const locked = await lockBills(
    tx,
    candidates.map((row) => ({ billId: row.ablId, billAccYear: row.ablAccYear })),
  );

  const bills: AllocationBill[] = [];
  let left = amount;

  // Back into the ORDER the query asked for: lockBills returns by id, because
  // that is what stops two concurrent calls deadlocking, and due-date order is
  // what decides who gets paid first.
  for (const candidate of candidates) {
    if (left.lessThanOrEqualTo(0)) {
      break;
    }
    const bill = locked.get(`${candidate.ablId}|${candidate.ablAccYear}`);
    if (!bill || bill.ablIsDeleted || bill.ablPendingAmount.lessThanOrEqualTo(0)) {
      continue;
    }
    const take = Prisma.Decimal.min(left, bill.ablPendingAmount);
    bills.push({
      billId: bill.ablId,
      billAccYear: bill.ablAccYear,
      docRefno: bill.ablDocRefno,
      amount: take,
      discount: ZERO,
      roundoff: ZERO,
      writeoff: ZERO,
      pendingAmount: bill.ablPendingAmount,
      writeoffApprovedBy: null,
    });
    left = left.minus(take);
  }

  return bills;
}

/**
 * The engine's rows, as `acc_bill_adjustment`.
 *
 * `abj_cheque_id` is set on every one of them, which is what makes a later
 * bounce possible at all: §4.4 step 5 finds what to reverse by
 * `abj_cheque_id = <this>`, and a row written without it could never be
 * unwound.
 */
async function writeAdjustments(
  tx: Prisma.TransactionClient,
  scope: ChequeAllocationScope,
  plan: AllocationResult,
): Promise<void> {
  if (plan.adjustments.length === 0) {
    return;
  }

  const rows: Prisma.AccBillAdjustmentUncheckedCreateInput[] = plan.adjustments.map(
    (adjustment, index) => ({
      abjCompanyId: scope.companyId,
      abjBranchId: scope.branchId,
      abjTenantId: scope.tenantId,
      abjAccYear: scope.accYear,
      abjBillId: adjustment.billId,
      abjBillAccYear: adjustment.billAccYear,
      abjPartyId: scope.partyId,
      abjRowNo: index + 1,
      abjAgainstBillId: adjustment.againstBill?.billId ?? null,
      abjAgainstBillAccYear: adjustment.againstBill?.billAccYear ?? null,
      abjVoucherId: scope.voucherId,
      abjVoucherAccYear: scope.accYear,
      abjAdjType: adjustment.adjType,
      abjAdjDate: scope.adjDate,
      abjDrCr: adjustment.drCr,
      abjAmount: adjustment.amount,
      abjSettlementMode: adjustment.settlementMode,
      abjSettlementLedgerId: null,
      abjTenderId: scope.tenderId,
      abjTenderAccYear: scope.tenderId ? scope.tenderAccYear : null,
      // ck_abj_cheque_mode: a CHEQUE-mode row must name its instrument, and
      // ck_abj_pdc: a post-dated row must too. Both are satisfied here for
      // every row, which is the point.
      abjChequeId: scope.cheque.apdId,
      abjChequeAccYear: scope.cheque.apdAccYear,
      abjIsPostDated: scope.isPostDated,
      abjApprovedBy: adjustment.approvedBy,
      abjRemarks: adjustment.remarks,
      abjUserId: scope.userId,
      abjSessionId: scope.sessionId,
      abjCreatedBy: scope.actor,
    }),
  );

  await tx.accBillAdjustment.createMany({ data: rows });
}

/**
 * R7 — a remainder is ALWAYS an ADVANCE bill, never a bare credit balance.
 *
 * Always, because an advance with a bill can be aged, offered on the next
 * receipt, reported and refunded. A bare credit balance can only be looked at.
 *
 * And it is what makes a later bounce recoverable: §4.4's cascade finds this
 * row by `abl_voucher_id` and unwinds whatever it has since been spent on.
 */
async function writeAdvanceBill(
  tx: Prisma.TransactionClient,
  scope: ChequeAllocationScope,
  plan: AllocationResult,
): Promise<void> {
  if (plan.totalOnAccount.lessThanOrEqualTo(0)) {
    return;
  }

  await tx.accBillBalance.create({
    data: {
      ablCompanyId: scope.companyId,
      ablBranchId: scope.branchId,
      ablTenantId: scope.tenantId,
      ablAccYear: scope.accYear,
      ablPartyId: scope.partyId,
      ablSalesmanId: scope.salesmanId,
      ablBillType: BillType.ADVANCE,
      ablSrcModule: RECEIPT_SRC_MODULE,
      ablSrcDocType: ADVANCE_SRC_DOC_TYPE,
      ablSrcDocId: scope.voucherId,
      ablSrcAccYear: scope.accYear,
      // ck_abl_voucher: a non-OPENING bill MUST name its voucher AND its type.
      ablVoucherId: scope.voucherId,
      ablVoucherTypeId: scope.voucherTypeId,
      ablVoucherNo: scope.voucherNo,
      ablVoucherRefno: scope.voucherRefno,
      ablVoucherDate: scope.adjDate,
      ablDocRefno: `ADV/${scope.cheque.apdInstrumentNo}`,
      ablDocDate: scope.adjDate,
      // A credit the company holds: CR of the party's account.
      ablDrCr: DrCr.CR,
      ablBillAmount: plan.totalOnAccount,
      ablNarration:
        `On account from cheque ${scope.cheque.apdInstrumentNo} ` +
        `dated ${toDateString(scope.cheque.apdInstrumentDate) ?? ''}`,
      ablCreatedBy: scope.actor,
    },
  });
}

/** The adj type an advance is spent under, kept here so the cascade agrees. */
export const ADVANCE_ADJ_TYPE = BillAdjType.ADVANCE_ADJUST;
