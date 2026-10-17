-- =============================================================================
-- notes-92-lot-cost-backfill.sql — the one-off backfill of notes 92 §4, as a
-- DRY RUN: step 0, the rebuild, the report, ROLLBACK. One-off. NOT a migration.
-- =============================================================================
--
-- WHAT IT ANSWERS
--   After migration 20261006100000 flips every tracked policy to LOT_ACTUAL,
--   the balance rows of tracked lots still carry the ITEM average
--   (MRP STOCK ITEM: 340.909 on all four batches). This script shows what the
--   rebuild writes — each tracked lot's own cost (25 / 250 / 400 / 500) and
--   every item total that moves — without keeping any of it.
--
-- STEP 0 (§4) decides whether anything beyond the rebuild is needed: a tracked
--   lot that has ALREADY had an outward was relieved at the old item average,
--   and a plain rebuild would carry that error for ever. The first query lists
--   such lots. On the dev box on 2026-10-06 it returned 0 rows. If it returns
--   rows on your box, STOP: that database needs the revaluation table of §4
--   (stock_cost_revaluation), which is deliberately not created anywhere yet.
--
-- THE REBUILD ITSELF is the engine's own TypeScript
--   (stock-voucher-posting.helper.ts rebuildStockDerivedFigures), reached as
--       POST /stock/admin/rebuild-costs?dryRun=true   -- the same report, rolled back
--       POST /stock/admin/rebuild-costs               -- the real run
--   The SQL below restates the §3.1 / §3.3 arithmetic so it can be read in
--   psql without the API; the TypeScript is the definition and the e2e suite
--   test/stock-lot-cost-notes-92.e2e-spec.ts holds the two to the same figures.
--
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f plan/notes-92-lot-cost-backfill.sql
--       It ends in ROLLBACK. To keep the result use the admin route instead,
--       or change the last line to COMMIT after reading the report.
-- =============================================================================
\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── step 0: tracked lots already sold under the item average ────────────────
\echo
\echo '=== STEP 0 — tracked lots with an outward row (must be EMPTY for a plain rebuild) ==='
SELECT sml.sml_company_id, sml.sml_branch_id, itm.item_name_en, slt.slt_batch_no, slt.slt_mrp,
       count(*) AS outward_rows
  FROM stock.stock_ledger sml
  JOIN stock.stock_lot slt ON slt.slt_id = sml.sml_lot_id
  JOIN inventory.item_master itm ON itm.item_id = sml.sml_item_id
 WHERE slt.slt_track_signature <> 'N'
   AND sml.sml_direction = -1
   AND sml.sml_is_deleted = false
 GROUP BY 1, 2, 3, 4, 5
 ORDER BY 3, 4;

-- ── before: every item total, kept for the report ────────────────────────────
CREATE TEMP TABLE n92_before AS
SELECT c.sic_company_id, c.sic_branch_id, c.sic_item_id,
       c.sic_total_qty, c.sic_total_value, c.sic_avg_cost_rate
  FROM stock.stock_item_cost c
 WHERE c.sic_is_deleted = false;

CREATE TEMP TABLE n92_before_lots AS
SELECT b.sbl_company_id, b.sbl_branch_id, b.sbl_item_id, b.sbl_lot_id,
       SUM(b.sbl_on_hand_qty) AS on_hand, MAX(b.sbl_avg_cost_rate) AS rate, SUM(b.sbl_stock_value) AS value
  FROM stock.stock_balance b
  JOIN stock.stock_lot slt ON slt.slt_id = b.sbl_lot_id
 WHERE b.sbl_is_deleted = false AND slt.slt_track_signature <> 'N'
 GROUP BY 1, 2, 3, 4;

-- ── the policy in force today, per (company, branch, item) with ledger rows ──
CREATE TEMP TABLE n92_items AS
SELECT t.company_id, t.branch_id, t.item_id,
       COALESCE(stp.stp_valuation_method, 'WAVG') AS valuation_method
  FROM (SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id, sml.sml_item_id AS item_id
          FROM stock.stock_ledger sml WHERE sml.sml_is_deleted = false) t
  JOIN inventory.item_master itm ON itm.item_id = t.item_id
  LEFT JOIN LATERAL (
    SELECT p.stp_valuation_method
      FROM stock.stock_track_policy p
     WHERE p.stp_is_active = true AND p.stp_is_deleted = false
       AND CURRENT_DATE BETWEEN p.stp_effective_from AND p.stp_effective_to
       AND (p.stp_company_id IS NULL OR p.stp_company_id = t.company_id)
       AND (p.stp_branch_id  IS NULL OR p.stp_branch_id  = t.branch_id)
       AND ((p.stp_scope = 'ITEM' AND p.stp_scope_id = t.item_id)
         OR (p.stp_scope = 'GROUP' AND p.stp_scope_id = itm.item_group_id)
         OR  p.stp_scope = 'COMPANY')
     ORDER BY CASE WHEN p.stp_scope = 'ITEM'  AND p.stp_branch_id IS NOT NULL THEN 1
                   WHEN p.stp_scope = 'ITEM'                                  THEN 2
                   WHEN p.stp_scope = 'GROUP' AND p.stp_branch_id IS NOT NULL THEN 3
                   WHEN p.stp_scope = 'GROUP'                                 THEN 4
                   WHEN p.stp_branch_id IS NOT NULL                           THEN 5
                   ELSE 6 END,
              (p.stp_company_id IS NULL), p.stp_effective_from DESC
     LIMIT 1) stp ON true;

