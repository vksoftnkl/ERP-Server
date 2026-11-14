import { Prisma } from '@prisma/client';
import { costValueCol } from '../item-ledger/item-ledger.sql';
import { poolValuationCtes } from '../common/stock-valuation.sql';

/**
 * The Stock Summary's SQL (plan 2026-11-13 §5.4 / §5.5 / §5.7). Read-only; the
 * service runs every statement of one Show inside ONE read-only REPEATABLE
 * READ transaction with `plan_cache_mode = force_custom_plan` and `jit = off`.
 *
 * Optional filters are LEFT OUT rather than written `$x IS NULL OR …` (the
 * Item Ledger's `ledgerScopeWhere` rule), so no plan depends on a value.
 */

export interface SummarySqlScope {
  companyId: string;
  branchId: string;
  from: string;
  to: string;
  /** The day before `from`: the opening is the closing of this day. */
  openingAsOf: string;
  /** Scope: one godown; null = all. */
  godownId: string | null;
  /** Scope: one bucket; null = ALL. */
  bucket: string | null;
  /** Item filter: the group and its whole subtree (by parent id); null = all. */
  groupId: string | null;
  /** Item filter: the brand and its whole subtree; null = all. */
  brandId: string | null;
  /** Cost without tax (`_wot` columns). */
  wot: boolean;
}

const MOVE_TXNS = Prisma.sql`('TRANSFER_OUT','TRANSFER_IN','BUCKET_OUT','BUCKET_IN')`;

/** True when the group / brand filter restricts the items. */
export function hasItemFilter(s: Pick<SummarySqlScope, 'groupId' | 'brandId'>): boolean {
  return !!s.groupId || !!s.brandId;
}

/**
 * `gt` / `bt` / `it` — the items of the group / brand subtree (D30). The
 * subtree is walked by `itg_parent_id` / `brand_parent_id`, not read from
 * `itg_path_ids_cache` / `brand_path_ids`: on the dev box those caches are
 * not the subtree (a group with 4 children caches only itself; a child
 * caches its parent's path). UNION stops a parent loop. Leading `RECURSIVE`
 * is written by the caller's `WITH` (see `withItems`).
 */
function itemFilterCtes(s: SummarySqlScope): Prisma.Sql {
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
  parts.push(Prisma.sql`
    it AS (
      SELECT i.item_id FROM inventory.item_master i
       WHERE true
         ${s.groupId ? Prisma.sql`AND i.item_group_id IN (SELECT id FROM gt)` : Prisma.empty}
         ${s.brandId ? Prisma.sql`AND i.item_brand_id IN (SELECT id FROM bt)` : Prisma.empty})`);
  return Prisma.join(parts, ',');
}

/** `WITH [RECURSIVE gt, bt,] it AS (…),` — or `WITH` alone when no item filter is set. */
function withItems(s: SummarySqlScope): Prisma.Sql {
  return hasItemFilter(s) ? Prisma.sql`WITH RECURSIVE ${itemFilterCtes(s)},` : Prisma.sql`WITH`;
}

/** `AND <alias>.<col> IN (SELECT item_id FROM it)` when the item filter is set. */
function itemIn(col: string, s: SummarySqlScope): Prisma.Sql {
  return hasItemFilter(s)
    ? Prisma.sql`AND ${Prisma.raw(col)} IN (SELECT item_id FROM it)`
    : Prisma.empty;
}

/** The holding scope of a ledger row (godown, bucket). */
function inScope(alias: string, s: SummarySqlScope): Prisma.Sql {
  const a = Prisma.raw(alias);
  if (!s.godownId && !s.bucket) return Prisma.sql`true`;
  return Prisma.sql`(true
      ${s.godownId ? Prisma.sql`AND ${a}.sml_godown_id = ${s.godownId}::uuid` : Prisma.empty}
      ${s.bucket ? Prisma.sql`AND ${a}.sml_bucket = ${s.bucket}` : Prisma.empty})`;
}

