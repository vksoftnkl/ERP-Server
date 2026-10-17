import { Prisma } from '@prisma/client';
import { BillAdjType, BillType, DrCr } from '../receipt/types/receipt-enum';
import { flipSide, ZERO } from '../receipt/receipt.utils';
import type { LockedCheque } from './cheques.guards';
import type { ChequeCascadeReport } from './types/cheque-api.types';

/**
 * Unwinding what a cheque settled — the shared half of bounce (§4.4 steps 5–6)
 * and return (§4.7).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  REVERSE, NEVER DELETE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every adjustment row gets a NEGATIVE row pointing back at it
 * (`abj_reversal_of_id`, which `ck_abj_reversal_sign` forces to be negative)
 * and the original stays exactly as it was. A bill's history then reads "this
 * cheque settled 12,500 on the 4th, and it came back on the 14th", which is
 * the question an accountant actually asks; a deleted row answers neither half
 * of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  THE POST-DATED MIRROR, WHICH IS EASY TO GET WRONG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A reversal row COPIES the original's `abj_is_post_dated` and `abj_adj_date`.
 * Dating it today so the bill "reopens at once" is tempting and wrong: an
 * un-matured post-dated row does not count towards `abl_alloc_amount`, so a
 * reversal that DID count would drive that column negative and `ck_abl_settled`
 * would refuse the write. Mirroring the flag makes the pair net to zero whether
 * the cheque has matured or not — which is true on every day, not just today.
 */

/** What a caller must tell the reverser about the voucher carrying the rows. */
export interface ReversalVoucherScope {
  voucherId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId: string | null;
  userId: string;
  sessionId: string | null;
  actor: string;
  reason: string;
}

export interface ReversedRows {
  /** The bills that need recomputing, in the order they were met. */
  bills: Array<{ billId: string; accYear: string }>;
  count: number;
  /**
   * What the cheque had settled on each bill and has now given back, keyed
   * `billId|accYear` — POSITIVE (notes 49 item 5: the reply reads "settled 315",
   * not −315).
   */
  amountByBill: Map<string, Prisma.Decimal>;
}

/**
 * Every live `acc_bill_adjustment` row this cheque wrote, split into the ones
 * still STANDING and the reversals that cancelled the rest.
 *
 * "This cheque wrote" is `abj_cheque_id = <this>`, which is precisely the link
 * the receipt's posting path set for exactly this moment: a receipt that took
 * three cheques and some cash wrote rows for all four, and only this cheque's
 * come back. A reversal COPIES that column from the row it reverses, so both
 * halves of every pair come back in the one read.
 */
async function loadChequeAdjustments(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
): Promise<{
  /** Positive rows that have NOT been reversed — what is still settling bills. */
  standing: Prisma.AccBillAdjustmentGetPayload<object>[];
  /** The negative rows, in the order they were written. */
  reversals: Prisma.AccBillAdjustmentGetPayload<object>[];
}> {
  const rows = await tx.accBillAdjustment.findMany({
    where: {
      abjChequeId: cheque.apdId,
      abjChequeAccYear: cheque.apdAccYear,
      abjIsDeleted: false,
    },
    orderBy: [{ abjVoucherId: 'asc' }, { abjRowNo: 'asc' }],
  });

  const reversals = rows.filter((row) => row.abjReversalOfId !== null);
  const alreadyReversed = new Set(reversals.map((row) => row.abjReversalOfId!));

  return {
    standing: rows.filter((row) => row.abjReversalOfId === null && !alreadyReversed.has(row.abjId)),
    reversals,
  };
}

