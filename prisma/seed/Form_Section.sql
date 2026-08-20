-- Seed: fixed.form_section -- the widget-master tabs of each entry form (48 rows).
--
-- One row per group of fields on a screen ("Primary details", "Credit details", ...).
-- Together with fixed.form_field (Form_Field.sql) this is what the widget master edits
-- when a user re-labels, re-orders or hides part of a form, so a form with no rows here
-- cannot be customised at all.
--
-- Runs after Menu_Master.sql -- section_menu_id is a foreign key into fixed.menu_master
-- (ON DELETE CASCADE) -- and before Item_Master_Widget_Config_Menu29.sql, whose menu-29
-- sections are already part of this export and therefore no-op.
--
-- section_id is written out because fixed.form_field.field_section_id points at it.
-- section_name is the internal name and section_gui_name the label the screen shows;
-- section_platform separates the Web layout from the Desktop one.
--
-- Idempotency: a menu that ALREADY HAS ANY SECTION is left completely alone (the WHERE
-- NOT EXISTS below), so a site that laid out its own forms keeps them. A database that
-- grew its sections independently therefore keeps its own ids, and Form_Field.sql skips
-- that branch too rather than attaching fields to a foreign section.
-- Regenerate with: npm run seed:export:ui-config
-- Run: psql "$DATABASE_URL" -f prisma/seed/Form_Section.sql
--      or: npm run seed:run -- --only=Form_Section.sql

BEGIN;

INSERT INTO fixed.form_section
    (section_id, section_menu_id, section_name, section_gui_name, section_position, section_visibility, section_platform, section_created_by)
