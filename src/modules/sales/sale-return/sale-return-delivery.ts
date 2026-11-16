import { Prisma } from '@prisma/client';
import { DELIVERY_ERROR_CODES } from '../delivery/core/delivery.constants';
import type { DeliveryPendingService } from '../delivery/core/delivery-pending.service';
import type { DocRow } from '../posting/sales-doc-store';
import { D, ZERO, n, r3, r6, type Dec } from './sale-return-money';

/**
 * Delivery tracking (plan 2026-11-15 §8.4 item 9, addendum 1 §5.2, decisions
 * 56, 62–65, 67) — the part of a sale return that was NEVER TAKEN.
 *
 * A Pickup / Dispatch bill line still has goods waiting in the godown
 * (pending = billed − settled events). A return against it may say how much
 * of what comes back never left the godown: `sri_undelivered_qty`, "Not
 * taken". At post that part writes a RETURN event (settle +u, out 0) against
 * the bill line, so billed-not-delivered drops by u while the whole row still
 * comes IN as stock (A3: Owned +q, BND −u, Physical unchanged for the
 * not-taken part — explainer row 8; the taken part is row 9).
 *
 * Default (decision 64): per row, in row order within a bill line —
 *   0 on a CLAIM, 0 when the row's godown or lot differs from the bill line's,
 *   0 on condition SCRAP, 0 on a line that is not eligible (§5.1);
 *   else min(row qty, pending − Not taken on earlier rows of the line),
 *   compared in base units, the result in the row's unit.
 * A typed value (`sriUndeliveredQty` sent) replaces the default and still
 * counts against the later rows' share.
 *
 * Rules, in this order (addendum §5.2):
 *   1 DELIVERY_RETURN_OVER_QTY   typed > the row's qty (return + free)
 *   2 DELIVERY_RETURN_CLAIM      a CLAIM with a value > 0
 *   3 DELIVERY_RETURN_OVER       Σ over the bill line > pending
 *   4 DELIVERY_RETURN_NOT_GIVEN  the taken part > given − taken by earlier returns
 *   5 DELIVERY_RETURN_GODOWN     a value > 0 in another godown / lot, or SCRAP
 *
 * Pure functions here; the service reads the facts (loadNotTakenLines) and
 * writes the events.
 */

/** One return row as the rules see it. Quantities in the ROW's unit unless named Base. */
export interface NotTakenRow {
  index: number;
  lineNo: number;
  sriId: string | null;
  billItemId: string | null;
  billAccYear: string | null;
  godownId: string | null;
  lotId: string | null;
  /** RESTOCK | DAMAGED | EXPIRED | SCRAP (null = RESTOCK). */
  condition: string | null;
  /** Return + free, in the row's unit. */
  qty: Dec;
  /** Row unit → base. */
  factor: Dec;
  /** What the client typed; null = use the default. */
  typed: Dec | null;
  unitName: string | null;
  /**
   * Review N7 — the figure this row keeps when nothing is typed: on an amend
   * of a POSTED return, the line's posted Not taken (0 included), in the
   * row's unit. Replaces the computed default; null / absent = none.
   */
  kept?: Dec | null;
}

/** One bill line's delivery facts, as this return sees them. */
export interface NotTakenBillLine {
  billItemId: string;
  billAccYear: string;
  billId: string;
  billRefno: string | null;
  lineNo: number;
  itemId: string;
  /** §5.1 eligible: posted, Pickup / Dispatch, a goods line, not from a challan. */
  eligible: boolean;
  godownId: string;
  lotId: string | null;
  /** Bill line unit → base. */
  factor: Dec;
  /** Pending (base) before this return: the events, with this return's own RETURN events added back. */
  pendingBase: Dec;
  /** Σ out (base): what physically left. */
  givenBase: Dec;
  /** The TAKEN part of every other posted return of the line (base). */
  takenBeforeBase: Dec;
  unitName: string | null;
  godownName: string | null;
  lotNo: string | null;
}

