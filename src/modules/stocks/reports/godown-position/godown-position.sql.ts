import { Prisma } from '@prisma/client';
import {
  OPEN_STATUSES_SQL,
  eligibleLineWhere,
  lineEventSumsLateral,
  lineFactorSql,
} from '../../../sales/delivery/core/delivery-pending.sql';

/**
 * Godown Stock Position (menu 306, delivery tracking plan §8.3) — the SQL.
 *
 *   Owned / Reserved / Free  stock.stock_balance (sbl_on_hand_qty / _reserved_qty / _available_qty)
 *   Billed not delivered     the §5.1 fragment (delivery-pending.sql.ts): Σ (billed − settled) × factor
 *                            over eligible open bill lines whose godown is this one
 *   Challan out              sale_dc_item.sdi_open_qty of POSTED challans
 *   Physical                 Owned + Billed not delivered (worked out in the rules, never stored)
 *
 * Everything is in BASE units here; the rules convert to the Qty-in unit.
 * Today only (stock_balance is now), as the Stock Summary's Reserved / Available.
 */
export interface PositionSqlScope {
  companyId: string;
  branchId: string;
  /** null = every godown of the branch. */
  godownId: string | null;
  /** null = ALL buckets. */
  bucket: string | null;
  groupId: string | null;
  brandId: string | null;
}

export interface PositionDbRow {
  item_id: string;
  godown_id: string;
  owned: Prisma.Decimal;
  reserved: Prisma.Decimal;
  free: Prisma.Decimal;
  bnd: Prisma.Decimal;
  /** BND read from the events' base columns (billed × factor − Σ sde_settle_base_qty): the tie. */
  bnd_ev: Prisma.Decimal;
  /** Σ −pending_base of over-given lines (decision 46), ≥ 0. */
  over_given: Prisma.Decimal;
  bill_ids: string[];
  dc_open: Prisma.Decimal;
  dc_ids: string[];
  last_refno: string | null;
  last_date: string | null;
  last_doc_id: string | null;
  last_doc_year: string | null;
}

export interface ItemFactDbRow {
  item_id: string;
  item_code: string | null;
  item_name: string | null;
  barcode: string | null;
  sell_factor: Prisma.Decimal;
  sell_unit: string;
  base_unit: string;
  kg_per_base: Prisma.Decimal;
}

function hasItemFilter(s: Pick<PositionSqlScope, 'groupId' | 'brandId'>): boolean {
  return !!s.groupId || !!s.brandId;
}

/**
 * `WITH [RECURSIVE gt, bt,] it AS (…), gd AS (…),` — the group / brand
 * subtree walked by parent (as the Stock Summary, D30) and the godowns of the
 * branch (or the one asked for).
 */
function withScope(s: PositionSqlScope): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (s.groupId) {
    parts.push(Prisma.sql`
    gt AS (
      SELECT g.itg_id AS id FROM inventory.item_group_master g WHERE g.itg_id = ${s.groupId}::uuid
      UNION
      SELECT c.itg_id FROM inventory.item_group_master c JOIN gt ON c.itg_parent_id = gt.id)`);
  }
  if (s.brandId) {
    parts.push(Prisma.sql`
    bt AS (
      SELECT b.brand_id AS id FROM inventory.item_brand_master b WHERE b.brand_id = ${s.brandId}::uuid
      UNION
      SELECT c.brand_id FROM inventory.item_brand_master c JOIN bt ON c.brand_parent_id = bt.id)`);
  }
  if (hasItemFilter(s)) {
    parts.push(Prisma.sql`
    it AS (
      SELECT i.item_id FROM inventory.item_master i
       WHERE true
         ${s.groupId ? Prisma.sql`AND i.item_group_id IN (SELECT id FROM gt)` : Prisma.empty}
         ${s.brandId ? Prisma.sql`AND i.item_brand_id IN (SELECT id FROM bt)` : Prisma.empty})`);
  }
  parts.push(Prisma.sql`
    gd AS (
      SELECT g.gdl_id FROM inventory.godown_locations g
       WHERE g.gdl_branch_id = ${s.branchId}::uuid AND g.gdl_is_deleted = false
         ${s.godownId ? Prisma.sql`AND g.gdl_id = ${s.godownId}::uuid` : Prisma.empty})`);
  return Prisma.sql`${hasItemFilter(s) ? Prisma.sql`WITH RECURSIVE` : Prisma.sql`WITH`} ${Prisma.join(parts, ',')}`;
}