/**
 * THE PASS (§5.4) — one row per holding (item × lot × godown × bucket) of the
 * branch with a ledger row up to `to`, EVERY godown and bucket (the pool needs
 * them; the scope is the `ins` flag):
 *
 *   op    the holdings before `from` — index-only on ix_sml_item_ledger;
 *   pr    the period rows `from` … `to`, with the natural direction (a
 *         reversal keeps its type with a minus, D9) and `ins`;
 *   mv    internal pairs: both legs of a godown transfer / bucket move IN
 *         SCOPE (the Item Ledger's own rule, D10/D15 — so the Movement pane,
 *         which is the Item Ledger's By-voucher-type, agrees on quantities);
 *   h     opening, period net, inward / outward (non-internal rows) per holding;
 *   vo_*  the engine's valuation at `from − 1` of the opening holdings;
 *   vc_*  the same at `to` of the closing holdings (D18).
 * The answer is in parts (see `PassPartRow`); `mergePass` joins them.
 */
export function passSql(s: SummarySqlScope): Prisma.Sql {
  const v = costValueCol('l', s.wot);
  return Prisma.sql`
    ${withItems(s)}
    op AS (
      SELECT l.sml_item_id AS item, l.sml_lot_id AS lot, l.sml_godown_id AS godown,
             l.sml_bucket::text AS bucket,
             SUM(l.sml_signed_base_qty) AS q, SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_branch_id = ${s.branchId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date < ${s.from}::date
         ${itemIn('l.sml_item_id', s)}
       GROUP BY 1, 2, 3, 4),
    pr AS (
      SELECT l.sml_item_id AS item, l.sml_lot_id AS lot, l.sml_godown_id AS godown,
             l.sml_bucket::text AS bucket,
             l.sml_signed_base_qty AS sq, l.sml_direction * ${v} AS sv,
             (CASE WHEN l.sml_is_reversal THEN -l.sml_direction ELSE l.sml_direction END)::int AS nat,
             l.sml_txn_type::text AS txn, l.sml_src_doc_id AS doc_id,
             COALESCE(l.sml_src_acc_year, l.sml_acc_year) AS src_year,
             l.sml_line_no AS line_no, l.sml_split_no AS split_no, l.sml_is_reversal AS is_rev,
             ${inScope('l', s)} AS ins
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_branch_id = ${s.branchId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date BETWEEN ${s.from}::date AND ${s.to}::date
         ${itemIn('l.sml_item_id', s)}),
    mv AS (
      SELECT item, doc_id, src_year, line_no, split_no, lot, is_rev
        FROM pr
       WHERE ins AND txn IN ${MOVE_TXNS}
       GROUP BY 1, 2, 3, 4, 5, 6, 7
      HAVING COUNT(DISTINCT nat) = 2),
    prc AS (
      SELECT pr.*, (mv.doc_id IS NOT NULL) AS internal
        FROM pr
        LEFT JOIN mv
          ON pr.ins AND pr.txn IN ${MOVE_TXNS}
         AND mv.item = pr.item AND mv.doc_id = pr.doc_id AND mv.src_year = pr.src_year
         AND mv.line_no = pr.line_no AND mv.split_no = pr.split_no
         AND mv.lot = pr.lot AND mv.is_rev = pr.is_rev),
    h AS (
      SELECT item, lot, godown, bucket,
             COALESCE(SUM(oq), 0) AS oq, COALESCE(SUM(ov), 0) AS ov,
             COALESCE(SUM(sq), 0) AS pq, COALESCE(SUM(sv), 0) AS pv,
             COALESCE(SUM(sq) FILTER (WHERE nat = 1 AND NOT internal), 0) AS iq,
             COALESCE(-SUM(sq) FILTER (WHERE nat = -1 AND NOT internal), 0) AS xq,
             COALESCE(SUM(sv) FILTER (WHERE nat = 1 AND NOT internal), 0) AS iv,
             COALESCE(-SUM(sv) FILTER (WHERE nat = -1 AND NOT internal), 0) AS xv,
             COUNT(sq)::int AS n
        FROM (SELECT item, lot, godown, bucket, q AS oq, v AS ov,
                     NULL::numeric AS sq, NULL::numeric AS sv, NULL::int AS nat, false AS internal
                FROM op
              UNION ALL
              SELECT item, lot, godown, bucket, NULL, NULL, sq, sv, nat, internal FROM prc) u
       GROUP BY 1, 2, 3, 4),
    ho AS (
      SELECT ${s.branchId}::uuid AS branch, item, lot, godown, bucket, oq AS q, ov AS v FROM h),
    hc AS (
      SELECT ${s.branchId}::uuid AS branch, item, lot, godown, bucket, oq + pq AS q, ov + pv AS v FROM h),
    ${poolValuationCtes({ holdings: 'ho', prefix: 'vo', companyId: s.companyId, asOf: s.openingAsOf, wot: s.wot })},
    ${poolValuationCtes({ holdings: 'hc', prefix: 'vc', companyId: s.companyId, asOf: s.to, wot: s.wot })}
    SELECT 'H'::text AS part, h.item, h.lot, h.godown, h.bucket,
           h.oq, h.pq, h.iq, h.xq, h.iv, h.xv, h.n, NULL::numeric AS value, NULL::text AS vm
      FROM h
    UNION ALL
    SELECT 'O', item, lot, godown, bucket, NULL, NULL, NULL, NULL, NULL, NULL, NULL, value, vm FROM vo_val
    UNION ALL
    SELECT 'C', item, lot, godown, bucket, NULL, NULL, NULL, NULL, NULL, NULL, NULL, value, vm FROM vc_val`;
}

