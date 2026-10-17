-- ═══════════════════════════════════════════════════════════════════════════
--  notes (57): Receipt / Payment Voucher keeps the unallocated remainder as an
--  ADVANCE bill. DATA ONLY (one setting). 2026-09-28.
--
--  The rule is TypeScript (voucher-derive.ts, the DEMAND branch of the party
--  leg loop): a party leg allocated SHORT raises one ADVANCE bill on the party
--  for leg − Σ allocations, the leg's side, dated the voucher, no due date;
--  over-allocation stays VCH_BILLWISE_SHORT. This setting is the brake the
--  notes offer: false = today's strict rule, every rupee bill by bill.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT 'accounts.voucher_allow_advance', 'ACCOUNTS', 'Voucher Register', 'BOOL', 'true',
       'COMPANY', 'Receipt / Payment: keep the remainder as an advance',
       'On a Receipt or Payment Voucher, an amount not set against a bill is kept as an ADVANCE bill on the party (the way menu 99 does it). false = the whole party amount must be allocated bill by bill.',
       0, 'SYSTEM'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'accounts.voucher_allow_advance');