-- ── §3.1: each LOT_ACTUAL lot's own cost in the branch, onto its balance rows ─
WITH lot AS (
  SELECT DISTINCT sml.sml_company_id AS company_id, sml.sml_branch_id AS branch_id,
         sml.sml_item_id AS item_id, sml.sml_lot_id AS lot_id
    FROM stock.stock_ledger sml
    JOIN n92_items i ON i.company_id = sml.sml_company_id AND i.branch_id = sml.sml_branch_id AND i.item_id = sml.sml_item_id
   WHERE sml.sml_is_deleted = false AND i.valuation_method = 'LOT_ACTUAL'
),
led AS (
  SELECT l.company_id, l.branch_id, l.item_id, l.lot_id,
         COALESCE(SUM(sml.sml_signed_base_qty), 0)                                                AS qty,
         COALESCE(SUM(sml.sml_direction * sml.sml_cost_value), 0)                                 AS value,
         COALESCE(SUM(sml.sml_direction * sml.sml_cost_value_wot), 0)                             AS value_wot,
         (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1] AS last_rate,
         (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1] AS last_rate_wot
    FROM lot l
    LEFT JOIN stock.stock_ledger sml
           ON sml.sml_company_id = l.company_id AND sml.sml_branch_id = l.branch_id
          AND sml.sml_item_id = l.item_id AND sml.sml_lot_id = l.lot_id AND sml.sml_is_deleted = false
   GROUP BY 1, 2, 3, 4
),
rated AS (
  SELECT led.*,
         CASE WHEN qty > 0 THEN ROUND(value     / qty, 6) ELSE COALESCE(last_rate, 0)     END AS rate,
         CASE WHEN qty > 0 THEN ROUND(value_wot / qty, 6) ELSE COALESCE(last_rate_wot, 0) END AS rate_wot
    FROM led
)
UPDATE stock.stock_balance b
   SET sbl_avg_cost_rate = r.rate, sbl_avg_cost_rate_wot = r.rate_wot,
       sbl_stock_value = ROUND(b.sbl_on_hand_qty * r.rate, 2), sbl_stock_value_wot = ROUND(b.sbl_on_hand_qty * r.rate_wot, 2)
  FROM rated r
 WHERE b.sbl_company_id = r.company_id AND b.sbl_branch_id = r.branch_id
   AND b.sbl_item_id = r.item_id AND b.sbl_lot_id = r.lot_id AND b.sbl_is_deleted = false
   AND (b.sbl_avg_cost_rate IS DISTINCT FROM r.rate OR b.sbl_avg_cost_rate_wot IS DISTINCT FROM r.rate_wot
     OR b.sbl_stock_value IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * r.rate, 2)
     OR b.sbl_stock_value_wot IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * r.rate_wot, 2));

-- ── §3.3: the item totals, Σ of the ledger (both methods) ────────────────────
WITH led AS (
  SELECT i.company_id, i.branch_id, i.item_id,
         COALESCE(SUM(sml.sml_signed_base_qty), 0)                                                AS qty,
         COALESCE(SUM(sml.sml_direction * sml.sml_cost_value), 0)                                 AS value,
         COALESCE(SUM(sml.sml_direction * sml.sml_cost_value_wot), 0)                             AS value_wot,
         (array_agg(sml.sml_cost_rate     ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1] AS last_rate,
         (array_agg(sml.sml_cost_rate_wot ORDER BY sml.sml_doc_datetime DESC, sml.sml_id DESC))[1] AS last_rate_wot
    FROM n92_items i
    JOIN stock.stock_ledger sml
      ON sml.sml_company_id = i.company_id AND sml.sml_branch_id = i.branch_id
     AND sml.sml_item_id = i.item_id AND sml.sml_is_deleted = false
   GROUP BY 1, 2, 3
),
next AS (
  SELECT led.*,
         CASE WHEN qty > 0 THEN ROUND(value     / qty, 6) ELSE COALESCE(last_rate, 0)     END AS avg,
         CASE WHEN qty > 0 THEN ROUND(value_wot / qty, 6) ELSE COALESCE(last_rate_wot, 0) END AS avg_wot
    FROM led
)
UPDATE stock.stock_item_cost c
   SET sic_total_qty = n.qty, sic_total_value = n.value, sic_total_value_wot = n.value_wot,
       sic_avg_cost_rate = n.avg, sic_avg_cost_rate_wot = n.avg_wot
  FROM next n
 WHERE c.sic_company_id = n.company_id AND c.sic_branch_id = n.branch_id AND c.sic_item_id = n.item_id
   AND c.sic_is_deleted = false
   AND (c.sic_total_qty IS DISTINCT FROM n.qty OR c.sic_total_value IS DISTINCT FROM n.value
     OR c.sic_total_value_wot IS DISTINCT FROM n.value_wot
     OR c.sic_avg_cost_rate IS DISTINCT FROM n.avg OR c.sic_avg_cost_rate_wot IS DISTINCT FROM n.avg_wot);

-- the plain-item stamp (WAVG only; LOT_ACTUAL rows carry their lot's rate)
UPDATE stock.stock_balance b
   SET sbl_avg_cost_rate = c.sic_avg_cost_rate, sbl_avg_cost_rate_wot = c.sic_avg_cost_rate_wot,
       sbl_stock_value = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate, 2),
       sbl_stock_value_wot = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2)
  FROM n92_items i
  JOIN stock.stock_item_cost c
    ON c.sic_company_id = i.company_id AND c.sic_branch_id = i.branch_id AND c.sic_item_id = i.item_id AND c.sic_is_deleted = false
 WHERE i.valuation_method <> 'LOT_ACTUAL'
   AND b.sbl_company_id = c.sic_company_id AND b.sbl_branch_id = c.sic_branch_id AND b.sbl_item_id = c.sic_item_id
   AND b.sbl_is_deleted = false
   AND (b.sbl_avg_cost_rate IS DISTINCT FROM c.sic_avg_cost_rate OR b.sbl_avg_cost_rate_wot IS DISTINCT FROM c.sic_avg_cost_rate_wot
     OR b.sbl_stock_value IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate, 2)
     OR b.sbl_stock_value_wot IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2));

