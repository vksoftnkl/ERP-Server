-- Supplier Master ("Suppliers", menu 22) — its widget-master configuration.
--
-- Three rows in fixed.form_section (Identity, Notes, Regional Details) and the 38
-- fixed.form_field rows under them: what the screen's right-click "Visible
-- Settings" popup edits, and what the supplier form reads to decide which fields
-- this deployment shows (features/masters/purchase/suppliers/widget-config.ts in
-- the client, WIDGET_FIELD_NAME_BY_FORM_FIELD).
--
-- WHY A TARGETED SEED RATHER THAN RELYING ON Form_Section.sql / Form_Field.sql
--
--   Those two exports carry menu 22 already, but under hardcoded ids (sections
--   62-64, fields 465-502) and with all-or-nothing guards: Form_Section.sql skips
--   a menu that has ANY section, its ON CONFLICT (section_id) silently drops a row
--   whose id another menu already took on a database that grew independently, and
--   Form_Field.sql skips a section that has ANY field. A live database whose
--   supplier config is missing or half-built stays that way. This file goes by
--   name instead of id and fills in only what is missing.
--
-- MATCHING
--
--   * A section counts as present when menu 22 has a Web section whose name OR
--     label is the shipped one (case-insensitive) — so a tab authored by hand in
--     the Widget Master UI is reused, not duplicated.
--   * A field counts as present when menu 22 has it ANYWHERE, under the name the
--     client reads it by: a field in a "region" section without a "Regional"
--     prefix is read as "Regional <name>" (qualifyRegionalSectionFieldNames in the
--     client's shared widget-config.ts). That rule is mirrored below, so a
--     regional "Address 1" authored in the UI is not added a second time and the
--     Identity "Address 1" is never mistaken for it.
--   * Existing rows are never updated: a site's own visibility, label and
--     secondary text (the popup's re-label) survive every run.
--
-- FIELD NAMING
--
--   field_name is the LABEL, as the client's map expects ('GST_No',
--   'Supplier_name', 'Short Name', ...), and the regional ones carry the
--   "Regional " prefix so they do not collide with the Identity tab's address
--   fields. Every field ships visible with an empty secondary text, so a fresh
--   config renders the form exactly as it does with no config at all.
--
-- Ids are left to the sequences (pushed past the table's max first, so this file
-- is safe to run on its own); nothing points at these rows by id.
--
-- Idempotent: a second run inserts nothing. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Supplier_Widget_Config_Menu22.sql
--      or: npm run seed:run -- --only=Supplier_Widget_Config_Menu22.sql

BEGIN;

-- ── Sequences: never behind the table (only ever moved forward) ─────────────
SELECT setval(pg_get_serial_sequence('fixed.form_section', 'section_id'), MAX(section_id))
  FROM fixed.form_section
HAVING MAX(section_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_section', 'section_id')::regclass), 0);

SELECT setval(pg_get_serial_sequence('fixed.form_field', 'field_id'), MAX(field_id))
  FROM fixed.form_field
HAVING MAX(field_id) > COALESCE(
           pg_sequence_last_value(pg_get_serial_sequence('fixed.form_field', 'field_id')::regclass), 0);

-- ── Sections (create the ones menu 22 lacks) ────────────────────────────────
INSERT INTO fixed.form_section (
    section_menu_id,
    section_name,
    section_gui_name,
    section_position,
    section_visibility,
    section_platform,
    section_created_by
)
SELECT 22, v.section_name, v.section_gui_name, v.section_position, true, 'Web', 'system'
  FROM (VALUES
        ('suppliers-Identity'::text      , 'Identity'::text        , 1::integer)
       ,('supplier-notes'                , 'Notes'                 , 2)
       ,('suppliers-regionaldetails'     , 'Regional Details'      , 3)
  ) AS v(section_name, section_gui_name, section_position)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 22)
   AND NOT EXISTS (
       SELECT 1
         FROM fixed.form_section s
        WHERE s.section_menu_id = 22
          AND s.section_platform = 'Web'
          AND (lower(btrim(s.section_name)) = lower(v.section_name)
               OR lower(btrim(s.section_gui_name)) = lower(v.section_gui_name))
   );

-- ── Fields (add the ones menu 22 lacks) ─────────────────────────────────────
WITH shipped_section (section_key, section_name, section_gui_name) AS (
    VALUES ('identity', 'suppliers-identity'       , 'identity')
          ,('notes'   , 'supplier-notes'           , 'notes')
          ,('regional', 'suppliers-regionaldetails', 'regional details')
),
-- The section each shipped field goes into: the one matched (or just created)
-- above, lowest id first if a hand-built config holds two.
target AS (
    SELECT DISTINCT ON (k.section_key) k.section_key, s.section_id
      FROM shipped_section k
      JOIN fixed.form_section s
        ON s.section_menu_id = 22
       AND s.section_platform = 'Web'
       AND (lower(btrim(s.section_name)) = k.section_name
            OR lower(btrim(s.section_gui_name)) = k.section_gui_name)
     ORDER BY k.section_key, s.section_id
),
-- Every field menu 22 already has, keyed the way the client reads it.
configured AS (
    SELECT CASE
               WHEN (s.section_name || ' ' || s.section_gui_name) ~* 'region'
                AND lower(btrim(f.field_name)) NOT LIKE 'regional%'
               THEN 'regional ' || lower(btrim(f.field_name))
               ELSE lower(btrim(f.field_name))
           END AS client_name
      FROM fixed.form_field f
      JOIN fixed.form_section s ON s.section_id = f.field_section_id
     WHERE s.section_menu_id = 22
       AND s.section_platform = 'Web'
)
INSERT INTO fixed.form_field (
    field_section_id,
    field_name,
    field_gui_name,
    field_secondary_text,
    field_position,
    field_visibility,
    field_created_by
)
SELECT t.section_id, v.field_name, v.field_gui_name, '', v.field_position, true, 'system'
  FROM (VALUES
        -- ── Identity ──
        ('identity'::text, 'GST_No'::varchar      , 'GST No'::varchar        , 1::integer)
       ,('identity'      , 'Supplier_name'        , 'Supplier Name'          , 2)
       ,('identity'      , 'Short Name'           , 'Short Name'             , 3)
       ,('identity'      , 'Group'                , 'Group'                  , 4)
       ,('identity'      , 'Company'              , 'Company'                , 5)
       ,('identity'      , 'Branch'               , 'Branch'                 , 6)
       ,('identity'      , 'GST Type'             , 'GST Type'               , 7)
       ,('identity'      , 'Purchase Type'        , 'Purchase Type'          , 8)
       ,('identity'      , 'PAN No'               , 'PAN No'                 , 9)
       ,('identity'      , 'Drug Licence No'      , 'Drug Licence No'        , 10)
       ,('identity'      , 'Active'               , 'Active'                 , 11)
       ,('identity'      , 'Address 1'            , 'Address 1'              , 12)
       ,('identity'      , 'Address 2'            , 'Address 2'              , 13)
       ,('identity'      , 'Address 3'            , 'Address 3'              , 14)
       ,('identity'      , 'City'                 , 'City'                   , 15)
       ,('identity'      , 'District'             , 'District'               , 16)
       ,('identity'      , 'State'                , 'State'                  , 17)
       ,('identity'      , 'Pincode'              , 'Pincode'                , 18)
       ,('identity'      , 'Country'              , 'Country'                , 19)
       ,('identity'      , 'Telephone'            , 'Telephone'              , 20)
       ,('identity'      , 'Phone'                , 'Phone'                  , 21)
       ,('identity'      , 'Email'                , 'Email'                  , 22)
       ,('identity'      , 'WhatsApp'             , 'WhatsApp'               , 23)
       ,('identity'      , 'Website'              , 'Website'                , 24)
        -- ── Notes ──
       ,('notes'         , 'Cheque Pre-Name'      , 'Cheque Pre-Name'        , 1)
       ,('notes'         , 'Credit Days'          , 'Credit Days'            , 2)
       ,('notes'         , 'Cash Disc %'          , 'Cash Disc %'            , 3)
       ,('notes'         , 'Sort Order'           , 'Sort Order'             , 4)
       ,('notes'         , 'Collection Days'      , 'Collection Days'        , 5)
       ,('notes'         , 'Notes'                , 'Notes'                  , 6)
        -- ── Regional Details ──
       ,('regional'      , 'Regional Name'        , 'Regional Name'          , 1)
       ,('regional'      , 'Regional Address 1'   , 'Address 1'              , 2)
       ,('regional'      , 'Regional Address 2'   , 'Address 2'              , 3)
       ,('regional'      , 'Regional Address 3'   , 'Address 3'              , 4)
       ,('regional'      , 'Regional City'        , 'City'                   , 5)
       ,('regional'      , 'Regional District'    , 'District'               , 6)
       ,('regional'      , 'Regional State'       , 'State'                  , 7)
       ,('regional'      , 'Regional Country'     , 'Country'                , 8)
  ) AS v(section_key, field_name, field_gui_name, field_position)
  JOIN target t USING (section_key)
 WHERE lower(v.field_name) NOT IN (SELECT c.client_name FROM configured c);

COMMIT;