SELECT v.* FROM (VALUES
    -- ============ Customers (id 10) ============
     (25::integer, 10::integer, 'Customer'::text, 'Primary details'::text, 1::integer, true::boolean, 'Web'::varchar, 'system'::text)
    ,(26, 10 , 'Customers'              , 'Basic details'    , 2, true, 'Web'    , 'system')
    ,(31, 10 , 'customers'              , 'Credit details'   , 3, true, 'Web'    , 'system')
    ,(34, 10 , 'Customers'              , 'Tax Details'      , 4, true, 'Web'    , 'system')
    ,(29, 10 , 'Customer'               , 'Region Details'   , 5, true, 'Web'    , 'system')
    ,(36, 10 , 'Customers'              , 'Status and Notes' , 6, true, 'Web'    , 'system')
    -- ============ Quotation (id 14) ============
    ,(61, 14 , 'Quoation'               , 'Quoation entry'   , 1, true, 'Web'    , 'system')
    -- ============ State Master (id 18) ============
    ,(7 , 18 , 'state master'           , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ City Master (id 19) ============
    ,(8 , 19 , 'City master'            , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Area Master (id 20) ============
    ,(9 , 20 , 'Area master'            , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Customer Type Master (id 21) ============
    ,(10, 21 , 'customer group'         , 'customer group'   , 1, true, 'Web'    , 'system')
    -- ============ Suppliers (id 22) ============
    ,(37, 22 , 'Primary Details'        , 'Suppliers'        , 1, true, 'Web'    , 'system')
    ,(38, 22 , 'Address&Contact Details', 'Suppliers'        , 2, true, 'Web'    , 'system')
    ,(39, 22 , 'Credit Details'         , 'Suppliers'        , 3, true, 'Web'    , 'system')
    ,(40, 22 , 'Region Details'         , 'Suppliers'        , 4, true, 'Web'    , 'system')
    ,(41, 22 , 'Status & Notes'         , 'Suppliers'        , 5, true, 'Web'    , 'system')
    -- ============ Supplier Groups (id 27) ============
    ,(12, 27 , 'supplier group list'    , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Item Master (id 29) ============
    ,(55, 29 , 'Core Details'           , 'Core Details'     , 1, true, 'Web'    , 'system')
    ,(56, 29 , 'Reference Links'        , 'Reference Links'  , 2, true, 'Web'    , 'system')
    ,(57, 29 , 'Ean table'              , 'EAN Table'        , 3, true, 'Web'    , 'system')
    ,(58, 29 , 'Inventory& notes'       , 'Inventory & Notes', 4, true, 'Web'    , 'system')
    -- ============ Item Group Master (id 35) ============
    ,(1 , 35 , 'Item Group master'      , 'group master'     , 1, true, 'Web'    , 'system')
    -- ============ Item Brand Master (id 36) ============
    ,(2 , 36 , 'item brand master'      , 'basic'            , 1, true, 'web'    , 'system')
    ,(13, 36 , 'brand master'           , 'brand master'     , 1, true, 'Web'    , 'system')
    -- ============ Item Section Master (id 37) ============
    ,(15, 37 , 'section master'         , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Unit Master (id 38) ============
    ,(6 , 38 , 'PACK UNIT DETAILS'      , 'MAIN SECTION'     , 1, true, 'Desktop', 'system')
    ,(16, 38 , 'unit master'            , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Godown Master (id 39) ============
    ,(17, 39 , 'Godown master'          , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Ledger Group Master (id 54) ============
    ,(19, 54 , 'ledger group master'    , 'group master'     , 1, true, 'Web'    , 'system')
    -- ============ Employee Master (id 57) ============
    ,(48, 57 , 'Primary Details'        , 'Employee master'  , 1, true, 'Web'    , 'system')
    ,(49, 57 , 'Contact & Address'      , 'Employee master'  , 2, true, 'Web'    , 'system')
    ,(50, 57 , 'Employment Details'     , 'Employee master'  , 3, true, 'Web'    , 'system')
    ,(51, 57 , 'Attendance setup'       , 'Employee master'  , 4, true, 'Web'    , 'system')
    ,(52, 57 , 'Commission & Payroll'   , 'Employee Master'  , 5, true, 'Web'    , 'system')
    ,(53, 57 , 'Statutory & Accounting' , 'Employee master'  , 6, true, 'Web'    , 'system')
    ,(54, 57 , 'Photo & Notes'          , 'Employee master'  , 7, true, 'Web'    , 'system')
    -- ============ Department Master (id 70) ============
    ,(21, 70 , 'Department master'      , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Designation Master (id 71) ============
    ,(22, 71 , 'Designation master'     , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Tender Master (id 95) ============
    ,(11, 95 , 'Tender master'          , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ Branch Master (id 191) ============
    ,(42, 191, 'Identity&Reference'     , 'Branch'           , 1, true, 'Web'    , 'system')
    ,(43, 191, 'Address'                , 'Branch'           , 2, true, 'Web'    , 'system')
    ,(44, 191, 'Region Address'         , 'Branch'           , 3, true, 'Web'    , 'system')
    ,(45, 191, 'Billing & Invoice Setup', 'Branch'           , 4, true, 'Web'    , 'system')
    ,(46, 191, 'Companies & Liceneces'  , 'Branch'           , 5, true, 'Web'    , 'system')
    ,(47, 191, 'Status'                 , 'Branch'           , 6, true, 'Web'    , 'system')
    -- ============ device list master (id 239) ============
    ,(23, 239, 'Device list master'     , 'basic'            , 1, true, 'Web'    , 'system')
    -- ============ item category master (id 240) ============
    ,(14, 240, 'item category master'   , 'basic details'    , 1, true, 'Web'    , 'system')
    -- ============ gsp company service (id 241) ============
    ,(20, 241, 'gsp company service'    , 'gsp'              , 1, true, 'Web'    , 'system')
) AS v(section_id, section_menu_id, section_name, section_gui_name, section_position, section_visibility, section_platform, section_created_by)
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.form_section existing
   WHERE existing.section_menu_id = v.section_menu_id
)
ON CONFLICT (section_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, so the next row created from
-- the UI does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.form_section', 'section_id'),
    (SELECT GREATEST(COALESCE(MAX(section_id), 0), 1) FROM fixed.form_section),
    true
);

COMMIT;
