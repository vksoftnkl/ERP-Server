import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  ensureBalanceRows,
  refreshReserved,
  reservationHoldingsOf,
} from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import { round4 } from './sales-doc.utils';

/**
 * `stock.stock_reservation` — what a CONFIRMED order holds against the shelf.
 *
 * A reservation is per LOT (`srv_lot_id` is NOT NULL), so confirming a line
 * walks the godown's holdings FEFO and reserves lot by lot until the line is
 * covered. What it cannot cover is reported as `SALES_RESERVE_SHORT` — a
 * WARNING, never a refusal (HANDOVER §3): an order is a promise, and a promise
 * the shelf cannot yet keep is still worth recording.
 *
 * A bill against the line CONSUMES; a cancel RELEASES. `srv_open_qty` is
 * generated and never written.
 *
 * `sbl_reserved_qty` ON THE BALANCE IS RECOMPUTED after every write here
 * (§1.3, `refreshReserved` — the one writer of that column), so
 * `sbl_available_qty`, which is GENERATED from it, is what the billing screen
 * and the transfer over-issue check read. It used to be written by nobody: 28
 * open reservations live, and the column read 0 everywhere.
 */
export interface ReservationLine {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemUnitId: string;
  godownId: string | null;
  bucket?: string | null;
  qty: number;
  expiresOn?: Date | null;
}

/** A signed base quantity against one sales-order line: + take, − give back. */
export interface OrderLineQty {
  docId: string;
  lineNo: number;
  baseQty: Prisma.Decimal;
}

/**
 * One net move per order line, in first-seen order; lines that net to zero
 * are dropped. A bill amend passes the new lines (+) and the posted ones (−),
 * so only the change reaches consume().
 */
export function netOrderLineMoves(entries: OrderLineQty[]): OrderLineQty[] {
  const byLine = new Map<string, OrderLineQty>();
  for (const e of entries) {
    const key = `${e.docId}|${e.lineNo}`;
    const seen = byLine.get(key);
    if (seen) {
      seen.baseQty = seen.baseQty.plus(e.baseQty);
    } else {
      byLine.set(key, { docId: e.docId, lineNo: e.lineNo, baseQty: e.baseQty });
    }
  }
  return [...byLine.values()].filter((m) => !m.baseQty.toDecimalPlaces(4).isZero());
}

export interface ReservationShort {
  code: 'SALES_RESERVE_SHORT';
  line: number;
  short: number;
  message: string;
}