/**
 * §4.4 step 5 — a negative row for every live adjustment this cheque wrote and
 * has not already had reversed.
 *
 * ── Why "and has not already had reversed" is load-bearing ────────────────
 *
 * `abj_reversal_of_id IS NULL` means "this row is not itself a reversal". It
 * does NOT mean "this row still stands", and reading it that way is the bug a
 * cheque goes looking for the second time round: bounce → re-present → bounce
 * again. The first bounce reversed the receipt's rows and left them in place
 * (reverse, never delete — see the header), the re-presentation wrote a fresh
 * positive set, and a second bounce that swept up everything with a null
 * `abj_reversal_of_id` would reverse the FIRST set a second time. The bill's
 * `abl_alloc_amount` then falls by twice what the cheque ever settled, which
 * the recompute writes straight into the column.
 *
 * The register invites exactly this: `apd_present_count` exists because a
 * cheque can go to the bank again, and §7 says a second bounce is "a real
 * separate event, not a duplicate".
 */
export async function reverseChequeAdjustments(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
  scope: ReversalVoucherScope,
  startRowNo = 1,
): Promise<ReversedRows & { nextRowNo: number }> {
  const { standing } = await loadChequeAdjustments(tx, cheque);

  const nextRowNo = await writeReversals(tx, standing, scope, startRowNo);

  const amountByBill = new Map<string, Prisma.Decimal>();
  for (const row of standing) {
    const k = `${row.abjBillId}|${row.abjBillAccYear}`;
    amountByBill.set(k, (amountByBill.get(k) ?? new Prisma.Decimal(0)).plus(row.abjAmount));
  }

  return {
    bills: standing.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear })),
    count: standing.length,
    amountByBill,
    nextRowNo,
  };
}

/**
 * One bill's share of what a bounce took back, ready to be put back exactly
 * where it came from.
 *
 * Decimals rather than the DTO's numbers, and a `roundoff` the DTO has no
 * field for: this is not a request being re-parsed, it is rows being read back
 * off the ledger, and every component the original settlement had has to
 * survive the round trip. A receipt that rounded 4,999.60 off to 5,000 wrote a
 * ROUND_OFF row; the bounce reversed it; the re-presentation owes the bill
 * that paisa back.
 */
export interface RestoredAllocation {
  billId: string;
  billAccYear: string;
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  writeoff: Prisma.Decimal;
  roundoff: Prisma.Decimal;
  writeoffApprovedBy: string | null;
}

/** The adjustment types a cheque's own settlement is made of. */
const SETTLEMENT_ADJ_TYPES: readonly BillAdjType[] = [
  BillAdjType.ALLOCATION,
  BillAdjType.DISCOUNT,
  BillAdjType.WRITEOFF,
  BillAdjType.ROUND_OFF,
];

/**
 * §4.5 — what the bounce took off the bills, so the re-presentation can put it
 * back on the SAME ones.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS AT ALL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A re-presentation is the same money for the same debt. The cheque did not
 * become a fresh payment when the bank returned it — it is the original
 * settlement being attempted again. So which bills it settles is not a choice
 * anybody is making; it is a fact this table already holds, in the very rows
 * the bounce reversed.
 *
 * Auto-FIFO is the right answer for money whose destination nobody has decided
 * (a cheque clearing under ON_CLEARING, §4.3). It is never the right answer
 * here, because it silently moves a customer's money onto whichever of their
 * debts happens to sort first — a bill this cheque was never against.
 *
 * And the client cannot supply the split itself: once the rows are reversed,
 * `/cheques/get` reports every bill as settled 0 by this cheque, which is
 * true. The per-bill amounts exist ONLY here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHICH ROWS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The reversals written BY THE BOUNCE VOUCHER, and only this cheque's own
 * settlement types. Two exclusions do real work:
 *
 *   · the bounce voucher, not "every reversal", because a cheque that has been
 *     round the loop before carries the older cycle's pairs too, and it is the
 *     LAST bounce that has to be undone;
 *   · the settlement types, because the C4 cascade writes its advance
 *     unwinding onto the same voucher, and an ADVANCE_ADJUST row is a credit
 *     being spent elsewhere rather than this cheque settling a bill.
 *
 * An EMPTY result is an answer, not a failure: a cheque whose money went
 * entirely on account settled no bill, and the re-presentation should put it
 * entirely on account again. That is why the caller must not read `[]` as
 * "nobody decided, go FIFO".
 */
