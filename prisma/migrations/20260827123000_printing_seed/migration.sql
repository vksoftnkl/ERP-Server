-- ═══════════════════════════════════════════════════════════════════════════
--  NexERP backend — 17: PRINTING, §9 and §10.
--
--  The shipped purposes, and the settings this subsystem reads.
--  Both are idempotent, so re-running is a no-op.
--
--  §11 (comments) and §12 (the not-executed migration of the previous
--  generation) are NOT here: several of §11's COMMENT targets name columns
--  that 20260827121000_add_printing_engine did not create, because the §5, §6
--  and §7 column blocks had not reached me when it was written. They land with
--  the correction migration.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  §9  Seed — the shipped purposes.
--
--  This is 3.0's pgrp_id list, as rows. It was a hard-coded magic integer at
--  ten C++ call sites (9 = Sales Bill, 10 = Delivery Slip, 11 = Godown Slip,
--  14 = Sales Order, 16 = Delivery Challan, 18 = Loyalty Redemption …) and
--  adding a printable thing meant editing the client.
--
--  ppo_company_id is left NULL: these are SHIPPED, visible to every company.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.print_purpose
    (ppo_code, ppo_name, ppo_src_module, ppo_doc_type,
     ppo_copy_count, ppo_copy_labels, ppo_allow_reprint, ppo_sort_order)
SELECT v.code, v.name, v.module, v.doc, v.copies, v.labels, v.reprint, v.sort
  FROM (VALUES
    -- code, name, module, doc type, copies, copy labels, reprint, sort
    ('SALE_INVOICE',    'Tax Invoice',            'SALES',    'SALE_BILL',
     3, 'ORIGINAL,DUPLICATE,TRIPLICATE', true,  10),
    ('SALE_RECEIPT',    'Counter Receipt',        'SALES',    'SALE_BILL',
     1, 'NA',                            true,  20),
    ('DELIVERY_SLIP',   'Delivery Slip',          'SALES',    'SALE_BILL',
     1, 'NA',                            true,  30),
    ('GODOWN_SLIP',     'Godown Delivery Slip',   'SALES',    'SALE_BILL',
     1, 'NA',                            true,  40),
    ('SALE_RETURN',     'Credit Note',            'SALES',    'SALE_RETURN',
     2, 'ORIGINAL,DUPLICATE',            true,  50),
    ('SALE_ORDER',      'Sales Order',            'SALES',    'SALES_ORDER',
     1, 'NA',                            true,  60),
    ('SALE_QUOTATION',  'Quotation',              'SALES',    'SALE_QUOTATION',
     1, 'NA',                            true,  70),
    ('DELIVERY_CHALLAN','Delivery Challan',       'SALES',    'DELIVERY_CHALLAN',
     3, 'ORIGINAL,DUPLICATE,TRIPLICATE', true,  80),
    ('RECEIPT_VOUCHER', 'Receipt Voucher',        'ACCOUNTS', 'ACC_VOUCHER',
     1, 'NA',                            true,  90),
    ('PAYMENT_VOUCHER', 'Payment Voucher',        'ACCOUNTS', 'ACC_VOUCHER',
     1, 'NA',                            true, 100),
    ('STOCK_VOUCHER',   'Stock Voucher',          'STOCK',    'STOCK_VOUCHER',
     1, 'NA',                            true, 110),
    ('LOYALTY_REDEEM',  'Loyalty Redemption',     'LOYALTY',  'LOYALTY_REDEMPTION',
     1, 'NA',                            true, 120)
  ) AS v(code, name, module, doc, copies, labels, reprint, sort)
 WHERE NOT EXISTS (
    SELECT 1 FROM public.print_purpose p
     WHERE p.ppo_company_id IS NULL
       AND lower(p.ppo_code::text) = lower(v.code));


-- ═══════════════════════════════════════════════════════════════════════════
--  §10  Seed — the settings this subsystem reads.
--
--  Registered in the catalog exactly as 13_loyalty_ledger.sql registers the
--  loyalty keys, so AppSession picks them up through the existing
--  USER > DEVICE > BRANCH > COMPANY > GLOBAL resolver with no new mechanism.
--
--  public.language exists because system.regional is a BOOL scoped to
--  COMPANY, and a chain spanning two states cannot say "Tamil in Chennai,
--  English in Bangalore" with a company-wide boolean. system.regional stays
--  as the on/off master switch so nothing already relying on it breaks.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES

-- ── PRINTING · output ────────────────────────────────────────────────────
('public.default_output_mode', 'PRINTING', 'Output', 'TEXT', 'PRINT',
 '["PRINT","PREVIEW","PDF"]', NULL, NULL, 'DEVICE',
 'Default output', 'What Save and Print does when the operator does not choose.', 10, false, 'SYSTEM'),

('public.preview_before_print', 'PRINTING', 'Output', 'BOOL', 'false',
 NULL, NULL, NULL, 'USER',
 'Preview first', 'Show the rendered document before it goes to the printer.', 20, false, 'SYSTEM'),

('public.allow_choose_format', 'PRINTING', 'Output', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Allow print in format', 'May an operator print with a design other than the one configured for the counter.', 30, false, 'SYSTEM'),

-- ── PRINTING · display ───────────────────────────────────────────────────
('public.language', 'PRINTING', 'Display', 'TEXT', 'en-IN',
 NULL, NULL, NULL, 'BRANCH',
 'Print language', 'Language for printed documents. Scoped to the branch, which system.regional cannot be: it is a company-wide boolean and a chain spanning two states needs one answer per branch.', 40, false, 'SYSTEM'),

-- ── PRINTING · control ───────────────────────────────────────────────────
('public.allow_reprint', 'PRINTING', 'Control', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Allow reprint', 'May a document already printed be printed again.', 50, false, 'SYSTEM'),

('public.reprint_watermark', 'PRINTING', 'Control', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Watermark reprints', 'Mark every print after the first as a duplicate. Decided from the print log, not from a counter on the document.', 60, false, 'SYSTEM'),

-- ── PRINTING · datasets ──────────────────────────────────────────────────
-- The kill switch. Stored SQL is the one part of this subsystem that can be
-- turned off without turning printing off, and it must be turn-off-able
-- without a release.
('public.sql_dataset_enabled', 'PRINTING', 'Datasets', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Allow stored SQL datasets', 'When off, only code-registered providers may supply report data. The schema still holds any stored SQL; the server refuses to run it.', 70, true, 'SYSTEM'),

('public.sql_timeout_ms', 'PRINTING', 'Datasets', 'INT', '15000',
 NULL, 100, 120000, 'COMPANY',
 'Dataset timeout (ms)', 'Server-side statement timeout for a stored-SQL dataset. The floor of the two, this and the row own value, wins.', 80, false, 'SYSTEM'),

('public.sql_row_limit', 'PRINTING', 'Datasets', 'INT', '5000',
 NULL, 1, 200000, 'COMPANY',
 'Dataset row limit', 'Hard cap the render wrapper applies to every stored-SQL dataset.', 90, false, 'SYSTEM'),

-- ── PRINTING · log ───────────────────────────────────────────────────────
('public.log_retention_years', 'PRINTING', 'Log', 'INT', '8',
 NULL, 1, 25, 'COMPANY',
 'Print log retention (years)', 'Whole-year partitions older than this may be dropped. Eight by default because GST records must survive 72 months from the annual return due date, and a print log is part of proving what was issued.', 100, false, 'SYSTEM')

ON CONFLICT (asd_key) DO NOTHING;
