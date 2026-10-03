import { Prisma } from '@prisma/client';
import { TENDER_TYPE } from '../posting/sales-doc.utils';

/**
 * notes (47) D1 / notes (49) item 2 — what the customer paid AT THE COUNTER is
 * an allocation against the bill, and is written as one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A posted bill's `abl_alloc_amount` used to be SEEDED with its counter tenders
 * and nothing else stood behind that figure. `BillBalanceRecomputeService` —
 * the one writer the receipt, the cheque verbs and the nightly sweep use —
 * derives `abl_alloc_amount` from `acc_bill_adjustment` rows ONLY, so the first
 * receipt against a part-paid bill recomputed it and the counter payment
 * vanished: bil00685 (cash 3,768, then rct00055 for 5) read 5 settled, 3,995
 * pending, where 227 was right.
 *
 * Now every settling counter tender is one `ALLOCATION` row on the bill:
 * `abj_tender_id` = the tender row, `abj_cheque_id` = its register row when it
 * is a cheque, `abj_voucher_id` = the voucher that took the money (the bill's
 * own, or a re-tender's contra). The recompute then counts it, and a bounced
 * bill cheque is reversed by the standard cheque path (`abj_cheque_id`), like
 * any receipt's.
 *
 * "Settling" = not voided, not deleted, not CREDIT (9) / TEMP_CR (8), amount >
 * 0 — the same set `settledByTenders` counts. Capped so the bill is never
 * over-allocated (ck_abl_settled).
 */

// ck_abj_settlement_mode, from acc_tender_types.ttm_type_id.
const SETTLEMENT_MODE_BY_TYPE: Record<number, string> = {
  [TENDER_TYPE.CASH]: 'CASH',
  [TENDER_TYPE.CARD]: 'CARD',
  [TENDER_TYPE.UPI]: 'UPI',
  [TENDER_TYPE.WALLET]: 'WALLET',
  [TENDER_TYPE.CHEQUE]: 'CHEQUE',
  [TENDER_TYPE.BANK]: 'BANK',
  [TENDER_TYPE.RRN]: 'BANK',
  [TENDER_TYPE.LOYALTY]: 'LOYALTY',
  [TENDER_TYPE.VOUCHER]: 'VOUCHER',
};
const NOT_SETTLING: number[] = [TENDER_TYPE.CREDIT, TENDER_TYPE.TEMP_CREDIT];
// A settling row moves the DR invoice, so it is a CR movement.
const INVOICE_MOVEMENT = 'CR';
const COUNTER_REMARKS = 'Paid at the counter';
const DROPPED_REMARKS = 'Tender no longer on the bill';
const ZERO = new Prisma.Decimal(0);
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export interface CounterAllocationScope {
  bill: {
    sbId: string;
    sbAccYear: string;
    sbCompanyId: string;
    sbBranchId: string;
    sbTenantId: string | null;
    sbBillDate: Date;
    sbUserId: string | null;
    sbSessionId: string | null;
  };
  /** The bill's live SALES receivable. */
  abl: { ablId: string; ablAccYear: string };
  partyId: string;
  /** The voucher a NEW row names, by tender row: the bill's own, or a re-tender's contra. */
  voucherFor: (tdId: string) => { voucherId: string; accYear: string } | null;
  /**
   * The most the counter rows may come to in all. /post passes bill − set-offs
   * (the set-off rows are written after these). Absent: the receivable's own
   * headroom (bill − discount − write-off − every other live row).
   */
  cap?: Prisma.Decimal;
  actor: string;
  now: Date;
}

export interface CounterAllocationResult {
  added: { abjId: string; tdId: string; amount: Prisma.Decimal; chequeId: string | null }[];
  dropped: number;
  /** Tenders that could not be allocated in full because the bill had no headroom left. */
  capped: { tdId: string; wanted: Prisma.Decimal; written: Prisma.Decimal }[];
}

/**
 * Makes the bill's counter rows match its live settling tenders:
 *   * a settling tender with no row yet gets one (in td_row_no order, capped);
 *   * a row whose tender is voided / deleted / no longer settling is soft
 *     deleted, with any reversal of it.
 * A tender that already HAS a row keeps it untouched — including one a bounce
 * has reversed, which must stay reversed.
 */