function itemIn(col: string, s: PositionSqlScope): Prisma.Sql {
  return hasItemFilter(s)
    ? Prisma.sql`AND ${Prisma.raw(col)} IN (SELECT item_id FROM it)`
    : Prisma.empty;
}

function bucketIs(col: string, s: PositionSqlScope): Prisma.Sql {
  return s.bucket ? Prisma.sql`AND COALESCE(${Prisma.raw(col)}, 'SALEABLE') = ${s.bucket}` : Prisma.empty;
}

/** The open bill lines of the scope (one row each), base units. */
function openLinesCte(s: PositionSqlScope, extra: Prisma.Sql = Prisma.empty): Prisma.Sql {
  return Prisma.sql`
    SELECT b.sb_id AS bill_id, b.sb_acc_year AS bill_acc_year,
           i.sbi_id AS line_id, i.sbi_line_no AS line_no,
           i.sbi_item_id AS item_id, i.sbi_godown_id AS godown_id, i.sbi_lot_id AS lot_id,
           ${lineFactorSql()} AS factor,
           i.sbi_bill_qty AS billed_qty,
           COALESCE(ev.given_qty, 0) AS given_qty,
           i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) AS pending_qty,
           (i.sbi_bill_qty - COALESCE(ev.settled_qty, 0)) * ${lineFactorSql()} AS pending_base,
           i.sbi_bill_qty * ${lineFactorSql()} - COALESCE(ev.settled_base, 0) AS pending_base_ev
      FROM sales.sale_bill b
      JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
      LEFT JOIN LATERAL ${lineEventSumsLateral()} ev ON true
     WHERE b.sb_company_id = ${s.companyId}::uuid
       AND b.sb_branch_id  = ${s.branchId}::uuid
       AND b.sb_delivery_status IN ${OPEN_STATUSES_SQL}
       AND ${eligibleLineWhere()}
       AND i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0
       AND i.sbi_godown_id IN (SELECT gdl_id FROM gd)
       ${bucketIs('i.sbi_bucket', s)}
       ${itemIn('i.sbi_item_id', s)}
       ${extra}`;
}

/** The last live GIVEN event of (item, godown) at the branch — the "Last given" cell. */
function lastGivenLateral(s: PositionSqlScope, item: string, godown: string): Prisma.Sql {
  return Prisma.sql`(
    SELECT e.sde_src_refno, e.sde_event_datetime, e.sde_src_doc_id, e.sde_src_acc_year
      FROM sales.sale_delivery_event e
     WHERE e.sde_company_id = ${s.companyId}::uuid
       AND e.sde_branch_id  = ${s.branchId}::uuid
       AND e.sde_godown_id  = ${Prisma.raw(godown)}
       AND e.sde_item_id    = ${Prisma.raw(item)}
       AND e.sde_kind       = 'GIVEN'
       AND e.sde_is_deleted = false
       AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                        WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'CANCEL')
     ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
     LIMIT 1)`;
}