export interface NotTakenIssue {
  code: string;
  message: string;
  field: string;
  line: number;
  params: Record<string, string | number>;
}

export interface NotTakenResolved {
  index: number;
  /** The server's default (row unit). */
  defaultQty: Dec;
  /** Typed, else the default (row unit) — what is stored. */
  resolvedQty: Dec;
  resolvedBase: Dec;
  /** The bill line's pending before this return, in the ROW's unit (0 when not eligible). */
  billPendingQty: Dec;
  billPendingBase: Dec;
}

export interface NotTakenBillLineAfter {
  billId: string;
  billAccYear: string;
  billRefno: string | null;
  billItemId: string;
  billLineNo: number;
  unitName: string | null;
  /** Bill line unit. */
  pendingBefore: Dec;
  pendingAfter: Dec;
  /** Σ resolved of this return, bill line unit (what the RETURN events settle). */
  settleQty: Dec;
  settleBase: Dec;
}

export interface NotTakenVerdict {
  rows: NotTakenResolved[];
  /** In rule order (1 … 5), then row order. */
  issues: NotTakenIssue[];
  /** The eligible bill lines this return touches. */
  delivery: NotTakenBillLineAfter[];
}

const lineKey = (billItemId: string, billAccYear: string): string =>
  `${billItemId}|${billAccYear.trim()}`;

/** A quantity as the wording shows it: up to 3 places, no trailing zeros. */
const fmt = (v: Dec): string => r3(v).toString();

/** A code this file adds beside the core list (worded in Error_Messages.json 2026-11-15.6). */
export const DELIVERY_RETURN_CODES_ADDED = {
  DELIVERY_RETURN_AMEND_LOCKED: 'DELIVERY_RETURN_AMEND_LOCKED',
} as const;

/** Rounds DOWN to 3 places: a default never grows past what is left. */
const down3 = (v: Dec): Dec => v.toDecimalPlaces(3, Prisma.Decimal.ROUND_DOWN);

