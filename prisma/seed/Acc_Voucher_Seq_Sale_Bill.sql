-- Seed: accounts.acc_voucher_seq -> counter row for voucher type 'Bil' (Sales Bill)
-- Depends on: prisma/seed/Acc_Voucher_Types_Sale_Bill.sql (voucher type 22)
--
-- Mirrors exactly what findOrCreateSequence() in
-- src/common/Sequence/voucher-sequence.helper.ts would create on first use:
--   * seq_last_no starts at 0 -- the first allocation increments to 1
--   * seq_voucher_prefix / suffix / no_width are a FORMAT SNAPSHOT copied from
--     the voucher type; editing the type later never rewrites numbers already
--     issued from this row
--   * seq_company_code / seq_branch_code are snapshots of the masters
--   * seq_period_key = the accounting year, because voucher type 'Bil' resets
--     YEARLY (NEVER -> 'ALL', MONTHLY -> 'YYYY-MM', DAILY -> 'YYYY-MM-DD')
--   * seq_device_code defaults to 'MAIN' -- the sales services do not pass a
--     deviceCode, so they all share the one counter per company/branch/year
--
-- Add a line to the VALUES list below for each (company, branch, accounting
-- year, device) counter you want pre-created.
--
-- Idempotent: uq_acc_voucher_seq_scope collisions are skipped, so re-running
-- never resets a counter that has already issued numbers.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Voucher_Seq_Sale_Bill.sql

INSERT INTO accounts.acc_voucher_seq (
    seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year,
    seq_device_id, seq_device_code, seq_period_key, seq_last_no,
    seq_voucher_prefix, seq_voucher_suffix, seq_no_width,
    seq_company_code, seq_branch_code, seq_last_refno,
    seq_is_active, seq_is_deleted,
    seq_created_on, seq_created_by, seq_modified_on, seq_modified_by
)
SELECT
    vt.vchr_type_id,
    c.comp_id,
    b.br_id,
    s.acc_year,
    NULL::uuid,          -- seq_device_id: unknown until a counter/device registers
    s.device_code,
    s.acc_year,          -- period key == accounting year (vchr_reset_freq = YEARLY)
    0,                   -- seq_last_no: nothing issued yet
    vt.vchr_no_prefix,
    vt.vchr_no_suffix,
    vt.vchr_no_width,
    c.comp_code,
    b.br_code,
    NULL,                -- seq_last_refno: filled in by the first allocation
    true, false,
    now(), NULL, NULL, NULL
FROM (VALUES
    -- company code, branch code, accounting year, device/counter code
    ('ABC123', 'BR001', '2026-2027', 'MAIN')
) AS s(comp_code, br_code, acc_year, device_code)
JOIN public.companys      c  ON c.comp_code = s.comp_code
                            AND c.comp_is_deleted = false
JOIN public.branch_master b  ON b.br_comp_id = c.comp_id
                            AND b.br_code = s.br_code
                            AND b.br_is_deleted = false
JOIN accounts.acc_voucher_types vt ON vt.vchr_type_code = 'Bil'
ON CONFLICT (
    seq_vchr_type_id, seq_company_id, seq_branch_id,
    seq_acc_year, seq_device_code, seq_period_key
) DO NOTHING;