/** Show — one row per item × godown with any owned, reserved, pending or challan figure. */
export function positionSql(s: PositionSqlScope): Prisma.Sql {
  return Prisma.sql`
    ${withScope(s)},
    own AS (
      SELECT sb.sbl_item_id AS item_id, sb.sbl_godown_id AS godown_id,
             SUM(sb.sbl_on_hand_qty) AS owned, SUM(sb.sbl_reserved_qty) AS reserved,
             SUM(sb.sbl_available_qty) AS free
        FROM stock.stock_balance sb
       WHERE sb.sbl_company_id = ${s.companyId}::uuid
         AND sb.sbl_branch_id  = ${s.branchId}::uuid
         AND sb.sbl_is_deleted = false
         AND sb.sbl_godown_id IN (SELECT gdl_id FROM gd)
         ${bucketIs('sb.sbl_bucket', s)}
         ${itemIn('sb.sbl_item_id', s)}
       GROUP BY sb.sbl_item_id, sb.sbl_godown_id),
    op AS (${openLinesCte(s)}),
    bnd AS (
      SELECT op.item_id, op.godown_id,
             SUM(op.pending_base) AS bnd,
             SUM(op.pending_base_ev) AS bnd_ev,
             COALESCE(SUM(-op.pending_base) FILTER (WHERE op.pending_base < 0), 0) AS over_given,
             array_agg(DISTINCT op.bill_id) AS bill_ids
        FROM op
       GROUP BY op.item_id, op.godown_id),
    dc AS (
      SELECT di.sdi_item_id AS item_id, di.sdi_godown_id AS godown_id,
             SUM(di.sdi_open_qty * CASE WHEN di.sdi_to_base_factor > 0 THEN di.sdi_to_base_factor
                                        ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END) AS dc_open,
             array_agg(DISTINCT d.sdc_id) AS dc_ids
        FROM sales.sale_dc d
        JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
       WHERE d.sdc_company_id = ${s.companyId}::uuid
         AND d.sdc_branch_id  = ${s.branchId}::uuid
         AND d.sdc_is_deleted = false
         AND d.sdc_status = 'POSTED'
         AND di.sdi_is_deleted = false
         AND di.sdi_open_qty > 0
         AND di.sdi_godown_id IN (SELECT gdl_id FROM gd)
         ${bucketIs('di.sdi_bucket', s)}
         ${itemIn('di.sdi_item_id', s)}
       GROUP BY di.sdi_item_id, di.sdi_godown_id),
    k AS (
      SELECT item_id, godown_id FROM own
      UNION SELECT item_id, godown_id FROM bnd
      UNION SELECT item_id, godown_id FROM dc)
    SELECT k.item_id, k.godown_id,
           COALESCE(own.owned, 0) AS owned, COALESCE(own.reserved, 0) AS reserved,
           COALESCE(own.free, 0) AS free,
           COALESCE(bnd.bnd, 0) AS bnd, COALESCE(bnd.bnd_ev, 0) AS bnd_ev,
           COALESCE(bnd.over_given, 0) AS over_given,
           COALESCE(bnd.bill_ids, '{}'::uuid[]) AS bill_ids,
           COALESCE(dc.dc_open, 0) AS dc_open, COALESCE(dc.dc_ids, '{}'::uuid[]) AS dc_ids,
           lg.sde_src_refno AS last_refno,
           (lg.sde_event_datetime AT TIME ZONE 'Asia/Kolkata')::date::text AS last_date,
           lg.sde_src_doc_id AS last_doc_id, btrim(lg.sde_src_acc_year) AS last_doc_year
      FROM k
      LEFT JOIN own ON own.item_id = k.item_id AND own.godown_id = k.godown_id
      LEFT JOIN bnd ON bnd.item_id = k.item_id AND bnd.godown_id = k.godown_id
      LEFT JOIN dc  ON dc.item_id  = k.item_id AND dc.godown_id  = k.godown_id
      LEFT JOIN LATERAL ${lastGivenLateral(s, 'k.item_id', 'k.godown_id')} lg ON true`;
}

/**
 * The items' facts: code, name, default barcode, the selling unit
 * (iuc_is_default_unit, else the base; Q16) and kg per BASE unit (the selling
 * unit's iuc_uom_weight ÷ its factor, else the base row's weight, else 0).
 */
export function itemFactsSql(itemIds: readonly string[]): Prisma.Sql {
  return Prisma.sql`
    SELECT im.item_id, im.item_code, im.item_name_en AS item_name,
           NULLIF(btrim(im.item_default_barcode), '') AS barcode,
           COALESCE(dfl.factor, 1) AS sell_factor,
           COALESCE(su.unit_name, bu.unit_name, bwu.unit_name, '') AS sell_unit,
           COALESCE(bu.unit_name, bwu.unit_name, '') AS base_unit,
           COALESCE(NULLIF(dfl.wt, 0) / NULLIF(dfl.factor, 0), NULLIF(bw.wt, 0), 0) AS kg_per_base
      FROM inventory.item_master im
      LEFT JOIN LATERAL (
        SELECT COALESCE(NULLIF(x.iuc_to_base_factor, 0), 1) AS factor, x.iuc_unit_id, x.iuc_uom_weight AS wt
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = im.item_id AND x.iuc_is_default_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno
         LIMIT 1) dfl ON true
      LEFT JOIN LATERAL (
        SELECT x.iuc_uom_weight AS wt, x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = im.item_id AND x.iuc_is_base_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno
         LIMIT 1) bw ON true
      LEFT JOIN inventory.item_unit_master su ON su.unit_id = dfl.iuc_unit_id
      LEFT JOIN inventory.item_unit_master bu ON bu.unit_id = im.item_base_unit_id
      LEFT JOIN inventory.item_unit_master bwu ON bwu.unit_id = bw.iuc_unit_id
     WHERE im.item_id = ANY(${[...itemIds]}::uuid[])`;
}