/** Work out the default, the stored figure and every refusal of a return's rows. */
export function resolveNotTaken(
  rows: readonly NotTakenRow[],
  billLines: ReadonlyMap<string, NotTakenBillLine>,
  claim: boolean,
): NotTakenVerdict {
  const remaining = new Map<string, Dec>();
  const resolved: NotTakenResolved[] = [];
  const byRule: NotTakenIssue[][] = [[], [], [], [], []];
  const perLine = new Map<
    string,
    { bl: NotTakenBillLine; resolvedBase: Dec; takenBase: Dec; firstLine: number }
  >();

  for (const r of rows) {
    const key = r.billItemId && r.billAccYear ? lineKey(r.billItemId, r.billAccYear) : null;
    const bl = key ? (billLines.get(key) ?? null) : null;
    const qtyBase = r.qty.times(r.factor);
    const condition = (r.condition ?? 'RESTOCK').toUpperCase();
    const sameHolding =
      !!bl &&
      (r.godownId ?? bl.godownId) === bl.godownId &&
      (r.lotId ?? bl.lotId) === bl.lotId;
    const pendingBase = bl?.eligible ? Prisma.Decimal.max(ZERO, bl.pendingBase) : ZERO;
    const left = key ? (remaining.get(key) ?? pendingBase) : ZERO;

    let defaultBase = ZERO;
    if (!claim && bl?.eligible && sameHolding && condition !== 'SCRAP' && left.gt(0)) {
      defaultBase = Prisma.Decimal.min(qtyBase, left);
    }
    const factor = r.factor.gt(0) ? r.factor : D(1);
    // N7 — a posted line's own figure stands in for the default on an amend.
    const defaultQty = r.kept ?? down3(defaultBase.dividedBy(factor));
    const resolvedQty = r.typed ?? defaultQty;
    const resolvedBase = resolvedQty.times(factor);
    if (key) {
      remaining.set(key, left.minus(resolvedBase));
    }
    resolved.push({
      index: r.index,
      defaultQty,
      resolvedQty,
      resolvedBase,
      billPendingQty: down3(pendingBase.dividedBy(factor)),
      billPendingBase: pendingBase,
    });

    const unit = r.unitName ?? '';
    // 1 — more not taken than the row returns (typed, or a kept posted figure
    // an amend cut the qty below: refused, never silently changed — N7).
    const asked = r.typed ?? r.kept ?? null;
    if (asked !== null && asked.gt(r.qty)) {
      byRule[0].push({
        code: DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER_QTY,
        message: `Line ${r.lineNo}: ${fmt(asked)} ${unit} marked not taken, but only ${fmt(r.qty)} ${unit} are being returned`,
        field: 'sriUndeliveredQty',
        line: r.lineNo,
        params: { n: r.lineNo, u: fmt(asked), unit, qty: fmt(r.qty) },
      });
    }
    // 2 — a claim is for goods the customer had.
    if (claim && resolvedQty.gt(0)) {
      byRule[1].push({
        code: DELIVERY_ERROR_CODES.DELIVERY_RETURN_CLAIM,
        message: `Line ${r.lineNo}: a claim is for goods the customer had, but ${fmt(resolvedQty)} ${unit} are marked never taken`,
        field: 'sriUndeliveredQty',
        line: r.lineNo,
        params: { n: r.lineNo, u: fmt(resolvedQty), unit },
      });
    }
    // 5 — goods never taken stay in the bill line's godown and lot, never SCRAP.
    if (resolvedQty.gt(0) && bl && (!sameHolding || condition === 'SCRAP')) {
      byRule[4].push({
        code: DELIVERY_ERROR_CODES.DELIVERY_RETURN_GODOWN,
        message: `Line ${r.lineNo}: goods never taken stay in ${bl.godownName ?? bl.godownId}, lot ${bl.lotNo ?? '-'} (condition Good, Damaged or Expired)`,
        field: condition === 'SCRAP' ? 'sriCondition' : 'sriGodownId',
        line: r.lineNo,
        params: { n: r.lineNo, godown: bl.godownName ?? '', lot: bl.lotNo ?? '' },
      });
    }
    // 3 / 4 are per bill line; a not-taken figure with no eligible line behind it is over pending.
    if (!bl || !bl.eligible) {
      if (resolvedQty.gt(0)) {
        byRule[2].push({
          code: DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER,
          message: `Line ${r.lineNo}: ${fmt(resolvedQty)} marked not taken, but nothing is still to give on ${bl?.billRefno ?? 'this bill line'}`,
          field: 'sriUndeliveredQty',
          line: r.lineNo,
          params: { n: r.lineNo, qty: fmt(resolvedQty), pending: '0', bill: bl?.billRefno ?? '' },
        });
      }
      continue;
    }
    const acc = perLine.get(key!) ?? {
      bl,
      resolvedBase: ZERO,
      takenBase: ZERO,
      firstLine: r.lineNo,
    };
    acc.resolvedBase = acc.resolvedBase.plus(resolvedBase);
    acc.takenBase = acc.takenBase.plus(Prisma.Decimal.max(ZERO, qtyBase.minus(resolvedBase)));
    perLine.set(key!, acc);
  }

  const delivery: NotTakenBillLineAfter[] = [];
  for (const { bl, resolvedBase, takenBase, firstLine } of perLine.values()) {
    const blFactor = bl.factor.gt(0) ? bl.factor : D(1);
    const pendingBase = Prisma.Decimal.max(ZERO, bl.pendingBase);
    const unit = bl.unitName ?? '';
    // 3 — not more not-taken than is still to give.
    if (resolvedBase.gt(pendingBase)) {
      byRule[2].push({
        code: DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER,
        message: `Line ${firstLine}: ${fmt(resolvedBase.dividedBy(blFactor))} ${unit} marked not taken, but only ${fmt(pendingBase.dividedBy(blFactor))} ${unit} are still to give on ${bl.billRefno ?? 'the bill'}`,
        field: 'sriUndeliveredQty',
        line: firstLine,
        params: {
          n: firstLine,
          qty: fmt(resolvedBase.dividedBy(blFactor)),
          pending: fmt(pendingBase.dividedBy(blFactor)),
          bill: bl.billRefno ?? '',
        },
      });
    }
    // 4 — the taken part must have left the godown (and not come back on an earlier return).
    const available = Prisma.Decimal.max(ZERO, bl.givenBase.minus(bl.takenBeforeBase));
    if (takenBase.gt(available)) {
      const min = takenBase.minus(available);
      byRule[3].push({
        code: DELIVERY_ERROR_CODES.DELIVERY_RETURN_NOT_GIVEN,
        message: `Line ${firstLine}: only ${fmt(available.dividedBy(blFactor))} ${unit} were given; the rest was never taken — mark at least ${fmt(min.dividedBy(blFactor))} ${unit} as not taken`,
        field: 'sriUndeliveredQty',
        line: firstLine,
        params: {
          n: firstLine,
          given: fmt(available.dividedBy(blFactor)),
          min: fmt(min.dividedBy(blFactor)),
          unit,
        },
      });
    }
    const settleBase = r6(resolvedBase);
    delivery.push({
      billId: bl.billId,
      billAccYear: bl.billAccYear,
      billRefno: bl.billRefno,
      billItemId: bl.billItemId,
      billLineNo: bl.lineNo,
      unitName: bl.unitName,
      pendingBefore: r3(bl.pendingBase.dividedBy(blFactor)),
      pendingAfter: r3(bl.pendingBase.minus(resolvedBase).dividedBy(blFactor)),
      settleQty: r3(resolvedBase.dividedBy(blFactor)),
      settleBase,
    });
  }

  return { rows: resolved, issues: byRule.flat(), delivery };
}

