-- ═══════════════════════════════════════════════════════════════════════════
--  stock.* — the guards the engine share puts in the database, and the two
--  schema corrections the TypeScript posting engine needs to agree with it.
--
--  The posting ENGINE stays in the application: stock-voucher-posting.helper.ts
--  resolves lots, writes stock_ledger and maintains stock_balance, stock_lot
--  and (from this migration on) stock_item_cost. The share's fn_sml_apply /
--  fn_slt_resolve / fn_svh_post are deliberately NOT installed — a trigger that
--  applied the same ledger rows a second time would double every balance.
--
--  What the database DOES own are the things that must hold whatever code
--  writes the ledger, and this migration adds them, transcribed from §17 of the
--  share (17_stock_functions.sql, seen 2026-09-08):
--
--    1. slt_key_batch / slt_key_serial fold case and whitespace, as the share's
--       16_stock.sql defines them and as the TypeScript identity key now does.
--       The 20260907090000 migration transcribed them as a plain COALESCE, so
--       'abc' and 'ABC ' opened two lots of one batch.
--    2. fn_sml_immutable — an UPDATE of a movement column is refused (DELETE
--       already is, by tr_sml_forbid_delete).
--    3. fn_sml_freeze_guard — no ledger row may touch a godown while a DRAFT
--       PHYSICAL count is freezing it, except the count's own posting.
--    4. stock_item_cost is seeded from the ledger for every holding posted
--       before the engine maintained it, so AVG_COST works from today.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1. Lot identity folds case and whitespace.
--
--  The share: COALESCE(NULLIF(upper(btrim(slt_batch_no)), ''), '~'). A batch
--  number is a label read off a carton, and 'b-2604', 'B-2604' and 'B-2604 '
--  are one carton. PostgreSQL 17+ rewrites the expression in place, rebuilding
--  ux_slt_identity with it; the precheck exists only to say WHICH lots would
--  collapse into one, because the unique index's own error would not.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_dupes text;
BEGIN
    SELECT string_agg(format('item %s batch %L/%L', slt_item_id, batch_key, serial_key), '; ')
      INTO v_dupes
      FROM (
            SELECT slt_item_id,
                   COALESCE(NULLIF(upper(btrim(slt_batch_no)),  ''), '~') AS batch_key,
                   COALESCE(NULLIF(upper(btrim(slt_serial_no)), ''), '~') AS serial_key
              FROM stock.stock_lot
             WHERE slt_is_deleted = false
             GROUP BY slt_company_id, slt_item_id,
                      COALESCE(NULLIF(upper(btrim(slt_batch_no)),  ''), '~'),
                      slt_key_mrp, slt_key_sp, slt_key_expiry,
                      COALESCE(NULLIF(upper(btrim(slt_serial_no)), ''), '~'),
                      slt_key_supplier
            HAVING count(*) > 1
           ) d;
    IF v_dupes IS NOT NULL THEN
        RAISE EXCEPTION
            'stock_lot: these lots differ only by batch/serial case or whitespace and would collapse into one under the folded identity key — merge them first: %',
            v_dupes;
    END IF;
END $$;

ALTER TABLE stock.stock_lot
    ALTER COLUMN slt_key_batch  SET EXPRESSION AS (COALESCE(NULLIF(upper(btrim(slt_batch_no)),  ''), '~')),
    ALTER COLUMN slt_key_serial SET EXPRESSION AS (COALESCE(NULLIF(upper(btrim(slt_serial_no)), ''), '~'));


