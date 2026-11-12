-- Seed: fixed.menu_master -- the full application menu tree (127 rows).
--
-- Exported from the reference database, so a fresh environment comes up with the
-- same menu ids every other table points at.
--
-- Why the ids are written out instead of left to the sequence:
--   * fixed.form_section.section_menu_id keys the widget-master layouts to a menu
--     -- Item_Master_Widget_Config_Menu29.sql is literally "menu 29", and fails
--     with a foreign-key error if this file has not run first;
--   * public.user_menus.um_menu_id stores per-user menu permissions by id;
--   * the client resolves screens by menu id, so a renumbered tree opens the
--     wrong form.
-- The setval at the bottom pushes menu_master_menu_id_seq past the highest id
-- seeded here, so the next menu added from the UI does not collide.
--
-- Column notes:
--   * menu_parent is the self-FK (fixed.menu_master.menu_id). Order does not
--     matter inside the single INSERT below: PostgreSQL queues referential
--     integrity as AFTER ROW triggers and fires them at the end of the statement,
--     by which time every parent row is in. Rows are grouped parent-first anyway
--     so the file reads like the menu it describes.
--   * menu_name keeps the "&1 Sales" ampersand accelerators of the desktop client.
--   * menu_visiblity (sic -- the column name carries the typo) hides a menu from
--     the tree; menu_is_active = false retires it without deleting the row.
--   * menu_icon_location_desktop is an icon *index* ('0', '1', ...) for the legacy
--     desktop client on most rows; only the newer entries carry real paths.
--   * names, parents, positions (steps of 10), separators and visibility of the
--     menus 20261027100000_menu_restructure touches are written here as that
--     migration leaves them; 249/250/266/269/270 are not in this file and come
--     only from the migrations that create them.
--   * the 137 menus 20261030200000_menu_master_remove_unbuilt deletes (no screen in either
--     client; the whole Transport 8 and Attendance 9 modules among them) are NOT in this file,
--     except 149 Transporters, which came back visible with its master screen
--     (20261104130000_purchase_entry_v2, plan D27). Never add a deleted menu back here:
--     PM2 boots with DB_AUTO_SEED=true, so a row listed here is re-inserted on every restart
--     (that undid the cleanup on 2026-10-31 and again on 2026-11-02). A deleted menu that
--     is needed again comes back by a new migration plus its row here.
--
-- Idempotent: ON CONFLICT (menu_id) DO NOTHING -- a menu that already exists is
-- left exactly as it is, because menu labels, positions and visibility are edited
-- per site and re-running must not undo that. To pick up new menus added to this
-- file later, just run it again.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Menu_Master.sql
--      or: npm run seed:run -- --only=Menu_Master.sql

BEGIN;

INSERT INTO fixed.menu_master
    (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position,
     menu_icon_location_desktop, menu_icon_location_web, menu_icon_location_mobile,
     menu_is_active, menu_separator)
