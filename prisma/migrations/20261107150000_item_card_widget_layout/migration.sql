-- Item card (Items, menu 29) Desktop widget config after the 2026-11-07 layout change
-- (plan inventory/plan-item-entry-qt-2026-11-07.md IE-02 / IE-07 / IE-10, addendum 1 A3):
--   * Tracked as <-> Display Order swapped: item_track_preset_id now sits in
--     primary_info (beside Barcode), item_sort_order in basic_info (beside Supplier);
--   * Item Code (txtItemCode, field item_code) is shown on the card, on its own line
--     under Barcode in primary_info;
--   * the four purchase fields (Purchase unit, Min shelf life %, ITC, Normal shortage %)
--     moved out of Attributes to the end of primary_info. They, and item_code, had no
--     Desktop row, so they could not be hidden.
--   * chkRandomStock / chkAllowPo leave the card. They never had a Desktop row, and
--     this file does not create one. The menu-29 Web rows are not touched.
--
-- field_position counts in reading order, left to right then down (the same order
-- NexDialog's reflowGrid re-packs in):
--   primary_info  1 Item Name | 2 Regional Name
--                 3 Alias     | 4 Tax Name
--                 5 SKU       | 6 HSN Code
--                 7 Barcode   | 8 Tracked as
--                 9 Item Code | (empty)
--                10 Purchase unit | 11 Min shelf life %
--                12 ITC           | 13 Normal shortage %
--   basic_info    1 Company | 2 Branch,  3 Group | 4 Brand,
--                 5 Category | 6 Section, 7 Supplier | 8 Display Order
--
-- Matched by NAME (section_menu_id 29 + section_platform 'Desktop' + section_name /
-- field_name), never by id: the Desktop rows were made through the API on the dev DB
-- (2026-10-22) and are in no seed, so ids differ or rows are missing elsewhere.
-- A site's own hides and labels (field_visibility, field_gui_name,
-- field_secondary_text, section_visibility) are never changed.
-- Needs menu 29: on a fresh DB (menus come from the seeds, after migrations) every
-- statement does nothing. Re-running the file changes nothing.
-- No new table, column, constraint, function or trigger.

-- 1. The five Desktop sections, where missing.
INSERT INTO fixed.form_section
       (section_menu_id, section_name, section_gui_name, section_position,
        section_visibility, section_platform, section_created_by)
SELECT 29, v.name, v.gui, v.pos, true, 'Desktop', 'migration 20261107150000'
  FROM (VALUES ('primary_info',    'Primary Information',                  1),
               ('basic_info',      'Basic Information',                    2),
               ('unit_conversion', 'Unit Conversion',                      3),
               ('tabs',            'Pricing / Barcodes / Reorder / Notes', 4),
               ('attributes',      'Attributes',                           5)) AS v(name, gui, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 29)
   AND NOT EXISTS (SELECT 1 FROM fixed.form_section s
                    WHERE s.section_menu_id = 29
                      AND s.section_platform = 'Desktop'
                      AND s.section_name = v.name)
 ORDER BY v.pos;

-- 2. Every existing Desktop row of primary_info / basic_info to its new section and
--    position (dev: 779 item_track_preset_id basic_info -> primary_info, 771
--    item_sort_order primary_info -> basic_info; both already at 8). Only rows that
--    already belong to a menu-29 Desktop section are moved.
WITH sec AS (
    SELECT DISTINCT ON (section_name) section_name, section_id
      FROM fixed.form_section
     WHERE section_menu_id = 29
       AND section_platform = 'Desktop'
       AND section_name IN ('primary_info', 'basic_info')
     ORDER BY section_name, section_id
), target(sname, fname, pos) AS (
    VALUES ('primary_info', 'item_name_en',            1),
           ('primary_info', 'item_name_ta',            2),
           ('primary_info', 'item_alias',              3),
           ('primary_info', 'item_default_tax_id',     4),
           ('primary_info', 'item_sku',                5),
           ('primary_info', 'item_hsn_code',           6),
           ('primary_info', 'item_default_barcode',    7),
           ('primary_info', 'item_track_preset_id',    8),
           ('primary_info', 'item_code',               9),
           ('primary_info', 'item_purchase_uom_id',    10),
           ('primary_info', 'item_min_shelf_life_pct', 11),
           ('primary_info', 'item_itc_class',          12),
           ('primary_info', 'item_shortage_pct',       13),
           ('basic_info',   'item_company_id',         1),
           ('basic_info',   'item_branch_id',          2),
           ('basic_info',   'item_group_id',           3),
           ('basic_info',   'item_brand_id',           4),
           ('basic_info',   'item_category_id',        5),
           ('basic_info',   'item_section_id',         6),
           ('basic_info',   'item_supplier_id',        7),
           ('basic_info',   'item_sort_order',         8)
)
UPDATE fixed.form_field f
   SET field_section_id = sec.section_id,
       field_position   = t.pos,
       field_updated_on = CURRENT_TIMESTAMP,
       field_updated_by = 'migration 20261107150000'
  FROM target t
  JOIN sec ON sec.section_name = t.sname
 WHERE f.field_name = t.fname
   AND f.field_section_id IN (SELECT section_id
                                FROM fixed.form_section
                               WHERE section_menu_id = 29
                                 AND section_platform = 'Desktop')
   AND (f.field_section_id, f.field_position) IS DISTINCT FROM (sec.section_id, t.pos);