-- ── report ───────────────────────────────────────────────────────────────────
\echo
\echo '=== TRACKED LOTS — rate before → after (the split across batches) ==='
SELECT itm.item_name_en, slt.slt_track_signature AS sig, slt.slt_batch_no, slt.slt_mrp,
       bl.on_hand, bl.rate AS rate_before, MAX(b.sbl_avg_cost_rate) AS rate_after,
       bl.value AS value_before, SUM(b.sbl_stock_value) AS value_after
  FROM n92_before_lots bl
  JOIN stock.stock_balance b ON b.sbl_company_id = bl.sbl_company_id AND b.sbl_branch_id = bl.sbl_branch_id
                             AND b.sbl_item_id = bl.sbl_item_id AND b.sbl_lot_id = bl.sbl_lot_id AND b.sbl_is_deleted = false
  JOIN stock.stock_lot slt ON slt.slt_id = bl.sbl_lot_id
  JOIN inventory.item_master itm ON itm.item_id = bl.sbl_item_id
 GROUP BY 1, 2, 3, 4, 5, 6, 8
 ORDER BY 1, 3;

\echo
\echo '=== ITEM TOTALS THAT MOVED (with step 0 empty, only pre-existing drift should appear) ==='
SELECT itm.item_code, itm.item_name_en,
       bf.sic_total_qty AS qty_before, c.sic_total_qty AS qty_after,
       bf.sic_total_value AS value_before, c.sic_total_value AS value_after,
       c.sic_total_value - bf.sic_total_value AS difference,
       bf.sic_avg_cost_rate AS avg_before, c.sic_avg_cost_rate AS avg_after
  FROM stock.stock_item_cost c
  JOIN n92_before bf ON bf.sic_company_id = c.sic_company_id AND bf.sic_branch_id = c.sic_branch_id AND bf.sic_item_id = c.sic_item_id
  JOIN inventory.item_master itm ON itm.item_id = c.sic_item_id
 WHERE c.sic_is_deleted = false
   AND (bf.sic_total_qty <> c.sic_total_qty OR bf.sic_total_value <> c.sic_total_value OR bf.sic_avg_cost_rate <> c.sic_avg_cost_rate)
 ORDER BY 2;

\echo
\echo '=== TOTALS BY KIND — value before vs after (tracked totals must not move when step 0 is empty) ==='
SELECT CASE WHEN i.valuation_method = 'LOT_ACTUAL' THEN 'tracked (LOT_ACTUAL)' ELSE 'plain (WAVG)' END AS kind,
       count(*) AS items, SUM(bf.sic_total_value) AS value_before, SUM(c.sic_total_value) AS value_after
  FROM stock.stock_item_cost c
  JOIN n92_items i ON i.company_id = c.sic_company_id AND i.branch_id = c.sic_branch_id AND i.item_id = c.sic_item_id
  JOIN n92_before bf ON bf.sic_company_id = c.sic_company_id AND bf.sic_branch_id = c.sic_branch_id AND bf.sic_item_id = c.sic_item_id
 WHERE c.sic_is_deleted = false
 GROUP BY 1 ORDER BY 1;

\echo
\echo '=== DRY RUN — rolling back. Keep it through POST /stock/admin/rebuild-costs, or change this line to COMMIT. ==='
ROLLBACK;