-- ───────────────────────────────────────────────────────────────────────────
--  2. The ledger is append-only, and the database says so — for UPDATE too.
--
--  tr_sml_forbid_delete (20260907090000) refuses a DELETE. A stock figure that
--  can be edited retrospectively is a stock figure nobody can reconcile, so an
--  UPDATE of a quantity, a direction, a lot, a godown or a bucket is refused
--  as well. A cancellation writes a reversal row; only the soft-delete flag,
--  the source-document labels and sync bookkeeping may change.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION stock.fn_sml_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.sml_base_qty      IS DISTINCT FROM OLD.sml_base_qty
    OR NEW.sml_free_base_qty IS DISTINCT FROM OLD.sml_free_base_qty
    OR NEW.sml_direction     IS DISTINCT FROM OLD.sml_direction
    OR NEW.sml_lot_id        IS DISTINCT FROM OLD.sml_lot_id
    OR NEW.sml_godown_id     IS DISTINCT FROM OLD.sml_godown_id
    OR NEW.sml_bucket        IS DISTINCT FROM OLD.sml_bucket THEN
        RAISE EXCEPTION
            'stock.stock_ledger movement columns are immutable (row %): post a reversal row instead',
            OLD.sml_id
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_sml_immutable ON stock.stock_ledger;
CREATE TRIGGER tr_sml_immutable
    BEFORE UPDATE ON stock.stock_ledger
    FOR EACH ROW EXECUTE FUNCTION stock.fn_sml_immutable();


-- ───────────────────────────────────────────────────────────────────────────
--  3. The freeze window, enforced.
--
--  A count that does not freeze the stock it is counting is counting a moving
--  target, and until now the freeze was documentation: ck_svh_freeze checked
--  the window's shape and nothing refused a movement inside it.
--
--  The rule: while a DRAFT PHYSICAL voucher with svh_freeze_stock is inside
--  its window, NO ledger row may touch the godown being counted — except the
--  count's own posting.
--
--    * WALL CLOCK, not document date. The freeze protects the shelf as it is
--      NOW; a back-dated document posted during the window still changes
--      today's on-hand, so now() is what is tested.
--    * DRAFT only. Posting the count flips it to POSTED and the freeze lifts
--      by itself, even mid-window; so does cancelling or deleting the sheet.
--    * The counted godown is COALESCE(from, to) on the PHYSICAL header.
--    * Other godowns of the same branch keep trading.
--    * The count's own rows are recognised by SOURCE DOCUMENT ID. The share
--      also tests sml_src_doc_type = 'STOCK_VOUCHER'; this engine writes the
--      voucher type there ('PHYSICAL'), and the document id alone is the
--      identity that matters.
--
--  Cost: one probe of ix_svh_freeze_open per ledger row — a partial index over
--  open freezing counts, which is almost always empty.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_svh_freeze_open
    ON stock.stock_voucher USING btree
    (svh_company_id, svh_branch_id)
    WITH (fillfactor = 100, deduplicate_items = true)
    WHERE svh_voucher_type::text = 'PHYSICAL'
      AND svh_freeze_stock = true
      AND svh_status::text = 'DRAFT'
      AND svh_is_deleted = false;

CREATE OR REPLACE FUNCTION stock.fn_sml_freeze_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_ref character varying(100);
    v_to  timestamp with time zone;
BEGIN
    SELECT svh_refno, svh_freeze_to
      INTO v_ref, v_to
      FROM stock.stock_voucher
     WHERE svh_voucher_type::text = 'PHYSICAL'
       AND svh_freeze_stock = true
       AND svh_status::text = 'DRAFT'
       AND svh_is_deleted   = false
       AND svh_company_id   = NEW.sml_company_id
       AND svh_branch_id    = NEW.sml_branch_id
       AND COALESCE(svh_from_godown_id, svh_to_godown_id) = NEW.sml_godown_id
       AND now() BETWEEN svh_freeze_from AND svh_freeze_to
       -- The count's own rows pass: the whole point of the freeze is that
       -- THIS document gets a still shelf to post against.
       AND NOT (NEW.sml_src_module = 'STOCK' AND NEW.sml_src_doc_id = svh_id)
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'this godown is frozen for physical count % (until %); post the movement after the count closes',
            v_ref, v_to
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_sml_freeze_guard ON stock.stock_ledger;
CREATE TRIGGER tr_sml_freeze_guard
    BEFORE INSERT ON stock.stock_ledger
    FOR EACH ROW EXECUTE FUNCTION stock.fn_sml_freeze_guard();


