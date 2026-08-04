-- Seed: accounts.acc_voucher_types -> Sales Bill (module src/modules/sales/bill)
--
-- One row per sales document module, following the existing rows:
--   20 = Opn / Opening Stock, 21 = Quo / Sales Quotation.
--
-- Notes on the values chosen:
--   * vchr_category = BOTH and vchr_affects_accounts = true, because unlike a
--     quotation a bill posts to the ledgers as well as moving stock.
--   * vchr_numbering_mode = AUTO with vchr_allow_manual_no = false, matching the
--     Quo row: bill.service.ts allocates sb_bill_slno / sb_bill_refno from
--     accounts.acc_voucher_seq on create and ignores whatever the client sent
--     -- see the "Bill numbering" section of src/modules/sales/bill/README.md.
--     The prefix / suffix / width / reset frequency below are the format the
--     sequence row is seeded with, so bills read bil00001, bil00002, ...
--   * Covers both sb_doc_type values (TAX_INVOICE and BILL_OF_SUPPLY) -- they
--     share one number series and both export to Tally as Sales vouchers.
--
-- Idempotent: re-running skips the row if the id / code / name already exists.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Voucher_Types_Sale_Bill.sql

INSERT INTO accounts.acc_voucher_types (
    vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short,
    vchr_category, vchr_nature, vchr_numbering_mode,
    vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
    vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
    vchr_print_title, vchr_sort_order, vchr_is_active,
    vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type,
    vchr_sync_date, vchr_created_on, vchr_created_by, vchr_updated_on, vchr_updated_by
) VALUES (
    22, 'Bil', 'Sales Bill', 'Bil',
    'BOTH'::accounts."VoucherCategory",
    'SALES'::accounts."VoucherNature",
    'AUTO'::accounts."VoucherNumberingMode",
    'bil', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
    true, true, false, false,
    'TAX INVOICE', 300, true,
    true, 'Sales', 'Sales',
    NULL, now(), 'system', NULL, NULL
)
ON CONFLICT DO NOTHING;

-- Keep the identity sequence ahead of the explicitly-numbered seed rows so a
-- later insert that omits vchr_type_id does not collide with them.
SELECT setval(
    pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
    GREATEST((SELECT COALESCE(MAX(vchr_type_id), 1) FROM accounts.acc_voucher_types), 1),
    true
);
