import { Prisma } from '@prisma/client';
import { throwSalesBadRequest, throwSalesConflict } from 'src/common/utils/module-service.utils';
import { SaveBillAdjustmentDto } from './dto/save-bill-adjustment.dto';
import { BillErrorDetail, BillErrorResponse } from './types/bill-api.types';
/// Posts the sale bill's ADJUSTMENTS: credits the customer already holds — an
/// order advance, a sale-return credit note — set off against this invoice.
///
/// An adjustment is never a tender. It reaches the server only through the
/// payload's `adjustments` array; the settle screen's ADJUST row (tender type 7)
/// is a read-only mirror of the same panel and writes no acc_tender_detail row.
/// Anything that posted it as a tender as well would write the same money twice.
///
/// Must run inside the caller's transaction, after the bill's own
/// acc_bill_balance receivable exists — the invoice's abl_id is half of every
/// row written here.
///
/// ---
///
/// WHY THIS FILE MAINTAINS abl_alloc_amount BY HAND
///
/// The table's design notes describe abl_alloc_amount as trigger-maintained,
/// recomputed from the adjustment rows by fn_abl_recompute(). That function does
/// not exist in this database — `accounts.acc_bill_balance` and
/// `acc_bill_adjustment` carry no triggers at all (verified 2026-08-15). So
/// writing an adjustment row moves no balance on its own, and every write below
/// is paired with an explicit update of the bills it affects.
///
/// If fn_abl_recompute() is ever installed, the two sides will double-count and
/// the explicit updates here must come out in the same change.
// acc_bill_balance.abl_bill_type values a sale bill may adjust against, and the
// routing each one settles as. Mirrors CREDIT_ADJUSTMENT_ROUTING in the
// transaction module, which is what the open-credits list hands the client.
//
// OPENING and JOURNAL credits are deliberately absent: ck_abj_against only lets
// ADVANCE_ADJUST / NOTE_ADJUST / TRANSFER name an opposite bill, and which of
// those an opening credit should post as is an accounting decision, not one to
// guess here.
const CREDIT_ROUTING: Record<string, { adjType: string; settlementMode: string }> = {
  ADVANCE: { adjType: 'ADVANCE_ADJUST', settlementMode: 'ADVANCE' },
  SALES_RETURN: { adjType: 'NOTE_ADJUST', settlementMode: 'CREDIT_NOTE' },
};
// The side of acc_bill_balance a credit sits on. A DR row is money the party
// owes, which is not theirs to spend on this invoice.
const CREDIT_SIDE = 'CR';
// abj_dr_cr. The invoice is a DR bill, so settling it is a CR movement; the
// credit is a CR bill, so relieving it is a DR movement.
const INVOICE_MOVEMENT = 'CR';
const CREDIT_MOVEMENT = 'DR';
const REVERSAL_REASON = 'Bill re-saved with a different settlement';
/// What the adjustment rows are written against: the invoice, plus the header
/// context every row copies.
export interface BillAdjustmentContext {
  // The invoice's acc_bill_balance row — the pair, because the table is
  // partitioned on the year.
  billId: string;
  billAccYear: string;
  // What the invoice is worth, and what was tendered against it. Together these
  // decide the invoice's total allocation; see settleInvoiceAllocation.
  billAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  companyId: string;
  // The branch that SETTLED it — this bill's branch, which may differ from the
  // one that raised the credit.
  branchId: string;
  tenantId: string | null;
  // FY of the ADJUSTMENT: the bill's year, never the credit's.
  accYear: string;
  // The customer's LEDGER id. Customer and ledger share a primary key, so
  // sbCustId is already the acc_ledger_master id (the same identity
  // postBillToAccounts writes into avh_party_id).
  partyId: string;
  adjDate: Date;
  userId: string;
  sessionId: string | null;
}
export interface BillAdjustmentSyncResult {
  // 'unchanged' covers both "the payload omitted the key" and "the payload
  // asked for exactly what is already posted".
  action: 'unchanged' | 'posted' | 'reversed' | 'replaced';
  // Live (non-reversed) adjustment pairs against this invoice after the sync.
  adjustments: PostedAdjustment[];
}
export interface PostedAdjustment {
  againstBillId: string;
  againstBillAccYear: string;
  amount: Prisma.Decimal;
  adjType: string;
  settlementMode: string;
}
// One credit, as re-read under a row lock. Every column the validation and the
// derivation need — nothing is taken from the payload's echo fields.
interface LockedCredit {
  ablId: string;
  ablAccYear: string;
  ablBillType: string;
  ablDrCr: string;
  ablPartyId: string;
  ablDocRefno: string | null;
  ablPendingAmount: Prisma.Decimal;
  ablAllocAmount: Prisma.Decimal;
}
/// Brings acc_bill_adjustment in line with the payload's `adjustments`.
///
/// ABSENT IS NOT EMPTY. The client omits the key entirely when it could not read
/// what a bill was settled with (a bill loaded for edit whose GET returned no
/// array), and it will not rewrite a settlement it was never shown. So:
///
///   key absent  -> leave the existing adjustments alone
///   []          -> the operator cleared them; reverse everything
///
/// Corrections are rows, never edits: nothing here is ever UPDATEd or DELETEd.
/// A changed settlement reverses the old pairs (same abj_adj_type, negative
/// amount, abj_reversal_of_id set — ck_abj_reversal_sign enforces the sign both
/// ways) and posts the new ones.
export async function syncBillAdjustments(
  tx: Prisma.TransactionClient,
  ctx: BillAdjustmentContext,
  adjustments: SaveBillAdjustmentDto[] | undefined,
  actor: string,
  now: Date,
): Promise<BillAdjustmentSyncResult> {
  if (adjustments === undefined) {
    return { action: 'unchanged', adjustments: await readLiveAdjustments(tx, ctx.billId) };
  }
  const requested = normalizeRequest(adjustments);
  const live = await readLiveAdjustments(tx, ctx.billId);
  if (matches(live, requested)) {
    // An ordinary re-save of an unchanged bill. Reversing and re-posting the
    // same pairs would double the audit trail on every keystroke-level save and
    // leave the balances exactly where they started.
    return { action: 'unchanged', adjustments: live };
  }
  if (live.length > 0) {
    await reverseAll(tx, ctx, actor, now);
  }
  const posted = await postAll(tx, ctx, requested, actor, now);
  await settleInvoiceAllocation(tx, ctx, posted, actor, now);
  const action = live.length === 0 ? 'posted' : posted.length === 0 ? 'reversed' : 'replaced';
  return { action, adjustments: posted };
}
// Collapses repeats and rejects the payload-level nonsense the DTO cannot see.
// Two lines naming the same credit are merged rather than refused: the panel can
// legitimately produce them, and one row per credit is what the balance
// arithmetic below assumes.
function normalizeRequest(adjustments: SaveBillAdjustmentDto[]): SaveBillAdjustmentDto[] {
  const merged = new Map<string, SaveBillAdjustmentDto>();
  for (const [index, adjustment] of adjustments.entries()) {
    const amount = new Prisma.Decimal(adjustment.amount);
    if (amount.lessThanOrEqualTo(0)) {
      // ck_abj_amount refuses zero outright; a negative is only ever a reversal,
      // which this path never writes.
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
        {
          field: `adjustments[${index}].amount`,
          message: `An adjustment must be for a positive amount; got ${amount.toString()}.`,
        },
      ]);
    }
    const existing = merged.get(adjustment.againstBillId);
    if (!existing) {
      merged.set(adjustment.againstBillId, { ...adjustment, amount: amount.toNumber() });
      continue;
    }
    if (existing.againstBillAccYear !== adjustment.againstBillAccYear) {
      throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
        {
          field: `adjustments[${index}].againstBillAccYear`,
          message:
            `Credit ${adjustment.againstBillId} is named twice with two different accounting ` +
            `years (${existing.againstBillAccYear} and ${adjustment.againstBillAccYear}).`,
        },
      ]);
    }
    existing.amount = new Prisma.Decimal(existing.amount).plus(amount).toNumber();
  }
  return [...merged.values()];
}
// True when what is already posted is exactly what the payload asks for.
function matches(live: PostedAdjustment[], requested: SaveBillAdjustmentDto[]): boolean {
  if (live.length !== requested.length) {
    return false;
  }
  const byCredit = new Map(live.map((row) => [row.againstBillId, row]));
  return requested.every((adjustment) => {
    const row = byCredit.get(adjustment.againstBillId);
    return (
      row !== undefined &&
      row.againstBillAccYear === adjustment.againstBillAccYear &&
      row.amount.equals(new Prisma.Decimal(adjustment.amount))
    );
  });
}
// The invoice-side rows that are still standing: posted, not themselves
// reversals, and not already reversed by a later row.
//
// Queried by bill id alone, without abj_bill_acc_year — the id is unique across
// every partition, and a settlement sitting in a later year's partition than the
// bill is exactly what has to be found here (the same reasoning resolveAllocation
// in bill-posting.helper uses).
async function readLiveAdjustments(
  tx: Prisma.TransactionClient,
  billId: string,
): Promise<PostedAdjustment[]> {
  const rows = await tx.accBillAdjustment.findMany({
    where: {
      abjBillId: billId,
      abjIsDeleted: false,
      abjAgainstBillId: { not: null },
      abjReversalOfId: null,
    },
    select: {
      abjId: true,
      abjAgainstBillId: true,
      abjAgainstBillAccYear: true,
      abjAmount: true,
      abjAdjType: true,
      abjSettlementMode: true,
    },
    orderBy: { abjRowNo: 'asc' },
  });
  if (rows.length === 0) {
    return [];
  }
  const reversed = new Set(
    (
      await tx.accBillAdjustment.findMany({
        where: { abjReversalOfId: { in: rows.map((row) => row.abjId) }, abjIsDeleted: false },
        select: { abjReversalOfId: true },
      })
    ).map((row) => row.abjReversalOfId as string),
  );
  return rows
    .filter((row) => !reversed.has(row.abjId))
    .map((row) => ({
      // Both are non-null: the query filters abjAgainstBillId, and
      // ck_abj_against_bill_pair moves the year with it.
      againstBillId: row.abjAgainstBillId as string,
      againstBillAccYear: row.abjAgainstBillAccYear as string,
      amount: row.abjAmount,
      adjType: row.abjAdjType,
      settlementMode: row.abjSettlementMode ?? '',
    }));
}
// Reverses every live pair against this invoice — both sides of each — and takes
// the relieved amount back off the credits.
async function reverseAll(
  tx: Prisma.TransactionClient,
  ctx: BillAdjustmentContext,
  actor: string,
  now: Date,
): Promise<void> {
  const rows = await tx.accBillAdjustment.findMany({
    where: {
      abjIsDeleted: false,
      abjReversalOfId: null,
      abjAgainstBillId: { not: null },
      // Both sides of every pair this invoice is part of: the row that moves the
      // invoice, and the mirror row that moves the credit.
      OR: [{ abjBillId: ctx.billId }, { abjAgainstBillId: ctx.billId }],
    },
    select: {
      abjId: true,
      abjAccYear: true,
      abjBillId: true,
      abjBillAccYear: true,
      abjAgainstBillId: true,
      abjAgainstBillAccYear: true,
      abjAmount: true,
      abjAdjType: true,
      abjSettlementMode: true,
      abjSettlementLedgerId: true,
      abjDrCr: true,
      abjRowNo: true,
    },
  });
  const alreadyReversed = new Set(
    (
      await tx.accBillAdjustment.findMany({
        where: { abjReversalOfId: { in: rows.map((row) => row.abjId) }, abjIsDeleted: false },
        select: { abjReversalOfId: true },
      })
    ).map((row) => row.abjReversalOfId as string),
  );
  let rowNo = await nextRowNo(tx, ctx.billId);
  for (const row of rows) {
    if (alreadyReversed.has(row.abjId)) {
      // ux_abj_reversal only holds within one year's partition, so a second
      // reversal in a later year would be accepted by the database. Checked here
      // instead, exactly as the model's caveat says the posting code must.
      continue;
    }
    await tx.accBillAdjustment.create({
      data: {
        abjCompanyId: ctx.companyId,
        abjBranchId: ctx.branchId,
        abjTenantId: ctx.tenantId,
        // The reversal happens now, in this bill's year — not in the year of the
        // row it undoes, which may sit in an earlier partition.
        abjAccYear: ctx.accYear,
        abjBillId: row.abjBillId,
        abjBillAccYear: row.abjBillAccYear,
        abjAgainstBillId: row.abjAgainstBillId,
        abjAgainstBillAccYear: row.abjAgainstBillAccYear,
        abjPartyId: ctx.partyId,
        abjRowNo: rowNo++,
        // Same type and same side as the row it undoes — only the sign differs,
        // so the roll-ups self-correct and the trail still shows what happened.
        abjAdjType: row.abjAdjType,
        abjAdjDate: ctx.adjDate,
        abjDrCr: row.abjDrCr,
        abjAmount: row.abjAmount.negated(),
        abjSettlementMode: row.abjSettlementMode,
        abjSettlementLedgerId: row.abjSettlementLedgerId,
        abjReversalOfId: row.abjId,
        abjReversalReason: REVERSAL_REASON,
        abjUserId: ctx.userId,
        abjSessionId: ctx.sessionId,
        abjCreatedOn: now,
        abjCreatedBy: actor,
      },
    });
    // Only the credit side is given back here. The invoice's own allocation is
    // rewritten wholesale by settleInvoiceAllocation once the new set is known,
    // so touching it per-row would just be undone.
    if (row.abjBillId !== ctx.billId) {
      await addToAllocation(
        tx,
        { ablId: row.abjBillId, ablAccYear: row.abjBillAccYear },
        row.abjAmount.negated(),
        actor,
        now,
      );
    }
  }
}
// Writes the two rows per credit, and relieves the credit.
async function postAll(
  tx: Prisma.TransactionClient,
  ctx: BillAdjustmentContext,
  requested: SaveBillAdjustmentDto[],
  actor: string,
  now: Date,
): Promise<PostedAdjustment[]> {
  const posted: PostedAdjustment[] = [];
  let rowNo = await nextRowNo(tx, ctx.billId);
  for (const [index, adjustment] of requested.entries()) {
    const amount = new Prisma.Decimal(adjustment.amount);
    const credit = await lockCredit(tx, ctx, adjustment, index);
    const routing = deriveRouting(credit, index);
    ensureCreditCovers(credit, amount, index);
    // Row 1 — moves the INVOICE. Each row moves exactly one balance: the one
    // named in abj_bill_id. abj_against_bill_id is a cross-reference, not a
    // second target, which is why the pair below is two rows and not one.
    await tx.accBillAdjustment.create({
      data: {
        ...commonColumns(ctx, routing, actor, now),
        abjBillId: ctx.billId,
        abjBillAccYear: ctx.billAccYear,
        abjAgainstBillId: credit.ablId,
        abjAgainstBillAccYear: credit.ablAccYear,
        abjRowNo: rowNo++,
        abjDrCr: INVOICE_MOVEMENT,
        abjAmount: amount,
        abjRemarks: adjustment.remarks ?? null,
      },
    });
    // Row 2 — moves the CREDIT, in the opposite direction.
    await tx.accBillAdjustment.create({
      data: {
        ...commonColumns(ctx, routing, actor, now),
        abjBillId: credit.ablId,
        abjBillAccYear: credit.ablAccYear,
        abjAgainstBillId: ctx.billId,
        abjAgainstBillAccYear: ctx.billAccYear,
        abjRowNo: rowNo++,
        abjDrCr: CREDIT_MOVEMENT,
        abjAmount: amount,
        abjRemarks: adjustment.remarks ?? null,
      },
    });
    await addToAllocation(tx, credit, amount, actor, now);
    posted.push({
      againstBillId: credit.ablId,
      againstBillAccYear: credit.ablAccYear,
      amount,
      adjType: routing.adjType,
      settlementMode: routing.settlementMode,
    });
  }
  return posted;
}
// Columns both rows of a pair share.
//
// abj_settlement_ledger_id is left NULL. An order advance names its ledger
// directly (sale_order.so_advance_ledger_id) and a credit note has no equivalent
// column at all, so it must come from company settings; until that exists this
// goes NULL rather than borrowing the advance ledger and quietly mixing two
// liabilities.
//
// abj_tender_id likewise: it names the ORIGINAL receipt on the order, which is
// per-instrument (an order's advance may have arrived as four tenders) and needs
// the sale_order_advance_alloc split this helper does not yet write.
function commonColumns(
  ctx: BillAdjustmentContext,
  routing: { adjType: string; settlementMode: string },
  actor: string,
  now: Date,
): Omit<
  Prisma.AccBillAdjustmentUncheckedCreateInput,
  'abjBillId' | 'abjBillAccYear' | 'abjRowNo' | 'abjDrCr' | 'abjAmount'
