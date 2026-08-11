-- Seed: accounts.acc_voucher_types -> Order Advance Receipt
-- (module src/modules/sales/sale-order, helper order-advance-posting.helper.ts)
--
-- One row per sales document module, following the existing rows:
--   1 = Opn / Opening Stock, 2 = Quo / Sales Quotation, 3 = Bil / Sales Bill,
--   4 = SOr / Sales Order.
--
-- Why a FIFTH type rather than reusing 4 (SOr):
--   * SOr is vchr_category = INVENTORY with vchr_affects_accounts = false — an
--     order is a commitment, and nothing about the commitment itself belongs in
--     the ledgers. Its own seed says so: "The advance money an order takes is a
--     tender row / receipt concern, not this voucher type's."
--   * The money a customer hands over against an order IS an accounting fact,
--     and its nature is RECEIPT, not SALES: cash / bank / card clearing is
--     debited and the customer-advance LIABILITY ledger
--     (sale_order.so_advance_ledger_id, falling back to the customer's own
--     ledger) is credited. Nothing is sold and nothing is owed yet.
--   * Giving it its own type keeps its number series separate, so an order
--     reads sor00101 while the receipt behind it reads arc00007 — and the day
--     book shows a receipt where a receipt belongs.
--
-- Numbering: AUTO with vchr_allow_manual_no = false, like every other document
-- type here. order-advance-posting.helper.ts draws avh_voucher_no from
-- accounts.acc_voucher_seq through allocateVoucherNumber; the sequence row is
-- created on first use and snapshots the prefix / width / reset frequency
-- below, so receipts read arc00001, arc00002, ...
--
-- vchr_is_cash_voucher / vchr_is_bank_voucher are both false on purpose: one
-- receipt can carry several tender lines (part cash, part UPI), so the voucher
-- as a whole is neither.
--
-- Idempotent: re-running skips the row if the id / code / name already exists.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Voucher_Types_Order_Advance_Receipt.sql

INSERT INTO accounts.acc_voucher_types (
    vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short,
    vchr_category, vchr_nature, vchr_numbering_mode,
    vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
    vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
    vchr_print_title, vchr_sort_order, vchr_is_active,
    vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type,
    vchr_sync_date, vchr_created_on, vchr_created_by, vchr_updated_on, vchr_updated_by
) VALUES (
    5, 'ARc', 'Order Advance Receipt', 'ARc',
    'ACCOUNTING'::accounts."VoucherCategory",
    'RECEIPT'::accounts."VoucherNature",
    'AUTO'::accounts."VoucherNumberingMode",
    'arc', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
    true, false, false, false,
    'ADVANCE RECEIPT', 260, true,
    true, 'Receipt', 'Receipt',
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
