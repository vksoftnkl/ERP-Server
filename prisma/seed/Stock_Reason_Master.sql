-- Seed: stock.stock_reason_master -- why stock moved outside a trade document (16 rows).
--
-- This is not decoration. fn_svh_txn_map REFUSES to post an ADJUSTMENT that does
-- not cite a reason, and refuses one whose reason is direction BOTH, because a
-- document that cannot say which way it moved is not a document. With
-- stock_reason_master empty, ADJUSTMENT cannot be posted at all. These rows are
-- what make the stock engine usable on day one.
--
-- srm_company_id NULL = SHARED with every company. Nothing here is copied per
-- company: a company that wants "Pilferage" to read "Shrinkage" inserts its own
-- row with the same srm_code and the picker hides the shared one (the same merge
-- rule as Stock_Track_Presets.sql).
--
-- ── srm_direction is load-bearing ──────────────────────────────────────────
--   IN / OUT  fn_svh_txn_map reads it to decide ADJUST_PLUS vs ADJUST_MINUS.
--             An ADJUSTMENT citing a BOTH reason RAISES.
--   BOTH      only safe where the direction comes from somewhere else -- a
--             PHYSICAL count, where it comes from the counted difference. Every
--             BOTH row below is therefore restricted to PHYSICAL by
--             srm_allowed_txn_types.
--
-- ── srm_allowed_txn_types is load-bearing too ──────────────────────────────
-- Empty array = any movement may cite it. But when a reason names EXACTLY ONE
-- type and the voucher is an ISSUE, fn_svh_txn_map believes the reason and posts
-- that type: an ISSUE citing SAMPLE becomes SAMPLE_ISSUE, not a bare
-- ADJUST_MINUS. That is the whole mechanism by which sample, gift and
-- internal-use issues classify themselves.
--
-- ── srm_gl_ledger_id is left NULL ──────────────────────────────────────────
-- Where the value of written-off stock lands is a chart-of-accounts question and
-- this file does not know your chart. Fill it per company when the accounting
-- side is wired; nothing in the stock engine reads it yet.
--
-- srm_id (uuidv7) is deliberately NOT written out: nothing outside this database
-- refers to it, so each environment generates its own. The stable identity is
-- srm_code, unique per company.
--
-- Guarded on to_regclass so the file is a clean no-op -- not a deploy error --
-- on a database where the stock movement engine has not been migrated in yet.
-- Idempotent: a NOT EXISTS guard on (shared, srm_code). Not ON CONFLICT, because
-- the uniqueness is partial (shared vs company rows) and cannot be named as a
-- conflict target by column list.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Stock_Reason_Master.sql
--      or: npm run seed:run -- --only=Stock_Reason_Master.sql

BEGIN;

DO $do$
BEGIN
    IF to_regclass('stock.stock_reason_master') IS NULL THEN
        RAISE NOTICE 'stock.stock_reason_master does not exist yet -- skipping Stock_Reason_Master.sql.';
        RETURN;
    END IF;

    EXECUTE $sql$
INSERT INTO stock.stock_reason_master
    (srm_company_id, srm_code, srm_name, srm_direction,
     srm_allowed_txn_types, srm_require_remarks, srm_sort_order, srm_remarks)