VALUES
    -- ============ &1 Sales (menu 1, 39 rows) ============
     (   1, NULL, '&1 Sales'                             , NULL                  , true ,  10.00, '0', NULL, NULL, true , false)
    ,(  10,    1, 'Customers'                            , 'CTRL+SHIFT+C'        , true ,  60.00, '0', NULL, NULL, true , true)
    ,(  11,    1, 'Sales Order'                          , 'CTRL+SHIFT+S'        , true ,  30.00, NULL, NULL, NULL, true , false)
    ,(  12,    1, 'Sales Bill'                           , 'CTRL+S'              , true ,  10.00, '0', NULL, NULL, true , false)
    ,(  14,    1, 'Quotation'                            , 'CTRL+Q'              , true ,  20.00, '0', NULL, NULL, true , false)
    ,(  17,    1, 'Sales Masters'                        , NULL                  , true , 100.00, '0', NULL, NULL, true , false)
    ,(  18,   17, 'States'                               , NULL                  , true ,  10.00, '1', NULL, NULL, true , false)
    ,(  19,   17, 'Cities'                               , NULL                  , true ,  20.00, '2', NULL, NULL, true , false)
    ,(  20,   17, 'Areas'                                , NULL                  , true ,  30.00, '3', NULL, NULL, true , false)
    ,(  21,   17, 'Customer Types'                       , NULL                  , true ,  40.00, '4', NULL, NULL, true , true)
    ,(  66,    1, 'Offers'                               , NULL                  , true ,  80.00, NULL, NULL, NULL, true , false)
    ,(  67,   75, 'Loyalty Programs'                     , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  75,    1, 'Loyalty'                              , NULL                  , true ,  70.00, NULL, NULL, NULL, true , false)
    ,(  79,   75, 'Loyalty Status'                       , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,(  95,   17, 'Tender Types'                         , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    ,( 130,   17, 'Freight Charges'                      , NULL                  , true ,  60.00, NULL, NULL, NULL, true , false)
    ,( 177,   17, 'Loading Charges'                      , NULL                  , true ,  70.00, NULL, NULL, NULL, true , false)
    -- 125 Vehicle Master (20261112120000_vehicle_transporter_masters, plan-vehicle-master D1).
    ,( 125,   17, 'Vehicle Master'                       , NULL                  , true ,  75.00, NULL, NULL, NULL, true , false)
    ,( 182,    1, 'Deliver Note'                         , NULL                  , false,   5.00, NULL, NULL, NULL, true , false)
    ,( 226,    1, 'Delivery Status'                      , 'true'                , true ,  40.00, NULL, NULL, NULL, true , false)
    ,( 247,   66, 'Promotion Schemes'                    , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 257,    1, 'Temp Credits'                         , NULL                  , true ,  50.00, NULL, NULL, NULL, true , true)
    -- 299 (20261110180000_sale_order_desk): Sales Order Management, the order desk
    -- (grids 201-203, ui_table 70), right after 11 Sales Order. Verbs below.
    ,( 299,    1, 'Sales Order Management'               , NULL                  , true ,  31.00, NULL, NULL, NULL, true , false)
    -- Till (271-276, migration 20261008140000 / src/modules/till): hidden until the
    -- client screens ship; rights work on a hidden menu. Verbs are set below.
    -- 275 was "Till Masters" until notes 101 split it into four screens:
    -- 275 / 280 / 281 / 282 (20261009190000_till_masters_split_menus); notes 102
    -- put them in the group 283 "Till Masters" (20261009200000_till_masters_group).
    -- 276 was "Till Approval Setup" until notes 111 split off its authority tab as
    -- 285 (20261013120000_till_approval_authority_menu). 286 Cash Office received the
    -- cashiers' hand-overs into the safe (notes 113, 20261014100000) until notes 114
    -- moved that to an Approve on Till Sessions (273): retired, menu_is_active false
    -- (20261014160000_till_approve_cash_notes_114). Notes 118 brought Cash Office back
    -- as a NEW id, 287 — the safe: balance, count, remittance (20261015100000_till_safe_notes_118).
    -- 288 Till Reports is the Qt read-only report screen over grids 157 / 159-169
    -- (notes 133, 20261017110000_till_reports_menu_notes_133). 289 Cash Position is
    -- head office's every-branch screen over grids 170-174, CREATE = add an HO review
    -- (notes 134, 20261017120000_till_cash_position_notes_134).
    ,( 271,    1, 'Till'                                 , NULL                  , true ,  90.00, NULL, NULL, NULL, true , true)
    ,( 272,  271, 'Open Till'                            , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 273,  271, 'Till Sessions'                        , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 288,  271, 'Till Reports'                         , NULL                  , true ,  60.00, NULL, NULL, NULL, true , true)
    ,( 289,  271, 'Cash Position'                        , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    ,( 274,  271, 'Business Day'                         , NULL                  , true ,  40.00, NULL, NULL, NULL, true , true)
    ,( 287,  271, 'Cash Office'                          , NULL                  , true ,  30.00, NULL, NULL, NULL, true , false)
    ,( 283,  271, 'Till Setup'                           , NULL                  , true ,  70.00, NULL, NULL, NULL, true , false)
    ,( 275,  283, 'Counters'                             , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 280,  283, 'Safes'                                , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 281,  283, 'Reasons'                              , NULL                  , true ,  30.00, NULL, NULL, NULL, true , false)
    ,( 282,  283, 'Denominations'                        , NULL                  , true ,  40.00, NULL, NULL, NULL, true , true)
    ,( 276,  283, 'Approval Rules'                       , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    ,( 285,  283, 'Approval Authority'                   , NULL                  , true ,  60.00, NULL, NULL, NULL, true , false)
    ,( 277,    5, 'Expense Voucher'                      , NULL                  , true ,  30.00, NULL, NULL, NULL, true , true)
    ,( 278,    5, 'Card / UPI Settlement'                , NULL                  , true , 150.00, NULL, NULL, NULL, true , true)
    -- ============ &2 Purchase (menu 2, 12 rows) ============
    ,(   2, NULL, '&2 Purchase'                          , NULL                  , true ,  20.00, '0', NULL, NULL, true , false)
    ,(  22,    2, 'Suppliers'                            , NULL                  , true ,  10.00, NULL, NULL, NULL, true , true)
    ,(  23,    2, 'Purchase Order'                       , 'CTRL+SHIFT+P'        , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  24,    2, 'Purchase Entry'                       , 'CTRL+P'              , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  25,    2, 'Purchase Return'                      , 'CTRL+SHIFT+R'        , false,   4.00, NULL, NULL, NULL, true , true)
    ,(  26,    2, 'Purchase Masters'                     , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,(  27,   26, 'Supplier Groups'                      , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  28,   26, 'Agents Master'                        , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,( 149,   26, 'Transporters'                         , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,( 195,    2, 'Shortage Receipt'                     , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 196,    2, 'Purchase Note'                        , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 297,    2, 'Supplier Dues'                        , NULL                  , true ,   4.50, NULL, NULL, NULL, true , false)
    -- ============ &3 Inventory (menu 3, 17 rows) ============
    ,(   3, NULL, '&3 Inventory'                         , NULL                  , true ,  30.00, '0', NULL, NULL, true , false)
    ,(  29,    3, 'Items'                                , 'CTRL+I'              , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  30,    3, 'Change Selling Price'                 , 'CTRL+G'              , true ,  20.00, NULL, NULL, NULL, true , false)
    -- 298 (20261105120000_cost_price_bulk_change): type the new cost, the selling
    -- prices follow each unit's own rule; grid = ui_table 67. Verbs below.
    ,( 298,    3, 'Cost Price – Bulk Change'             , NULL                  , true ,  25.00, NULL, NULL, NULL, true , false)
    ,(  34,    3, 'Item Masters'                         , NULL                  , true ,  40.00, NULL, NULL, NULL, true , false)
    ,(  35,   34, 'Item Groups'                          , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  36,   34, 'Brands'                               , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,(  37,   34, 'Sections'                             , NULL                  , true ,  40.00, NULL, NULL, NULL, true , true)
    ,(  38,   34, 'Units'                                , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    -- 291 / 292 (notes 147, 20261023170000_textile_size_colour_screens): the textile
    -- size and colour masters (/item-sizes, /item-colours), grids 181 / 182.
    ,( 291,   34, 'Sizes'                                , NULL                  , true ,  60.00, NULL, NULL, NULL, true , false)
    ,( 292,   34, 'Colours'                              , NULL                  , true ,  70.00, NULL, NULL, NULL, true , true)
    ,( 293,   34, 'Stock Reasons'                        , NULL                  , true , 110.00, NULL, NULL, NULL, true , false)
    ,( 294,   34, 'Ageing Slabs'                         , NULL                  , true , 120.00, NULL, NULL, NULL, true , false)
    ,(  39,   34, 'Godowns'                              , NULL                  , true ,  80.00, NULL, NULL, NULL, true , false)
    ,(  40,   34, 'GST Rates'                            , NULL                  , true ,  90.00, NULL, NULL, NULL, true , false)
    ,( 240,   34, 'Categories'                           , 'item-category-master', true ,  30.00, NULL, NULL, NULL, true , false)
    ,( 244,    3, 'Qty-wise Prices'                      , NULL                  , true ,  30.00, NULL, NULL, NULL, true , true)
    -- ============ &4 Stock (menu 4, 7 rows) ============
    ,(   4, NULL, '&4 Stock'                             , NULL                  , true ,  40.00, '0', NULL, NULL, true , false)
    ,(  41,    4, 'Godown Transfer'                      , 'CTRL+T'              , true ,  40.00, NULL, NULL, NULL, true , false)
    ,(  44,    4, 'Opening Stock'                        , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  45,    4, 'Physical Stock'                       , 'CTRL+SHIFT+U'        , true ,  20.00, NULL, NULL, NULL, true , false)
    -- 264: notes 60 / 20260928210000_stock_bucket_move -- ONE menu for every adjustment kind
    -- (adjustment, re-lot, move stock, issue, damage, expiry write-off); per-kind rights later.
    ,( 264,    4, 'Stock Adjustment'                     , NULL                  , true ,  30.00, NULL, NULL, NULL, true , true)
    ,( 192,    4, 'Branch Outward'                       , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    ,( 193,    4, 'Branch Inward'                        , NULL                  , true ,  60.00, NULL, NULL, NULL, true , false)
    -- ============ &5 Accounts (menu 5, 18 rows) ============
    -- notes (59) / 20260928200000_accounts_menu_by_nature: names and positions follow the
    -- screen's nature -- masters 1-3, bill-wise settlement 10-14 (99/100 settle ONE party's
    -- bills; 260/261 are the register's many-party vouchers), the Voucher Register's
    -- vouchers 20-28 in Tally's F4-F10 order, retired / unbuilt screens at 90+ and hidden.
    -- Ids are pinned (the client opens screens by id). 100 is visible since the payment
    -- screen was built (20260929090000). 48 is inactive (20260915120000: the one receipt screen is 99).
    ,(   5, NULL, '&5 Accounts'                          , NULL                  , true ,  50.00, '0', NULL, NULL, true , false)
    ,(  51,    5, 'Received Cheques'                     , NULL                  , true , 120.00, NULL, NULL, NULL, true , false)
    ,(  52,    5, 'Issued Cheques'                       , NULL                  , true , 130.00, NULL, NULL, NULL, true , false)
    ,(  53,    5, 'Ledgers'                              , NULL                  , true , 170.00, NULL, NULL, NULL, true , false)
    ,(  54,    5, 'Ledger Groups'                        , NULL                  , true , 180.00, NULL, NULL, NULL, true , false)
    ,(  55,    5, 'Opening Balances'                     , NULL                  , true , 190.00, NULL, NULL, NULL, true , false)
    ,(  99,    5, 'Receipt (Bill-wise)'                  , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 100,    5, 'Payment (Bill-wise)'                  , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 101,    5, 'Debit Note'                           , NULL                  , true ,  90.00, NULL, NULL, NULL, true , false)
    ,( 102,    5, 'Credit Note'                          , NULL                  , true ,  80.00, NULL, NULL, NULL, true , false)
    ,( 103,    5, 'Journal'                              , NULL                  , true ,  70.00, NULL, NULL, NULL, true , false)
    ,( 104,    5, 'Contra'                               , NULL                  , true ,  60.00, NULL, NULL, NULL, true , false)
    ,( 163,    5, 'Purchase (Accounting)'                , NULL                  , true , 110.00, NULL, NULL, NULL, true , true)
    ,( 259,    5, 'Sales (Accounting)'                   , NULL                  , true , 100.00, NULL, NULL, NULL, true , false)
    ,( 260,    5, 'Receipt Voucher'                      , NULL                  , true ,  40.00, NULL, NULL, NULL, true , false)
    ,( 261,    5, 'Payment Voucher'                      , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    ,( 262,    5, 'Voucher Register'                     , NULL                  , true , 160.00, NULL, NULL, NULL, true , true)
    ,( 263,    5, 'Cheque Books'                         , NULL                  , true , 140.00, NULL, NULL, NULL, true , false)
    -- ============ &6 Reports (menu 6, 11 rows) ============
    -- 290 Price Change Log (notes 144, 20261023130000_price_change_log_menu_notes_144):
    -- the report over inventory.item_price_change_log, beside Audit Logs.
    ,(   6, NULL, '&6 Reports'                           , NULL                  , true ,  60.00, '0', NULL, NULL, true , false)
    ,( 106,    6, 'Audit Logs'                           , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 290,    6, 'Price Change Log'                     , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 137,    6, 'Accounts Reports'                     , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 279,    6, 'Party Outstanding'                    , NULL                  , false,   7.50, NULL, NULL, NULL, true , false)
    -- 300 Stock Reports / 301 Item Ledger (20261111130000_item_ledger_report, plan
    -- report/plan-item-ledger-2026-11-11.md): the stock reports folder after Accounts
    -- Reports (the Stock Summary will take 300 / 10.00) and the Item Ledger report.
    ,( 300,    6, 'Stock Reports'                        , NULL                  , true ,  15.00, NULL, NULL, NULL, true , false)
    ,( 301,  300, 'Item Ledger'                          , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 258,  137, 'Ledger Statement'                     , NULL                  , false,   0.50, NULL, NULL, NULL, true , false)
    ,( 284,  137, 'Day Book by Tender'                   , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 144,  137, 'Ledger Monthly Summary'               , NULL                  , false,   5.00, NULL, NULL, NULL, true , false)
    ,( 181,  137, 'Day Book Detail'                      , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    -- ============ &7 Settings (menu 7, 23 rows) ============
    ,(   7, NULL, '&7 Settings'                          , NULL                  , true ,  70.00, '0', NULL, NULL, true , false)
    ,(  56,    7, 'Company'                              , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  57,    7, 'Employees'                            , NULL                  , true ,  30.00, NULL, NULL, NULL, true , false)
    ,(  58,    7, 'Users & Rights'                       , NULL                  , true ,  40.00, NULL, NULL, NULL, true , true)
    ,(  59,    7, 'Modules'                              , NULL                  , true ,  50.00, NULL, NULL, NULL, true , true)
    ,(  60,    7, 'Configuration'                        , NULL                  , true ,  60.00, NULL, NULL, NULL, true , false)
    ,(  62,   60, 'Print Templates'                      , NULL                  , true ,  70.00, NULL, NULL, NULL, true , false)
    ,(  69,    7, 'Employee Masters'                     , NULL                  , true ,  70.00, NULL, NULL, NULL, true , false)
    ,(  70,   69, 'Departments'                          , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,(  71,   69, 'Designations'                         , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,(  73,  159, 'Grids'                                , NULL                  , true ,  30.00, NULL, NULL, NULL, true , false)
    ,(  77,  159, 'Dropdowns'                            , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 159,    7, 'System Setup'                         , NULL                  , true ,  80.00, NULL, NULL, NULL, true , false)
    ,( 160,  159, 'Customer Template'                    , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 161,  159, 'Item Template'                        , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 174,   60, 'Price Levels'                         , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 191,    7, 'Branches'                             , NULL                  , true ,  20.00, NULL, NULL, NULL, true , false)
    ,( 239,  159, 'Devices'                              , 'device-listmaster'   , true ,  10.00, '/icons/desktop/device.png', '/icons/web/device.png', '/icons/mobile/device.png', true , false)
    ,( 242,  159, 'UI Tables'                            , NULL                  , true ,  40.00, NULL, NULL, NULL, true , false)
    ,( 243,  159, 'Widgets'                              , NULL                  , true ,  50.00, NULL, NULL, NULL, true , false)
    ,( 245,   60, 'Charges'                              , NULL                  , true ,  30.00, NULL, NULL, NULL, true , false)
    ,( 246,   60, 'App Settings'                         , NULL                  , true ,  10.00, NULL, NULL, NULL, true , false)
    ,( 248,   60, 'Print Assignments'                    , NULL                  , true ,  80.00, NULL, NULL, NULL, true , false)
ON CONFLICT (menu_id) DO NOTHING;

-- ── menu_verbs for the rows this file adds after 20260922170000 ─────────────
-- The column defaults to '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}'. Each block
-- below narrows a row that needs a different list, and is guarded on that
-- default so a site that has since edited the row's verbs keeps its own
-- answer: this runs on every deploy.
--
-- 257 Temp Credits keeps the default (CREATE and DELETE are grantable there);
-- an earlier block narrowed it to {VIEW,EDIT,PRINT,EXPORT} and was retired by
-- 20261007100000_temp_credits_create_delete_verbs.

-- 258 Ledger Statement is a read-only report (reports/ledger-statement): it
-- can be viewed, printed and exported, and nothing else.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,PRINT,EXPORT}'
 WHERE menu_id = 258
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- The Voucher Register's screens (20260925160000_voucher_register): 101-104 (Debit
-- Note, Credit Note, Journal, Contra), 163 (Purchase (Accounting), formerly "GST
-- Expenses") and 259-262 (Sales (Accounting), Receipt Voucher, Payment Voucher, Voucher
-- Register). Posting documents, so POST / CANCEL / OVERRIDE -- and no AMEND: a posted
-- voucher is corrected by cancel + re-enter. The migration sets the same list on a
-- database that already has the rows; this catches a fresh one, where 20260922170000
-- ran before any menu existed. Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,OVERRIDE}'
 WHERE menu_id IN (101, 102, 103, 104, 163, 259, 260, 261, 262)
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Stock Adjustment (264, notes 60 / 20260928210000_stock_bucket_move): a posting
-- document -- POST and CANCEL -- but no AMEND (a posted adjustment is corrected by
-- cancel + re-enter) and no OVERRIDE (negative stock is BLOCK by decision D-A1).
-- Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}'
 WHERE menu_id = 264
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Ageing Slabs (294, notes 159 / 20261026130000_stock_small_masters_notes_159):
-- one ladder per company, saved whole — VIEW reads it, EDIT saves or reverts it.
-- (293 Stock Reasons keeps the default.) Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,EDIT}'
 WHERE menu_id = 294
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Cheque Books (263, notes 58 / 20260928190000_cheque_books_menu): a master that
-- is closed, never deleted, and neither posts nor prints. Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT}'
 WHERE menu_id = 263
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Till (271-276 + 280-283 + 285-289, 20261008140000 / 20261009190000 / 20261009200000 / 20261013120000 / 20261014100000 / 20261015100000 / 20261017110000 / 20261017120000): what each till screen can do. The groups hold
-- VIEW only; Open Till is the cashier's own session (CREATE = open, EDIT = suspend /
-- resume / count / close, PRINT = X read); Till Sessions is the supervisor's view
-- (OVERRIDE = the expected figures a blind close hides); Business Day opens the day
-- (CREATE) and closes / reopens it (EDIT, notes 117, 20261014180000);
-- Cash Office 286 (retired by notes 114) listed the bags awaiting receipt (VIEW) and
-- received them (CREATE); Cash Office 287 (notes 118) is the safe: VIEW the balance,
-- CREATE count / remit, OVERRIDE decide a safe gap; Till Reports 288 (notes 133) is
-- a read-only report: view, print, export; Cash Position 289 (notes 134) is head
-- office's view: VIEW, CREATE an HO review, EXPORT.
-- Same guard as above: a site that edited a row keeps its edit.
UPDATE fixed.menu_master m
   SET menu_verbs = v.verbs::text[]
  FROM (VALUES (271, '{VIEW}'), (272, '{VIEW,CREATE,EDIT,PRINT}'),
               (273, '{VIEW,PRINT,EXPORT,OVERRIDE}'), (274, '{VIEW,CREATE,EDIT}'),
               (275, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'), (276, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'),
               (280, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'), (281, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'),
               (282, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'), (283, '{VIEW}'),
               (285, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'), (286, '{VIEW,CREATE,PRINT,EXPORT}'),
               (287, '{VIEW,CREATE,PRINT,EXPORT,OVERRIDE}'), (288, '{VIEW,PRINT,EXPORT}'),
               (289, '{VIEW,CREATE,EXPORT}')
       ) AS v(id, verbs)
 WHERE m.menu_id = v.id
   AND m.menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Expense Voucher (277, 20261008160000_expense_voucher): a posting document --
-- POST and CANCEL, no AMEND (cancel + re-enter) and no OVERRIDE. Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}'
 WHERE menu_id = 277
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Settlement Reconciliation (278, 20261008190000_tender_settlement): import, match,
-- post, void — and OVERRIDE, which stands in for the NONCASH_WRITE_OFF /
-- SETTLEMENT_RESOLVE approvals until the till approval gate ships. Same guard.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,PRINT,EXPORT,POST,CANCEL,OVERRIDE}'
 WHERE menu_id = 278
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 279 Party Outstanding (reports/party-outstanding; 20261009100000_party_outstanding_menu,
-- moved under Reports by 20261009150000_party_outstanding_menu_reports) is a
-- read-only report like 258: view, print, export.
-- Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,PRINT,EXPORT}'
 WHERE menu_id = 279
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 284 Account Day Summary (reports/day-summary; 20261012120000_account_day_summary_menu)
-- is a read-only report like 258: view, print, export. 181 Day Book Detail opens
-- the same screen and keeps its row as it is (D8).
-- Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,PRINT,EXPORT}'
 WHERE menu_id = 284
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 290 Price Change Log (item-price-log/*; 20261023130000_price_change_log_menu_notes_144)
-- is a read-only report like 258: view, print, export. Its VIEW right is the
-- report's access (notes 144: "a normal menu right").
-- Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,PRINT,EXPORT}'
 WHERE menu_id = 290
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 298 Cost Price – Bulk Change (20261105120000_cost_price_bulk_change): VIEW loads
-- the grid, EDIT saves the new costs and prices in place. Nothing is created,
-- deleted, printed or exported. Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,EDIT}'
 WHERE menu_id = 298
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 299 Sales Order Management (20261110180000_sale_order_desk): VIEW only puts the
-- desk on the menu. Every action on it is judged on its own menu's rights (11 Sales
-- Order, 12 Sales Bill, 99 Receipt, 258, 279), plan D6. Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW}'
 WHERE menu_id = 299
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 300 Stock Reports (20261111130000_item_ledger_report) is a folder: VIEW only.
-- 301 Item Ledger (same migration) is a read-only report like 279: view, print,
-- export; VIEW also gates the Ctrl+F10 popup. Same guard as above.
UPDATE fixed.menu_master m
   SET menu_verbs = v.verbs::text[]
  FROM (VALUES (300, '{VIEW}'),
               (301, '{VIEW,PRINT,EXPORT}')
       ) AS v(id, verbs)
 WHERE m.menu_id = v.id
   AND m.menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- 192 Branch Outward (notes 160 B / 20261027110000_transfers_notes_160): CANCEL is
-- the recall of a despatch nobody received (POST /stock/transfer/recall). Its other
-- routes are judged on menu 41. Same guard as above.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,CANCEL}'
 WHERE menu_id = 192
   AND menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Purchase (20261028130000_purchase_masters_menus, 20261029130000_purchase_fidelity_db_needs):
-- 195 Shortage Receipt posts and cancels; 196 GRN also takes OVERRIDE (posting past
-- PUR_SHELF_LIFE in REFUSE mode); 297 Supplier Dues (claims + shortages on one page)
-- views, settles (POST) and voids (CANCEL), no DELETE. Same guard as above.
UPDATE fixed.menu_master m
   SET menu_verbs = v.verbs::text[]
  FROM (VALUES (195, '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL}'),
               (196, '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,OVERRIDE}'),
               (297, '{VIEW,CREATE,EDIT,PRINT,EXPORT,POST,CANCEL}')
       ) AS v(id, verbs)
 WHERE m.menu_id = v.id
   AND m.menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

-- Keep the identity sequence ahead of the seeded ids, otherwise the first menu
-- created from the UI reuses id 1 and fails on the primary key.
SELECT setval(
    pg_get_serial_sequence('fixed.menu_master', 'menu_id'),
    (SELECT GREATEST(COALESCE(MAX(menu_id), 0), 1) FROM fixed.menu_master),
    true
);

COMMIT;
