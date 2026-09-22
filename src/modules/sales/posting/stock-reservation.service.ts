import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
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
      const [unit] = await tx.$queryRaw<
        { iuc_base_unit_id: string; iuc_to_base_factor: Prisma.Decimal }[]
      >`
        SELECT iuc_base_unit_id, iuc_to_base_factor FROM inventory.item_unit_conversion WHERE iuc_id = ${line.itemUnitId}::uuid`;
      const factor = Number(unit?.iuc_to_base_factor ?? 1) || 1;
      let wantBase = round4(want * factor);
      // Already open for this line (an amend re-confirms): release first, reserve fresh.
      await tx.$executeRaw`
        UPDATE stock.stock_reservation
           SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
               srv_closed_on = ${now}, srv_close_reason = 'Re-reserved', srv_modified_on = ${now}, srv_modified_by = ${actor}
         WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid AND srv_line_no = ${line.lineNo}
           AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
      const holdings = await tx.$queryRaw<{ sbl_lot_id: string; free: Prisma.Decimal | null }[]>`
        SELECT b.sbl_lot_id,
               b.sbl_available_qty - COALESCE((SELECT SUM(r.srv_open_qty) FROM stock.stock_reservation r
                                                WHERE r.srv_lot_id = b.sbl_lot_id AND r.srv_godown_id = b.sbl_godown_id
                                                  AND r.srv_status IN ('OPEN', 'PARTIAL') AND r.srv_is_deleted = false), 0) AS free
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
            ${line.godownId}::uuid, ${line.itemId}::uuid, ${h.sbl_lot_id}::uuid, ${unit.iuc_base_unit_id}::uuid,
            ${line.bucket ?? 'SALEABLE'}, 'SALES', ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::char(9),
            ${doc.refno}, ${line.lineNo}, ${take}::numeric, ${now}, ${line.expiresOn ?? null}, 'OPEN', ${now}, ${actor}
          )`;
        wantBase = round4(wantBase - take);
        got = round4(got + take);
      }
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
    return tx.$executeRaw`
      UPDATE stock.stock_reservation
         SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
             srv_closed_on = ${now}, srv_close_reason = ${reason}, srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid
         AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
  }

  /**
   * A bill against an order line takes from its reservations, FEFO. `qty` is
   * in BASE units. Negative gives back (a cancelled bill).
   */
  async consume(
    tx: Prisma.TransactionClient,
    order: { docId: string; lineNo: number },
    baseQty: number,
    actor: string,
    now: Date,
  ): Promise<void> {
    let left = round4(baseQty);
    if (left === 0) {
      return;
    }
    const rows = await tx.$queryRaw<
      {
        srv_id: string;
        srv_acc_year: string;
        srv_reserved_qty: Prisma.Decimal;
        srv_consumed_qty: Prisma.Decimal;
        srv_released_qty: Prisma.Decimal;
      }[]
    >`
      SELECT r.srv_id, r.srv_acc_year, r.srv_reserved_qty, r.srv_consumed_qty, r.srv_released_qty
        FROM stock.stock_reservation r
        JOIN stock.stock_lot l ON l.slt_id = r.srv_lot_id
       WHERE r.srv_src_doc_type = 'SALES_ORDER' AND r.srv_src_doc_id = ${order.docId}::uuid AND r.srv_line_no = ${order.lineNo}
         AND r.srv_is_deleted = false AND r.srv_status IN ('OPEN', 'PARTIAL', 'CONSUMED')
       ORDER BY l.slt_expiry_date NULLS LAST, r.srv_reserved_on
       FOR UPDATE OF r`;
    for (const r of rows) {
      if (Math.abs(left) < 0.0005) {
        break;
      }
      const reserved = Number(r.srv_reserved_qty);
      const consumed = Number(r.srv_consumed_qty);
      const released = Number(r.srv_released_qty);
      let next: number;
      if (left > 0) {
        const room = round4(reserved - consumed - released);
        if (room <= 0) {
          continue;
        }
        const take = Math.min(room, left);
        next = round4(consumed + take);
        left = round4(left - take);
      } else {
        if (consumed <= 0) {
          continue;
        }
        const give = Math.min(consumed, -left);
        next = round4(consumed - give);
        left = round4(left + give);
      }
      const status =
        round4(next + released) >= reserved - 0.0005
          ? released > 0
            ? 'RELEASED'
            : 'CONSUMED'
          : next > 0
            ? 'PARTIAL'
            : 'OPEN';
      await tx.$executeRaw`
        UPDATE stock.stock_reservation
           SET srv_consumed_qty = ${next}::numeric, srv_status = ${status},
               srv_closed_on = CASE WHEN ${status} IN ('CONSUMED', 'RELEASED') THEN ${now} ELSE NULL END,
               srv_modified_on = ${now}, srv_modified_by = ${actor}
         WHERE srv_id = ${r.srv_id}::uuid AND srv_acc_year = ${r.srv_acc_year}::char(9)`;
    }
  }
}