export async function syncCounterAllocations(
  tx: Prisma.TransactionClient,
  scope: CounterAllocationScope,
): Promise<CounterAllocationResult> {
  const tenders = await loadTenders(tx, scope.bill);
  const settling = tenders.filter(
    (t) =>
      !t.td_is_deleted &&
      !t.td_is_voided &&
      !NOT_SETTLING.includes(Number(t.td_tender_type_id)) &&
      new Prisma.Decimal(t.td_amount).greaterThan(0),
  );
  const settlingIds = new Set(settling.map((t) => t.td_id));
  const rows = await loadCounterRows(
    tx,
    scope.abl,
    tenders.map((t) => t.td_id),
  );

  // Drop the rows whose tender went away.
  const stale = rows.filter(
    (r) => r.abj_reversal_of_id === null && !settlingIds.has(r.abj_tender_id),
  );
  if (stale.length > 0) {
    const ids = stale.map((r) => r.abj_id);
    await tx.accBillAdjustment.updateMany({
      where: {
        OR: [{ abjId: { in: ids } }, { abjReversalOfId: { in: ids } }],
        abjIsDeleted: false,
      },
      data: {
        abjIsDeleted: true,
        abjRemarks: DROPPED_REMARKS,
        abjModifiedOn: scope.now,
        abjModifiedBy: scope.actor,
      },
    });
  }

  const hasRow = new Set(
    rows.filter((r) => r.abj_reversal_of_id === null).map((r) => r.abj_tender_id),
  );
  const missing = settling.filter((t) => !hasRow.has(t.td_id));
  const result: CounterAllocationResult = { added: [], dropped: stale.length, capped: [] };
  if (missing.length === 0) {
    return result;
  }

  let headroom = await headroomOf(tx, scope);
  let rowNo = await nextRowNo(tx, scope.abl.ablId);
  const userId = uuidOr(scope.bill.sbUserId, uuidOr(scope.actor, NIL_UUID));
  for (const t of missing) {
    const wanted = new Prisma.Decimal(t.td_amount);
    const amount = Prisma.Decimal.min(wanted, headroom);
    if (amount.lessThan(wanted)) {
      result.capped.push({ tdId: t.td_id, wanted, written: Prisma.Decimal.max(amount, ZERO) });
    }
    if (amount.lessThanOrEqualTo(0)) {
      continue;
    }
    const voucher = scope.voucherFor(t.td_id);
    const created = await tx.accBillAdjustment.create({
      data: {
        abjCompanyId: scope.bill.sbCompanyId,
        abjBranchId: scope.bill.sbBranchId,
        abjTenantId: scope.bill.sbTenantId,
        abjAccYear: voucher?.accYear ?? scope.bill.sbAccYear,
        abjBillId: scope.abl.ablId,
        abjBillAccYear: scope.abl.ablAccYear,
        abjPartyId: scope.partyId,
        abjRowNo: rowNo++,
        abjVoucherId: voucher?.voucherId ?? null,
        abjVoucherAccYear: voucher ? voucher.accYear : null,
        abjAdjType: 'ALLOCATION',
        abjAdjDate: scope.bill.sbBillDate,
        abjDrCr: INVOICE_MOVEMENT,
        abjAmount: amount,
        abjSettlementMode: SETTLEMENT_MODE_BY_TYPE[Number(t.td_tender_type_id)] ?? 'MIXED',
        abjTenderId: t.td_id,
        abjTenderAccYear: t.td_acc_year,
        // ck_abj_cheque_mode: a CHEQUE row names its instrument. The register
        // row exists by now — /post registers before it allocates.
        abjChequeId: t.apd_id,
        abjChequeAccYear: t.apd_id ? t.apd_acc_year : null,
        abjIsPostDated: false,
        abjRemarks: COUNTER_REMARKS,
        abjUserId: userId,
        abjSessionId: uuidOr(scope.bill.sbSessionId, null),
        abjCreatedOn: scope.now,
        abjCreatedBy: scope.actor,
      },
      select: { abjId: true },
    });
    result.added.push({ abjId: created.abjId, tdId: t.td_id, amount, chequeId: t.apd_id });
    headroom = headroom.minus(amount);
  }
  return result;
}

/**
 * Cancel / amend: the receivable is being retired, and its counter rows go with
 * it (soft deleted, reversals included). A re-post writes fresh ones against
 * the new receivable.
 */
