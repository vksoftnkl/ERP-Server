-- Seed: accounts.acc_voucher_types -> Sales Order (module src/modules/sales/order)
--
-- One row per sales document module, following the existing rows:
--   1 = Opn / Opening Stock, 2 = Quo / Sales Quotation, 3 = Bil / Sales Bill.
--
-- Notes on the values chosen:
--   * vchr_category = INVENTORY and vchr_affects_accounts = false, matching the
--     Quo row: an order is a commitment, not an accounting document — nothing
--     posts to the ledgers until it becomes a bill. (The advance money an order
--     takes is a tender row / receipt concern, not this voucher type's.)
--   * vchr_numbering_mode = AUTO with vchr_allow_manual_no = false, matching the
--     Quo / Bil rows: order.service.ts allocates so_order_slno / so_order_refno
--     from accounts.acc_voucher_seq on create and ignores whatever the client
--     sent — see the "Order numbering" section of
--     src/modules/sales/order/README.md. The prefix / width / reset frequency
--     below are the format the sequence row is seeded with, so orders read
--     sor00001, sor00002, ...
--   * Covers all three so_doc_type values (SALES_ORDER, BOOKING, CUSTOM_ORDER)
--     — they share one number series.
--
-- Idempotent: re-running skips the row if the id / code / name already exists.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Voucher_Types_Sale_Order.sql

INSERT INTO accounts.acc_voucher_types (
    vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short,
    vchr_category, vchr_nature, vchr_numbering_mode,
    vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
    vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
    vchr_print_title, vchr_sort_order, vchr_is_active,
    vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type,
    vchr_sync_date, vchr_created_on, vchr_created_by, vchr_updated_on, vchr_updated_by
) VALUES (
    4, 'SOr', 'Sales Order', 'SOr',
    'INVENTORY'::accounts."VoucherCategory",
    'SALES'::accounts."VoucherNature",
    'AUTO'::accounts."VoucherNumberingMode",
    'sor', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
    false, true, false, false,
    'SALES ORDER', 250, true,
    false, NULL, NULL,
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
