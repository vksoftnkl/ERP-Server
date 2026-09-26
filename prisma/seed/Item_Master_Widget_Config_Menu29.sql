-- Item Master (menu_id 29) widget-master config — EAN Table + Inventory & Notes.
--
-- Extends the menu-29 config (sections "Core Details" and "Reference Links") so
-- the item form's Rules & Status checkboxes (shown under the EAN Table tab) and
-- the Inventory & Notes fields become re-labelable / re-orderable / hideable from
-- the widget master (fixed.form_section / fixed.form_field), like Core Details.
--
-- field_name MUST equal the form field's binding key (e.g. item_retail_item), not
-- a label-derived name — otherwise the field shows "not on form" in the popup and
-- nothing binds. Every field ships field_visibility = true and field_gui_name =
-- the current hardcoded label, so this is a NO-OP for the rendered form until a
-- user toggles something in the modal's right-click "Visible Settings" popup.
--
-- Idempotent + self-correcting: creates the sections if absent, normalizes the
-- known label-derived field_names an earlier admin-UI pass produced, moves
-- item_sort_order into Inventory & Notes, and inserts any missing fields. Safe to
-- re-run (there is no unique constraint on these tables — migration 20260707120000).
-- Assumes menu 29 and its Core Details / Reference Links sections already exist.
BEGIN;

-- ── Sections (create if absent) ─────────────────────────────────────────────
INSERT INTO fixed.form_section
  (section_menu_id, section_name, section_gui_name, section_position, section_visibility, section_platform)
SELECT 29, 'Ean table', 'EAN Table', 3, true, 'Web'
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.form_section
  WHERE section_menu_id = 29 AND section_name = 'Ean table' AND section_platform = 'Web'
);
INSERT INTO fixed.form_section
  (section_menu_id, section_name, section_gui_name, section_position, section_visibility, section_platform)
SELECT 29, 'Inventory& notes', 'Inventory & Notes', 4, true, 'Web'
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.form_section
  WHERE section_menu_id = 29 AND section_name = 'Inventory& notes' AND section_platform = 'Web'
);

-- ── Replace placeholder section gui_names so the tree labels read cleanly ────
UPDATE fixed.form_section SET section_gui_name = 'Core Details'
  WHERE section_menu_id = 29 AND section_name = 'Core Details'     AND section_platform = 'Web';
UPDATE fixed.form_section SET section_gui_name = 'Reference Links'
  WHERE section_menu_id = 29 AND section_name = 'Reference Links'  AND section_platform = 'Web';
UPDATE fixed.form_section SET section_gui_name = 'EAN Table'
  WHERE section_menu_id = 29 AND section_name = 'Ean table'        AND section_platform = 'Web';
UPDATE fixed.form_section SET section_gui_name = 'Inventory & Notes'
  WHERE section_menu_id = 29 AND section_name = 'Inventory& notes' AND section_platform = 'Web';

-- ── Normalize label-derived field_names to real binding keys ─────────────────
UPDATE fixed.form_field f SET field_name = 'item_retail_item'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_Retail Item';
UPDATE fixed.form_field f SET field_name = 'item_allow_neg_stock'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_allow_negative_stock';
UPDATE fixed.form_field f SET field_name = 'item_is_batch_based'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_batch_based';
UPDATE fixed.form_field f SET field_name = 'item_is_service'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_service_item';
UPDATE fixed.form_field f SET field_name = 'item_is_expiry_item'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_expiry_item';
UPDATE fixed.form_field f SET field_name = 'item_weigh_scale'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_weigh-scale';
UPDATE fixed.form_field f SET field_name = 'item_image_url'
  FROM fixed.form_section s WHERE f.field_section_id = s.section_id
  AND s.section_menu_id = 29 AND f.field_name = 'item_image_URL';

-- ── Move item_sort_order from Reference Links into Inventory & Notes ─────────
UPDATE fixed.form_field SET field_position = 1, field_section_id = (
    SELECT section_id FROM fixed.form_section
    WHERE section_menu_id = 29 AND section_name = 'Inventory& notes' AND section_platform = 'Web' LIMIT 1)
WHERE field_name = 'item_sort_order' AND field_section_id = (
    SELECT section_id FROM fixed.form_section
    WHERE section_menu_id = 29 AND section_name = 'Reference Links' AND section_platform = 'Web' LIMIT 1);

-- ── EAN Table fields (Rules & Status checkboxes + expiry number fields) ──────
WITH sec AS (
  SELECT section_id FROM fixed.form_section
  WHERE section_menu_id = 29 AND section_name = 'Ean table' AND section_platform = 'Web' LIMIT 1
)
INSERT INTO fixed.form_field (field_section_id, field_name, field_gui_name, field_position, field_visibility)
SELECT sec.section_id, v.field_name, v.gui_name, v.pos, true
FROM sec CROSS JOIN (VALUES
  ('item_retail_item',        'Retail Item',            1),
  ('item_allow_sales',        'Allow Sales',            2),
  ('item_allow_loading',      'Allow Loading',          3),
  ('item_damagable_product',  'Damagable Product',      4),
  ('item_allow_neg_stock',    'Allow Negative Stock',   5),
  ('item_allow_promo',        'Allow Promo',            6),
  ('item_price_list',         'Price List',             7),
  ('item_allow_sales_return', 'Allow Sales Return',     8),
  ('item_allow_freight',      'Allow Freight',          9),
  ('item_is_kit',             'Is Kit',                10),
  ('item_allow_negative_so',  'Allow Negative SO',     11),
  ('item_allow_loyalty',      'Allow Loyalty',         12),
  ('item_is_batch_based',     'Batch Based',           13),
  ('item_allow_purchase',     'Allow Purchase',        14),
  ('item_auto_break',         'Auto Break',            15),
  ('item_is_demand',          'Is Demand',             16),
  ('item_has_offer',          'Has Offer',             17),
  ('item_barcode_sticker',    'Barcode Sticker',       18),
  ('item_is_service',         'Service Item',          19),
  ('item_allow_po',           'Allow PO',              20),
  ('item_auto_make',          'Auto Make',             21),
  ('item_is_expiry_item',     'Expiry Item',           22),
  ('item_random_stock',       'Random Stock',          23),
  ('item_allow_so',           'Allow SO',              24),
  ('item_weigh_scale',        'Weigh Scale',           25),
  ('item_expiry_days',        'Expiry Days',           26),
  ('item_intimate_before_days','Intimate Before Days', 27)
) AS v(field_name, gui_name, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.form_field f
  WHERE f.field_section_id = sec.section_id AND f.field_name = v.field_name
);

-- ── Inventory & Notes fields ────────────────────────────────────────────────
WITH sec AS (
  SELECT section_id FROM fixed.form_section
  WHERE section_menu_id = 29 AND section_name = 'Inventory& notes' AND section_platform = 'Web' LIMIT 1
)
INSERT INTO fixed.form_field (field_section_id, field_name, field_gui_name, field_position, field_visibility)
SELECT sec.section_id, v.field_name, v.gui_name, v.pos, true
FROM sec CROSS JOIN (VALUES
  ('item_sort_order',       'Sort Order',       1),
  ('item_storage_location', 'Storage Location', 2),
  ('item_image_url',        'Image URL',        3),
  ('item_photo_file',       'Photo File',       4),
  ('item_notes',            'Notes',            5)
) AS v(field_name, gui_name, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.form_field f
  WHERE f.field_section_id = sec.section_id AND f.field_name = v.field_name
);

COMMIT;