export async function allocationsReversedBy(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
  bounce: { voucherId: string; accYear: string },
): Promise<RestoredAllocation[]> {
  const reversed = await tx.accBillAdjustment.findMany({
    where: {
      abjChequeId: cheque.apdId,
      abjChequeAccYear: cheque.apdAccYear,
      abjIsDeleted: false,
      abjReversalOfId: { not: null },
      abjVoucherId: bounce.voucherId,
      abjVoucherAccYear: bounce.accYear,
      abjAdjType: { in: [...SETTLEMENT_ADJ_TYPES] },
    },
    orderBy: [{ abjRowNo: 'asc' }],
  });

  // One entry per bill, in the order the bounce met them — which is the order
  // the original settlement was written in, so the re-presentation fills the
  // bills back up the way they were filled the first time.
  const byBill = new Map<string, RestoredAllocation>();

  for (const row of reversed) {
    const key = `${row.abjBillId}|${row.abjBillAccYear}`;
    let entry = byBill.get(key);
    if (!entry) {
      entry = {
        billId: row.abjBillId,
        billAccYear: row.abjBillAccYear,
        amount: ZERO,
        discount: ZERO,
        writeoff: ZERO,
        roundoff: ZERO,
        writeoffApprovedBy: null,
      };
      byBill.set(key, entry);
    }

    // The reversal rows are NEGATIVE (ck_abj_reversal_sign). What was taken
    // off the bill is their magnitude.
    const amount = row.abjAmount.negated();

    // The column is a plain string in the client; BillAdjType is what the
    // check constraint actually allows in it.
    switch (row.abjAdjType as BillAdjType) {
      case BillAdjType.ALLOCATION:
        entry.amount = entry.amount.plus(amount);
        break;
      case BillAdjType.DISCOUNT:
        entry.discount = entry.discount.plus(amount);
        break;
      case BillAdjType.WRITEOFF:
        entry.writeoff = entry.writeoff.plus(amount);
        // ck_abj_writeoff_approval: a WRITEOFF row names who allowed it, and
        // the row going back on carries the SAME approval. Asking for it again
        // would make a re-presentation need a manager for a write-off that was
        // already authorised once.
        entry.writeoffApprovedBy = row.abjApprovedBy ?? entry.writeoffApprovedBy;
        break;
      case BillAdjType.ROUND_OFF:
        entry.roundoff = entry.roundoff.plus(amount);
        break;
      default:
        break;
    }
  }

  return [...byBill.values()];
}

/**
 * §4.4 step 6 — the C4 cascade.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHAT IT IS FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A receipt of 20,000 that settled 18,500 of bills leaves 1,500 as an ADVANCE
 * bill — money the company holds. Next week that advance is applied to a new
 * invoice. Then the cheque bounces.
 *
 * Reversing only the cheque's own rows would leave the new invoice settled by
 * money that never existed. Refusing the bounce because the advance was spent
 * (which is what the receipt's own `/cancel` does) is not available here: the
 * cheque HAS bounced, the bank has said so, and a system that cannot record
 * that is not a choice. So the cascade unwinds the applications too, and the
 * new invoice reopens.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ATTRIBUTION — THE ONE JUDGMENT IN THIS MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The plan says to cascade the advances "whose remainder came from this
 * cheque". An ADVANCE bill records which VOUCHER raised it and not which
 * tender, so the question has to be answered from the voucher:
 *
 *   · A post-dated cheque has a voucher OF ITS OWN (receipt plan R2), whose
 *     only money is that cheque. Any advance on it is wholly the cheque's.
 *   · A current-dated cheque shares the receipt's voucher with the cash, the
 *     card and the other cheques of the same receipt. An advance there was
 *     funded by all of them together, and no column says in what proportion.
 *
 * So: cascade when this cheque is the voucher's ONLY money source, and
 * otherwise leave the advance alone and SAY SO — `advancesLeftMixed` in the
 * response, not silence. Removing a mixed advance in full would destroy money
 * that is still good; removing a guessed fraction of it would be arithmetic
 * nobody could audit. The operator is told which advance is affected and
 * decides.
 *
 * The party is not left short either way: the bounce still debits them the
 * full amount of the cheque, so the ledger is right. What the mixed case
 * leaves open is only which BILL the remaining credit belongs against.
 */