/**
 * The pass answers in three parts (H = the holding's quantities and row
 * values, O / C = its engine value at from − 1 / at to), joined by
 * `mergePass` in TypeScript: a SQL join of the three needed a nested loop
 * the planner could not be talked out of (its estimate of a materialized
 * CTE is a few rows) — 68 ms of 163 ms on 982 holdings.
 */
export interface PassPartRow {
  part: 'H' | 'O' | 'C';
  item: string;
  lot: string;
  godown: string;
  bucket: string;
  oq: Prisma.Decimal | null;
  pq: Prisma.Decimal | null;
  iq: Prisma.Decimal | null;
  xq: Prisma.Decimal | null;
  iv: Prisma.Decimal | null;
  xv: Prisma.Decimal | null;
  n: number | null;
  value: Prisma.Decimal | null;
  vm: string | null;
}

/** Item facts for the run (§5.4 statement 4): names, codes, units, expiry warning days, company. */
export function factsSql(itemIds: readonly string[]): Prisma.Sql {
  return Prisma.sql`
    SELECT i.item_id, NULLIF(btrim(i.item_code), '') AS code, i.item_name_en AS name,
           NULLIF(btrim(i.item_default_barcode), '') AS barcode, NULLIF(btrim(i.item_sku), '') AS sku,
           i.item_group_id AS group_id, g.itg_name AS group_name,
           i.item_brand_id AS brand_id, br.brand_name,
           i.item_section_id AS section_id, sc.sec_name AS section_name,
           i.item_category_id AS category_id, ct.category_name,
           i.item_company_id AS company_id, i.item_intimate_before_days AS warn_days,
           COALESCE(NULLIF(btrim(bm.unit_alias), ''), bm.unit_name) AS base_unit,
           du.iuc_id AS default_iuc_id, du.iuc_to_base_factor AS default_factor,
           COALESCE(du.iuc_is_base_unit, false) AS default_is_base,
           COALESCE(NULLIF(btrim(dm.unit_alias), ''), dm.unit_name) AS default_unit
      FROM inventory.item_master i
      LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
      LEFT JOIN inventory.item_brand_master br ON br.brand_id = i.item_brand_id
      LEFT JOIN inventory.item_section_master sc ON sc.sec_id = i.item_section_id
      LEFT JOIN inventory.item_category_master ct ON ct.category_id = i.item_category_id
      LEFT JOIN LATERAL (
        SELECT x.iuc_unit_id
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = i.item_id AND x.iuc_is_base_unit = true AND x.iuc_is_deleted = false
         ORDER BY x.iuc_unit_slno NULLS LAST, x.iuc_id
         LIMIT 1) bu ON true
      LEFT JOIN inventory.item_unit_master bm ON bm.unit_id = COALESCE(bu.iuc_unit_id, i.item_base_unit_id)
      LEFT JOIN LATERAL (
        SELECT x.iuc_id, x.iuc_unit_id, x.iuc_to_base_factor, x.iuc_is_base_unit
          FROM inventory.item_unit_conversion x
         WHERE x.iuc_item_id = i.item_id AND x.iuc_is_default_unit = true AND x.iuc_is_deleted = false
           AND x.iuc_to_base_factor > 0
         ORDER BY x.iuc_unit_slno NULLS LAST, x.iuc_id
         LIMIT 1) du ON true
      LEFT JOIN inventory.item_unit_master dm ON dm.unit_id = du.iuc_unit_id
     WHERE i.item_id = ANY(${itemIds}::uuid[])`;
}

