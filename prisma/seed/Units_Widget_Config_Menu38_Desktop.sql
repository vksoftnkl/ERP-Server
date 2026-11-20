-- Units (menu 38) Desktop show / hide config: the 5 fields above the old pack-unit block
-- (inventory masters test list 2026-11-20, point 38.6). Section 6 is "unit" (Form_Section.sql);
-- Pack Unit / Base Unit / Conversion are hidden by default (Form_Field.sql 12-14).
-- Same rows as migration 20261120180000_inventory_masters_audit_units_config. Idempotent.
SELECT setval(pg_get_serial_sequence('fixed.form_field', 'field_id'), MAX(field_id))
  FROM fixed.form_field
HAVING MAX(field_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_field', 'field_id')::regclass), 0);

INSERT INTO fixed.form_field
       (field_section_id, field_name, field_gui_name, field_position, field_visibility, field_created_by)
SELECT 6, v.fname, v.gui, v.pos, true, 'system'
  FROM (VALUES ('unit_name',          'Unit Name',      1),
               ('unit_code',          'GST Unit Code',  2),
               ('unit_alias',         'Unit Alias',     3),
               ('unit_weight',        'Weight',         4),
               ('unit_decimal_count', 'Decimal Places', 5)) v(fname, gui, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.form_section s WHERE s.section_id = 6 AND s.section_menu_id = 38)
   AND NOT EXISTS (SELECT 1 FROM fixed.form_field f WHERE f.field_section_id = 6 AND f.field_name = v.fname);
