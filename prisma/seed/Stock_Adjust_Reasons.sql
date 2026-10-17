-- Seed: fixed.stock_adj_reasons -- why a physical-stock count did not match (9 rows).
--
-- Picked per line on the physical stock screen: stock.physical_stock_detail.
-- psd_reason_id is a foreign key to sar_id. sar_reason_kind classifies the reason and
-- sar_default_resolution is the action the screen pre-selects for it
-- (ADJUST_LOSS_GAIN, RECLASSIFY, CORRECT_SOURCE_DOC, RECOUNT_REQUIRED).
-- sar_affects_accounts marks the reasons that post a value difference to the ledgers,
-- as opposed to the ones that only move stock between codes.
--
-- sar_id (uuidv7) is deliberately NOT written out: nothing outside this database
-- refers to it, so each environment generates its own. The stable identity is
-- sar_code, which is UNIQUE and is what this file conflicts on.
--
-- Idempotent: ON CONFLICT (sar_code) DO NOTHING.
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Stock_Adjust_Reasons.sql
--      or: npm run seed:run -- --only=Stock_Adjust_Reasons.sql

BEGIN;

INSERT INTO fixed.stock_adj_reasons
    (sar_code, sar_name, sar_reason_kind, sar_default_resolution, sar_affects_accounts, sar_is_active, sar_is_deleted)
VALUES
     ('BATCH_SWAP'::varchar, 'Wrong Batch Selected'::varchar, 'BATCH_SWAP'::varchar, 'RECLASSIFY'::varchar, false::boolean, true::boolean, false::boolean)
    ,('BRAND_SWAP' , 'Wrong Brand Selected'    , 'BRAND_SWAP'       , 'RECLASSIFY'        , false, true, false)
    ,('COUNT_ERROR', 'Counting Error'          , 'COUNTING_ERROR'   , 'RECOUNT_REQUIRED'  , false, true, false)
    ,('DAMAGE'     , 'Damage / Expired Stock'  , 'DAMAGE'           , 'ADJUST_LOSS_GAIN'  , true , true, false)
    ,('EXCESS'     , 'Physical Excess'         , 'EXCESS'           , 'ADJUST_LOSS_GAIN'  , true , true, false)
    ,('PILFERAGE'  , 'Pilferage / Theft'       , 'PILFERAGE'        , 'ADJUST_LOSS_GAIN'  , true , true, false)
    ,('SHORTAGE'   , 'Physical Shortage'       , 'SHORTAGE'         , 'ADJUST_LOSS_GAIN'  , true , true, false)
    ,('UNIT_ERROR' , 'Wrong Unit Conversion'   , 'UNIT_ERROR'       , 'CORRECT_SOURCE_DOC', false, true, false)
    ,('UNPOSTED'   , 'Unposted Sale / Purchase', 'UNPOSTED_DOCUMENT', 'CORRECT_SOURCE_DOC', false, true, false)
ON CONFLICT (sar_code) DO NOTHING;

COMMIT;
