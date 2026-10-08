-- fixed.form_field — the "Stock Tracking" preset combo on Item Master and Item
-- Group Master.
--
-- Separate from Form_Field.sql because that file is guarded per SECTION:
--
--     WHERE NOT EXISTS (SELECT 1 FROM fixed.form_field existing
--                        WHERE existing.field_section_id = v.field_section_id)
--
-- i.e. a section that already has ANY field is skipped whole. That is right for
-- a bulk seed — it must not fight an admin who has re-laid-out a section — but
-- it means a row appended there reaches new databases only. Every existing one
-- already has fields under sections 1 and 71, so the two new fields need this
-- targeted insert instead. The rows are also in Form_Field.sql so a fresh
-- database gets them in the bulk pass; both are idempotent, so whichever runs
-- first wins and the other does nothing.
--
-- Backs item_master.item_track_preset_id / item_group_master.itg_track_preset_id
-- (migration 20260907060000_add_track_preset_to_masters). The combo is fed by
-- GET /stock-track-presets/get and the chosen spt_id is what the screen saves;
-- the server writes the stock.stock_track_policy row from it.
--
--   section 1  = Item Group Master / "group master"
--   section 71 = Item Master / "Inventory&Notes"
--
-- Idempotent: guarded on (section, field_name), so re-running inserts nothing.
-- field_id is drawn from the identity sequence rather than hardcoded, because
-- 620/621 may already be taken on a database where fields were added from the UI.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Form_Field_Stock_Track_Preset.sql
--      or: npm run seed:run -- --only=Form_Field_Stock_Track_Preset.sql

BEGIN;

INSERT INTO fixed.form_field
    (field_section_id, field_name, field_gui_name, field_secondary_text,
     field_position, field_visibility, field_created_by)
SELECT v.section_id, v.field_name, v.gui_name, v.secondary, v.position, true, 'system'
  FROM (VALUES
    -- Last in its section: the preset is a refinement of an already-saved item,
    -- not something to type before the name.
    (71::integer, 'item_track_preset_id'::varchar, 'Stock Tracking'::varchar,
     'Batch / expiry / MRP tracking preset'::varchar, 5::integer),
    (1, 'itg_track_preset_id', 'Stock Tracking',
     'Default tracking preset for items in this group', 7)
  ) AS v(section_id, field_name, gui_name, secondary, position)
 WHERE EXISTS (
        SELECT 1 FROM fixed.form_section parent WHERE parent.section_id = v.section_id
       )
   AND NOT EXISTS (
        SELECT 1 FROM fixed.form_field existing
         WHERE existing.field_section_id = v.section_id
           AND existing.field_name       = v.field_name
       );

-- Keep the identity sequence ahead of the seeded ids, so the next row created
-- from the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.form_field', 'field_id'),
    (SELECT GREATEST(COALESCE(MAX(field_id), 0), 1) FROM fixed.form_field),
    true
);

COMMIT;