/**
 * The latest SALE ledger row up to `to` per item that is not reversed (D28):
 * a LATERAL on ix_sml_demand + an anti-join on ux_sml_reversal.
 */
export function lastSaleSql(
  s: Pick<SummarySqlScope, 'companyId' | 'branchId' | 'to'>,
  itemIds: readonly string[],
): Prisma.Sql {
  return Prisma.sql`
    SELECT k.item, ls.d::text AS last_sale
      FROM unnest(${itemIds}::uuid[]) AS k(item)
      LEFT JOIN LATERAL (
        SELECT x.sml_doc_date AS d
          FROM stock.stock_ledger x
         WHERE x.sml_company_id = ${s.companyId}::uuid
           AND x.sml_branch_id = ${s.branchId}::uuid
           AND x.sml_item_id = k.item
           AND x.sml_src_module = 'SALES'
           AND x.sml_is_deleted = false
           AND x.sml_txn_type = 'SALE'
           AND x.sml_is_reversal = false
           AND x.sml_doc_date <= ${s.to}::date
           AND NOT EXISTS (
             SELECT 1 FROM stock.stock_ledger y
              WHERE y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year
                AND y.sml_is_reversal = true AND y.sml_is_deleted = false)
         ORDER BY x.sml_doc_date DESC
         LIMIT 1) ls ON true`;
}

/**
 * Today-only (D17): the branch's stock_balance rows (ix_sbl_lookup) with
 * anything on them — on hand, reserved, transit-in, the stored value (the
 * tie) and the lot's expiry (the EXP chip). Every godown and bucket: the
 * service applies the scope.
 */
export function balanceNowSql(s: SummarySqlScope): Prisma.Sql {
  return Prisma.sql`
    ${hasItemFilter(s) ? Prisma.sql`WITH RECURSIVE ${itemFilterCtes(s)}` : Prisma.empty}
    SELECT b.sbl_item_id AS item, b.sbl_lot_id AS lot, b.sbl_godown_id AS godown,
           b.sbl_bucket::text AS bucket,
           b.sbl_on_hand_qty AS on_hand, b.sbl_reserved_qty AS reserved,
           b.sbl_available_qty AS available, b.sbl_transit_in_qty AS transit_in,
           ${Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} AS value,
           ${Prisma.raw(s.wot ? 'b.sbl_avg_cost_rate_wot' : 'b.sbl_avg_cost_rate')} AS rate,
           COALESCE(lt.slt_expiry_date, b.sbl_expiry_date)::text AS expiry
      FROM stock.stock_balance b
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = b.sbl_lot_id
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_branch_id = ${s.branchId}::uuid
       AND b.sbl_is_deleted = false
       AND (b.sbl_on_hand_qty <> 0 OR b.sbl_reserved_qty <> 0 OR b.sbl_transit_in_qty <> 0
            OR ${Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} <> 0)
       ${itemIn('b.sbl_item_id', s)}`;
}

