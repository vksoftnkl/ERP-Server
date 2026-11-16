import { Prisma } from '@prisma/client';

/**
 * Plan §5.1 — THE definition of "billed not delivered", as SQL fragments every
 * reader composes: the Delivery Note, Pending Deliveries, the Godown Stock
 * Position, the Stock Summary, Physical Stock, the Sale Return and the bill.
 *
 *   eligible line  sb_status POSTED, not deleted, sb_delivery_mode PICKUP /
 *                  DISPATCH, line not deleted, not a service, not from a
 *                  delivery challan, sbi_bill_qty > 0
 *   billed         sbi_bill_qty (line unit)
 *   factor         sbi_to_base_factor when > 0, else the unit conversion's,
 *                  else 1 (the grid 208 / D68 rule)
 *   settled        Σ sde_settle_qty of the line's events
 *   given          Σ sde_out_qty
 *   pending        billed − settled (negative only for an over-given line,
 *                  decision 46)
 *   pending_base   pending × factor
 *   BND(holding)   Σ pending_base over eligible lines of that godown, item,
 *                  lot and bucket
 *
 * Readers sum the signed qty COLUMNS, never by kind, so a phase-2 event kind
 * (POD) needs no change here (§14). Grids 212–218 (seeded SQL) state the same
 * rule; a change here is a change there.
 *
 * Aliases are fixed SQL chosen by the caller (`Prisma.raw`), never request
 * values.
 */

/** sb_delivery_mode values whose lines wait in the godown. */
export const WAITING_MODES_SQL = Prisma.sql`('PICKUP', 'DISPATCH')`;

/** The prefilter (decision 36): bills whose cached status says something is open. */
export const OPEN_STATUSES_SQL = Prisma.sql`('PENDING', 'PART', 'OUT')`;

/** WHERE predicate of an eligible line. `b` = sales.sale_bill, `i` = sales.sale_bill_item. */
export function eligibleLineWhere(b = 'b', i = 'i'): Prisma.Sql {
  const B = Prisma.raw(b);
  const I = Prisma.raw(i);
  return Prisma.sql`${B}.sb_is_deleted = false
     AND ${B}.sb_status = 'POSTED'
     AND ${B}.sb_delivery_mode IN ('PICKUP', 'DISPATCH')
     AND ${I}.sbi_is_deleted = false
     AND ${I}.sbi_is_service = false
     AND COALESCE(${I}.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
     AND ${I}.sbi_bill_qty > 0`;
}

/** The same predicate as a boolean column expression (for readers that also see ineligible lines). */
export function eligibleLineExpr(b = 'b', i = 'i'): Prisma.Sql {
  return Prisma.sql`(${eligibleLineWhere(b, i)})`;
}

/** The line's base factor. `u` = inventory.item_unit_conversion of sbi_item_unit_id (LEFT JOIN). */
export function lineFactorSql(i = 'i', u = 'u'): Prisma.Sql {
  const I = Prisma.raw(i);
  const U = Prisma.raw(u);
  return Prisma.sql`(CASE WHEN ${I}.sbi_to_base_factor > 0 THEN ${I}.sbi_to_base_factor
              ELSE COALESCE(NULLIF(${U}.iuc_to_base_factor, 0), 1) END)`;
}

/**
 * Kilograms per line unit (plan §8.1 rule 8, confirmed on live data 2026-11-15):
 * the bill line's own weight per unit (sbi_weight_qty / sbi_bill_qty) when it
 * carries one, else the unit's iuc_uom_weight, else 0.
 */
export function lineUnitKgSql(i = 'i', u = 'u'): Prisma.Sql {
  const I = Prisma.raw(i);
  const U = Prisma.raw(u);
  return Prisma.sql`(CASE WHEN ${I}.sbi_weight_qty > 0 AND ${I}.sbi_bill_qty > 0
              THEN ${I}.sbi_weight_qty / ${I}.sbi_bill_qty
              ELSE COALESCE(${U}.iuc_uom_weight, 0) END)`;
}

/**
 * LATERAL (… ) <alias>: the line's event sums — settled_qty, settled_base,
 * given_qty, given_base — over sales.sale_delivery_event by (bill line, bill
 * year), the ix_sde_bill_item INCLUDE index. Join it `LEFT JOIN LATERAL … ON true`
 * and read every column through COALESCE(…, 0).
 */
export function lineEventSumsLateral(i = 'i'): Prisma.Sql {
  const I = Prisma.raw(i);
  return Prisma.sql`(SELECT SUM(e.sde_settle_qty)      AS settled_qty,
                 SUM(e.sde_settle_base_qty) AS settled_base,
                 SUM(e.sde_out_qty)         AS given_qty,
                 SUM(e.sde_out_base_qty)    AS given_base
            FROM sales.sale_delivery_event e
           WHERE e.sde_bill_item_id  = ${I}.sbi_id
             AND e.sde_bill_acc_year = ${I}.sbi_acc_year
             AND e.sde_is_deleted    = false)`;
}

/**
 * A CTE body: one row per ELIGIBLE line with something pending (≠ 0) in a
 * company + branch, read through the open-status prefilter. Columns:
 * bill_id, bill_acc_year, bill_refno, bill_date, cust_id, cust_name,
 * delivery_mode, line_id, line_acc_year, line_no, item_id, unit_id, godown_id,
 * lot_id, bucket, factor, unit_kg, billed_qty, settled_qty, given_qty,
 * pending_qty, pending_base.
 *
 * `extra` narrows it further (fixed SQL over aliases b / i); used by BND
 * readers to limit godowns / items.
 */
export function pendingLinesCte(
  companyId: string,
  branchId: string,
  extra: Prisma.Sql = Prisma.empty,
): Prisma.Sql {
  return Prisma.sql`
    SELECT b.sb_id AS bill_id, b.sb_acc_year AS bill_acc_year, b.sb_bill_refno AS bill_refno,
           b.sb_bill_date AS bill_date, b.sb_cust_id AS cust_id, b.sb_cust_name AS cust_name,
           b.sb_delivery_mode AS delivery_mode,
           i.sbi_id AS line_id, i.sbi_acc_year AS line_acc_year, i.sbi_line_no AS line_no,
           i.sbi_item_id AS item_id, i.sbi_item_unit_id AS unit_id, i.sbi_godown_id AS godown_id,
           i.sbi_lot_id AS lot_id, COALESCE(i.sbi_bucket, 'SALEABLE') AS bucket,
           ${lineFactorSql()} AS factor,
           ${lineUnitKgSql()} AS unit_kg,
           i.sbi_bill_qty AS billed_qty,
           COALESCE(ev.settled_qty, 0) AS settled_qty,
           COALESCE(ev.given_qty, 0) AS given_qty,
           i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
           (i.sbi_bill_qty - COALESCE(ev.settled_qty, 0)) * ${lineFactorSql()} AS pending_base
      FROM sales.sale_bill b
      JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
     WHERE b.sb_company_id = ${companyId}::uuid
       AND b.sb_branch_id  = ${branchId}::uuid
       AND b.sb_delivery_status IN ${OPEN_STATUSES_SQL}
       AND ${eligibleLineWhere()}
       AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0
       ${extra}`;
}
