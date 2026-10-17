-- Accept 'DESKTOP' as a voucher device type.
--
-- sale_bill.sb_device_type records 'Desktop', and the sale-bill posting helper
-- carries that vocabulary straight through rather than squashing it into 'PC'.
-- Without this the first POSTED bill raised from a desktop till fails on
-- ck_avh_device_type.
--
-- The constraint lives on the partitioned parent, so dropping and re-adding it
-- there propagates to every partition.

ALTER TABLE accounts.acc_voucher_header
  DROP CONSTRAINT IF EXISTS ck_avh_device_type;

ALTER TABLE accounts.acc_voucher_header
  ADD CONSTRAINT ck_avh_device_type CHECK (
    avh_device_type IS NULL
    OR avh_device_type::text = ANY (ARRAY[
      'PC'::text, 'WEB'::text, 'MOBILE'::text, 'POS'::text, 'DESKTOP'::text]));