export async function retireCounterAllocations(
  tx: Prisma.TransactionClient,
  bill: { sbId: string; sbAccYear: string },
  abl: { ablId: string; ablAccYear: string },
  actor: string,
  now: Date,
): Promise<number> {
  const tenders = await loadTenders(tx, bill);
  const rows = await loadCounterRows(
    tx,
    abl,
    tenders.map((t) => t.td_id),
  );
  if (rows.length === 0) {
    return 0;
  }
  const { count } = await tx.accBillAdjustment.updateMany({
    where: { abjId: { in: rows.map((r) => r.abj_id) }, abjIsDeleted: false },
    data: { abjIsDeleted: true, abjModifiedOn: now, abjModifiedBy: actor },
  });
  return count;
}

// ── internals ──────────────────────────────────────────────────────────────

interface TenderRow {
  td_id: string;
  td_acc_year: string;
  td_row_no: number;
  td_tender_type_id: number;
  td_amount: Prisma.Decimal;
  td_is_voided: boolean;
  td_is_deleted: boolean;
  apd_id: string | null;
  apd_acc_year: string | null;
}

// Every tender row of the bill — voided and deleted included, since their rows
// are the ones to drop — with the live register row of a cheque.
async function loadTenders(
  tx: Prisma.TransactionClient,
  bill: { sbId: string; sbAccYear: string },
): Promise<TenderRow[]> {
  return tx.$queryRaw<TenderRow[]>`
    SELECT t.td_id, t.td_acc_year, t.td_row_no, t.td_tender_type_id, t.td_amount,
           t.td_is_voided, t.td_is_deleted, p.apd_id, p.apd_acc_year
      FROM accounts.acc_tender_detail t
      LEFT JOIN LATERAL (
        SELECT p.apd_id, p.apd_acc_year FROM accounts.acc_pdc_register p
         WHERE p.apd_tender_id = t.td_id AND p.apd_is_deleted = false
           AND p.apd_status <> 'CANCELLED'
         LIMIT 1) p ON true
     WHERE t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
       AND t.td_src_doc_id = ${bill.sbId}::uuid AND t.td_acc_year = ${bill.sbAccYear}::char(9)
     ORDER BY t.td_row_no`;
}

// The counter rows on this receivable: ALLOCATION rows naming one of the bill's
// own tender rows, originals and their reversals, not deleted.
async function loadCounterRows(
  tx: Prisma.TransactionClient,
  abl: { ablId: string; ablAccYear: string },
  tenderIds: string[],
): Promise<{ abj_id: string; abj_tender_id: string; abj_reversal_of_id: string | null }[]> {
  if (tenderIds.length === 0) {
    return [];
  }
  return tx.$queryRaw`
    SELECT abj_id, abj_tender_id, abj_reversal_of_id
      FROM accounts.acc_bill_adjustment
     WHERE abj_bill_id = ${abl.ablId}::uuid AND abj_bill_acc_year = ${abl.ablAccYear}::char(9)
       AND abj_adj_type = 'ALLOCATION' AND abj_is_deleted = false
       AND abj_tender_id = ANY(${tenderIds}::uuid[])`;
}

// What the counter rows may still add: the cap, or the receivable's headroom
// after every live row already on it (set-offs, receipts, earlier counter rows,
// reversals netting), whichever is smaller.
async function headroomOf(
  tx: Prisma.TransactionClient,
  scope: CounterAllocationScope,
): Promise<Prisma.Decimal> {
  const [row] = await tx.$queryRaw<{ room: Prisma.Decimal | null }[]>`
    SELECT b.abl_bill_amount - b.abl_disc_amount - b.abl_writeoff_amount
           - COALESCE((SELECT SUM(a.abj_amount) FROM accounts.acc_bill_adjustment a
                        WHERE a.abj_bill_id = b.abl_id AND a.abj_bill_acc_year = b.abl_acc_year
                          AND a.abj_is_deleted = false
                          AND a.abj_adj_type IN ('ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER')), 0)
           AS room
      FROM accounts.acc_bill_balance b
     WHERE b.abl_id = ${scope.abl.ablId}::uuid AND b.abl_acc_year = ${scope.abl.ablAccYear}::char(9)`;
  const room = new Prisma.Decimal(row?.room ?? 0);
  const limited = scope.cap ? Prisma.Decimal.min(room, scope.cap) : room;
  return Prisma.Decimal.max(limited, ZERO);
}

async function nextRowNo(tx: Prisma.TransactionClient, billId: string): Promise<number> {
  const highest = await tx.accBillAdjustment.aggregate({
    where: { abjBillId: billId },
    _max: { abjRowNo: true },
  });
  return (highest._max.abjRowNo ?? 0) + 1;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOr<T extends string | null>(v: string | null | undefined, fallback: T): string | T {
  return v && UUID.test(v) ? v : fallback;
}