> {
  return {
    abjCompanyId: ctx.companyId,
    abjBranchId: ctx.branchId,
    abjTenantId: ctx.tenantId,
    abjAccYear: ctx.accYear,
    abjPartyId: ctx.partyId,
    abjAdjType: routing.adjType,
    abjAdjDate: ctx.adjDate,
    abjSettlementMode: routing.settlementMode,
    abjUserId: ctx.userId,
    abjSessionId: ctx.sessionId,
    abjCreatedOn: now,
    abjCreatedBy: actor,
  };
}
// Re-reads the credit under a row lock, inside the caller's transaction.
//
// The panel was fetched seconds or minutes ago and another counter may have
// spent the credit since, so nothing about it is taken on trust. The lock is
// what makes the pending-amount check below hold: without it two counters can
// both read 5,000 pending, both pass, and the loser dies on ck_abl_settled with
// a bare 23514 instead of being told cleanly that the credit is spent.
//
// Raw SQL because Prisma has no FOR UPDATE. The predicates are the same ones the
// open-credits SELECT used, so a credit that would no longer be offered is no
// longer accepted either.
async function lockCredit(
  tx: Prisma.TransactionClient,
  ctx: BillAdjustmentContext,
  adjustment: SaveBillAdjustmentDto,
  index: number,
): Promise<LockedCredit> {
  const rows = await tx.$queryRaw<
    {
      abl_id: string;
      abl_acc_year: string;
      abl_bill_type: string;
      abl_dr_cr: string;
      abl_party_id: string;
      abl_doc_refno: string | null;
      abl_pending_amount: Prisma.Decimal;
      abl_alloc_amount: Prisma.Decimal;
    }[]
  >`
    SELECT abl_id, abl_acc_year, abl_bill_type, abl_dr_cr, abl_party_id,
           abl_doc_refno, abl_pending_amount, abl_alloc_amount
    FROM   accounts.acc_bill_balance
    WHERE  abl_id       = ${adjustment.againstBillId}::uuid
      AND  abl_acc_year = ${adjustment.againstBillAccYear}::bpchar
      AND  abl_company_id = ${ctx.companyId}::uuid
      AND  abl_is_deleted = false
      AND  abl_is_active  = true
    FOR UPDATE
  `;
  const credit = rows[0];
  if (!credit) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
      {
        field: `adjustments[${index}].againstBillId`,
        message:
          `No open credit ${adjustment.againstBillId} in accounting year ` +
          `${adjustment.againstBillAccYear} for this company. Re-open the adjustment panel and pick again.`,
      },
    ]);
  }
  if (credit.abl_party_id !== ctx.partyId) {
    // A credit belongs to the party who holds it. Spending someone else's is the
    // one mistake here that would silently produce a plausible-looking ledger.
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
      {
        field: `adjustments[${index}].againstBillId`,
        message: `Credit ${credit.abl_doc_refno ?? credit.abl_id} belongs to a different party.`,
      },
    ]);
  }
  if (credit.abl_dr_cr.trim() !== CREDIT_SIDE) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
      {
        field: `adjustments[${index}].againstBillId`,
        message:
          `${credit.abl_doc_refno ?? credit.abl_id} is a ${credit.abl_dr_cr.trim()} balance — the ` +
          'party owes it, so it cannot settle this bill.',
      },
    ]);
  }
  return {
    ablId: credit.abl_id,
    ablAccYear: credit.abl_acc_year,
    ablBillType: credit.abl_bill_type,
    ablDrCr: credit.abl_dr_cr,
    ablPartyId: credit.abl_party_id,
    ablDocRefno: credit.abl_doc_refno,
    ablPendingAmount: credit.abl_pending_amount,
    ablAllocAmount: credit.abl_alloc_amount,
  };
}
// How this credit settles, read off its OWN bill type and never off the
// payload's echo fields. A client that mislabels an advance as a credit note
// simply cannot post one.
function deriveRouting(
  credit: LockedCredit,
  index: number,
): { adjType: string; settlementMode: string } {
  const routing = CREDIT_ROUTING[credit.ablBillType];
  if (!routing) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
      {
        field: `adjustments[${index}].againstBillId`,
        message:
          `${credit.ablDocRefno ?? credit.ablId} is a ${credit.ablBillType} balance. Only ` +
          `${Object.keys(CREDIT_ROUTING).join(' and ')} credits can be adjusted against a sale bill.`,
      },
    ]);
  }
  return routing;
}
// 409, not 400: the payload was valid when the panel was drawn and the operator
// did nothing wrong — another counter spent the credit first. Retrying after a
// refresh is the fix, which is exactly what a conflict means.
function ensureCreditCovers(credit: LockedCredit, amount: Prisma.Decimal, index: number): void {
  if (credit.ablPendingAmount.greaterThanOrEqualTo(amount)) {
    return;
  }
  throwSalesConflict<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
    {
      field: `adjustments[${index}].amount`,
      message:
        `Credit ${credit.ablDocRefno ?? credit.ablId} has only ` +
        `${credit.ablPendingAmount.toString()} left, but ${amount.toString()} was adjusted ` +
        'against it. Another counter may have used it — re-open the adjustment panel.',
    },
  ]);
}
// Moves one bill's allocation by a signed delta. The database has no trigger
// doing this (see the file header), and abl_pending_amount / abl_status are
// STORED generated columns off abl_alloc_amount, so this update is the only
// thing that makes a settled credit stop being offered.
async function addToAllocation(
  tx: Prisma.TransactionClient,
  bill: { ablId: string; ablAccYear: string },
  delta: Prisma.Decimal,
  actor: string,
  now: Date,
): Promise<void> {
  await tx.accBillBalance.update({
    where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
    data: {
      ablAllocAmount: { increment: delta },
      ablModifiedOn: now,
      ablModifiedBy: actor,
    },
  });
}
// Rewrites the invoice's own allocation as tendered + adjusted.
//
// Set, not incremented, and deliberately so: resolveAllocation in
// bill-posting.helper stops maintaining abl_alloc_amount the moment any
// adjustment exists against the bill, so from that point this is the only writer
// and it must produce the whole figure. An absolute write is also what makes a
// re-save idempotent — reverse-then-repost lands on the same number as a first
// post of the same set.
//
// sbPaidAmt must therefore be TENDERS ONLY. If the client folds credit-note
// money into it (the settle screen's header keeps advances out in sbAdvanceAmt,
// but a credit note has no such field), the same money arrives twice and the
// guard below is what catches it, rather than ck_abl_settled failing the whole
// transaction with a bare 23514.
async function settleInvoiceAllocation(
  tx: Prisma.TransactionClient,
  ctx: BillAdjustmentContext,
  posted: PostedAdjustment[],
  actor: string,
  now: Date,
): Promise<void> {
  const adjusted = posted.reduce(
    (total, row) => total.plus(row.amount),
    new Prisma.Decimal(0),
  );
  const allocated = ctx.paidAmount.plus(adjusted);
  if (allocated.greaterThan(ctx.billAmount)) {
    throwSalesBadRequest<BillErrorDetail, BillErrorResponse>('Bill cannot be saved', [
      {
        field: 'adjustments',
        message:
          `${ctx.paidAmount.toString()} tendered plus ${adjusted.toString()} adjusted comes to ` +
          `${allocated.toString()}, which is more than the bill's ${ctx.billAmount.toString()}. ` +
          'Adjusted credits must not also be counted in sbPaidAmt.',
      },
    ]);
  }
  await tx.accBillBalance.update({
    where: { ablId_ablAccYear: { ablId: ctx.billId, ablAccYear: ctx.billAccYear } },
    data: {
      ablAllocAmount: allocated,
      ablModifiedOn: now,
      ablModifiedBy: actor,
    },
  });
}
// abj_row_no is an ordinal per bill with no unique index behind it, so this only
// has to keep the rows in the order they were written.
async function nextRowNo(tx: Prisma.TransactionClient, billId: string): Promise<number> {
  const highest = await tx.accBillAdjustment.aggregate({
    where: { abjBillId: billId },
    _max: { abjRowNo: true },
  });
  return (highest._max.abjRowNo ?? 0) + 1;
}