/** The in-scope rows dated after `to` (the tie's future-dated documents, D19). */
export function rowsAfterSql(s: SummarySqlScope): Prisma.Sql {
  return Prisma.sql`
    ${hasItemFilter(s) ? Prisma.sql`WITH RECURSIVE ${itemFilterCtes(s)}` : Prisma.empty}
    SELECT l.sml_item_id AS item, l.sml_godown_id AS godown, l.sml_bucket::text AS bucket,
           SUM(l.sml_signed_base_qty) AS q, COUNT(*)::int AS n
      FROM stock.stock_ledger l
     WHERE l.sml_company_id = ${s.companyId}::uuid
       AND l.sml_branch_id = ${s.branchId}::uuid
       AND l.sml_is_deleted = false
       AND l.sml_doc_date > ${s.to}::date
       ${itemIn('l.sml_item_id', s)}
     GROUP BY 1, 2, 3`;
}

/**
 * Goods on the road as of TODAY (§5.7): `stock_transit` rows IN_TRANSIT /
 * PARTIAL (never `stt_short_qty <> 0`: a recalled row carries one with
 * nothing lost), remaining = sent − received − damage, at the despatch's cost
 * rate. `dir` 'in' = to this branch, 'out' = from it, 'all' = the company.
 */
export function transitNowSql(s: SummarySqlScope, dir: 'in' | 'out' | 'all'): Prisma.Sql {
  const side =
    dir === 'in'
      ? Prisma.sql`AND t.stt_to_branch_id = ${s.branchId}::uuid`
      : dir === 'out'
        ? Prisma.sql`AND t.stt_from_branch_id = ${s.branchId}::uuid`
        : Prisma.empty;
  return Prisma.sql`
    ${hasItemFilter(s) ? Prisma.sql`WITH RECURSIVE ${itemFilterCtes(s)}` : Prisma.empty}
    SELECT t.stt_out_voucher_id AS out_id, t.stt_out_refno::text AS doc_no,
           t.stt_from_branch_id AS from_branch, fb.br_name AS from_branch_name,
           t.stt_to_branch_id AS to_branch, tb.br_name AS to_branch_name,
           t.stt_to_godown_id AS to_godown, t.stt_item_id AS item, t.stt_bucket::text AS bucket,
           (t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty) AS q,
           ROUND((t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty)
                 * ${Prisma.raw(s.wot ? 't.stt_cost_rate_wot' : 't.stt_cost_rate')}, 2) AS v
      FROM stock.stock_transit t
      LEFT JOIN public.branch_master fb ON fb.br_id = t.stt_from_branch_id
      LEFT JOIN public.branch_master tb ON tb.br_id = t.stt_to_branch_id
     WHERE t.stt_company_id = ${s.companyId}::uuid
       AND t.stt_is_deleted = false
       AND t.stt_status IN ('IN_TRANSIT', 'PARTIAL')
       AND (t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty) <> 0
       ${side}
       ${s.bucket ? Prisma.sql`AND t.stt_bucket = ${s.bucket}` : Prisma.empty}
       ${itemIn('t.stt_item_id', s)}`;
}

/**
 * Goods on the road as of a PAST `to` (§5.7), replayed from the ledger, per
 * despatch × item:
 *   sent      − Σ the TRANSFER_OUT rows of branch-outward vouchers dated ≤ to
 *             (reversals net, so a recall nets to 0);
 *   received  Σ the TRANSFER_IN rows of the branch-inward vouchers linked to the
 *             despatch dated ≤ to, every bucket (damage lands in DAMAGED);
 *   short     stt_short_qty of the despatch's transit rows whose CLOSED step
 *             (INVENTORY / STOCK_TRANSFER, short settlement) is dated ≤ to (IST);
 *   in transit = sent − received − short, valued at the despatch's own cost rate.
 * `fromBranch` set = only that branch's despatches (Item-wise transitOut);
 * null = the company (Branch-wise). The bucket scope is the despatch row's.
 */
