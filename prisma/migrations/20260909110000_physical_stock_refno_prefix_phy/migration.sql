-- Physical Stock reference numbers print as "PHY0001", not
-- "PHY/2026-2027/<device-uuid>/1".
--
-- Unlike the OPENING and Quotation refno migrations, which UPDATE a voucher
-- type that already existed, there was NO acc_voucher_types row for the
-- physical count at all -- so its refno fell through to the device-based
-- fallback in stock-voucher-numbering.helper.ts, and on a device registered
-- without a printable code (dev_device_uid / dev_device_name empty) the middle
-- segment was the raw device uuid.
--
-- This inserts the missing series. PHYSICAL_VCHR_TYPE_ID in
-- physical-stock-voucher.controller.ts names vchr_type_id 6; the id is pinned
-- (not identity-assigned) so the code can reference it, mirroring how OPENING
-- pins id 1. Idempotent via ON CONFLICT DO NOTHING, so re-running -- or a DB
-- that already carries a physical type under any unique key -- is a no-op.
--
-- Numbers already issued keep the text they were printed and stored with
-- (svh_refno, txn_status_log); only numbers allocated from now on take the new
-- shape. Any acc_voucher_seq counter created from this type before this ran is
-- realigned too, so a live series does not keep the old format snapshot.

BEGIN;

INSERT INTO accounts.acc_voucher_types
    (vchr_type_id, vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode, vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no, vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher, vchr_print_title, vchr_sort_order, vchr_is_active, vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
VALUES
    (6::integer, 'Phy'::varchar, 'Physical Stock'::varchar, 'Phy'::varchar, 'INVENTORY'::accounts."VoucherCategory", 'STOCK_JOURNAL'::accounts."VoucherNature", 'MANUAL'::accounts."VoucherNumberingMode", 'PHY'::varchar, ''::varchar, 4::integer, 'YEARLY'::accounts."VoucherResetFreq", false::boolean, false::boolean, true::boolean, false::boolean, false::boolean, 'Physical Stock'::varchar, 110::integer, true::boolean, true::boolean, NULL::varchar, NULL::varchar, 'system'::varchar)
ON CONFLICT DO NOTHING;

-- Realign any counter already created from this type (harmless when none exists).
UPDATE accounts.acc_voucher_seq
SET seq_voucher_prefix = 'PHY',
    seq_voucher_suffix = '',
    seq_no_width       = 4,
    seq_modified_on    = now()
WHERE seq_vchr_type_id IN (
    SELECT vchr_type_id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Phy'
);

-- Keep the identity sequence ahead of the pinned id, so a UI-created type does
-- not collide with row 6.
SELECT setval(
    pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
    (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types),
    true
);

COMMIT;