@Injectable()
export class StockReservationService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(
    tx: Prisma.TransactionClient,
    doc: {
      docType: 'SALES_ORDER';
      docId: string;
      accYear: string;
      companyId: string;
      branchId: string;
      tenantId?: string | null;
      refno: string | null;
    },
    lines: ReservationLine[],
    actor: string,
    now: Date,
  ): Promise<{ reserved: Map<string, number>; warnings: ReservationShort[] }> {
    const reserved = new Map<string, number>();
    const warnings: ReservationShort[] = [];
    for (const line of lines) {
      const want = round4(line.qty);
      if (want <= 0) {
        continue;
      }
      if (!line.godownId) {
        warnings.push({
          code: 'SALES_RESERVE_SHORT',
          line: line.lineNo,
          short: want,
          message: `Line ${line.lineNo}: no godown on the line, nothing reserved`,
        });
        continue;
      }
      // srv_base_uom_id is a foreign key to item_unit_conversion, NOT to the
      // unit master: it takes the item's BASE conversion row (factor 1), the
      // same one sales-stock.service writes to svi_base_uom_id. Writing
      // iuc_base_unit_id — a raw unit id — failed fk_srv_base_uom, and every
      // /sale-orders/post with a godown answered 500.
      const [unit] = await tx.$queryRaw<
        { base_iuc_id: string; iuc_to_base_factor: Prisma.Decimal }[]
      >`
        SELECT COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id, iuc.iuc_to_base_factor
          FROM inventory.item_unit_conversion iuc
          LEFT JOIN LATERAL (
            SELECT b.iuc_id FROM inventory.item_unit_conversion b
             WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit = true
               AND b.iuc_is_deleted = false
             ORDER BY b.iuc_unit_slno LIMIT 1
          ) base ON true
         WHERE iuc.iuc_id = ${line.itemUnitId}::uuid`;
      const factor = Number(unit?.iuc_to_base_factor ?? 1) || 1;
      let wantBase = round4(want * factor);
      // Already open for this line (an amend re-confirms): release first, reserve fresh.
      await tx.$executeRaw`
        UPDATE stock.stock_reservation
           SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
               srv_closed_on = ${now}, srv_close_reason = 'Re-reserved', srv_modified_on = ${now}, srv_modified_by = ${actor}
         WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid AND srv_line_no = ${line.lineNo}
           AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
      // The release above changed what is free, so the balance is brought up
      // to date BEFORE it is read: sbl_available_qty already nets every open
      // reservation, and subtracting them again here counted each one twice.
      await refreshReserved(tx, reservationHoldingsOf(doc.docType, doc.docId), actor, now);
      const holdings = await tx.$queryRaw<{ sbl_lot_id: string; free: Prisma.Decimal | null }[]>`
        SELECT b.sbl_lot_id, b.sbl_available_qty AS free
          FROM stock.stock_balance b
          JOIN stock.stock_lot l ON l.slt_id = b.sbl_lot_id
         WHERE b.sbl_company_id = ${doc.companyId}::uuid AND b.sbl_branch_id = ${doc.branchId}::uuid
           AND b.sbl_godown_id = ${line.godownId}::uuid AND b.sbl_item_id = ${line.itemId}::uuid
           AND b.sbl_bucket = ${line.bucket ?? 'SALEABLE'} AND b.sbl_is_deleted = false
         ORDER BY l.slt_expiry_date NULLS LAST, b.sbl_first_in_date NULLS LAST`;
      let got = 0;
      for (const h of holdings) {
        if (wantBase <= 0) {
          break;
        }
        const free = round4(Number(h.free ?? 0));
        if (free <= 0) {
          continue;
        }
        const take = Math.min(free, wantBase);
        await tx.$executeRaw`
          INSERT INTO stock.stock_reservation (
            srv_company_id, srv_branch_id, srv_tenant_id, srv_acc_year, srv_godown_id, srv_item_id, srv_lot_id,
            srv_base_uom_id, srv_bucket, srv_src_module, srv_src_doc_type, srv_src_doc_id, srv_src_acc_year,
            srv_src_refno, srv_line_no, srv_reserved_qty, srv_reserved_on, srv_expires_on, srv_status, srv_created_on, srv_created_by
          ) VALUES (
            ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId ?? null}::uuid, ${doc.accYear}::char(9),
            ${line.godownId}::uuid, ${line.itemId}::uuid, ${h.sbl_lot_id}::uuid, ${unit.base_iuc_id}::uuid,
            ${line.bucket ?? 'SALEABLE'}, 'SALES', ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::char(9),
            ${doc.refno}, ${line.lineNo}, ${take}::numeric, ${now}, ${line.expiresOn ?? null}, 'OPEN', ${now}, ${actor}
          )`;
        wantBase = round4(wantBase - take);
        got = round4(got + take);
      }
      // Every holding this line now holds carries its reservation on the balance.
      await ensureBalanceRows(tx, reservationHoldingsOf(doc.docType, doc.docId), actor);
      await refreshReserved(tx, reservationHoldingsOf(doc.docType, doc.docId), actor, now);
      reserved.set(line.lineId, round4(got / factor));
      if (wantBase > 0.0005) {
        const short = round4(wantBase / factor);
        warnings.push({
          code: 'SALES_RESERVE_SHORT',
          line: line.lineNo,
          short,
          message: `Line ${line.lineNo}: only ${round4(got / factor)} of ${want} could be reserved (${short} short)`,
        });
      }
    }
    return { reserved, warnings };
  }

  /** Cancel: every open reservation of the document is released. */
  async release(
    tx: Prisma.TransactionClient,
    doc: { docType: string; docId: string },
    reason: string,
    actor: string,
    now: Date,
  ): Promise<number> {
    const released = await tx.$executeRaw`
      UPDATE stock.stock_reservation
         SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
             srv_closed_on = ${now}, srv_close_reason = ${reason}, srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid
         AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
    if (released > 0) {
      await refreshReserved(tx, reservationHoldingsOf(doc.docType, doc.docId), actor, now);
    }
    return released;
  }

  /**
   * A bill against an order line takes from its reservations, FEFO. `qty` is
   * in BASE units. Negative gives back (a cancelled bill).
   *
   * GIVE-BACK ONTO A NEWER HOLD (user, 2026-11-11). `ux_srv_source` allows ONE
   * live (OPEN / PARTIAL) row per key (acc year, module, doc, line, lot,
   * godown, bucket) and ignores terminal rows (20261111100000). An amend of a
   * confirmed order releases the line's live rows and inserts fresh ones, so a
   * line can carry a terminal row AND a live row on the same key. Reopening the
   * terminal row on a give-back would then be a second live row: 23505. So a
   * give-back that lands on a terminal row whose key already has a live row
   * hands the returned quantity to that live row instead:
   *   - the old row: consumed -= give, released += give; it stays terminal
   *     (the status rule below: consumed + released still covers reserved, and
   *     released > 0, so RELEASED), and keeps its srv_closed_on;
   *   - the live row: srv_reserved_qty += give, status from its own figures.
   * The order then holds its whole pending quantity, as if there had been no
   * amend. Without a live row on the key a CONSUMED row is reopened, as
   * before (the order is live again).
   *
   * A RELEASED row (an amend released the unbilled part of a PARTIAL row, or
   * a desk close / cancel released the order) is only read on a give-back,
   * AFTER every other row, so live and CONSUMED rows take a give-back first.
   * It is never reopened: with a live row on its key it hands its consumed
   * quantity over as above; with none, the give-back is only recorded on it
   * (consumed −= give, released += give; still RELEASED, open 0, closed_on
   * kept), so its consumed figure follows the bill and no hold comes back
   * (user, 2026-11-11).
   *
   * srv_open_qty (generated) and sbl_reserved_qty (refreshReserved) are never
   * written here.
   */
  async consume(
    tx: Prisma.TransactionClient,
    order: { docId: string; lineNo: number },
    baseQty: number | Prisma.Decimal,
    actor: string,
    now: Date,
  ): Promise<void> {
    let left = new Prisma.Decimal(baseQty).toDecimalPlaces(4);
    if (left.isZero()) {
      return;
    }
    const giveBack = left.isNegative();
    const found = await tx.$queryRaw<ConsumeRow[]>`
      SELECT r.srv_id, r.srv_acc_year, r.srv_src_module, r.srv_lot_id, r.srv_godown_id, r.srv_bucket,
             r.srv_status, r.srv_reserved_qty, r.srv_consumed_qty, r.srv_released_qty
        FROM stock.stock_reservation r
        JOIN stock.stock_lot l ON l.slt_id = r.srv_lot_id
       WHERE r.srv_src_doc_type = 'SALES_ORDER' AND r.srv_src_doc_id = ${order.docId}::uuid AND r.srv_line_no = ${order.lineNo}
         AND r.srv_is_deleted = false
         AND (r.srv_status IN ('OPEN', 'PARTIAL', 'CONSUMED')
              OR (${giveBack}::boolean AND r.srv_status = 'RELEASED' AND r.srv_consumed_qty > 0))
       ORDER BY (r.srv_status = 'RELEASED'), l.slt_expiry_date NULLS LAST, r.srv_reserved_on
       FOR UPDATE OF r`;
    // Every row of the line is held here with its figures as they are AFTER
    // the writes so far, so a row reopened earlier in this call is seen as
    // the live row of its key by the rows after it.
    const rows: HeldRow[] = found.map((r) => ({
      id: r.srv_id,
      accYear: r.srv_acc_year,
      key: [r.srv_acc_year, r.srv_src_module, r.srv_lot_id, r.srv_godown_id, r.srv_bucket].join(
        '|',
      ),
      status: r.srv_status,
      reserved: new Prisma.Decimal(r.srv_reserved_qty),
      consumed: new Prisma.Decimal(r.srv_consumed_qty),
      released: new Prisma.Decimal(r.srv_released_qty),
    }));
    const liveOn = (row: HeldRow) =>
      rows.find((o) => o !== row && o.key === row.key && LIVE.has(o.status));
    for (const r of rows) {
      if (left.isZero()) {
        break;
      }
      if (!giveBack) {
        // A take lands only where there is room, i.e. on a live row: a
        // CONSUMED or RELEASED row has none, so billing after an amend draws
        // on the new live hold and never reopens the old row.
        const room = r.reserved.minus(r.consumed).minus(r.released);
        if (room.lte(0)) {
          continue;
        }
        const take = Prisma.Decimal.min(room, left);
        left = left.minus(take);
        await this.writeConsumed(tx, r, r.consumed.plus(take), actor, now);
        continue;
      }
      if (r.consumed.lte(0)) {
        continue;
      }
      const give = Prisma.Decimal.min(r.consumed, left.negated());
      const live = LIVE.has(r.status) ? undefined : liveOn(r);
      if (live) {
        left = left.plus(give);
        await this.releaseGiveBack(tx, r, give, HANDED_OVER_REASON, actor, now);
        await this.holdMore(tx, live, give, actor, now);
        continue;
      }
      if (r.status === 'RELEASED') {
        // Released by an amend, a desk close or a cancel, and no live hold on
        // its lot now: the hold does not come back (user, 2026-11-11), but the
        // record follows the bill, so consumed − give and released + give.
        // Open stays 0, so no stock is held and the lot figure is unchanged.
        left = left.plus(give);
        await this.releaseGiveBack(tx, r, give, RELEASED_GIVE_BACK_REASON, actor, now);
        continue;
      }
      left = left.plus(give);
      await this.writeConsumed(tx, r, r.consumed.minus(give), actor, now);
    }
    if (rows.length > 0) {
      await refreshReserved(tx, reservationHoldingsOf('SALES_ORDER', order.docId), actor, now);
    }
  }

  /** One row's consumed quantity moves (a take, or a give-back on the row itself). */
  private async writeConsumed(
    tx: Prisma.TransactionClient,
    r: HeldRow,
    next: Prisma.Decimal,
    actor: string,
    now: Date,
  ): Promise<void> {
    const status = reservationStatus(r.reserved, next, r.released);
    await tx.$executeRaw`
      UPDATE stock.stock_reservation
         SET srv_consumed_qty = ${next}::numeric, srv_status = ${status},
             srv_closed_on = CASE WHEN ${status} IN ('CONSUMED', 'RELEASED') THEN ${now} ELSE NULL END,
             srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_id = ${r.id}::uuid AND srv_acc_year = ${r.accYear}::char(9)`;
    r.consumed = next;
    r.status = status;
  }

  /**
   * A give-back on a terminal row that is not reopened: what it gives back is
   * recorded as released, so the row stays terminal (RELEASED) with open 0
   * and keeps its srv_closed_on. Either the live row of its key holds the
   * quantity next (holdMore), or, with no live row, nothing does.
   */
  private async releaseGiveBack(
    tx: Prisma.TransactionClient,
    from: HeldRow,
    give: Prisma.Decimal,
    reason: string,
    actor: string,
    now: Date,
  ): Promise<void> {
    const consumed = from.consumed.minus(give);
    const released = from.released.plus(give);
    const status = reservationStatus(from.reserved, consumed, released);
    await tx.$executeRaw`
      UPDATE stock.stock_reservation
         SET srv_consumed_qty = ${consumed}::numeric, srv_released_qty = ${released}::numeric,
             srv_status = ${status}, srv_closed_on = COALESCE(srv_closed_on, ${now}),
             srv_close_reason = COALESCE(srv_close_reason, ${reason}),
             srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_id = ${from.id}::uuid AND srv_acc_year = ${from.accYear}::char(9)`;
    from.consumed = consumed;
    from.released = released;
    from.status = status;
  }

  /** The live row of a key takes over what a terminal row gave back. */
  private async holdMore(
    tx: Prisma.TransactionClient,
    to: HeldRow,
    give: Prisma.Decimal,
    actor: string,
    now: Date,
  ): Promise<void> {
    const reserved = to.reserved.plus(give);
    const toStatus = reservationStatus(reserved, to.consumed, to.released);
    await tx.$executeRaw`
      UPDATE stock.stock_reservation
         SET srv_reserved_qty = ${reserved}::numeric, srv_status = ${toStatus},
             srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_id = ${to.id}::uuid AND srv_acc_year = ${to.accYear}::char(9)`;
    to.reserved = reserved;
    to.status = toStatus;
  }
}

