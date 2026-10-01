-- =============================================================================
-- notes-77-wot-repair.sql — repair the WITHOUT-TAX cost side of stock
-- (notes 77, 2026-10-01). One-off. NOT a migration.
-- =============================================================================
--
-- WHY
--   The sales shadow voucher wrote svi_cost_rate_wot = svi_cost_rate, and the
--   engine takes a nonzero stated wot as given: every SALE_RETURN / DC_RETURN
--   received stock at the INCLUSIVE rate on the without-tax side. Old OPENING
--   rows (before the opening path was fixed) carry wot 0, or wot = cost on a
--   taxed item. The branch moving average's wot (stock_item_cost) absorbed all
--   of it, and every later row priced from that average inherited it — sale
--   bills, count gains/losses, adjustments. ZT-ITEM-A: avg wot 7.90 on a cost of
--   79.29 at 18%. The WITH-tax side is right throughout and is not touched.
--
-- WHAT IT DOES — for every (company, branch, item) with ledger rows:
--   1. REPLAYS the ledger through the engine's own moving-average rules
--      (stock-voucher-posting.helper.ts applyItemCost: per posting, outwards at
--      the average the branch carried before it, then inwards re-average; a
--      fresh row swallows outwards; bucket moves are a wash), on BOTH sides.
--   2. VALIDATES the replay on the WITH-tax side, which is correct: the
--      replayed qty / value / average must reproduce stock_item_cost as stored.
--      A key that does not reproduce is SKIPPED, written nowhere, and listed —
--      its history was posted by rules this replay does not know.
--   3. For a validated key, re-derives each row's WITHOUT-tax rate:
--        SALE_RETURN / DC_RETURN inward  cost ÷ (1 + item tax %)
--        OPENING inward, wot 0 or = cost on a taxed item   cost ÷ (1 + tax %)
--        PHYSICAL gain, BUCKET moves, every outward,      the replayed average
--        any inward valued AT the average (an AVG_COST    wot (cost ÷ (1 + tax %)
--        adjustment gain: its rate is the average's)      when that is 0)
--        a reversal row                                    the row it reverses
--        any other inward (a typed cost)                   kept as stored
--      the item tax % as at the row's doc date: item_tax_history's latest
--      window, else item_default_tax_id (item-tax-rate.helper's rule).
--   4. Writes ONLY what changed: stock_ledger rate/value wot, the document line
--      (svi_cost_rate_wot, as the engine writes back), the lot's first-inward
--      wot, the voucher header's total wot (its own sign rule, inferred from
--      the stored total — left alone when none reproduces it), stock_item_cost
--      avg/total wot, and the holdings' stamp (sbl_*_wot), exactly as
--      applyItemCost stamps them.
--   Every write goes through the cloud-sync triggers, so the push carries it.
--
-- RUN (as postgres: only it holds UPDATE on stock.stock_ledger)
--   psql -d ERP -v ON_ERROR_STOP=1 -f notes-77-wot-repair.sql
--   It ends with ROLLBACK: a dry run that prints the report and changes
--   nothing. For the real run, change the last line to COMMIT.
-- =============================================================================

BEGIN;

-- ── 0. every live ledger row, with the item's tax % at its doc date ─────────
CREATE TEMP TABLE n77_row ON COMMIT DROP AS
SELECT sml.sml_id,
       sml.sml_company_id AS comp, sml.sml_branch_id AS br, sml.sml_item_id AS item,
       sml.sml_src_doc_id AS doc, sml.sml_acc_year AS yr, sml.sml_is_reversal AS rev,
       sml.sml_src_doc_type AS doc_type, sml.sml_txn_type AS txn, sml.sml_direction AS dir,
       sml.sml_line_no AS line_no, sml.sml_split_no AS split_no,
       sml.sml_base_qty + sml.sml_free_base_qty AS qty,
       sml.sml_cost_rate AS rate, sml.sml_cost_value AS value,
       sml.sml_cost_rate_wot AS old_wot, sml.sml_cost_value_wot AS old_value_wot,
       sml.sml_reverses_id AS reverses, sml.sml_created_on AS created_on,
       COALESCE(tax.tax_rate_perc, 0) AS tax_perc,
       NULL::numeric AS new_wot, NULL::numeric AS new_value_wot
  FROM stock.stock_ledger sml
  LEFT JOIN LATERAL (
    SELECT t.tax_rate_perc
      FROM inventory.tax_rate_master t
     WHERE t.tax_id = COALESCE(
             (SELECT h.ith_tax_id FROM inventory.item_tax_history h
               WHERE h.ith_item_id = sml.sml_item_id
                 AND h.ith_effective_from <= sml.sml_doc_date
                 AND (h.ith_effective_to IS NULL OR h.ith_effective_to >= sml.sml_doc_date)
               ORDER BY h.ith_effective_from DESC LIMIT 1),
             (SELECT i.item_default_tax_id FROM inventory.item_master i
               WHERE i.item_id = sml.sml_item_id))
  ) tax ON true
 WHERE sml.sml_is_deleted = false;
CREATE INDEX ON n77_row (comp, br, item);
CREATE INDEX ON n77_row (sml_id);

CREATE TEMP TABLE n77_key (
    comp uuid, br uuid, item uuid,
    status text, detail text,
    rows_changed int DEFAULT 0,
    stored_avg numeric, replay_avg numeric,
    old_avg_wot numeric, new_avg_wot numeric, new_value_wot numeric
) ON COMMIT DROP;

-- ── 1–3. replay per key ───────────────────────────────────────────────────
DO $$
DECLARE
    k record; e record; r record; sic record;
    has_row boolean;
    q numeric; v numeric; a numeric;          -- the replay, with tax
    vw numeric; aw numeric;                   -- the replay, without tax
    qty_in numeric; qty_out numeric; val_in numeric; val_in_w numeric;
    last_in numeric; last_in_w numeric; last_out numeric; last_out_w numeric;
    moves int; new_q numeric; w numeric;
BEGIN
    FOR k IN SELECT DISTINCT comp, br, item FROM n77_row LOOP
        has_row := false; q := 0; v := 0; a := 0; vw := 0; aw := 0;

        FOR e IN
            SELECT doc, yr, rev
              FROM n77_row
             WHERE comp = k.comp AND br = k.br AND item = k.item
             GROUP BY doc, yr, rev
             ORDER BY min(created_on), min(sml_id::text)
        LOOP
            -- Price each row of this posting against the state BEFORE it.
            FOR r IN
                SELECT * FROM n77_row
                 WHERE comp = k.comp AND br = k.br AND item = k.item
                   AND doc = e.doc AND yr = e.yr AND rev = e.rev
            LOOP
                IF r.rev AND r.reverses IS NOT NULL THEN
                    SELECT o.new_wot INTO w FROM n77_row o WHERE o.sml_id = r.reverses;
                    w := COALESCE(w, r.old_wot);
                ELSIF r.dir < 0 OR r.txn IN ('BUCKET_OUT', 'BUCKET_IN') OR r.doc_type = 'PHYSICAL' THEN
                    w := CASE WHEN aw > 0 THEN aw
                              ELSE ROUND(r.rate / (1 + r.tax_perc / 100), 6) END;
                ELSIF r.doc_type IN ('SALE_RETURN', 'DC_RETURN') THEN
                    w := ROUND(r.rate / (1 + r.tax_perc / 100), 6);
                ELSIF r.doc_type = 'OPENING' AND r.rate > 0
                      AND (r.old_wot = 0 OR (r.old_wot = r.rate AND r.tax_perc > 0)) THEN
                    w := ROUND(r.rate / (1 + r.tax_perc / 100), 6);
                ELSIF a > 0 AND abs(r.rate - a) <= 0.000001 THEN
                    -- Valued at the branch average (an AVG_COST adjustment gain):
                    -- the average's own wot, as the engine pairs them.
                    w := CASE WHEN aw > 0 THEN aw
                              ELSE ROUND(r.rate / (1 + r.tax_perc / 100), 6) END;
                ELSE
                    w := r.old_wot;
                END IF;
                UPDATE n77_row
                   SET new_wot = w,
                       new_value_wot = CASE
                         WHEN r.rev AND r.reverses IS NOT NULL
                         THEN COALESCE((SELECT o.new_value_wot FROM n77_row o WHERE o.sml_id = r.reverses),
                                       ROUND(w * r.qty, 2))
                         ELSE ROUND(w * r.qty, 2) END
                 WHERE sml_id = r.sml_id;
            END LOOP;

            -- Then the average, as applyItemCost moves it (bucket moves are a wash).
            SELECT count(*),
                   COALESCE(SUM(qty)           FILTER (WHERE dir > 0), 0),
                   COALESCE(SUM(qty)           FILTER (WHERE dir < 0), 0),
                   COALESCE(SUM(value)         FILTER (WHERE dir > 0), 0),
                   COALESCE(SUM(new_value_wot) FILTER (WHERE dir > 0), 0),
                   (array_agg(rate    ORDER BY line_no DESC, split_no DESC) FILTER (WHERE dir > 0))[1],
                   (array_agg(new_wot ORDER BY line_no DESC, split_no DESC) FILTER (WHERE dir > 0))[1],
                   (array_agg(rate    ORDER BY line_no DESC, split_no DESC) FILTER (WHERE dir < 0))[1],
                   (array_agg(new_wot ORDER BY line_no DESC, split_no DESC) FILTER (WHERE dir < 0))[1]
              INTO moves, qty_in, qty_out, val_in, val_in_w, last_in, last_in_w, last_out, last_out_w
              FROM n77_row
             WHERE comp = k.comp AND br = k.br AND item = k.item
               AND doc = e.doc AND yr = e.yr AND rev = e.rev
               AND txn NOT IN ('BUCKET_OUT', 'BUCKET_IN');
            CONTINUE WHEN moves = 0;

            new_q := CASE WHEN has_row THEN q - qty_out ELSE 0 END + qty_in;
            v  := GREATEST(v  - ROUND(qty_out * a,  2), 0) + val_in;
            vw := GREATEST(vw - ROUND(qty_out * aw, 2), 0) + val_in_w;
            a  := CASE WHEN new_q > 0 THEN ROUND(v  / new_q, 6)
                       WHEN qty_in > 0 THEN last_in
                       WHEN NOT has_row THEN COALESCE(last_out, 0)
                       ELSE a END;
            aw := CASE WHEN new_q > 0 THEN ROUND(vw / new_q, 6)
                       WHEN qty_in > 0 THEN last_in_w
                       WHEN NOT has_row THEN COALESCE(last_out_w, 0)
                       ELSE aw END;
            q := new_q;
            has_row := true;
        END LOOP;

        SELECT sic_total_qty, sic_total_value, sic_avg_cost_rate, sic_avg_cost_rate_wot
          INTO sic
          FROM stock.stock_item_cost
         WHERE sic_company_id = k.comp AND sic_branch_id = k.br AND sic_item_id = k.item
           AND sic_is_deleted = false;

        IF NOT FOUND THEN
            INSERT INTO n77_key (comp, br, item, status, detail)
            VALUES (k.comp, k.br, k.item, 'SKIPPED', 'no stock_item_cost row');
        ELSIF sic.sic_total_qty <> q
           OR abs(sic.sic_total_value - v) > 0.05
           OR abs(sic.sic_avg_cost_rate - a) > 0.0001 THEN
            INSERT INTO n77_key (comp, br, item, status, detail, stored_avg, replay_avg)
            VALUES (k.comp, k.br, k.item, 'SKIPPED',
                    format('replay does not reproduce the stored average: qty %s vs %s, value %s vs %s, avg %s vs %s',
                           sic.sic_total_qty, q, sic.sic_total_value, v, sic.sic_avg_cost_rate, a),
                    sic.sic_avg_cost_rate, a);
        ELSE
            INSERT INTO n77_key (comp, br, item, status, rows_changed, stored_avg, replay_avg,
                                 old_avg_wot, new_avg_wot, new_value_wot)
            SELECT k.comp, k.br, k.item,
                   CASE WHEN count(*) FILTER (WHERE abs(new_wot - old_wot) > 0.0000005
                                                 OR abs(new_value_wot - old_value_wot) > 0.005) > 0
                          OR abs(sic.sic_avg_cost_rate_wot - aw) > 0.0000005
                        THEN 'REPAIRED' ELSE 'UNCHANGED' END,
                   count(*) FILTER (WHERE abs(new_wot - old_wot) > 0.0000005
                                       OR abs(new_value_wot - old_value_wot) > 0.005),
                   sic.sic_avg_cost_rate, a, sic.sic_avg_cost_rate_wot, aw, vw
              FROM n77_row
             WHERE comp = k.comp AND br = k.br AND item = k.item;
        END IF;
    END LOOP;
END $$;

-- The rows to write: changed, on a repaired key.
CREATE TEMP TABLE n77_fix ON COMMIT DROP AS
SELECT r.*
  FROM n77_row r
  JOIN n77_key k ON k.comp = r.comp AND k.br = r.br AND k.item = r.item AND k.status = 'REPAIRED'
 WHERE abs(r.new_wot - r.old_wot) > 0.0000005
    OR abs(r.new_value_wot - r.old_value_wot) > 0.005;

-- ── 4. write ──────────────────────────────────────────────────────────────
UPDATE stock.stock_ledger sml
   SET sml_cost_rate_wot  = f.new_wot,
       sml_cost_value_wot = f.new_value_wot
  FROM n77_fix f
 WHERE sml.sml_id = f.sml_id;

-- The document line, as the engine writes it back at post (forward rows only).
UPDATE stock.stock_voucher_item svi
   SET svi_cost_rate_wot = f.new_wot
  FROM n77_fix f
 WHERE NOT f.rev
   AND svi.svi_voucher_id = f.doc AND svi.svi_acc_year = f.yr
   AND svi.svi_line_no = f.line_no AND svi.svi_split_no = f.split_no
   AND svi.svi_cost_rate_wot = f.old_wot;

-- A lot keeps its FIRST inward cost: fixed when that row was fixed.
UPDATE stock.stock_lot l
   SET slt_cost_rate_wot = f.new_wot
  FROM (SELECT DISTINCT ON (sml.sml_lot_id) sml.sml_lot_id AS lot_id, sml.sml_id
          FROM stock.stock_ledger sml
         WHERE sml.sml_direction = 1 AND NOT sml.sml_is_reversal AND NOT sml.sml_is_deleted
           AND sml.sml_lot_id IS NOT NULL
         ORDER BY sml.sml_lot_id, sml.sml_created_on, sml.sml_id) first_in
  JOIN n77_fix f ON f.sml_id = first_in.sml_id
 WHERE l.slt_id = first_in.lot_id
   AND l.slt_cost_rate_wot = f.old_wot;

-- The voucher header's total: whichever of the engine's sign rules reproduces
-- the stored total with the OLD values is applied to the new ones.
WITH docs AS (SELECT DISTINCT doc, yr FROM n77_fix),
rows_of AS (
  SELECT r.doc, r.yr, r.txn, r.dir,
         CASE WHEN r.rev THEN -1 ELSE 1 END AS rev_sign,
         r.old_value_wot, COALESCE(r.new_value_wot, r.old_value_wot) AS new_value_wot
    FROM n77_row r JOIN docs d ON d.doc = r.doc AND d.yr = r.yr
),
rules AS (
  SELECT doc, yr,
         SUM(rev_sign * old_value_wot) AS old_mag, SUM(rev_sign * new_value_wot) AS new_mag,
         SUM(dir * old_value_wot)      AS old_net, SUM(dir * new_value_wot)      AS new_net,
         SUM(rev_sign * old_value_wot) FILTER (WHERE txn IN ('TRANSFER_OUT', 'BUCKET_OUT')) AS old_out,
         SUM(rev_sign * new_value_wot) FILTER (WHERE txn IN ('TRANSFER_OUT', 'BUCKET_OUT')) AS new_out
    FROM rows_of GROUP BY doc, yr
)
UPDATE stock.stock_voucher svh
   SET svh_total_value_wot = CASE
         WHEN abs(svh.svh_total_value_wot - ru.old_mag) <= 0.01 THEN ru.new_mag
         WHEN abs(svh.svh_total_value_wot - ru.old_net) <= 0.01 THEN ru.new_net
         WHEN ru.old_out IS NOT NULL AND abs(svh.svh_total_value_wot - ru.old_out) <= 0.01 THEN ru.new_out
       END
  FROM rules ru
 WHERE svh.svh_id = ru.doc AND svh.svh_acc_year = ru.yr
   AND (abs(svh.svh_total_value_wot - ru.old_mag) <= 0.01
     OR abs(svh.svh_total_value_wot - ru.old_net) <= 0.01
     OR (ru.old_out IS NOT NULL AND abs(svh.svh_total_value_wot - ru.old_out) <= 0.01));

UPDATE stock.stock_item_cost c
   SET sic_avg_cost_rate_wot = k.new_avg_wot,
       sic_total_value_wot   = k.new_value_wot
  FROM n77_key k
 WHERE k.status = 'REPAIRED'
   AND c.sic_company_id = k.comp AND c.sic_branch_id = k.br AND c.sic_item_id = k.item
   AND c.sic_is_deleted = false;

-- The stamp, exactly as applyItemCost writes it.
UPDATE stock.stock_balance b
   SET sbl_avg_cost_rate_wot = c.sic_avg_cost_rate_wot,
       sbl_stock_value_wot   = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2)
  FROM n77_key k
  JOIN stock.stock_item_cost c
    ON c.sic_company_id = k.comp AND c.sic_branch_id = k.br AND c.sic_item_id = k.item
   AND c.sic_is_deleted = false
 WHERE k.status = 'REPAIRED'
   AND b.sbl_company_id = k.comp AND b.sbl_branch_id = k.br AND b.sbl_item_id = k.item
   AND b.sbl_is_deleted = false;

-- ── report ────────────────────────────────────────────────────────────────
SELECT status, count(*) AS keys, sum(rows_changed) AS ledger_rows_changed
  FROM n77_key GROUP BY status ORDER BY status;

SELECT f.doc_type, f.dir, count(*) AS rows_changed
  FROM n77_fix f GROUP BY 1, 2 ORDER BY 1, 2;

SELECT i.item_name_en AS item, k.status,
       round(k.stored_avg, 4) AS avg_cost, round(k.old_avg_wot, 4) AS old_avg_wot,
       round(k.new_avg_wot, 4) AS new_avg_wot, k.rows_changed, k.detail
  FROM n77_key k JOIN inventory.item_master i ON i.item_id = k.item
 WHERE k.status <> 'UNCHANGED'
 ORDER BY k.status, i.item_name_en;

ROLLBACK;   -- dry run. For the real run: COMMIT;