export function transitReplaySql(s: SummarySqlScope, fromBranch: string | null): Prisma.Sql {
  const v = costValueCol('l', s.wot);
  return Prisma.sql`
    ${withItems(s)}
    snt AS (
      SELECT v.svh_id AS out_id, v.svh_acc_year AS out_year, v.svh_refno::text AS doc_no,
             v.svh_branch_id AS from_branch, v.svh_to_branch_id AS to_branch,
             l.sml_item_id AS item, MIN(l.sml_bucket::text) AS bucket,
             -SUM(l.sml_signed_base_qty) AS q, -SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
        JOIN stock.stock_voucher v
          ON v.svh_id = l.sml_src_doc_id
         AND v.svh_acc_year = COALESCE(l.sml_src_acc_year, l.sml_acc_year)
       WHERE l.sml_company_id = ${s.companyId}::uuid
         ${fromBranch ? Prisma.sql`AND l.sml_branch_id = ${fromBranch}::uuid` : Prisma.empty}
         AND l.sml_is_deleted = false
         AND l.sml_txn_type = 'TRANSFER_OUT' AND l.sml_src_doc_type = 'TRANSFER_OUT'
         AND l.sml_doc_date <= ${s.to}::date
         AND v.svh_to_branch_id IS NOT NULL AND v.svh_to_branch_id <> v.svh_branch_id
         ${itemIn('l.sml_item_id', s)}
       GROUP BY 1, 2, 3, 4, 5, 6),
    rcv AS (
      SELECT iv.svh_link_src_doc_id AS out_id, iv.svh_link_src_acc_year AS out_year,
             l.sml_item_id AS item, SUM(l.sml_signed_base_qty) AS q
        FROM stock.stock_ledger l
        JOIN stock.stock_voucher iv
          ON iv.svh_id = l.sml_src_doc_id
         AND iv.svh_acc_year = COALESCE(l.sml_src_acc_year, l.sml_acc_year)
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_txn_type = 'TRANSFER_IN' AND l.sml_src_doc_type = 'TRANSFER_IN'
         AND l.sml_doc_date <= ${s.to}::date
         AND iv.svh_link_src_doc_type = 'STOCK_VOUCHER'
         AND (iv.svh_link_src_doc_id, iv.svh_link_src_acc_year) IN (SELECT out_id, out_year FROM snt)
       GROUP BY 1, 2, 3),
    sht AS (
      SELECT t.stt_out_voucher_id AS out_id, t.stt_out_acc_year AS out_year, t.stt_item_id AS item,
             SUM(t.stt_short_qty) AS q
        FROM stock.stock_transit t
       WHERE t.stt_company_id = ${s.companyId}::uuid
         AND t.stt_is_deleted = false
         AND t.stt_status <> 'CANCELLED'
         AND (t.stt_out_voucher_id, t.stt_out_acc_year) IN (SELECT out_id, out_year FROM snt)
         AND EXISTS (
           SELECT 1 FROM public.txn_status_log c
            WHERE c.tsl_src_module = 'INVENTORY' AND c.tsl_src_doc_type = 'STOCK_TRANSFER'
              AND c.tsl_src_doc_id = t.stt_out_voucher_id AND c.tsl_event = 'CLOSED'
              AND c.tsl_is_deleted = false
              AND (c.tsl_changed_on AT TIME ZONE 'Asia/Kolkata')::date <= ${s.to}::date)
       GROUP BY 1, 2, 3)
    SELECT snt.out_id, snt.doc_no, snt.from_branch, fb.br_name AS from_branch_name,
           snt.to_branch, tb.br_name AS to_branch_name, NULL::uuid AS to_godown,
           snt.item, snt.bucket,
           snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0) AS q,
           CASE WHEN snt.q = 0 THEN 0::numeric
                ELSE ROUND((snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0)) * snt.v / snt.q, 2) END AS v
      FROM snt
      LEFT JOIN rcv ON rcv.out_id = snt.out_id AND rcv.out_year = snt.out_year AND rcv.item = snt.item
      LEFT JOIN sht ON sht.out_id = snt.out_id AND sht.out_year = snt.out_year AND sht.item = snt.item
      LEFT JOIN public.branch_master fb ON fb.br_id = snt.from_branch
      LEFT JOIN public.branch_master tb ON tb.br_id = snt.to_branch
     WHERE snt.q - COALESCE(rcv.q, 0) - COALESCE(sht.q, 0) <> 0
       ${s.bucket ? Prisma.sql`AND snt.bucket = ${s.bucket}` : Prisma.empty}`;
}