-- ───────────────────────────────────────────────────────────────────────────
--  4. stock_item_cost, seeded from the ledger.
--
--  Every movement posted before this migration was posted by an engine that
--  did not maintain the moving average, so the table is empty while the
--  balances are not. From here on the posting helper maintains it on every
--  post; this seed gives that arithmetic a starting point that agrees with
--  the ledger. Only holdings with NO cost row are touched — the seed is safe
--  to re-run and never overrules a row the engine has since maintained.
--
--  The same definition the engine uses: quantity is the signed sum, value is
--  Σ direction × cost_value floored at 0, the average is value / quantity
--  while quantity is positive and otherwise the latest inward's rate, and
--  the last-purchase columns come from the latest inward row.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO stock.stock_item_cost (
    sic_company_id, sic_branch_id, sic_item_id, sic_base_uom_id,
    sic_total_qty, sic_total_value, sic_total_value_wot,
    sic_avg_cost_rate, sic_avg_cost_rate_wot, sic_max_cost_rate,
    sic_last_purchase_rate, sic_last_purchase_date)
SELECT s.sml_company_id, s.sml_branch_id, s.sml_item_id, s.base_uom,
       s.qty,
       s.val,
       s.val_wot,
       CASE WHEN s.qty > 0 THEN ROUND(s.val     / s.qty, 6) ELSE COALESCE(li.sml_cost_rate,     0) END,
       CASE WHEN s.qty > 0 THEN ROUND(s.val_wot / s.qty, 6) ELSE COALESCE(li.sml_cost_rate_wot, 0) END,
       s.max_in_rate,
       COALESCE(li.sml_cost_rate, 0),
       li.sml_doc_date
  FROM (
        SELECT sml_company_id, sml_branch_id, sml_item_id,
               (array_agg(sml_base_uom_id ORDER BY sml_posted_on))[1]                        AS base_uom,
               SUM(sml_signed_base_qty)                                                      AS qty,
               GREATEST(SUM(sml_direction * sml_cost_value), 0)                              AS val,
               GREATEST(SUM(sml_direction * sml_cost_value_wot), 0)                          AS val_wot,
               COALESCE(MAX(sml_cost_rate) FILTER (WHERE sml_direction = 1), 0)              AS max_in_rate
          FROM stock.stock_ledger
         WHERE sml_is_deleted = false
         GROUP BY sml_company_id, sml_branch_id, sml_item_id
       ) s
  LEFT JOIN LATERAL (
        SELECT l.sml_cost_rate, l.sml_cost_rate_wot, l.sml_doc_date
          FROM stock.stock_ledger l
         WHERE l.sml_company_id = s.sml_company_id
           AND l.sml_branch_id  = s.sml_branch_id
           AND l.sml_item_id    = s.sml_item_id
           AND l.sml_direction  = 1
           AND l.sml_is_deleted = false
         ORDER BY l.sml_doc_date DESC, l.sml_posted_on DESC, l.sml_line_no DESC, l.sml_split_no DESC
         LIMIT 1
       ) li ON true
 WHERE NOT EXISTS (
        SELECT 1
          FROM stock.stock_item_cost c
         WHERE c.sic_company_id = s.sml_company_id
           AND c.sic_branch_id  = s.sml_branch_id
           AND c.sic_item_id    = s.sml_item_id
           AND c.sic_is_deleted = false);

-- Carry the branch average onto the holdings, the way every post does from
-- now on: a holding's value is the distribution of the branch average over
-- what is on that shelf, not a separate truth.
UPDATE stock.stock_balance b
   SET sbl_avg_cost_rate     = c.sic_avg_cost_rate,
       sbl_avg_cost_rate_wot = c.sic_avg_cost_rate_wot,
       sbl_stock_value       = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate,     2),
       sbl_stock_value_wot   = ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate_wot, 2),
       sbl_row_version       = b.sbl_row_version + 1,
       sbl_modified_on       = now()
  FROM stock.stock_item_cost c
 WHERE c.sic_company_id = b.sbl_company_id
   AND c.sic_branch_id  = b.sbl_branch_id
   AND c.sic_item_id    = b.sbl_item_id
   AND c.sic_is_deleted = false
   AND b.sbl_is_deleted = false
   AND (b.sbl_avg_cost_rate     IS DISTINCT FROM c.sic_avg_cost_rate
     OR b.sbl_stock_value       IS DISTINCT FROM ROUND(b.sbl_on_hand_qty * c.sic_avg_cost_rate, 2));