export async function cascadeAdvances(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
  scope: ReversalVoucherScope,
  startRowNo = 1,
): Promise<{
  report: ChequeCascadeReport;
  bills: Array<{ billId: string; accYear: string }>;
  nextRowNo: number;
}> {
  const report: ChequeCascadeReport = {
    advanceBillsRemoved: [],
    advanceApplicationsReversed: 0,
    advancesLeftMixed: [],
  };
  const bills: Array<{ billId: string; accYear: string }> = [];
  let rowNo = startRowNo;

  if (!cheque.apdVoucherId || !cheque.apdVoucherAccYear) {
    // ON_CLEARING, or a row an import wrote. Nothing was posted, so no advance
    // can have come from it.
    return { report, bills, nextRowNo: rowNo };
  }

  const advances = await tx.accBillBalance.findMany({
    where: {
      ablVoucherId: cheque.apdVoucherId,
      ablAccYear: cheque.apdVoucherAccYear,
      ablBillType: BillType.ADVANCE,
      ablIsDeleted: false,
    },
    select: { ablId: true, ablAccYear: true, ablDocRefno: true },
  });

  if (advances.length === 0) {
    return { report, bills, nextRowNo: rowNo };
  }

  const soleSource = await isSoleMoneySource(tx, cheque);

  for (const advance of advances) {
    const ref = {
      billId: advance.ablId,
      billAccYear: advance.ablAccYear,
      docRefno: advance.ablDocRefno,
    };

    if (!soleSource) {
      report.advancesLeftMixed.push(ref);
      continue;
    }

    // Both halves of every pair: the row ON the advance (it being spent) and
    // the row on the invoice it was spent against. `ck_abj_against` requires
    // an ADVANCE_ADJUST row to name the opposite bill, so the pair is how the
    // engine records one application and both sides have to come back.
    const applications = await tx.accBillAdjustment.findMany({
      where: {
        abjIsDeleted: false,
        abjReversalOfId: null,
        abjAdjType: { in: [BillAdjType.ADVANCE_ADJUST, BillAdjType.NOTE_ADJUST] },
        OR: [
          { abjBillId: advance.ablId, abjBillAccYear: advance.ablAccYear },
          { abjAgainstBillId: advance.ablId, abjAgainstBillAccYear: advance.ablAccYear },
        ],
      },
      orderBy: [{ abjVoucherId: 'asc' }, { abjRowNo: 'asc' }],
    });

    rowNo = await writeReversals(tx, applications, scope, rowNo);
    report.advanceApplicationsReversed += applications.length;
    for (const row of applications) {
      bills.push({ billId: row.abjBillId, accYear: row.abjBillAccYear });
    }

    // Soft delete, not delete: the row is what proves the advance once existed,
    // and fk_abj_against_bill may still name it from the reversals just
    // written.
    await tx.accBillBalance.update({
      where: { ablId_ablAccYear: { ablId: advance.ablId, ablAccYear: advance.ablAccYear } },
      data: {
        ablIsDeleted: true,
        ablIsActive: false,
        ablModifiedOn: new Date(),
        ablModifiedBy: scope.actor,
      },
    });
    report.advanceBillsRemoved.push(ref);
  }

  return { report, bills, nextRowNo: rowNo };
}

/**
 * Is this cheque the only money on its voucher?
 *
 * Two questions, because a voucher can carry more than one kind of thing:
 * another TENDER row (cash alongside the cheque on one receipt), or another
 * CHEQUE pointing at the same voucher. Either makes the advance mixed.
 *
 * A voucher with no tender rows at all answers `true`: the receipt wrote them
 * for every instrument, so the only ways to reach that state are an import or
 * a cancelled receipt whose tenders were soft-deleted — and in both of those
 * the cheque is the only thing left claiming the voucher.
 */