/** Branch-wise as of TODAY (D23): stock_balance of the company by branch × item (ix_sbl_item_chain). */
export function branchesNowSql(s: SummarySqlScope): Prisma.Sql {
  const value = Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value');
  return Prisma.sql`
    ${hasItemFilter(s) ? Prisma.sql`WITH RECURSIVE ${itemFilterCtes(s)}` : Prisma.empty}
    SELECT b.sbl_branch_id AS branch, b.sbl_item_id AS item,
           SUM(b.sbl_on_hand_qty) AS q, SUM(${value}) AS v
      FROM stock.stock_balance b
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_is_deleted = false
       ${s.bucket ? Prisma.sql`AND b.sbl_bucket = ${s.bucket}` : Prisma.empty}
       ${itemIn('b.sbl_item_id', s)}
     GROUP BY 1, 2
    HAVING SUM(b.sbl_on_hand_qty) <> 0 OR SUM(${value}) <> 0`;
}

/**
 * Branch-wise as of a PAST `to` (D23): every branch's holdings replayed from
 * the ledger, valued by each branch's own pool (§5.5), summed per branch ×
 * item over the bucket scope. O(company history) — the screen shows a busy
 * line; the month-end snapshot (SS-40) is the later cure.
 */
export function branchesReplaySql(s: SummarySqlScope): Prisma.Sql {
  const v = costValueCol('l', s.wot);
  return Prisma.sql`
    ${withItems(s)}
    ch AS (
      SELECT l.sml_branch_id AS branch, l.sml_item_id AS item, l.sml_lot_id AS lot,
             l.sml_godown_id AS godown, l.sml_bucket::text AS bucket,
             SUM(l.sml_signed_base_qty) AS q, SUM(l.sml_direction * ${v}) AS v
        FROM stock.stock_ledger l
       WHERE l.sml_company_id = ${s.companyId}::uuid
         AND l.sml_is_deleted = false
         AND l.sml_doc_date <= ${s.to}::date
         ${itemIn('l.sml_item_id', s)}
       GROUP BY 1, 2, 3, 4, 5),
    ${poolValuationCtes({ holdings: 'ch', prefix: 'bv', companyId: s.companyId, asOf: s.to, wot: s.wot })}
    SELECT branch, item, SUM(q) AS q, SUM(value) AS v
      FROM bv_val
     WHERE true ${s.bucket ? Prisma.sql`AND bucket = ${s.bucket}` : Prisma.empty}
     GROUP BY 1, 2
    HAVING SUM(q) <> 0 OR SUM(value) <> 0`;
}