/**
 * The bill's computed delivery status (plan §5.2) from its eligible lines'
 * settled / pending / given — what /validate shows as deliveryStatusAfter.
 */
export function deliveryStatusOf(
  lines: readonly { eligible: boolean; pending: Dec; settled: Dec; given: Dec }[],
  billPostedWaiting: boolean,
): string {
  const el = lines.filter((l) => l.eligible);
  if (!billPostedWaiting || el.length === 0) {
    return 'NA';
  }
  if (el.some((l) => !l.pending.isZero())) {
    return el.some((l) => !l.settled.isZero()) ? 'PART' : 'PENDING';
  }
  return el.reduce((s, l) => s.plus(l.given), ZERO).gt(0) ? 'DELIVERED' : 'RETURNED';
}

/** The rows of a return body (after the money: the bill keys and factors are server-filled). */
export function notTakenRowsOf(
  items: readonly DocRow[],
  money: { lines: readonly { qty: Dec; factor: Dec; billItemId: string | null; billAccYear: string | null }[] },
  unitNames: ReadonlyMap<string, string>,
): NotTakenRow[] {
  return items.map((item, i) => {
    const m = money.lines[i];
    const typedRaw = item.sriUndeliveredQty;
    const typed =
      typedRaw === undefined || typedRaw === null || typedRaw === '' ? null : D(typedRaw as string);
    const qty = m ? m.qty : D(item.sriReturnQty as string).plus(D(item.sriFreeQty as string));
    return {
      index: i,
      lineNo: (item.sriLineNo as number | null) ?? i + 1,
      sriId: (item.sriId as string | null | undefined) ?? null,
      billItemId: m?.billItemId ?? (item.sriBillItemId as string | null) ?? null,
      billAccYear:
        (m?.billAccYear ?? (item.sriBillAccYear as string | null) ?? null)?.trim() ?? null,
      godownId: (item.sriGodownId as string | null) ?? null,
      lotId: (item.sriLotId as string | null) ?? null,
      condition: (item.sriCondition as string | null) ?? null,
      qty,
      factor: m && m.factor.gt(0) ? m.factor : D((item.sriToBaseFactor as string) || 1),
      typed,
      unitName: unitNames.get(item.sriItemUnitId as string) ?? null,
    };
  });
}