export interface BehindBillDbRow {
  bill_id: string;
  bill_acc_year: string;
  bill_refno: string | null;
  bill_date: string | null;
  days: number | null;
  cust_id: string | null;
  cust_name: string | null;
  area_name: string | null;
  mode: string;
  line_id: string;
  line_no: number;
  lot_id: string | null;
  lot_no: string | null;
  factor: Prisma.Decimal;
  billed_qty: Prisma.Decimal;
  given_qty: Prisma.Decimal;
  pending_qty: Prisma.Decimal;
  pending_base: Prisma.Decimal;
  last_refno: string | null;
  last_date: string | null;
  last_doc_id: string | null;
  last_doc_year: string | null;
}

/** /behind kind BND — the open bill lines of one item × godown, oldest bill first. */
export function behindBillsSql(s: PositionSqlScope, itemId: string): Prisma.Sql {
  return Prisma.sql`
    ${withScope(s)},
    op AS (${openLinesCte(s, Prisma.sql`AND i.sbi_item_id = ${itemId}::uuid`)})
    SELECT op.bill_id, btrim(op.bill_acc_year) AS bill_acc_year, b.sb_bill_refno AS bill_refno,
           b.sb_bill_date::text AS bill_date,
           ((now() AT TIME ZONE 'Asia/Kolkata')::date - b.sb_bill_date) AS days,
           b.sb_cust_id AS cust_id, COALESCE(c.cus_name, b.sb_cust_name) AS cust_name,
           a.arm_name AS area_name, b.sb_delivery_mode AS mode,
           op.line_id, op.line_no, op.lot_id, NULLIF(btrim(lt.slt_batch_no), '') AS lot_no,
           op.factor, op.billed_qty, op.given_qty, op.pending_qty, op.pending_base,
           lg.sde_src_refno AS last_refno,
           (lg.sde_event_datetime AT TIME ZONE 'Asia/Kolkata')::date::text AS last_date,
           lg.sde_src_doc_id AS last_doc_id, btrim(lg.sde_src_acc_year) AS last_doc_year
      FROM op
      JOIN sales.sale_bill b ON b.sb_id = op.bill_id AND b.sb_acc_year = op.bill_acc_year
      LEFT JOIN sales.customers c ON c.cus_id = b.sb_cust_id
      LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = op.lot_id
      LEFT JOIN LATERAL (
        SELECT e.sde_src_refno, e.sde_event_datetime, e.sde_src_doc_id, e.sde_src_acc_year
          FROM sales.sale_delivery_event e
         WHERE e.sde_bill_item_id = op.line_id AND e.sde_bill_acc_year = op.bill_acc_year
           AND e.sde_kind = 'GIVEN' AND e.sde_is_deleted = false
           AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                            WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'CANCEL')
         ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC
         LIMIT 1) lg ON true
     WHERE op.godown_id = ${s.godownId}::uuid
     ORDER BY b.sb_bill_date, b.sb_bill_refno, op.line_no`;
}

export interface BehindChallanDbRow {
  dc_id: string;
  dc_acc_year: string;
  dc_refno: string | null;
  dc_date: string | null;
  days: number | null;
  cust_id: string | null;
  cust_name: string | null;
  open_base: Prisma.Decimal;
  total_base: Prisma.Decimal;
}

