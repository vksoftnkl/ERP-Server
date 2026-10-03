-- ───────────────────────────────────────────────────────────────────────────
--  public.app_setting_def  —  product catalog seed
--
--  The real settings catalog, replacing the starter set 20260812120000 shipped
--  as an illustration. A setting is a ROW, so this is an INSERT and nothing
--  else — no DDL, no client release (see prisma/public/appSettings.prisma and
--  src/modules/settings/appSettings/README.md).
--
--  Idempotent on asd_key (ON CONFLICT DO NOTHING), so replaying it on a shadow
--  database, or after somebody has added keys by hand, changes nothing.
--
--  Two rules the database does NOT enforce, both honoured below:
--    · asd_default_value must cast to asd_data_type — fn_app_settings casts it
--      blindly for every caller who has not overridden the setting.
--    · asd_max_scope is a judgement, not a default. A setting that changes what
--      a document TOTALS TO is COMPANY (one answer for the business); a setting
--      that only changes how a counter feels to work at is DEVICE or USER.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES

-- ── SYSTEM ───────────────────────────────────────────────────────────────
('system.regional', 'SYSTEM', 'Display', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Regional language', 'Show item names and prints in the regional language where a screen supports it.', 10, true, 'SYSTEM'),

('system.company_state_code', 'SYSTEM', 'Tax', 'TEXT', '33',
 NULL, NULL, NULL, 'COMPANY',
 'Company state code', 'The GST state code of the company. Decides local vs inter-state on every sale.', 20, false, 'SYSTEM'),

('system.txn_entry_first', 'SYSTEM', 'Navigation', 'BOOL', 'false',
 NULL, NULL, NULL, 'USER',
 'Open entry screen first', 'A transaction menu opens the voucher screen (true) or its list (false). A person''s working style, so it is settable per user.', 30, false, 'SYSTEM'),

-- ── INVENTORY ────────────────────────────────────────────────────────────
('inventory.price_level_count', 'INVENTORY', 'Pricing', 'INT', '4',
 NULL, 1, 10, 'COMPANY',
 'Price levels', 'How many selling price levels the item master carries.', 10, true, 'SYSTEM'),

('inventory.edit_price', 'INVENTORY', 'Pricing', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Allow price edit', 'May a price be typed on the item price grid.', 20, false, 'SYSTEM'),

('inventory.skip_mrp', 'INVENTORY', 'Pricing', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Skip MRP', 'Leave MRP out of item entry for a business that does not print one.', 30, false, 'SYSTEM'),

('inventory.below_cost_price', 'INVENTORY', 'Pricing', 'TEXT', 'warning',
 '["restrict","warning","allow"]'::jsonb, NULL, NULL, 'COMPANY',
 'Price below cost', 'What happens when a price is entered below its cost: block it, ask, or allow it silently.', 40, false, 'SYSTEM'),

('inventory.hsn_min_length', 'INVENTORY', 'Tax', 'INT', '0',
 NULL, 0, 8, 'COMPANY',
 'Minimum HSN length', 'Shortest HSN code accepted on the item master. 0 turns the check off.', 50, false, 'SYSTEM'),

-- ── SALES · entry ────────────────────────────────────────────────────────
('sales.auto_pop_qty', 'SALES', 'Entry', 'BOOL', 'false',
 NULL, NULL, NULL, 'DEVICE',
 'Auto quantity', 'A picked item lands with quantity 1 already filled, for a counter that sells singles.', 10, false, 'SYSTEM'),

('sales.allow_duplicate_item', 'SALES', 'Entry', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Allow duplicate item', 'May the same item appear on more than one line of a document.', 20, false, 'SYSTEM'),

('sales.duplicate_default_yes', 'SALES', 'Entry', 'BOOL', 'false',
 NULL, NULL, NULL, 'DEVICE',
 'Duplicate prompt defaults to Yes', 'Which button the duplicate-item prompt starts on.', 30, false, 'SYSTEM'),

('sales.salesman_mandatory', 'SALES', 'Entry', 'BOOL', 'false',
 NULL, NULL, NULL, 'BRANCH',
 'Salesman required', 'A document cannot be saved without a salesman.', 40, false, 'SYSTEM'),

('sales.allow_mrp_edit', 'SALES', 'Entry', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Allow MRP edit', 'May the MRP be retyped on a sale line.', 50, false, 'SYSTEM'),

('sales.clear_delivery_on_clear', 'SALES', 'Entry', 'BOOL', 'false',
 NULL, NULL, NULL, 'DEVICE',
 'Clear delivery crew on Clear', 'A trip bills many customers with the same crew, so clearing them every bill is optional.', 60, false, 'SYSTEM'),

('sales.auto_save_temp_bill', 'SALES', 'Entry', 'BOOL', 'true',
 NULL, NULL, NULL, 'DEVICE',
 'Power-failure autosave', 'The bill screen keeps a running snapshot and offers to restore it after a crash.', 70, false, 'SYSTEM'),

('sales.pop_default_customer', 'SALES', 'Entry', 'BOOL', 'true',
 NULL, NULL, NULL, 'DEVICE',
 'Seed walk-in customer', 'A new bill starts on the default customer instead of an empty picker.', 80, false, 'SYSTEM'),

('sales.default_customer_id', 'SALES', 'Entry', 'UUID', '019f659c-3942-7237-89b0-c4899603dd7a',
 NULL, NULL, NULL, 'DEVICE',
 'Walk-in customer', 'The customer a new bill starts on. Per till, because counters differ.', 90, false, 'SYSTEM'),

-- ── SALES · pricing ──────────────────────────────────────────────────────
('sales.default_price_level', 'SALES', 'Pricing', 'INT', '1',
 NULL, 1, 10, 'BRANCH',
 'Default price level (bill)', 'Which price level a new sale bill prices at.', 10, false, 'SYSTEM'),

('sales.quote_default_price_level', 'SALES', 'Pricing', 'INT', '1',
 NULL, 1, 10, 'BRANCH',
 'Default price level (quotation)', 'Which price level a new quotation prices at.', 20, false, 'SYSTEM'),

('sales.disc_alter_base_rate', 'SALES', 'Pricing', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Discount alters base rate', 'Whether a line discount is taken off the rate before tax or applied after. Changes what every document totals to — company-wide, never per till.', 30, false, 'SYSTEM'),

('sales.round_off_step', 'SALES', 'Pricing', 'DECIMAL', '1',
 NULL, 0, 100, 'COMPANY',
 'Round off to', 'The step a document total is rounded to. 0 turns rounding off.', 40, false, 'SYSTEM'),

('sales.free_item_tax', 'SALES', 'Pricing', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Tax on free items', 'Whether a free line still carries tax.', 50, false, 'SYSTEM'),

('sales.freight_calc_type', 'SALES', 'Charges', 'TEXT', 'item_basis',
 '["manual","auto","item_basis"]'::jsonb, NULL, NULL, 'COMPANY',
 'Freight calculation', 'How freight is worked out: typed by hand, from the distance bands, or per item.', 60, false, 'SYSTEM'),

('sales.loading_calc_type', 'SALES', 'Charges', 'TEXT', 'item_basis',
 '["manual","auto","item_basis"]'::jsonb, NULL, NULL, 'COMPANY',
 'Loading calculation', 'How loading / unloading is worked out.', 70, false, 'SYSTEM'),

-- ── SALES · settlement ───────────────────────────────────────────────────
('sales.tender_type', 'SALES', 'Settlement', 'TEXT', 'all_bills',
 '["none","cash_bills","all_bills"]'::jsonb, NULL, NULL, 'DEVICE',
 'Tender screen', 'When settlement goes through the tender dialog: never, cash bills only, or every bill. Per till — a delivery counter and a POS counter settle differently.', 10, false, 'SYSTEM'),

('sales.tender_print_only', 'SALES', 'Settlement', 'BOOL', 'false',
 NULL, NULL, NULL, 'DEVICE',
 'Tender on print only', 'The tender dialog opens only on Save and Print.', 20, false, 'SYSTEM'),

('sales.allow_excess_tender', 'SALES', 'Settlement', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Allow excess tender', 'May more be tendered than the bill asks for (change is given back).', 30, false, 'SYSTEM'),

('sales.auto_post', 'SALES', 'Settlement', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Post on save', 'A save asks the backend to post the bill immediately instead of leaving it DRAFT.', 40, false, 'SYSTEM'),

-- ── SALES · documents / import ───────────────────────────────────────────
('sales.default_validity_days', 'SALES', 'Quotation', 'INT', '7',
 NULL, 0, 365, 'COMPANY',
 'Quotation validity (days)', 'How long a new quotation is valid unless the operator changes it.', 10, false, 'SYSTEM'),

('sales.default_delivery_mode', 'SALES', 'Order', 'TEXT', 'STORE_PICKUP',
 '["STORE_PICKUP","HOME_DELIVERY","SHIP_FROM_STORE","COURIER","TRANSPORT"]'::jsonb, NULL, NULL, 'BRANCH',
 'Default delivery mode', 'How a new sale order is delivered unless the operator says otherwise.', 20, false, 'SYSTEM'),

('sales.allow_customer_change_on_import', 'SALES', 'Import', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Allow customer change on import', 'May the customer be repointed on a document imported from another one. Off means the converted document stays the same promise to the same party.', 30, false, 'SYSTEM'),

('sales.allow_bill_over_order_qty', 'SALES', 'Import', 'BOOL', 'false',
 NULL, NULL, NULL, 'COMPANY',
 'Allow billing over order quantity', 'May a line be billed for more than is pending on the order it came from. Off caps the bill quantity at what is still owed.', 40, false, 'SYSTEM')

ON CONFLICT (asd_key) DO NOTHING;


-- ───────────────────────────────────────────────────────────────────────────
--  One key above already exists in the 20260812120000 starter seed, so on a
--  database built from scratch the INSERT above skips it and the starter row
--  survives with the wrong home and the wrong depth (Billing / BRANCH). The
--  catalog is a deployment artefact — nobody hand-edits a definition, they
--  override it in app_setting_value — so re-stating it is safe, and it is what
--  makes this migration land the same way on a fresh database as on one that
--  already ran the starter seed.
--
--  asd_key is untouched: overrides point at the key, so it is never rewritten.
-- ───────────────────────────────────────────────────────────────────────────
UPDATE public.app_setting_def
SET asd_module      = 'SALES',
    asd_group       = 'Import',
    asd_data_type   = 'BOOL',
    asd_default_value = 'false',
    asd_max_scope   = 'COMPANY',
    asd_label       = 'Allow billing over order quantity',
    asd_description = 'May a line be billed for more than is pending on the order it came from. Off caps the bill quantity at what is still owed.',
    asd_sort_order  = 40,
    asd_modified_on = CURRENT_TIMESTAMP,
    asd_modified_by = 'SYSTEM'
WHERE asd_key = 'sales.allow_bill_over_order_qty'
  AND asd_module IS DISTINCT FROM 'SALES';