/**
 * Review N7 (user, 2026-11-16: absent on an amend always means "keep") — an
 * amend of a POSTED return (its re-save, its /validate preview, and /get's
 * `undeliveredDefaultQty`): EVERY row that names a posted line (sriId) and
 * sends no `sriUndeliveredQty` keeps that line's posted figure — a line with
 * a live RETURN keeps its figure, a line posted with 0 keeps 0. Nothing is
 * defaulted again from today's pending. `posted` = the posted lines' stored
 * figure and unit factor; the kept figure is converted to the row's unit.
 * Rows naming no posted line (added by the amend) take the default; a typed
 * value still wins (a number changes it, 0 clears).
 */
export function withKeptNotTaken(
  rows: readonly NotTakenRow[],
  posted: ReadonlyMap<string, { qty: Dec; factor: Dec }>,
): NotTakenRow[] {
  return rows.map((r) => {
    const p = r.sriId ? posted.get(r.sriId) : undefined;
    if (!p) {
      return r;
    }
    const was = p.factor.gt(0) ? p.factor : D(1);
    const factor = r.factor.gt(0) ? r.factor : D(1);
    const kept = p.qty.times(was).dividedBy(factor).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
    return { ...r, kept };
  });
}

/** sriId → the stored Not taken and unit factor of a return's lines (withKeptNotTaken's `posted`). */
export function postedNotTakenOf(items: readonly DocRow[]): Map<string, { qty: Dec; factor: Dec }> {
  const out = new Map<string, { qty: Dec; factor: Dec }>();
  for (const i of items) {
    const id = i.sriId as string | null | undefined;
    if (!id) {
      continue;
    }
    const raw = i.sriUndeliveredQty;
    out.set(id, {
      qty: raw === undefined || raw === null || raw === '' ? ZERO : D(raw as string),
      factor: D((i.sriToBaseFactor as string) || 1),
    });
  }
  return out;
}

/**
 * The bill-line facts the rules need: §5.1 through the shared reader, with
 * this return's own live RETURN events added back to pending (an amend keeps
 * them, decision below), the TAKEN part of every other posted return, and the
 * names the wording shows.
 */
