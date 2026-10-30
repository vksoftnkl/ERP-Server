-- Additional-charges grid, web layout (ui table 26, "QUOTATION - CHARGES").
--
-- The web quotation and sale-order screens both render their charges grid from
-- this one layout (CHARGE_GRID_UI_TABLE_ID in quotation.constants.ts, re-exported
-- by sale-order.constants.ts), the same way both render their item grids from a
-- web table of their own -- 23 for quotation, 24 for sale order.
--
-- Before this seed the charges grid read ui table 21 ("CHARGES"), which is the
-- LEGACY Qt screen's layout: ui_tbl_device_type = 'Desktop', widths stored as
-- fractional Qt percents rather than pixels, and 30 of its 33 columns hidden. The
-- web screens therefore opened on three columns (Charge Name, Rate, Amount) and
-- every "Admin settings" save from the browser rewrote the desktop screen's own
-- layout. Table 26 is that layout's web twin, so the two can now diverge.
--
-- The 33 rows below are CHARGE_COLUMN_MEANINGS (quotation.constants.ts) verbatim
-- and in its order: the client matches each row against that list on a normalized
-- token -- lowercased, non-alphanumerics stripped -- and DROPS any row no meaning
-- answers to, so the names here are not free text.
--
-- Two of those rows are load-bearing beyond their name:
--   * ui_tbl_clm_no 0 is the serial column. Its name "#" normalizes to the empty
--     string, which no meaning can key on, so resolveColumns falls back to
--     matching column number 0 -- the number is what identifies it, not the name.
--   * ui_tbl_clm_column_focus marks the Enter chain the grid walks (grid-focus.ts).
--     Three columns carry it -- Charge Name, Rate, Amount -- the ones an operator
--     actually keys; Enter runs past the read-outs between them. Clearing all
--     three does not disable Enter, it falls back to stopping at every editable
--     cell, so "no rows flagged" and "these three flagged" are different layouts.
--
-- Hidden by default (visibility false), all reachable from the grid's own Admin
-- settings dialog:
--   * Unit / QtyVal / Weight -- the charge row's own snapshot of them. The per-unit
--     and per-weight methods measure against the LINES, so hiding these cannot
--     stop a charge from pricing.
--   * Role / LandingCost / CostAlloc / BeforeTax / SepPost / ChargeId / LedgerCode
--     / TaxCode / TaxApl -- master-side configuration and internal ids, not part of
--     reading a charge line.
--
-- Idempotency: the table row is inserted only when id 26 is free, and the columns
-- only when table 26 has none -- so a re-run never fights a site that has since
-- re-ordered, re-widened or hidden columns from the UI. The id is pinned because
-- the client asks for the grid by id; if some environment has already given 26 to
-- another table the DO block below fails the deploy rather than silently hanging
-- the charge columns off a stranger's layout.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Quotation_Charges_Grid_Web.sql
--      or: npm run seed:run -- --only=Quotation_Charges_Grid_Web.sql

BEGIN;

DO $$
DECLARE
  occupant text;
BEGIN
  SELECT ui_tbl_name INTO occupant FROM fixed.ui_tables WHERE ui_tbl_id = 26;
  IF occupant IS NOT NULL AND occupant IS DISTINCT FROM 'QUOTATION - CHARGES' THEN
    RAISE EXCEPTION
      'fixed.ui_tables id 26 is held by %, but the web charges grid is pinned to it (CHARGE_GRID_UI_TABLE_ID). Move that table before deploying.',
      occupant;
  END IF;
END
$$;

INSERT INTO fixed.ui_tables (
  ui_tbl_id,
  ui_tbl_name,
  ui_tbl_editable,
  ui_tbl_device_type,
  ui_tbl_is_active,
  ui_tbl_is_deleted,
  ui_tbl_created_by,
  ui_tbl_modified_by
)
SELECT 26, 'QUOTATION - CHARGES', true, 'web', true, false, 'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM fixed.ui_tables WHERE ui_tbl_id = 26);

-- Keep the identity sequence ahead of the pinned id, so the next table created
-- from the UI does not collide with it.
SELECT setval(
    pg_get_serial_sequence('fixed.ui_tables', 'ui_tbl_id'),
    (SELECT GREATEST(COALESCE(MAX(ui_tbl_id), 0), 1) FROM fixed.ui_tables),
    true
);

INSERT INTO fixed.ui_table_columns (
  ui_tbl_clm_table_id,
  ui_tbl_clm_no,
  ui_tbl_clm_name,
  ui_tbl_clm_column_width,
  ui_tbl_clm_column_visibility,
  ui_tbl_clm_column_focus,
  ui_tbl_clm_column_position,
  ui_tbl_clm_column_necessity,
  ui_tbl_clm_is_active,
  ui_tbl_clm_is_deleted,
  ui_tbl_clm_created_by,
  ui_tbl_clm_modified_by
)
-- Position is seeded equal to the column number: the client sorts on position
-- and tie-breaks on the number, and the Admin settings dialog rewrites position
-- alone when an operator drags a row, so starting them equal means the seeded
-- order and the declared order are the same thing.
SELECT 26, v.no, v.name, v.width, v.visible, v.focus, v.no, false, true, false, 'system', 'system'
FROM (VALUES
   -- no,  name           , width, visible, focus
    ( 0::bigint, '#'::text          ,  48::numeric, true::boolean , false::boolean)
   ,( 1, 'Charge Name'    , 220, true , true )
   ,( 2, 'Ledger Name'    , 200, true , false)
   ,( 3, 'Method'         , 110, true , false)
   ,( 4, 'Type'           ,  90, true , false)
   ,( 5, 'Apply On'       , 110, true , false)
   ,( 6, 'Unit'           ,  80, false, false)
   ,( 7, 'QtyVal'         ,  90, false, false)
   ,( 8, 'Weight'         ,  90, false, false)
   ,( 9, 'Rate'           , 100, true , true )
   ,(10, 'Amount'         , 110, true , true )
   ,(11, 'Hsn'            , 100, true , false)
   ,(12, 'TaxPerc'        ,  90, true , false)
   ,(13, 'TaxAmt'         , 100, true , false)
   ,(14, 'SgstPerc'       ,  90, true , false)
   ,(15, 'SgstAmt'        , 100, true , false)
   ,(16, 'CgstPerc'       ,  90, true , false)
   ,(17, 'CgstAmt'        , 100, true , false)
   ,(18, 'IgstPerc'       ,  90, true , false)
   ,(19, 'IgstAmt'        , 100, true , false)
   ,(20, 'CessPerc'       ,  90, true , false)
   ,(21, 'CessAmt'        , 100, true , false)
   ,(22, 'NetAmt'         , 110, true , false)
   ,(23, 'Remarks'        , 180, true , false)
   ,(24, 'Role'           , 110, false, false)
   ,(25, 'LandingCost'    , 110, false, false)
   ,(26, 'CostAlloc'      , 110, false, false)
   ,(27, 'BeforeTax'      , 100, false, false)
   ,(28, 'SepPost'        , 100, false, false)
   ,(29, 'ChargeId'       ,  90, false, false)
   ,(30, 'LedgerCode'     , 110, false, false)
   ,(31, 'TaxCode'        , 100, false, false)
   ,(32, 'TaxApl'         ,  90, false, false)
) AS v(no, name, width, visible, focus)
WHERE NOT EXISTS (
  SELECT 1 FROM fixed.ui_table_columns WHERE ui_tbl_clm_table_id = 26
);

COMMIT;
