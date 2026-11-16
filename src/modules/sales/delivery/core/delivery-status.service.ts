import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import type { BillKey, DeliveryStatus } from './delivery.constants';
import { lineEventSumsLateral } from './delivery-pending.sql';

/** What recompute found for one bill. */
export interface DeliveryStatusChange {
  billId: string;
  billAccYear: string;
  billRefno: string | null;
  statusBefore: string;
  statusAfter: DeliveryStatus;
  changed: boolean;
}

/**
 * Plan §5.2 / decision 36 — THE ONLY WRITER of `sale_bill.sb_delivery_status`
 * and `sb_delivered_on`.
 *
 * The status is a site-local derived cache of the events (used as the index
 * prefilter, `ix_sb_delivery_open`); the figures always come from the events.
 * Every path that changes a bill's lines, mode or events calls `recompute`
 * in its own transaction, after its writes:
 *
 *   bill post / cancel / amend / void · note post / cancel / goods back ·
 *   sale return post / cancel / amend · /deliveries/mode
 *
 *   1. not POSTED, deleted, Instant, or no eligible line          → NA
 *   2. a line with pending ≠ 0: nothing settled on any line        → PENDING
 *                               else (an over-given line too, d.46) → PART
 *   3. no line pending: Σ given > 0                                 → DELIVERED
 *      (sb_delivered_on = the latest live GIVEN / CLEANUP time)
 *                       else (all settled by returns)              → RETURNED
 *   OUT is reserved for phase 2 (POD).
 *
 * A row is written only when its value changes, so an unchanged bill is not
 * re-dirtied for sync.
 */