async function isSoleMoneySource(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
): Promise<boolean> {
  const tenders = await tx.accTenderDetail.findMany({
    where: { tdSrcDocId: cheque.apdVoucherId!, tdIsDeleted: false },
    select: { tdId: true },
  });
  if (tenders.some((tender) => tender.tdId !== cheque.apdTenderId)) {
    return false;
  }

  const siblings = await tx.accPdcRegister.count({
    where: {
      apdVoucherId: cheque.apdVoucherId!,
      apdVoucherAccYear: cheque.apdVoucherAccYear!,
      apdIsDeleted: false,
      NOT: { apdId: cheque.apdId },
    },
  });

  return siblings === 0;
}

/**
 * The mirror rows themselves, for whichever set of originals a caller hands
 * over.
 *
 * `abj_row_no` runs 1..n within the voucher carrying them, which is why the
 * callers thread a counter through: the bounce writes the cheque's own
 * reversals and then the cascade's onto the SAME voucher, and restarting at 1
 * would give two rows the same number.
 */
async function writeReversals(
  tx: Prisma.TransactionClient,
  originals: readonly Prisma.AccBillAdjustmentGetPayload<object>[],
  scope: ReversalVoucherScope,
  startRowNo: number,
): Promise<number> {
  if (originals.length === 0) {
    return startRowNo;
  }

  let rowNo = startRowNo;
  const rows: Prisma.AccBillAdjustmentUncheckedCreateInput[] = originals.map((row) => ({
    abjCompanyId: scope.companyId,
    abjBranchId: scope.branchId,
    abjTenantId: scope.tenantId,
    // Partitioned with the voucher that CAUSED it — the bounce, not the
    // receipt — while abj_bill_acc_year keeps the bill's own year. That is how
    // a bounce in 2027-2028 reopens a bill raised in 2025-2026.
    abjAccYear: scope.accYear,
    abjBillId: row.abjBillId,
    abjBillAccYear: row.abjBillAccYear,
    abjPartyId: row.abjPartyId,
    abjRowNo: rowNo++,
    abjAgainstBillId: row.abjAgainstBillId,
    abjAgainstBillAccYear: row.abjAgainstBillAccYear,
    abjVoucherId: scope.voucherId,
    abjVoucherAccYear: scope.accYear,
    abjAdjType: row.abjAdjType,
    // The ORIGINAL's date and flag, mirrored exactly. See the header note:
    // anything else drives abl_alloc_amount negative on an un-matured cheque
    // and ck_abl_settled refuses the write.
    abjAdjDate: row.abjAdjDate,
    abjIsPostDated: row.abjIsPostDated,
    // The side flips: a row that credited the party now debits them.
    abjDrCr: flipSide(row.abjDrCr, DrCr.DR, DrCr.CR),
    // ck_abj_reversal_sign: a row naming abj_reversal_of_id MUST be negative,
    // and one that does not MUST be positive.
    abjAmount: row.abjAmount.negated(),
    abjSettlementMode: row.abjSettlementMode,
    abjSettlementLedgerId: row.abjSettlementLedgerId,
    abjTenderId: row.abjTenderId,
    abjTenderAccYear: row.abjTenderAccYear,
    abjChequeId: row.abjChequeId,
    abjChequeAccYear: row.abjChequeAccYear,
    // ck_abj_writeoff_approval: a WRITEOFF row needs an approver, and the
    // reversal of one is still a WRITEOFF row.
    abjApprovedBy: row.abjApprovedBy,
    abjReversalOfId: row.abjId,
    abjReversalReason: scope.reason.slice(0, 250),
    abjUserId: scope.userId,
    abjSessionId: scope.sessionId,
    abjCreatedBy: scope.actor,
  }));

  await tx.accBillAdjustment.createMany({ data: rows });
  return rowNo;
}
