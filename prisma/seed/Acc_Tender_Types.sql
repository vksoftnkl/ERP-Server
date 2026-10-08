-- Seed: accounts.acc_tender_types -- the ways a bill can be paid (11 rows).
--
-- accounts.acc_tender_master.tnd_type_id and acc_tender_detail.td_tender_type_id are
-- foreign keys here, ON DELETE RESTRICT, so the ids are written out -- a tender line
-- recorded as type 3 has to stay UPI everywhere.
--
-- ttm_type_id has NO sequence default on this table: the id must always be supplied,
-- which is why there is no setval at the bottom. Pick the next free number by hand
-- when adding a tender type.
--
-- Flags, because they drive the payment screen:
--   * ttm_needs_ref forces a reference to be typed, labelled by ttm_ref_label (a check
--     constraint enforces that the label exists whenever needs_ref is true);
--   * ttm_is_cash marks the tender change can be given from;
--   * ttm_allow_change permits over-tender, ttm_sale_only hides it outside sales, and
--     ttm_allow_in_return decides whether a refund may be paid back this way.
--
-- And two the till close reads (migration 20261008100000, share file 47 §1.8):
--   * ttm_close_mode: DENOM (cash, by denomination) | SLIPS (card / cheque / gift
--     voucher) | STATEMENT (UPI / wallet / bank, reconciled later) | NONE (not money
--     in the drawer); ttm_handover marks the instrument that goes to the safe. On a
--     fresh database this file is the only thing that sets them: the migration's
--     UPDATE runs before the seed and finds no rows.
--
-- Rows are ordered by ttm_display_order, the order the screen lists them in.
-- Idempotent: ON CONFLICT (ttm_type_id) DO NOTHING.
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Tender_Types.sql
--      or: npm run seed:run -- --only=Acc_Tender_Types.sql

BEGIN;

INSERT INTO accounts.acc_tender_types
    (ttm_type_id, ttm_type_name, ttm_display_name, ttm_is_cash, ttm_needs_ref, ttm_ref_label, ttm_sale_only, ttm_allow_change, ttm_allow_in_return, ttm_close_mode, ttm_handover, ttm_display_order, ttm_is_active, ttm_is_deleted, ttm_created_by)
VALUES
     (1::integer, 'CASH'::varchar, 'Cash'::varchar, true::boolean, false::boolean, NULL::varchar, false::boolean, true::boolean, true::boolean, 'DENOM'::varchar, true::boolean, 10::integer, true::boolean, false::boolean, 'system'::varchar)
    ,(2 , 'CARD'   , 'Card'            , false, true , 'Card Last 4' , false, false, true , 'SLIPS'    , false, 20 , true, false, 'system')
    ,(3 , 'UPI'    , 'UPI'             , false, true , 'UTR No'      , false, false, true , 'STATEMENT', false, 30 , true, false, 'system')
    ,(4 , 'WALLET' , 'Wallet'          , false, true , 'Txn Ref'     , false, false, true , 'STATEMENT', false, 40 , true, false, 'system')
    ,(5 , 'CHEQUE' , 'Cheque'          , false, true , 'Cheque No'   , false, false, true , 'SLIPS'    , true , 50 , true, false, 'system')
    ,(6 , 'BANK'   , 'Bank Transfer'   , false, true , 'UTR / Ref No', false, false, true , 'STATEMENT', false, 60 , true, false, 'system')
    ,(7 , 'RRN'    , 'RRN'             , false, true , 'RRN'         , true , false, false, 'NONE'     , false, 70 , true, false, 'system')
    ,(8 , 'TEMP_CR', 'Temporary Credit', false, true , 'Approved By' , true , false, false, 'NONE'     , false, 80 , true, false, 'system')
    ,(9 , 'CREDIT' , 'Credit'          , false, false, NULL          , true , false, false, 'NONE'     , false, 90 , true, false, 'system')
    ,(10, 'LOYALTY', 'Loyalty Points'  , false, false, NULL          , true , false, false, 'NONE'     , false, 100, true, false, 'system')
    ,(11, 'VOUCHER', 'Gift Voucher'    , false, true , 'Voucher No'  , true , false, false, 'SLIPS'    , true , 110, true, false, 'system')
ON CONFLICT (ttm_type_id) DO NOTHING;

COMMIT;
