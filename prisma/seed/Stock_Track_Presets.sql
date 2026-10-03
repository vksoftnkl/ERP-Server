-- Seed: stock.stock_track_preset -- the shared tracking presets (8 rows).
--
-- Offered by the tracking-policy screen as a combo of TRADES instead of six
-- checkboxes. One row per trade the stock module has been designed against; a
-- client's own trades are their own rows, inserted with spt_company_id set.
--
-- spt_company_id NULL = SHARED with every company. Nothing here is copied per
-- company: a company row with the same spt_code simply overrides the shared
-- one in the picker (the same merge rule as Stock_Adjust_Reasons.sql).
--
-- A preset is a STENCIL. Picking one copies its values into the policy form;
-- Save writes an ordinary stock.stock_track_policy row that owns its flags.
-- There is no FK from the policy back to here and no spt_id on the policy, so
-- re-running this file can never re-key existing stock.
--
-- Issue strategies are not uniform, and two are forced by the CHECKs:
--   * BATCH without expiry CANNOT be FEFO (nothing to order by) -> FIFO.
--   * MRP-only goods get FIFO so the OLDER MRP's stock is proposed first --
--     which is also the stock the shop wants gone first.
-- NONE keeps FEFO to match fn_stp_effective's no-policy fallback exactly: an
-- untracked item has one lot and no expiry, so the two strategies are
-- indistinguishable -- but the screen shows the strategy, and the preset must
-- not disagree with the fallback about it.
--
-- spt_id (uuidv7) is deliberately NOT written out: nothing outside this
-- database refers to it, so each environment generates its own. The stable
-- identity is spt_code, unique per company via ux_spt_code.
--
-- spt_track_signature is GENERATED ALWAYS ... STORED and must never be listed
-- in the column list -- Postgres rejects any write to it.
--
-- Idempotent: a NOT EXISTS guard on (shared, spt_code). Not ON CONFLICT,
-- because ux_spt_code is a partial EXPRESSION index and cannot be named as a
-- conflict target by column list.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Stock_Track_Presets.sql
--      or: npm run seed:run -- --only=Stock_Track_Presets.sql

BEGIN;

INSERT INTO stock.stock_track_preset
    (spt_company_id, spt_code, spt_name, spt_description,
     spt_track_batch, spt_track_mrp, spt_track_sale_price, spt_track_expiry,
     spt_track_serial, spt_track_supplier,
     spt_issue_strategy, spt_allow_negative,
     spt_near_expiry_days, spt_block_expired_sale, spt_sort_order)
SELECT v.company, v.code, v.name, v.descr,
       v.b, v.m, v.s, v.e, v.r, v.p,
       v.issue, v.negative, v.near, v.block, v.sort
  FROM (VALUES
    (NULL::uuid, 'NONE'::varchar, 'Plain stock'::varchar,
     'Tracked by nothing: one holding for ever. Salt, sugar, loose goods. Matches the no-policy fallback, so choosing it or having no policy row is the same answer.'::varchar,
     false, false, false, false, false, false,
     'FEFO'::varchar, 'ALLOW'::varchar, 30, false, 10),

    (NULL, 'MRP_SELLING', 'MRP & selling price',
     'Packaged goods whose printed MRP revises: one holding and one price bucket per MRP. Old stock keeps its old price until it sells through. FIFO so the older MRP is proposed first.',
     false, true, false, false, false, false,
     'FIFO', 'ALLOW', 30, false, 20),

    (NULL, 'SP_ONLY', 'Selling-price-wise (no MRP)',
     'Nothing printed on the goods — garments, hardware. The selling price itself is the stock dimension; new stock at a new price while the old sells out.',
     false, false, true, false, false, false,
     'FIFO', 'ALLOW', 30, false, 30),

    (NULL, 'BATCH', 'Batch only',
     'Lot recall without expiry. FIFO is forced: FEFO has no expiry date to order by, and the CHECK refuses the combination.',
     true, false, false, false, false, false,
     'FIFO', 'ALLOW', 30, false, 40),

    (NULL, 'BATCH_EXPIRY', 'Batch + expiry (perishables)',
     'Dairy, bakery, juice: FEFO issue, expired sale blocked, 7-day near-expiry watch. Price stays on the item master — every batch sells at the shelf price.',
     true, false, false, true, false, false,
     'FEFO', 'ALLOW', 7, true, 50),

    (NULL, 'FMCG_MRP', 'Batch + expiry + MRP (supermarket)',
     'Packaged supermarket goods: FEFO picks the earliest expiry, the picked stock prices by its own MRP bucket. The pick changes the price only through the MRP — never through the batch.',
     true, true, false, true, false, false,
     'FEFO', 'ALLOW', 30, true, 60),

    (NULL, 'PHARMA', 'Pharma (batch + expiry + MRP + supplier)',
     'The full pharmacy case: supplier on the lot makes near-expiry returns and recalls name the right supplier without a ledger join. 90-day near-expiry per trade convention.',
     true, true, false, true, false, true,
     'FEFO', 'ALLOW', 90, true, 70),

    (NULL, 'SERIAL', 'Serial number',
     'One holding per serial: appliances, phones, clocks. Negative stock BLOCKED — a serialised unit that is not there cannot be sold.',
     false, false, false, false, true, false,
     'FIFO', 'BLOCK', 30, false, 80)
  ) AS v(company, code, name, descr, b, m, s, e, r, p,
         issue, negative, near, block, sort)
 WHERE NOT EXISTS (
        SELECT 1
          FROM stock.stock_track_preset x
         WHERE x.spt_company_id IS NULL
           AND x.spt_code       = v.code
           AND x.spt_is_deleted = false);

COMMIT;