/** The company's branches (columns of Branch-wise, and the names left out). */
export function companyBranchesSql(companyId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT br_id AS branch_id, br_name AS name
      FROM public.branch_master
     WHERE br_comp_id = ${companyId}::uuid AND COALESCE(br_is_deleted, false) = false
     ORDER BY lower(br_name), br_id`;
}

/** /item lots when `to` ≥ today: the item's balance rows at the branch, with MRP and supplier. */
export function lotsNowSql(s: SummarySqlScope, itemId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT b.sbl_godown_id AS godown_id, g.gdl_name AS godown_name, b.sbl_bucket::text AS bucket,
           b.sbl_lot_id AS lot_id,
           COALESCE(NULLIF(lt.slt_batch_no, ''), NULLIF(b.sbl_batch_no, '')) AS batch_no,
           COALESCE(lt.slt_mrp, b.sbl_mrp) AS mrp,
           COALESCE(lt.slt_expiry_date, b.sbl_expiry_date)::text AS expiry,
           sp.led_name AS supplier,
           b.sbl_on_hand_qty AS on_hand, b.sbl_reserved_qty AS reserved,
           b.sbl_available_qty AS available,
           ${Prisma.raw(s.wot ? 'b.sbl_avg_cost_rate_wot' : 'b.sbl_avg_cost_rate')} AS cost_rate,
           ${Prisma.raw(s.wot ? 'b.sbl_stock_value_wot' : 'b.sbl_stock_value')} AS value
      FROM stock.stock_balance b
      LEFT JOIN inventory.godown_locations g ON g.gdl_id = b.sbl_godown_id
      LEFT JOIN stock.stock_lot lt ON lt.slt_id = b.sbl_lot_id
      LEFT JOIN accounts.acc_ledger_master sp ON sp.led_id = COALESCE(lt.slt_supplier_id, b.sbl_supplier_id)
     WHERE b.sbl_company_id = ${s.companyId}::uuid
       AND b.sbl_branch_id = ${s.branchId}::uuid
       AND b.sbl_item_id = ${itemId}::uuid
       AND b.sbl_is_deleted = false
       AND (b.sbl_on_hand_qty <> 0 OR b.sbl_reserved_qty <> 0)
     ORDER BY g.gdl_sort NULLS LAST, g.gdl_name, b.sbl_bucket,
              COALESCE(lt.slt_expiry_date, b.sbl_expiry_date) NULLS LAST, b.sbl_lot_id`;
}

/** Lot / godown names for the past-date lots (holdings of the valuation). */
export function lotNamesSql(lotIds: readonly string[], godownIds: readonly string[]): Prisma.Sql {
  return Prisma.sql`
    SELECT 'L'::text AS k, lt.slt_id AS id, NULLIF(btrim(lt.slt_batch_no), '') AS batch_no,
           lt.slt_mrp AS mrp, lt.slt_expiry_date::text AS expiry, sp.led_name AS supplier,
           NULL::text AS name, NULL::int AS sort
      FROM stock.stock_lot lt
      LEFT JOIN accounts.acc_ledger_master sp ON sp.led_id = lt.slt_supplier_id
     WHERE lt.slt_id = ANY(${lotIds}::uuid[])
    UNION ALL
    SELECT 'G', g.gdl_id, NULL, NULL, NULL, NULL, g.gdl_name, g.gdl_sort
      FROM inventory.godown_locations g
     WHERE g.gdl_id = ANY(${godownIds}::uuid[])`;
}

/** /item facts: the latest live PURCHASE row up to `to` (date, refno, cost rate per base unit). */
export function lastPurchaseSql(s: SummarySqlScope, itemId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT x.sml_doc_date::text AS d, x.sml_src_refno::text AS doc_no,
           ${Prisma.raw(s.wot ? 'x.sml_cost_rate_wot' : 'x.sml_cost_rate')} AS rate
      FROM stock.stock_ledger x
     WHERE x.sml_company_id = ${s.companyId}::uuid
       AND x.sml_branch_id = ${s.branchId}::uuid
       AND x.sml_item_id = ${itemId}::uuid
       AND x.sml_is_deleted = false
       AND x.sml_txn_type = 'PURCHASE'
       AND x.sml_is_reversal = false
       AND x.sml_doc_date <= ${s.to}::date
       AND NOT EXISTS (
         SELECT 1 FROM stock.stock_ledger y
          WHERE y.sml_reverses_id = x.sml_id AND y.sml_acc_year = x.sml_acc_year
            AND y.sml_is_reversal = true AND y.sml_is_deleted = false)
     ORDER BY x.sml_doc_datetime DESC, x.sml_id DESC
     LIMIT 1`;
}
