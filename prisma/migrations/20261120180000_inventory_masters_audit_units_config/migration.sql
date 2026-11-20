-- Inventory masters, user's test list 2026-11-20 (Shared/Prathap/inventory/manual-test-review-list-2026-11-20.md).
-- 1. audit screens for the two masters that never wrote history:
--      168 Stock Track Preset   (menu 249, stock.stock_track_preset)
--      169 Stock Reason Master  (menu 293, stock.stock_reason_master)
--    Fixed ids so the Qt lists can name them (house pattern: 161/162 Vehicle / Transporter).
--    The field labels come from AUDIT_SCREEN_SQL_BY_NAME; the server fills screen_audit_sql on the first write.
-- 2. Units (menu 38) show / hide config, Desktop: the old section 6 "PACK UNIT DETAILS" becomes the one
--    "unit" section (the form drops that heading, user point 38.5); the 5 fields above it are registered
--    (38.6); Pack Unit / Base Unit / Conversion are hidden by default (38.4, "we can add later").
-- Re-runnable: inserts only what is missing, updates only while the old values are still there.

-- ── 0 · guard: the two audit ids / names are free, or already ours ───────────────────────────
DO $$
DECLARE clash text;
BEGIN
    SELECT string_agg(format('audit screen %s (%s)', s.screen_id, s.screen_name), ', ')
      INTO clash
      FROM audit.audit_screen s
      JOIN (VALUES (168, 'Stock Track Preset'::text), (169, 'Stock Reason Master')) v(id, name)
        ON v.id = s.screen_id OR lower(v.name) = lower(s.screen_name)
     WHERE (s.screen_id, s.screen_name) IS DISTINCT FROM (v.id, v.name);
    IF clash IS NOT NULL THEN
        RAISE EXCEPTION 'audit screen id / name already used by another row: %', clash;
    END IF;
END $$;

-- ── 1 · audit screens ─────────────────────────────────────────────────────────────────────────
INSERT INTO audit.audit_screen (screen_id, screen_name, screen_type, screen_status, screen_module)
SELECT v.id, v.name, 'master'::audit.audit_screen_type, true, 'INVENTORY'
  FROM (VALUES (168, 'Stock Track Preset'), (169, 'Stock Reason Master')) v(id, name)
 WHERE NOT EXISTS (SELECT 1 FROM audit.audit_screen s WHERE s.screen_id = v.id);

SELECT setval('audit.audit_screen_screen_id_seq',
              GREATEST((SELECT COALESCE(max(screen_id), 1) FROM audit.audit_screen),
                       (SELECT last_value FROM audit.audit_screen_screen_id_seq)));

-- ── 2 · Units (menu 38) Desktop show / hide config ────────────────────────────────────────────
UPDATE fixed.form_section
   SET section_name = 'unit', section_gui_name = 'Unit', section_updated_by = 'system', section_updated_on = now()
 WHERE section_id = 6 AND section_menu_id = 38 AND section_platform = 'Desktop'
   AND section_name = 'PACK UNIT DETAILS';

UPDATE fixed.form_field
   SET field_visibility = false, field_updated_by = 'system', field_updated_on = now()
 WHERE field_section_id = 6
   AND field_name IN ('unit_is_pack_unit', 'unit_base_unit_id', 'unit_conversion')
   AND field_visibility = true
   AND NOT EXISTS (SELECT 1 FROM fixed.form_field f WHERE f.field_section_id = 6 AND f.field_name = 'unit_name');

UPDATE fixed.form_field
   SET field_position = field_position + 5, field_updated_by = 'system', field_updated_on = now()
 WHERE field_section_id = 6
   AND NOT EXISTS (SELECT 1 FROM fixed.form_field f WHERE f.field_section_id = 6 AND f.field_name = 'unit_name');

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
