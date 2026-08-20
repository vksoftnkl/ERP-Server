-- Seed: accounts.acc_voucher_types -- one row per document series (5 rows).
--
-- Every numbered document resolves its series here: accounts.acc_voucher_seq keys its
-- counters on seq_vchr_type_id, and the sales services allocate numbers through
-- findOrCreateSequence() (src/common/Sequence/voucher-sequence.helper.ts), which copies
-- vchr_no_prefix / _suffix / _width into the counter row as a format snapshot. Editing
-- a type later therefore never rewrites numbers already issued.
--
-- This file supersedes the three single-type seeds kept alongside it
-- (Acc_Voucher_Types_Sale_Bill / _Sale_Order / _Order_Advance_Receipt): it runs first
-- in the manifest, so those turn into no-ops. They are left in place because each one
-- documents the reasoning behind its row, and because they still add their type to a
-- database seeded before this export existed.
--
-- The enum columns (vchr_category, vchr_nature, vchr_numbering_mode, vchr_reset_freq)
-- are cast to their accounts."..." enum types on the first row; PostgreSQL resolves
-- the rest of the VALUES list from it.
--
-- Idempotent: ON CONFLICT (vchr_type_id) DO NOTHING, and the setval keeps the sequence
-- past the seeded ids.
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Voucher_Types.sql
--      or: npm run seed:run -- --only=Acc_Voucher_Types.sql

BEGIN;

INSERT INTO accounts.acc_voucher_types
    (vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode, vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no, vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher, vchr_print_title, vchr_sort_order, vchr_is_active, vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
VALUES
     (1::integer, 'Opn'::varchar, 'Opening Stock'::varchar, 'Opn'::varchar, 'INVENTORY'::accounts."VoucherCategory", 'STOCK_JOURNAL'::accounts."VoucherNature", 'MANUAL'::accounts."VoucherNumberingMode", 'opn'::varchar, 'st'::varchar, 12::integer, 'YEARLY'::accounts."VoucherResetFreq", false::boolean, false::boolean, true::boolean, false::boolean, false::boolean, 'Opening Stock'::varchar, 100::integer, true::boolean, true::boolean, NULL::varchar, NULL::varchar, 'system'::varchar)
    ,(2, 'Quo', 'Sales Quotation'      , 'Quo', 'INVENTORY' , 'SALES'        , 'AUTO'  , 'quo', NULL, 5 , 'YEARLY', false, false, true , false, false, 'QUOTATION'      , 200, true, false, NULL     , NULL     , 'system')
    ,(3, 'Bil', 'Sales Bill'           , 'Bil', 'BOTH'      , 'SALES'        , 'AUTO'  , 'bil', ''  , 5 , 'YEARLY', false, true , true , false, false, 'TAX INVOICE'    , 300, true, true , 'Sales'  , 'Sales'  , 'system')
    ,(4, 'SOr', 'Sales Order'          , 'SOr', 'INVENTORY' , 'SALES'        , 'AUTO'  , 'sor', ''  , 5 , 'YEARLY', false, false, true , false, false, 'SALES ORDER'    , 250, true, false, NULL     , NULL     , 'system')
    ,(5, 'ARc', 'Order Advance Receipt', 'ARc', 'ACCOUNTING', 'RECEIPT'      , 'AUTO'  , 'arc', ''  , 5 , 'YEARLY', false, true , false, false, false, 'ADVANCE RECEIPT', 260, true, true , 'Receipt', 'Receipt', 'system')
ON CONFLICT (vchr_type_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
    (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types),
    true
);

COMMIT;