interface ConsumeRow {
  srv_id: string;
  srv_acc_year: string;
  srv_src_module: string;
  srv_lot_id: string;
  srv_godown_id: string;
  srv_bucket: string;
  srv_status: string;
  srv_reserved_qty: Prisma.Decimal;
  srv_consumed_qty: Prisma.Decimal;
  srv_released_qty: Prisma.Decimal;
}

interface HeldRow {
  id: string;
  accYear: string;
  /** The ux_srv_source key within one order line: acc year, module, lot, godown, bucket. */
  key: string;
  status: string;
  reserved: Prisma.Decimal;
  consumed: Prisma.Decimal;
  released: Prisma.Decimal;
}

/** The statuses ux_srv_source covers: one per key. */
const LIVE: ReadonlySet<string> = new Set(['OPEN', 'PARTIAL']);

const HANDED_OVER_REASON = 'Bill cancelled: quantity returned to the newer hold';
const RELEASED_GIVE_BACK_REASON = 'Bill quantity given back after the hold was released';

/**
 * Settled (consumed + released covers reserved): RELEASED if any of it was
 * given back, else CONSUMED. Otherwise PARTIAL once anything is consumed,
 * else OPEN.
 */
function reservationStatus(
  reserved: Prisma.Decimal,
  consumed: Prisma.Decimal,
  released: Prisma.Decimal,
): string {
  if (consumed.plus(released).gte(reserved)) {
    return released.gt(0) ? 'RELEASED' : 'CONSUMED';
  }
  return consumed.gt(0) ? 'PARTIAL' : 'OPEN';
}