SELECT v.company, v.code, v.name, v.direction,
       v.allowed, v.require_remarks, v.sort_order, v.note
  FROM (VALUES
    -- ── physical count variances ────────────────────────────────────────
    (NULL::uuid, 'SHORTAGE'::varchar, 'Physical shortage'::varchar, 'OUT'::varchar,
     ARRAY['PHYSICAL_MINUS']::text[],                     false, 10,
     'Counted less than the book. The default explanation for a count that came up short.'::varchar),
    (NULL, 'EXCESS',      'Physical excess',           'IN',
     ARRAY['PHYSICAL_PLUS']::text[],                      false, 20,
     'Counted more than the book.'),
    (NULL, 'COUNT_ERROR', 'Counting error',            'BOTH',
     ARRAY['PHYSICAL_PLUS','PHYSICAL_MINUS']::text[],     true,  30,
     'The count was wrong, not the stock. BOTH is safe here because a count takes its direction from the counted difference. Remarks required -- a recount should say what was recounted.'),
    (NULL, 'UNIT_ERROR',  'Wrong unit conversion',     'BOTH',
     ARRAY['PHYSICAL_PLUS','PHYSICAL_MINUS']::text[],     true,  40,
     'Keyed in the wrong unit somewhere upstream. Fix the source document as well; this only squares the quantity.'),
    (NULL, 'UNPOSTED',    'Unposted sale or purchase', 'BOTH',
     ARRAY['PHYSICAL_PLUS','PHYSICAL_MINUS']::text[],     true,  50,
     'The stock moved but the document did not. Raise the missing document rather than leaving this adjustment as the only record.'),

    -- ── stock genuinely leaving ─────────────────────────────────────────
    (NULL, 'DAMAGE',      'Damaged',                   'OUT',
     ARRAY['DAMAGE']::text[],                             true,  60,
     'Broken, spoiled or unsaleable. Remarks required because this is a write-off somebody will ask about.'),
    (NULL, 'EXPIRY',      'Expired',                   'OUT',
     ARRAY['EXPIRY_WRITEOFF']::text[],                    false, 70,
     'Past its expiry date. Pairs with stp_block_expired_sale and the near-expiry report.'),
    (NULL, 'PILFERAGE',   'Pilferage or theft',        'OUT',
     ARRAY[]::text[],                                     true,  80,
     'Remarks required. Deliberately has no allowed-type list so it can be cited on an adjustment or a count alike.'),
    (NULL, 'SAMPLE',      'Sample issued',             'OUT',
     ARRAY['SAMPLE_ISSUE']::text[],                       false, 90,
     'Exactly one allowed type, so an ISSUE citing this posts as SAMPLE_ISSUE and separates from ordinary shrinkage in every report.'),
    (NULL, 'GIFT',        'Gift issued',               'OUT',
     ARRAY['GIFT_ISSUE']::text[],                         false, 100,
     'As SAMPLE. Loyalty gift redemptions post through here.'),
    (NULL, 'INTERNAL',    'Internal use',              'OUT',
     ARRAY['ADJUST_MINUS']::text[],                       false, 110,
     'Consumed by the shop itself -- cleaning stock, staff tea, display units.'),

    -- ── stock genuinely arriving ────────────────────────────────────────
    (NULL, 'FOUND',       'Found on shelf',            'IN',
     ARRAY['ADJUST_PLUS']::text[],                        true,  120,
     'Stock that exists but the system never knew about. Remarks required: an unexplained increase is worth a sentence.'),
    (NULL, 'RETURN_IN',   'Returned from a customer',  'IN',
     ARRAY['ADJUST_PLUS']::text[],                        false, 130,
     'Only for goods coming back OUTSIDE a sale return document. A real sale return posts SALE_RETURN and needs no reason.'),

    (NULL, 'CORRECTION',  'Correction',                'BOTH',
     ARRAY['PHYSICAL_PLUS','PHYSICAL_MINUS']::text[],     true,  140,
     'The catch-all, restricted to counts. It is NOT usable on an ADJUSTMENT -- deliberately: "correction" does not say which way stock moved, and fn_svh_txn_map will refuse it. Pick FOUND or PILFERAGE instead.'),

    -- ── re-classification: the same stock, a different lot identity ─────
    -- Always used as a PAIR on one ADJUSTMENT, one line each way, same
    -- quantity and same cost. Nothing is gained or lost; the stock simply
    -- stops being in a lot whose identity was wrong. This is the repair for
    -- "we turned MRP tracking on after stock was already on the shelf": the
    -- old lot has no MRP, the soap on the shelf plainly does, and no amount
    -- of picking at the counter can reconcile that.
    --
    -- Do NOT instead UPDATE slt_mrp in place. stock_lot is identity: editing
    -- it silently rewrites what every past movement meant, while the
    -- sml_mrp snapshots on those ledger rows still say NULL.
    (NULL, 'RELOT_OUT',   'Re-classify -- out of the old lot',   'OUT',
     ARRAY['ADJUST_MINUS']::text[],                       true,  150,
     'Half of a re-lot pair. Never valid on its own: if stock leaves a lot and does not arrive in another, that is shrinkage, and PILFERAGE or DAMAGE is the honest reason.'),
    (NULL, 'RELOT_IN',    'Re-classify -- into the correct lot', 'IN',
     ARRAY['ADJUST_PLUS']::text[],                        true,  160,
     'The other half. Carry the SAME cost rate as the outgoing line, or the re-lot moves value as well as identity and the moving average shifts for no reason.')
  ) AS v(company, code, name, direction, allowed, require_remarks, sort_order, note)
 WHERE NOT EXISTS (
        SELECT 1
          FROM stock.stock_reason_master e
         WHERE e.srm_company_id IS NULL
           AND e.srm_code       = v.code
           AND e.srm_is_deleted = false)
    $sql$;
END
$do$;

COMMIT;

-- Verification, safe to run any time:
--   SELECT srm_code, srm_direction, srm_allowed_txn_types, srm_require_remarks
--     FROM stock.stock_reason_master WHERE srm_company_id IS NULL
--    ORDER BY srm_sort_order;