export async function loadNotTakenLines(
  tx: Prisma.TransactionClient,
  pending: Pick<DeliveryPendingService, 'linesByKeys'>,
  rows: readonly NotTakenRow[],
  srId: string | null,
): Promise<Map<string, NotTakenBillLine>> {
  const keys = new Map<string, { billItemId: string; billAccYear: string }>();
  for (const r of rows) {
    if (r.billItemId && r.billAccYear) {
      keys.set(lineKey(r.billItemId, r.billAccYear), {
        billItemId: r.billItemId,
        billAccYear: r.billAccYear,
      });
    }
  }
  const out = new Map<string, NotTakenBillLine>();
  if (keys.size === 0) {
    return out;
  }
  const facts = await pending.linesByKeys(tx, [...keys.values()]);
  const eligible = facts.filter((f) => f.eligible);
  if (facts.length === 0) {
    return out;
  }
  const ids = facts.map((f) => f.billItemId);
  const own = new Map<string, Dec>();
  const taken = new Map<string, Dec>();
  const names = new Map<string, { unit: string | null; godown: string | null; lot: string | null }>();
  if (eligible.length > 0) {
    const eligibleIds = eligible.map((f) => f.billItemId);
    if (srId) {
      const ownRows = await tx.$queryRaw<{ id: string; base: Prisma.Decimal | null }[]>`
        SELECT sde_bill_item_id AS id, SUM(sde_settle_base_qty) AS base
          FROM sales.sale_delivery_event
         WHERE sde_src_doc_type = 'SALE_RETURN' AND sde_src_doc_id = ${srId}::uuid
           AND sde_bill_item_id = ANY(${eligibleIds}::uuid[])
           AND sde_is_deleted = false
         GROUP BY sde_bill_item_id`;
      for (const o of ownRows) {
        own.set(o.id, D(o.base ?? 0));
      }
    }
    const takenRows = await tx.$queryRaw<{ id: string; base: Prisma.Decimal | null }[]>`
      SELECT sri.sri_bill_item_id AS id,
             SUM((COALESCE(sri.sri_return_qty, 0) + COALESCE(sri.sri_free_qty, 0) - sri.sri_undelivered_qty)
                 * CASE WHEN sri.sri_to_base_factor > 0 THEN sri.sri_to_base_factor
                        ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END) AS base
        FROM sales.sale_return_item sri
        JOIN sales.sale_return sr ON sr.sr_id = sri.sri_return_id AND sr.sr_acc_year = sri.sri_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = sri.sri_item_unit_id
       WHERE sri.sri_bill_item_id = ANY(${eligibleIds}::uuid[])
         AND sri.sri_is_deleted = false
         AND sr.sr_is_deleted = false
         AND sr.sr_status = 'POSTED'
         AND sr.sr_id <> ${srId ?? '00000000-0000-0000-0000-000000000000'}::uuid
       GROUP BY sri.sri_bill_item_id`;
    for (const t of takenRows) {
      taken.set(t.id, D(t.base ?? 0));
    }
  }
  const nameRows = await tx.$queryRaw<
    { id: string; unit_name: string | null; godown_name: string | null; lot_no: string | null }[]
  >`
    SELECT i.sbi_id AS id, um.unit_name, gd.gdl_name AS godown_name, lt.slt_batch_no AS lot_no
      FROM sales.sale_bill_item i
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
      LEFT JOIN inventory.godown_locations gd ON gd.gdl_id = i.sbi_godown_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = i.sbi_lot_id
     WHERE i.sbi_id = ANY(${ids}::uuid[])`;
  for (const r of nameRows) {
    names.set(r.id, { unit: r.unit_name, godown: r.godown_name, lot: r.lot_no });
  }
  for (const f of facts) {
    const nm = names.get(f.billItemId);
    out.set(lineKey(f.billItemId, f.billAccYear), {
      billItemId: f.billItemId,
      billAccYear: f.billAccYear,
      billId: f.billId,
      billRefno: f.billRefno,
      lineNo: f.lineNo,
      itemId: f.itemId,
      eligible: f.eligible,
      godownId: f.godownId,
      lotId: f.lotId,
      factor: f.factor,
      pendingBase: f.eligible ? f.pendingBase.plus(own.get(f.billItemId) ?? ZERO) : ZERO,
      givenBase: f.givenBase,
      takenBeforeBase: taken.get(f.billItemId) ?? ZERO,
      unitName: nm?.unit ?? null,
      godownName: nm?.godown ?? null,
      lotNo: nm?.lot ?? null,
    });
  }
  return out;
}

