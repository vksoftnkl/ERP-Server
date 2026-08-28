-- Seed: accounts.acc_voucher_types -- one row per document series (5 rows).
--
-- Every numbered document resolves its series here: accounts.acc_voucher_seq keys its
-- counters on seq_vchr_type_id, and the sales services allocate numbers through
-- findOrCreateSequence() (src/common/Sequence/voucher-sequence.helper.ts), which copies
-- vchr_no_prefix / _suffix / _width into the counter row as a format snapshot. Editing
-- a type later therefore never rewrites numbers already issued.
--
-- This file replaced the three single-type seeds that used to sit alongside it
-- (Acc_Voucher_Types_Sale_Bill / _Sale_Order / _Order_Advance_Receipt), which are now
-- deleted: every type they carried is in the VALUES list below.
--
-- The enum columns (vchr_category, vchr_nature, vchr_numbering_mode, vchr_reset_freq)
-- are cast to their accounts."..." enum types on the first row; PostgreSQL resolves
-- the rest of the VALUES list from it.
--
-- Idempotent: ON CONFLICT DO NOTHING with no target, so a row already present under
-- ANY unique key -- vchr_type_id, vchr_type_code or vchr_type_name -- is left exactly
-- as it is. That matters because a database seeded from Acc_Voucher_Types_Sale_Bill.sql
-- carries Sales Bill as id 22: the id 3 row below is skipped there, the existing 22 is
-- kept (acc_vouchers, acc_voucher_seq and acc_bill_balance all point at it), and only
-- the types actually missing are inserted. The setval then keeps the sequence past
-- whatever the highest id turns out to be.
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
ON CONFLICT DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
    (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types),
    true
);

COMMIT;
