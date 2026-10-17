-- Sale Bill Entry ("Sales Entry", menu 12) — its widget-master configuration.
--
-- Two rows in fixed.form_section and the fixed.form_field rows hanging off them:
-- what the screen's right-click "Visible Settings" dialog edits, and what the
-- header panel reads to decide which fields this deployment shows and what it
-- calls them.
--
-- Runs after Menu_Master.sql (section_menu_id is a foreign key into
-- fixed.menu_master, ON DELETE CASCADE) and after Form_Section.sql /
-- Form_Field.sql, whose own exports carry no menu-12 rows.
--
-- WHY A TARGETED SEED RATHER THAN AN EDIT TO THOSE TWO
--
--   Form_Section.sql skips any menu that ALREADY HAS ANY SECTION, and
--   Form_Field.sql skips any section that already has any field — both so that a
--   site which has re-labelled its own forms keeps them. Neither file adds a
--   newly introduced screen to a database that is already laid out, which is
--   exactly what this is for (the precedent is
--   Quotation_Item_Grid_ItemSize_Column.sql).
--
-- FIELD NAMING
--
--   field_name here is the LABEL the screen ships with, not a column binding
--   key. That is the convention the VOUCHER screens use — the sale bill matches
--   each row against SALE_BILL_HEADER_FIELD_NAMES (salebill.constants.ts) on a
--   case-insensitive name, and the quotation's own menu-14 rows are named the
--   same way. The master screens bind by column name instead; do not copy this
--   file's convention onto one of those.
--
--   The names are deliberately the QUOTATION's wherever the field is the same
--   one (Existing Customer, Customer Name, Address, Place, Phone, GSTIN, POS
--   State Code, Salesman, Agent, Contact Person, Contact No, Freight, Load,
--   Unload, Promo, Price Level): an operator who has configured one sales screen
--   should recognise the next.
--
--   A name the client does not know is listed in the dialog but greyed as "not
--   on form", and a field the CLIENT knows that has no row here simply stays
--   visible under its shipped label. So drift in either direction degrades
--   quietly rather than breaking the screen — which is also why nothing here is
--   load-bearing enough to justify hardcoded ids.
--
-- WHAT IS NOT HERE
--
--   * The two grids. They take their column layout from fixed.ui_table_columns
--     (ui table 22 for the items, 26 for the charges) through their own
--     right-click "Admin settings", which is a different dialog on a different
--     table.
--   * The two hints under the credit column ("Credit check is off for this
--     customer", "Credit standing unavailable"). They report no figure — they
--     say WHY the figures are blank, and a site that has hidden every credit row
--     still needs to be told that rather than shown an empty column.
--
-- CASE
--
--   The client matches on a lowercased name, so 'GSTIN' and 'Gstin' are the same
--   row and a config keyed by hand through the Widget Master UI (which
--   title-cases what it is given) resolves against the shipped names unchanged.
--
-- Ids are left to the sequences rather than written out: nothing points at these
-- rows by id, and both sequences were pushed past the exported ids by the setval
-- at the bottom of Form_Section.sql / Form_Field.sql.
--
-- Idempotent: re-running inserts nothing once menu 12 has a Web section. Safe to
-- re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Sale_Bill_Widget_Config_Menu12.sql
--      or: npm run seed:run -- --only=Sale_Bill_Widget_Config_Menu12.sql

BEGIN;

WITH seeded_sections AS (
    INSERT INTO fixed.form_section (
        section_menu_id,
        section_name,
        section_gui_name,
        section_position,
        section_visibility,
        section_platform,
        section_created_by
    )
    SELECT v.*
      FROM (VALUES
          -- The header panel: customer, bill, people. One section, because the
          -- three blocks are one hand-laid-out row and a site that wants the
          -- whole header gone wants all of it gone.
           (12::integer, 'SaleBill'::text, 'Sales Entry'::text, 1::integer, true::boolean, 'Web'::varchar, 'system'::text)
          -- The Terms panel carries its own, so turning this one off drops the
          -- whole block — which is what `terms.anyVisible` reads on the client.
          ,(12       , 'SaleBill-terms'  , 'Terms'            , 2       , true      , 'Web'      , 'system')
      ) AS v(
          section_menu_id,
          section_name,
          section_gui_name,
          section_position,
          section_visibility,
          section_platform,
          section_created_by
      )
     -- Menu 12 already laid out (by an earlier run, or by hand) — leave it be.
     WHERE NOT EXISTS (
         SELECT 1
           FROM fixed.form_section existing
          WHERE existing.section_menu_id = 12
            AND existing.section_platform = 'Web'
     )
    RETURNING section_id, section_name
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
SELECT s.section_id,
       f.field_name,
       -- The label starts as the name; the dialog's own edits move it from here.
       f.field_name,
       '',
       f.field_position,
       true,
       'system'
  FROM seeded_sections s
  JOIN (VALUES
      -- ---- the customer block -------------------------------------------
       ('SaleBill'::text, 'Existing Customer'::varchar, 1::integer)
      ,('SaleBill'      , 'Customer Name'              , 2 )
      ,('SaleBill'      , 'Address'                    , 3 )
      ,('SaleBill'      , 'Place'                      , 4 )
      ,('SaleBill'      , 'Phone'                      , 5 )
      ,('SaleBill'      , 'GSTIN'                      , 6 )
      -- Two different facts since 2026-09-11, so two rows: the customer's own
      -- state is a snapshot that decides nothing, and the place of supply is
      -- what splits CGST+SGST from IGST.
      ,('SaleBill'      , 'Customer State'             , 7 )
      ,('SaleBill'      , 'POS State Code'             , 8 )
      -- ---- the bill ------------------------------------------------------
      ,('SaleBill'      , 'Bill No'                    , 9 )
      ,('SaleBill'      , 'Ref No'                     , 10)
      ,('SaleBill'      , 'Bill Date'                  , 11)
      ,('SaleBill'      , 'Document Type'              , 12)
      -- CASH or CREDIT. Hiding it fixes every bill on the default, which is a
      -- legitimate thing for a cash-only counter to want.
      ,('SaleBill'      , 'Term'                       , 13)
      ,('SaleBill'      , 'Due Days'                   , 14)
      ,('SaleBill'      , 'Due Date'                   , 15)
      ,('SaleBill'      , 'Price Level'                , 16)
      ,('SaleBill'      , 'Freight'                    , 17)
      ,('SaleBill'      , 'Load'                       , 18)
      ,('SaleBill'      , 'Unload'                     , 19)
      ,('SaleBill'      , 'Promo'                      , 20)
      -- ---- the people ----------------------------------------------------
      ,('SaleBill'      , 'Salesman'                   , 21)
      ,('SaleBill'      , 'Agent'                      , 22)
      ,('SaleBill'      , 'Driver'                     , 23)
      ,('SaleBill'      , 'Loadman'                    , 24)
      ,('SaleBill'      , 'Packed By'                  , 25)
      ,('SaleBill'      , 'Supervisor'                 , 26)
      ,('SaleBill'      , 'Vehicle No'                 , 27)
      ,('SaleBill'      , 'Contact Person'             , 28)
      ,('SaleBill'      , 'Contact No'                 , 29)
      ,('SaleBill'      , 'Loyalty'                    , 30)
      ,('SaleBill'      , 'Commission'                 , 31)
      -- ---- the credit column ---------------------------------------------
      -- Read-only figures, and configurable all the same: a counter that never
      -- sells on credit has five read-outs it does not want the screen width
      -- spent on. The two hints under them ("Credit check is off for this
      -- customer", "Credit standing unavailable") are NOT configurable — they
      -- say why the figures are blank, which a site that hid them still needs.
      ,('SaleBill'      , 'Outstanding'                , 32)
      ,('SaleBill'      , 'Overdue'                    , 33)
      ,('SaleBill'      , 'Overdue By'                 , 34)
      ,('SaleBill'      , 'Credit Limit'               , 35)
      ,('SaleBill'      , 'Available'                  , 36)
      -- ---- the Terms panel's own section ---------------------------------
      ,('SaleBill-terms', 'Remarks'                    , 1 )
      ,('SaleBill-terms', 'Payment Terms'              , 2 )
      ,('SaleBill-terms', 'Delivery Terms'             , 3 )
      ,('SaleBill-terms', 'Other Terms'                , 4 )
  ) AS f(section_name, field_name, field_position)
    ON f.section_name = s.section_name;

-- Keep the identity sequences ahead of whatever was just inserted, so the next
-- row created from the widget master does not collide with one of them.
SELECT setval(
    pg_get_serial_sequence('fixed.form_section', 'section_id'),
    (SELECT GREATEST(COALESCE(MAX(section_id), 0), 1) FROM fixed.form_section),
    true
);
SELECT setval(
    pg_get_serial_sequence('fixed.form_field', 'field_id'),
    (SELECT GREATEST(COALESCE(MAX(field_id), 0), 1) FROM fixed.form_field),
    true
);

COMMIT;
