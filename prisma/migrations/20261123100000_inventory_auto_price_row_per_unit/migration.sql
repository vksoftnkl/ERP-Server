-- Item master review point 7 (Q6, user 2026-11-23 "do 5 and 7"): a company switch that
-- adds a price line on the item card for every unit picked in Unit Conversion.
-- Default off. Read by the desktop client only (AppSession); the server's checks
-- (UNIT_NOT_CONVERTED) are unchanged. Re-runnable.
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT 'inventory.auto_price_row_per_unit', 'INVENTORY', 'Pricing', 'BOOL', 'false',
       'COMPANY', 'Add a price line for each new unit',
       'On: picking a unit in the item card''s Unit Conversion table adds a price line for it when the price table has none for that unit (its cost from the other units, its profit type from the first price line); removing an unsaved unit takes its untouched price line with it, and Save warns when a unit has no price line. Barcode and reorder lines are never added. Off: price lines are added by hand.',
       25, 'SYSTEM'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'inventory.auto_price_row_per_unit');