-- 3. Every field the card carries, where menu 29 Desktop has no row of that name, at
--    its new place. Dev: only item_code and the 4 purchase fields are missing. Ids come
--    from the sequence (dev: 867-871 in position order), never literals, because
--    another DB may already use them.
WITH sec AS (
    SELECT DISTINCT ON (section_name) section_name, section_id, section_position
      FROM fixed.form_section
     WHERE section_menu_id = 29
       AND section_platform = 'Desktop'
     ORDER BY section_name, section_id
)
INSERT INTO fixed.form_field
       (field_section_id, field_name, field_gui_name, field_position,
        field_visibility, field_created_by)
SELECT sec.section_id, v.fname, v.gui, v.pos, true, 'migration 20261107150000'
  FROM (VALUES
    ('primary_info',    'item_name_en',              'Item Name',            1),
    ('primary_info',    'item_name_ta',              'Regional Name',        2),
    ('primary_info',    'item_alias',                'Alias Name',           3),
    ('primary_info',    'item_default_tax_id',       'Tax Name',             4),
    ('primary_info',    'item_sku',                  'SKU Name',             5),
    ('primary_info',    'item_hsn_code',             'HSN Code',             6),
    ('primary_info',    'item_default_barcode',      'Barcode',              7),
    ('primary_info',    'item_track_preset_id',      'Tracked as',           8),
    ('primary_info',    'item_code',                 'Item Code',            9),
    ('primary_info',    'item_purchase_uom_id',      'Purchase unit',        10),
    ('primary_info',    'item_min_shelf_life_pct',   'Min shelf life %',     11),
    ('primary_info',    'item_itc_class',            'ITC',                  12),
    ('primary_info',    'item_shortage_pct',         'Normal shortage %',    13),
    ('basic_info',      'item_company_id',           'Company Name',         1),
    ('basic_info',      'item_branch_id',            'Branch Name',          2),
    ('basic_info',      'item_group_id',             'Group Name',           3),
    ('basic_info',      'item_brand_id',             'Brand Name',           4),
    ('basic_info',      'item_category_id',          'Category Name',        5),
    ('basic_info',      'item_section_id',           'Section Name',         6),
    ('basic_info',      'item_supplier_id',          'Supplier Name',        7),
    ('basic_info',      'item_sort_order',           'Display Order',        8),
    ('unit_conversion', 'unit_conversions',          'Unit Conversion grid', 1),
    ('tabs',            'prices',                    'Pricing',              1),
    ('tabs',            'ean_codes',                 'Barcodes',             2),
    ('tabs',            'reorders',                  'Reorder',              3),
    ('tabs',            'notes',                     'Notes',                4),
    ('attributes',      'item_is_active',            'Active',               1),
    ('attributes',      'item_is_service',           'Service Item',         2),
    ('attributes',      'item_is_batch_based',       'Batch Based',          3),
    ('attributes',      'item_allow_sales_return',   'Sales Return',         4),
    ('attributes',      'item_allow_so',             'Allow SO',             5),
    ('attributes',      'item_allow_purchase',       'Allow Purchase',       6),
    ('attributes',      'item_allow_freight',        'Freight',              7),
    ('attributes',      'item_allow_sales',          'Sales',                8),
    ('attributes',      'item_allow_neg_stock',      'Negative Stock',       9),
    ('attributes',      'item_allow_negative_so',    'Negative SO',          10),
    ('attributes',      'item_weigh_scale',          'Weigh Scale',          11),
    ('attributes',      'item_incl_tax',             'Inclusive of Tax',     12),
    ('attributes',      'item_retail_item',          'Retail Item',          13),
    ('attributes',      'item_is_kit',               'Is Kit',               14),
    ('attributes',      'item_allow_promo',          'Promotion',            15),
    ('attributes',      'item_auto_make',            'Auto Make',            16),
    ('attributes',      'item_allow_loyalty',        'Loyalty',              17),
    ('attributes',      'item_price_list',           'PriceList',            18),
    ('attributes',      'item_damagable_product',    'Damagable',            19),
    ('attributes',      'item_barcode_sticker',      'Sticker',              20),
    ('attributes',      'item_allow_loading',        'Loading',              21),
    ('attributes',      'item_is_expiry_item',       'Has Expiry',           22),
    ('attributes',      'item_expiry_days',          'Shelf life (days)',    23),
    ('attributes',      'item_intimate_before_days', 'Alert before (days)',  24),
    ('attributes',      'item_auto_break',           'Auto Break',           25)
  ) AS v(sname, fname, gui, pos)
  JOIN sec ON sec.section_name = v.sname
 WHERE NOT EXISTS (SELECT 1
                     FROM fixed.form_field f
                     JOIN fixed.form_section s2 ON s2.section_id = f.field_section_id
                    WHERE s2.section_menu_id = 29
                      AND s2.section_platform = 'Desktop'
                      AND f.field_name = v.fname)
 ORDER BY sec.section_position, v.pos;