/** /behind kind CHALLAN — the posted challans with open qty of one item × godown. */
export function behindChallansSql(s: PositionSqlScope, itemId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT d.sdc_id AS dc_id, btrim(d.sdc_acc_year) AS dc_acc_year, d.sdc_dc_refno AS dc_refno,
           d.sdc_dc_date::text AS dc_date,
           ((now() AT TIME ZONE 'Asia/Kolkata')::date - d.sdc_dc_date) AS days,
           d.sdc_cust_id AS cust_id, COALESCE(c.cus_name, d.sdc_cust_name) AS cust_name,
           SUM(di.sdi_open_qty * f.factor) AS open_base,
           SUM(di.sdi_dc_qty * f.factor) AS total_base
      FROM sales.sale_dc d
      JOIN sales.sale_dc_item di ON di.sdi_dc_id = d.sdc_id AND di.sdi_acc_year = d.sdc_acc_year
      LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = di.sdi_item_unit_id
      CROSS JOIN LATERAL (
        SELECT CASE WHEN di.sdi_to_base_factor > 0 THEN di.sdi_to_base_factor
                    ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END AS factor) f
      LEFT JOIN sales.customers c ON c.cus_id = d.sdc_cust_id
     WHERE d.sdc_company_id = ${s.companyId}::uuid
       AND d.sdc_branch_id  = ${s.branchId}::uuid
       AND d.sdc_is_deleted = false
       AND d.sdc_status = 'POSTED'
       AND di.sdi_is_deleted = false
       AND di.sdi_open_qty > 0
       AND di.sdi_item_id = ${itemId}::uuid
       AND di.sdi_godown_id = ${s.godownId}::uuid
       ${bucketIs('di.sdi_bucket', s)}
     GROUP BY d.sdc_id, d.sdc_acc_year, d.sdc_dc_refno, d.sdc_dc_date, d.sdc_cust_id, c.cus_name, d.sdc_cust_name
     ORDER BY d.sdc_dc_date, d.sdc_dc_refno`;
}

export interface ByLotDbRow {
  lot_id: string | null;
  lot_no: string | null;
  owned: Prisma.Decimal;
  reserved: Prisma.Decimal;
  free: Prisma.Decimal;
  bnd: Prisma.Decimal;
}

/** The row by lot: each lot's owned + not delivered = its physical (D5: a lot swap shows where the goods are). */
export function byLotSql(s: PositionSqlScope, itemId: string): Prisma.Sql {
  return Prisma.sql`
    ${withScope(s)},
    own AS (
      SELECT sb.sbl_lot_id AS lot_id, SUM(sb.sbl_on_hand_qty) AS owned,
             SUM(sb.sbl_reserved_qty) AS reserved, SUM(sb.sbl_available_qty) AS free
        FROM stock.stock_balance sb
       WHERE sb.sbl_company_id = ${s.companyId}::uuid
         AND sb.sbl_branch_id  = ${s.branchId}::uuid
         AND sb.sbl_is_deleted = false
         AND sb.sbl_godown_id  = ${s.godownId}::uuid
         AND sb.sbl_item_id    = ${itemId}::uuid
         ${bucketIs('sb.sbl_bucket', s)}
       GROUP BY sb.sbl_lot_id),
    op AS (${openLinesCte(s, Prisma.sql`AND i.sbi_item_id = ${itemId}::uuid AND i.sbi_godown_id = ${s.godownId}::uuid`)}),
    bnd AS (SELECT op.lot_id, SUM(op.pending_base) AS bnd FROM op GROUP BY op.lot_id),
    k AS (SELECT lot_id FROM own UNION SELECT lot_id FROM bnd)
    SELECT k.lot_id, NULLIF(btrim(lt.slt_batch_no), '') AS lot_no,
           COALESCE(own.owned, 0) AS owned, COALESCE(own.reserved, 0) AS reserved,
           COALESCE(own.free, 0) AS free, COALESCE(bnd.bnd, 0) AS bnd
      FROM k
      LEFT JOIN own ON own.lot_id IS NOT DISTINCT FROM k.lot_id
      LEFT JOIN bnd ON bnd.lot_id IS NOT DISTINCT FROM k.lot_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = k.lot_id
     ORDER BY lt.slt_first_inward_date NULLS LAST, lot_no NULLS LAST, k.lot_id`;
}
