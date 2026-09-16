import { Prisma } from '@prisma/client';
import { BillAdjType, BillType, DrCr } from '../receipt/types/receipt-enum';
import { flipSide } from '../receipt/receipt.utils';
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
}

/**
 * §4.4 step 5 — a negative row for every live adjustment this cheque wrote.
 *
 * "This cheque wrote" is `abj_cheque_id = <this>`, which is precisely the link
 * the receipt's posting path set for exactly this moment: a receipt that took
 * three cheques and some cash wrote rows for all four, and only this cheque's
 * come back.
 *
 * Rows that are THEMSELVES reversals are skipped. Sweeping one up would cancel
 * the cancellation and re-settle a bill that had already been reopened — which
 * is the shape of bug that shows up as an invoice quietly closing itself
 * months later.
 */
export async function reverseChequeAdjustments(
  tx: Prisma.TransactionClient,
  cheque: LockedCheque,
  scope: ReversalVoucherScope,
  startRowNo = 1,
): Promise<ReversedRows & { nextRowNo: number }> {
  const originals = await tx.accBillAdjustment.findMany({
    where: {
      abjChequeId: cheque.apdId,
      abjChequeAccYear: cheque.apdAccYear,
      abjIsDeleted: false,
      abjReversalOfId: null,
    },
    orderBy: [{ abjVoucherId: 'asc' }, { abjRowNo: 'asc' }],
  });

  const nextRowNo = await writeReversals(tx, originals, scope, startRowNo);

  return {
    bills: originals.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear })),
    count: originals.length,
    nextRowNo,
  };
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
