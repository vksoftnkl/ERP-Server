-- Sales Order entry ("Sales Order", menu 11) — its Desktop widget-master config:
-- the same rows migration 20261110200000_sales_order_entry_grids_widgets writes.
--
-- 6 fixed.form_section rows (platform Desktop) and the 27 fixed.form_field rows
-- under them: what the Qt screen's right-click "Visibility Settings" and menu 243
-- "Widgets" edit, and what NexDialog reads (/widget-masters/config?menu_id=11&
-- platform=Desktop) to hide a widget whose .ui fieldKey / sectionKey matches.
--
--   customer        beat, soCustId, soCustName, soCustPlace, soCustPhone,
--                   soCustGstin, soPosStcd
--   order_info      soOrderRefno, soOrderDate, soOrderType, soPriceLevel,
--                   soDeliveryDate, soValidUntil, soPriority
--   delivery        soSalesmanId, soAgentId, soPackedId, soHasFreight, soHasLoad,
--                   soHasUnload, soHasPromo, soHasLoyalty, soDeliveryMode,
--                   soDeliverySlot, soRemarks
--   credit          (section only)
--   pending_orders  (section only)
--   margin          margin, savings
--
-- field_name is the save payload's key (beat / margin / savings are screen-only
-- keys); field_gui_name is the label on screen. Everything ships visible, so the
-- screen looks the same until someone hides something. Customer, Order Date and
-- Remarks (and a mandatory Salesman) are never hidden: the .ui marks them
-- fieldRequired; that is not stored here.
--
-- WHY A TARGETED SEED: Form_Section.sql skips a menu that already has any section
-- and Form_Field.sql a section that already has any field, so neither adds a newly
-- configured screen to a laid-out database (precedent:
-- Sale_Bill_Widget_Config_Menu12.sql, Supplier_Widget_Config_Menu22.sql).
--
-- Matched by NAME, never by id: a section by menu 11 + Desktop + section_name, a
-- field by its name anywhere under menu 11 Desktop. Ids come from the sequences
-- (pushed past the table's max first). Existing rows are never updated, so a
-- site's own hides and labels survive every run. Runs after Menu_Master.sql (FK)
-- and Form_Section.sql / Form_Field.sql (manifest order); does nothing while menu
-- 11 is absent.
--
-- Idempotent: a second run inserts nothing. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Sale_Order_Widget_Config_Menu11_Desktop.sql
--      or: npm run seed:run -- --only=Sale_Order_Widget_Config_Menu11_Desktop.sql

BEGIN;

SELECT setval(pg_get_serial_sequence('fixed.form_section', 'section_id'), MAX(section_id))
  FROM fixed.form_section
HAVING MAX(section_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_section', 'section_id')::regclass), 0);

SELECT setval(pg_get_serial_sequence('fixed.form_field', 'field_id'), MAX(field_id))
  FROM fixed.form_field
HAVING MAX(field_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_field', 'field_id')::regclass), 0);

INSERT INTO fixed.form_section
       (section_menu_id, section_name, section_gui_name, section_position,
        section_visibility, section_platform, section_created_by)
SELECT 11, v.name, v.gui, v.pos, true, 'Desktop', 'system'
  FROM (VALUES
               ('customer', 'Customer', 1),
               ('order_info', 'Order', 2),
               ('delivery', 'Delivery & options', 3),
               ('credit', 'Credit standing', 4),
               ('pending_orders', 'Pending orders', 5),
               ('margin', 'Margin line', 6)
       ) AS v(name, gui, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 11)
   AND NOT EXISTS (SELECT 1 FROM fixed.form_section s
                    WHERE s.section_menu_id = 11
                      AND s.section_platform = 'Desktop'
                      AND lower(btrim(s.section_name)) = v.name)
 ORDER BY v.pos;

WITH sec AS (
    SELECT DISTINCT ON (lower(btrim(section_name))) lower(btrim(section_name)) AS sname, section_id
      FROM fixed.form_section
     WHERE section_menu_id = 11
       AND section_platform = 'Desktop'
     ORDER BY lower(btrim(section_name)), section_id
)
INSERT INTO fixed.form_field
       (field_section_id, field_name, field_gui_name, field_position,
        field_visibility, field_created_by)
SELECT sec.section_id, v.fname, v.gui, v.pos, true, 'system'
  FROM (VALUES
    ('customer', 'beat', 'Beat', 1),
    ('customer', 'soCustId', 'Customer', 2),
    ('customer', 'soCustName', 'Name', 3),
    ('customer', 'soCustPlace', 'Place', 4),
    ('customer', 'soCustPhone', 'Phone', 5),
    ('customer', 'soCustGstin', 'GSTIN', 6),
    ('customer', 'soPosStcd', 'POS State Code', 7),
    ('order_info', 'soOrderRefno', 'Order No', 1),
    ('order_info', 'soOrderDate', 'Order Date', 2),
    ('order_info', 'soOrderType', 'Term', 3),
    ('order_info', 'soPriceLevel', 'Price Level', 4),
    ('order_info', 'soDeliveryDate', 'Delivery Date', 5),
    ('order_info', 'soValidUntil', 'Valid Until', 6),
    ('order_info', 'soPriority', 'Priority', 7),
    ('delivery', 'soSalesmanId', 'Salesman', 1),
    ('delivery', 'soAgentId', 'Agent', 2),
    ('delivery', 'soPackedId', 'Packed By', 3),
    ('delivery', 'soHasFreight', 'Freight', 4),
    ('delivery', 'soHasLoad', 'Load', 5),
    ('delivery', 'soHasUnload', 'Unload', 6),
    ('delivery', 'soHasPromo', 'Promo', 7),
    ('delivery', 'soHasLoyalty', 'Loyalty', 8),
    ('delivery', 'soDeliveryMode', 'Delivery Mode', 9),
    ('delivery', 'soDeliverySlot', 'Slot', 10),
    ('delivery', 'soRemarks', 'Remarks', 11),
    ('margin', 'margin', 'Total Profit', 1),
    ('margin', 'savings', 'Total Saving', 2)
       ) AS v(sname, fname, gui, pos)
  JOIN sec ON sec.sname = v.sname
 WHERE NOT EXISTS (SELECT 1
                     FROM fixed.form_field f
                     JOIN fixed.form_section s ON s.section_id = f.field_section_id
                    WHERE s.section_menu_id = 11
                      AND s.section_platform = 'Desktop'
                      AND lower(btrim(f.field_name)) = lower(v.fname))
 ORDER BY sec.section_id, v.pos;

COMMIT;