/** The live RETURN events of a return, by its line (sri_id), and every sri ever given one. */
export async function returnEventsOf(
  tx: Prisma.TransactionClient,
  srId: string,
): Promise<{
  live: Map<string, { sdeId: string; accYear: string; settleQty: Dec; settleBase: Dec; billItemId: string; billAccYear: string; billId: string }>;
  ever: Set<string>;
}> {
  const rows = await tx.$queryRaw<
    {
      sde_id: string;
      sde_acc_year: string;
      sde_src_line_id: string | null;
      sde_settle_qty: Prisma.Decimal;
      sde_settle_base_qty: Prisma.Decimal;
      sde_bill_item_id: string;
      sde_bill_acc_year: string;
      sde_bill_id: string;
      reversed: boolean;
    }[]
  >`
    SELECT e.sde_id, e.sde_acc_year, e.sde_src_line_id, e.sde_settle_qty, e.sde_settle_base_qty,
           e.sde_bill_item_id, e.sde_bill_acc_year, e.sde_bill_id,
           EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                    WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'RETURN_CANCEL') AS reversed
      FROM sales.sale_delivery_event e
     WHERE e.sde_src_doc_type = 'SALE_RETURN' AND e.sde_src_doc_id = ${srId}::uuid
       AND e.sde_kind = 'RETURN' AND e.sde_is_deleted = false`;
  const live = new Map<
    string,
    { sdeId: string; accYear: string; settleQty: Dec; settleBase: Dec; billItemId: string; billAccYear: string; billId: string }
  >();
  const ever = new Set<string>();
  for (const r of rows) {
    if (!r.sde_src_line_id) {
      continue;
    }
    ever.add(r.sde_src_line_id);
    if (!r.reversed) {
      live.set(r.sde_src_line_id, {
        sdeId: r.sde_id,
        accYear: r.sde_acc_year.trim(),
        settleQty: D(r.sde_settle_qty),
        settleBase: D(r.sde_settle_base_qty),
        billItemId: r.sde_bill_item_id,
        billAccYear: r.sde_bill_acc_year.trim(),
        billId: r.sde_bill_id,
      });
    }
  }
  return { live, ever };
}

/**
 * The amend rule (ux_sde_return / ux_sde_reversal: one RETURN and one
 * RETURN_CANCEL per return line, ever). A posted line's not-taken figure is
 * kept or cleared on an amend, never changed: changing it would need a second
 * RETURN for the same line. DELIVERY_RETURN_AMEND_LOCKED otherwise.
 *
 * `settleOf(index)` is the row's new settle in the BILL line's unit.
 */
export function amendLockIssues(
  rows: readonly NotTakenRow[],
  verdict: NotTakenVerdict,
  events: { live: ReadonlyMap<string, { settleBase: Dec }>; ever: ReadonlySet<string> },
): NotTakenIssue[] {
  const issues: NotTakenIssue[] = [];
  rows.forEach((r, i) => {
    if (!r.sriId || !events.ever.has(r.sriId)) {
      return;
    }
    const nowBase = r6(verdict.rows[i]?.resolvedBase ?? ZERO);
    const live = events.live.get(r.sriId);
    const ok = live ? nowBase.isZero() || nowBase.equals(r6(live.settleBase)) : nowBase.isZero();
    if (!ok) {
      const was = live ? live.settleBase.dividedBy(r.factor.gt(0) ? r.factor : D(1)) : ZERO;
      issues.push({
        code: DELIVERY_RETURN_CODES_ADDED.DELIVERY_RETURN_AMEND_LOCKED,
        message: `Line ${r.lineNo}: ${fmt(was)} ${r.unitName ?? ''} not taken was posted with this return; an amend may keep it or set it to 0, not change it. Cancel the return and make a new one`,
        field: 'sriUndeliveredQty',
        line: r.lineNo,
        params: { n: r.lineNo, was: fmt(was), unit: r.unitName ?? '' },
      });
    }
  });
  return issues;
}

/** Decimal → JSON number (house answer shape). */
export const num = n;

/** iuc_id → the unit's name (the wording's {unit}). */
export async function unitNamesOf(
  tx: Prisma.TransactionClient,
  iucIds: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(iucIds.filter((x): x is string => typeof x === 'string' && x !== ''))];
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await tx.$queryRaw<{ id: string; name: string | null }[]>`
    SELECT u.iuc_id AS id, um.unit_name AS name
      FROM inventory.item_unit_conversion u
      LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
     WHERE u.iuc_id = ANY(${ids}::uuid[])`;
  return new Map(rows.map((r) => [r.id, r.name ?? '']));
}
