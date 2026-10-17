-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 92 (2026-10-06) — stock cost: plain stock on the item average, EVERY
--  tracked item at its own lot cost.
--
--  The posting engine (stock-voucher-posting.helper.ts) now reads the
--  effective policy's stp_valuation_method:
--    WAVG        the branch moving average in stock_item_cost, stamped onto
--                every holding of the item — plain (untracked) stock only;
--    LOT_ACTUAL  each lot's own moving average IN THIS BRANCH, kept on the
--                lot's stock_balance rows (sbl_avg_cost_rate) by applyLotCost
--                and read back whenever a line of that lot is priced — every
--                tracked item: batch, expiry, MRP, selling price, serial,
--                supplier, any mix.
--
--  The user's rule has no exception, so the column FOLLOWS THE TRACK FLAGS:
--  a policy that tracks any dimension is LOT_ACTUAL, one that tracks nothing
--  is WAVG. Set here for every existing preset and policy, derived by the
--  policy service on every save, and held by two CHECKs so that no path — a
--  seed, a hand insert, a sync — can store the inconsistent pair. (FIFO stays
--  in the vocabulary CHECKs; it was never implemented and is now unreachable.)
--
--  NO DATA REBUILD HERE, ON PURPOSE. The balance rows of tracked lots still
--  carry the item average until the derived figures are rebuilt from the
--  ledger — notes 92 §4 asks for that to be dry-run first:
--      plan/notes-92-lot-cost-backfill.sql       BEGIN … report … ROLLBACK
--      POST /stock/admin/rebuild-costs?dryRun=true   the same, through the API
--      POST /stock/admin/rebuild-costs               the real run
--  Run it straight after this migration: until then an outward of a tracked
--  lot is still relieved at the stale figure on its rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Presets: the stencil the policy screen offers. 7 of the 8 shared rows flip.
UPDATE stock.stock_track_preset
   SET spt_valuation_method = CASE
                                WHEN spt_track_batch OR spt_track_mrp OR spt_track_sale_price
                                  OR spt_track_expiry OR spt_track_serial OR spt_track_supplier
                                THEN 'LOT_ACTUAL' ELSE 'WAVG' END
 WHERE spt_valuation_method IS DISTINCT FROM CASE
                                WHEN spt_track_batch OR spt_track_mrp OR spt_track_sale_price
                                  OR spt_track_expiry OR spt_track_serial OR spt_track_supplier
                                THEN 'LOT_ACTUAL' ELSE 'WAVG' END;

-- 2. Policies: every row, live or retired, so the CHECK below holds everywhere.
UPDATE stock.stock_track_policy
   SET stp_valuation_method = CASE
                                WHEN stp_track_batch OR stp_track_mrp OR stp_track_sale_price
                                  OR stp_track_expiry OR stp_track_serial OR stp_track_supplier
                                THEN 'LOT_ACTUAL' ELSE 'WAVG' END
 WHERE stp_valuation_method IS DISTINCT FROM CASE
                                WHEN stp_track_batch OR stp_track_mrp OR stp_track_sale_price
                                  OR stp_track_expiry OR stp_track_serial OR stp_track_supplier
                                THEN 'LOT_ACTUAL' ELSE 'WAVG' END;

-- 3. The rule, declaratively: the method IS a function of the flags.
ALTER TABLE stock.stock_track_preset DROP CONSTRAINT IF EXISTS ck_spt_valuation_tracks;
ALTER TABLE stock.stock_track_preset ADD CONSTRAINT ck_spt_valuation_tracks CHECK (
    spt_valuation_method::text = CASE
        WHEN spt_track_batch OR spt_track_mrp OR spt_track_sale_price
          OR spt_track_expiry OR spt_track_serial OR spt_track_supplier
        THEN 'LOT_ACTUAL' ELSE 'WAVG' END);

ALTER TABLE stock.stock_track_policy DROP CONSTRAINT IF EXISTS ck_stp_valuation_tracks;
ALTER TABLE stock.stock_track_policy ADD CONSTRAINT ck_stp_valuation_tracks CHECK (
    stp_valuation_method::text = CASE
        WHEN stp_track_batch OR stp_track_mrp OR stp_track_sale_price
          OR stp_track_expiry OR stp_track_serial OR stp_track_supplier
        THEN 'LOT_ACTUAL' ELSE 'WAVG' END);

-- 4. What the cost columns now mean.
COMMENT ON COLUMN stock.stock_track_policy.stp_valuation_method IS
  'How a holding of this item is COSTED (notes 92). WAVG = the branch moving average in stock_item_cost, stamped onto every holding — plain stock only. LOT_ACTUAL = each lot''s own moving average in the branch, on its stock_balance rows — every tracked item. Follows the track flags (ck_stp_valuation_tracks); derived by the policy service, never sent.';
COMMENT ON COLUMN stock.stock_track_preset.spt_valuation_method IS
  'Follows the preset''s track flags (ck_spt_valuation_tracks): WAVG when nothing is tracked, LOT_ACTUAL otherwise. Copied into the policy by the policy service, which derives it from the flags again (notes 92).';
COMMENT ON COLUMN stock.stock_lot.slt_cost_rate IS
  'The cost on the lot''s FIRST receipt, written once when the lot is opened (resolveLots) and never after. NOT the lot''s running cost: stock_lot is company-wide, and a lot''s moving average per branch is sbl_avg_cost_rate on its stock_balance rows (notes 92 §3.1).';
COMMENT ON COLUMN stock.stock_lot.slt_cost_rate_wot IS
  'The without-tax cost on the lot''s first receipt, written once — see slt_cost_rate.';
COMMENT ON COLUMN stock.stock_balance.sbl_avg_cost_rate IS
  'The cost of one unit on this shelf (notes 92). Plain (WAVG) item: the branch average from stock_item_cost, stamped onto every holding of the item. Tracked (LOT_ACTUAL) item: the LOT''s own moving average in this branch — Σ of its ledger rows here — the same on every godown and bucket of the lot, rebuilt by the posting engine (applyLotCost) and never written by hand.';
COMMENT ON COLUMN stock.stock_balance.sbl_stock_value IS
  'ROUND(sbl_on_hand_qty × sbl_avg_cost_rate, 2): what this shelf is worth at the cost that applies to it (notes 92). Engine-maintained.';
COMMENT ON COLUMN stock.stock_item_cost.sic_avg_cost_rate IS
  'Plain (WAVG) item: the branch moving average, the cost every outward is relieved at. Tracked (LOT_ACTUAL) item: the item''s SUMMARY — Σ of its lots'' values ÷ quantity — for item-level reports and the fallback for a lot the branch has never held; its outwards are relieved at the lot''s own cost (notes 92). Rebuilt from the ledger on every post.';