@Injectable()
export class DeliveryStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async recompute(
    tx: Prisma.TransactionClient,
    bills: readonly BillKey[],
  ): Promise<DeliveryStatusChange[]> {
    const uniq = new Map<string, BillKey>();
    for (const b of bills) {
      uniq.set(`${b.billId}|${b.billAccYear.trim()}`, {
        billId: b.billId,
        billAccYear: b.billAccYear.trim(),
      });
    }
    if (uniq.size === 0) {
      return [];
    }
    const ids = [...uniq.values()].map((b) => b.billId);
    const years = [...uniq.values()].map((b) => b.billAccYear);
    const rows = await tx.$queryRaw<
      {
        sb_id: string;
        sb_acc_year: string;
        sb_bill_refno: string | null;
        cur: string;
        cur_on: Date | null;
        sb_status: string;
        sb_is_deleted: boolean;
        sb_delivery_mode: string;
        lines: number;
        open_lines: number;
        any_settled: boolean;
        given: Prisma.Decimal | number | string | null;
        last_at: Date | null;
      }[]
    >`
      WITH k AS (
        SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[])::bpchar AS yr
      ),
      agg AS (
        SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_delivery_status AS cur,
               b.sb_delivered_on AS cur_on, b.sb_status, b.sb_is_deleted, b.sb_delivery_mode,
               COALESCE(l.lines, 0) AS lines, COALESCE(l.open_lines, 0) AS open_lines,
               COALESCE(l.any_settled, false) AS any_settled, COALESCE(l.given, 0) AS given,
               g.last_at
          FROM k
          JOIN sales.sale_bill b ON b.sb_id = k.id AND b.sb_acc_year = k.yr
          LEFT JOIN LATERAL (
            SELECT count(*) AS lines,
                   count(*) FILTER (WHERE i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0) AS open_lines,
                   bool_or(COALESCE(ev.settled_qty, 0) <> 0) AS any_settled,
                   SUM(COALESCE(ev.given_qty, 0)) AS given
              FROM sales.sale_bill_item i
              LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
             WHERE i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
               AND i.sbi_is_deleted = false
               AND i.sbi_is_service = false
               AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
               AND i.sbi_bill_qty > 0
          ) l ON true
          LEFT JOIN LATERAL (
            SELECT MAX(e.sde_event_datetime) AS last_at
              FROM sales.sale_delivery_event e
             WHERE e.sde_bill_id = b.sb_id AND e.sde_bill_acc_year = b.sb_acc_year
               AND e.sde_kind IN ('GIVEN', 'CLEANUP')
               AND e.sde_is_deleted = false
               AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'CANCEL')
          ) g ON true
      )
      SELECT a.sb_id, a.sb_acc_year, a.sb_bill_refno, a.cur, a.cur_on, a.sb_status, a.sb_is_deleted,
             a.sb_delivery_mode, a.lines::int AS lines, a.open_lines::int AS open_lines, a.any_settled,
             a.given, a.last_at
        FROM agg a`;

    const out: DeliveryStatusChange[] = [];
    for (const row of rows) {
      const want = deliveryStatusOf({
        billStatus: row.sb_status,
        deleted: row.sb_is_deleted,
        mode: row.sb_delivery_mode,
        lines: Number(row.lines),
        openLines: Number(row.open_lines),
        anySettled: row.any_settled === true,
        given: new Prisma.Decimal(String(row.given ?? 0)),
      });
      const r = { ...row, want, want_on: want === 'DELIVERED' ? row.last_at : null };
      const statusChanged = r.cur !== r.want;
      // The delivered time only matters on a DELIVERED bill; an NA bill keeps
      // whatever it had (a legacy row) unless its status moves.
      const onChanged =
        r.want === 'DELIVERED'
          ? (r.cur_on?.getTime() ?? null) !== (r.want_on?.getTime() ?? null)
          : statusChanged && r.cur_on !== null;
      if (statusChanged || onChanged) {
        await tx.$executeRaw`
          UPDATE sales.sale_bill
             SET sb_delivery_status = ${r.want},
                 sb_delivered_on    = ${r.want === 'DELIVERED' ? r.want_on : null}::timestamptz
           WHERE sb_id = ${r.sb_id}::uuid AND sb_acc_year = ${r.sb_acc_year}::bpchar`;
      }
      out.push({
        billId: r.sb_id,
        billAccYear: r.sb_acc_year.trim(),
        billRefno: r.sb_bill_refno,
        statusBefore: r.cur,
        statusAfter: r.want,
        changed: statusChanged,
      });
    }
    return out;
  }

  /** The current computed status of bills without writing (for previews). */
  async preview(
    client: Prisma.TransactionClient | null,
    bills: readonly BillKey[],
  ): Promise<Map<string, string>> {
    const c = client ?? (this.prisma as unknown as Prisma.TransactionClient);
    const out = new Map<string, string>();
    if (bills.length === 0) {
      return out;
    }
    const rows = await c.$queryRaw<{ sb_id: string; sb_delivery_status: string }[]>`
      SELECT sb_id, sb_delivery_status FROM sales.sale_bill
       WHERE sb_id = ANY(${bills.map((b) => b.billId)}::uuid[])`;
    for (const r of rows) {
      out.set(r.sb_id, r.sb_delivery_status);
    }
    return out;
  }
}

/** The aggregates §5.2 decides on, per bill. */
export interface DeliveryStatusInput {
  billStatus: string;
  deleted: boolean;
  mode: string;
  /** Eligible lines (§5.1). */
  lines: number;
  /** Eligible lines with pending ≠ 0 (an over-given line counts, decision 46). */
  openLines: number;
  /** Any eligible line with settled ≠ 0. */
  anySettled: boolean;
  /** Σ given (out) over the eligible lines. */
  given: Prisma.Decimal;
}

/**
 * Plan §5.2 as a pure function (the recompute's only decision):
 *   not POSTED / deleted / Instant / no eligible line → NA
 *   a line pending ≠ 0: nothing settled → PENDING, else PART
 *   nothing pending: Σ given > 0 → DELIVERED, else RETURNED
 */
export function deliveryStatusOf(a: DeliveryStatusInput): DeliveryStatus {
  if (a.billStatus !== 'POSTED' || a.deleted || (a.mode !== 'PICKUP' && a.mode !== 'DISPATCH') || a.lines === 0) {
    return 'NA';
  }
  if (a.openLines > 0) {
    return a.anySettled ? 'PART' : 'PENDING';
  }
  return a.given.greaterThan(0) ? 'DELIVERED' : 'RETURNED';
}
