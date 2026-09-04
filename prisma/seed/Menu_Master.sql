-- Seed: fixed.menu_master -- the full application menu tree (226 rows).
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
    -- ============ &1 Sales (menu 1, 65 rows) ============
     (   1, NULL, '&1 Sales'                             , NULL                  , true ,   1.00, '0', NULL, NULL, true , true)
    ,(  10,    1, 'Customers'                            , 'CTRL+SHIFT+C'        , true ,   1.00, '0', NULL, NULL, true , true)
    ,(  11,    1, 'Sales Order'                          , 'CTRL+SHIFT+S'        , true ,   2.00, NULL, NULL, NULL, true , false)
    ,(  12,    1, 'Sales Entry'                          , 'CTRL+S'              , true ,   3.00, '0', NULL, NULL, true , false)
    ,(  13,    1, 'Sales Return'                         , 'CTRL+R'              , true ,   4.00, '0', NULL, NULL, true , false)
    ,(  14,    1, 'Quotation'                            , 'CTRL+Q'              , true ,   5.00, '0', NULL, NULL, true , false)
    ,(  15,    1, 'Pick List'                            , NULL                  , false,   6.00, '0', NULL, NULL, true , false)
    ,(  16,    1, 'Order - Invoice'                      , 'CTRL+O'              , false,   7.00, '0', NULL, NULL, true , false)
    ,(  17,    1, 'Master'                               , NULL                  , true ,   8.00, '0', NULL, NULL, true , true)
    ,(  18,   17, 'State Master'                         , NULL                  , true ,   1.00, '1', NULL, NULL, true , false)
    ,(  19,   17, 'City Master'                          , NULL                  , true ,   2.00, '2', NULL, NULL, true , false)
    ,(  20,   17, 'Area Master'                          , NULL                  , true ,   3.00, '3', NULL, NULL, true , false)
    ,(  21,   17, 'Customer Type Master'                 , NULL                  , true ,   4.00, '4', NULL, NULL, true , false)
    ,(  66,    1, 'Offer & Schemes'                      , NULL                  , true ,  12.00, NULL, NULL, NULL, true , true)
    ,(  67,   75, 'Loyalty Programs'                     , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  75,    1, 'Loyalty Schemes'                      , NULL                  , true ,  10.00, NULL, NULL, NULL, true , true)
    ,(  79,   75, 'Loyalty Status'                       , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  80,   75, 'Loyalty Redemption'                   , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  81,    1, 'Salesman Schemes'                     , NULL                  , false,  11.00, NULL, NULL, NULL, true , false)
    ,(  82,   81, 'Salesman Target Schemes'              , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,(  83,   81, 'Salesman Target Status'               , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  95,   17, 'Tender Master'                        , NULL                  , true ,   5.00, NULL, NULL, NULL, true , false)
    ,( 105,    1, 'SO Check Sheet'                       , NULL                  , false,  13.00, NULL, NULL, NULL, true , true)
    ,( 110,    1, 'Customer Reminders'                   , NULL                  , false,  14.00, NULL, NULL, NULL, true , false)
    ,( 111,    1, 'Mobile Orders'                        , NULL                  , false,   7.00, NULL, NULL, NULL, true , true)
    ,( 119,   17, 'Special Discount Customers'           , NULL                  , false,   6.00, NULL, NULL, NULL, true , false)
    ,( 120,    1, 'Salesman Notices'                     , NULL                  , false,  16.00, NULL, NULL, NULL, true , false)
    ,( 122,    1, 'Third Party Bills'                    , NULL                  , false,  17.00, NULL, NULL, NULL, true , false)
    ,( 125,   17, 'Vehicle Master'                       , NULL                  , false,   4.00, NULL, NULL, NULL, true , true)
    ,( 129,   17, 'Sales Categories'                     , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 130,   17, 'Vehicle Freight Charges'              , NULL                  , true ,   8.00, NULL, NULL, NULL, true , false)
    ,( 131,    1, 'Cashier Screen'                       , NULL                  , false,  18.00, NULL, NULL, NULL, true , false)
    ,( 141,    1, 'Dispatch Detail'                      , NULL                  , false,  19.00, NULL, NULL, NULL, true , false)
    ,( 142,    1, 'Contract'                             , NULL                  , false,   6.00, NULL, NULL, NULL, true , true)
    ,( 147,    1, 'Dispatch - Pending Bills'             , NULL                  , false,  20.00, NULL, NULL, NULL, true , false)
    ,( 148,    1, 'Pick List - Sales Order'              , NULL                  , false,  21.00, NULL, NULL, NULL, true , false)
    ,( 151,    1, 'Bill Verification'                    , NULL                  , false,  22.00, NULL, NULL, NULL, true , false)
    ,( 152,    1, 'e-Invoice'                            , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 153,    1, 'e-Way Bill'                           , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 162,   17, 'Agent Master'                         , NULL                  , false,   9.00, NULL, NULL, NULL, true , false)
    ,( 172,    1, 'SO Management'                        , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 177,   17, 'Loading Charges'                      , NULL                  , true ,   8.00, NULL, NULL, NULL, true , false)
    ,( 182,    1, 'Deliver Note'                         , NULL                  , false,   5.00, NULL, NULL, NULL, true , false)
    ,( 189,    1, 'Optical Prescription'                 , NULL                  , true ,   1.10, NULL, NULL, NULL, true , false)
    ,( 198,    1, 'Session Control'                      , NULL                  , false,  22.00, NULL, NULL, NULL, true , false)
    ,( 199,  198, 'Session Management'                   , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 200,  198, 'Session Tender Details'               , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,( 201,  198, 'Session Close '                       , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,( 202,    1, 'Agents'                               , NULL                  , false,  21.10, NULL, NULL, NULL, true , false)
    ,( 203,  202, 'Agents Master'                        , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 204,  202, 'Agent Groups Master'                  , NULL                  , true ,   2.00, NULL, NULL, NULL, true , true)
    ,( 205,  202, 'Loyalty Program'                      , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,( 206,  202, 'Loyalty Status'                       , NULL                  , true ,   4.00, NULL, NULL, NULL, true , false)
    ,( 207,  202, 'Loyalty Redemption'                   , NULL                  , true ,   5.00, NULL, NULL, NULL, true , false)
    ,( 212,  202, 'Loyalty Transaction'                  , NULL                  , true ,   4.10, NULL, NULL, NULL, true , false)
    ,( 218,    1, 'Data Import'                          , NULL                  , false,  23.00, NULL, NULL, NULL, true , false)
    ,( 219,  218, 'Import Customers'                     , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 220,  218, 'Import Invoices'                      , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,( 226,    1, 'Bill Delivery Update'                 , 'true'                , true ,   6.10, NULL, NULL, NULL, true , false)
    ,( 228,   17, 'Customer Discount Master'             , NULL                  , false,   6.10, NULL, NULL, NULL, true , true)
    ,( 229,    1, 'Sale Entry (Bulk)'                    , NULL                  , false,   3.10, NULL, NULL, NULL, true , false)
    ,( 233,    1, 'Sales Bill - Loadman'                 , 'false'               , false,  24.00, NULL, NULL, NULL, true , false)
    ,( 235,   75, 'Loyalty Redemption (Item)'            , 'false'               , false,   4.00, NULL, NULL, NULL, true , true)
    ,( 236,   75, 'Loyalty Redemption Report (Item-wise)', 'false'               , false,   5.00, NULL, NULL, NULL, true , false)
    ,( 247,   66, 'Promotion Scheme'                     , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    -- ============ &2 Purchase (menu 2, 18 rows) ============
    ,(   2, NULL, '&2 Purchase'                          , NULL                  , true ,   2.00, '0', NULL, NULL, true , false)
    ,(  22,    2, 'Suppliers'                            , NULL                  , true ,   1.00, NULL, NULL, NULL, true , true)
    ,(  23,    2, 'Purchase Order'                       , 'CTRL+SHIFT+P'        , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  24,    2, 'Purchase Entry'                       , 'CTRL+P'              , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  25,    2, 'Purchase Return'                      , 'CTRL+SHIFT+R'        , false,   4.00, NULL, NULL, NULL, true , true)
    ,(  26,    2, 'Master'                               , NULL                  , true ,   5.00, NULL, NULL, NULL, true , false)
    ,(  27,   26, 'Supplier Groups'                      , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  28,   26, 'Agents Master'                        , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,( 149,   26, 'Transporters'                         , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,( 195,    2, 'Shortage Receipt'                     , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 196,    2, 'Purchase Note'                        , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 208,    2, 'Procurement'                          , NULL                  , false,   4.90, NULL, NULL, NULL, true , false)
    ,( 209,  208, 'Center Master'                        , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 210,  208, 'Farmer Master'                        , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,( 211,  208, 'Proc Entry'                           , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,( 213,  208, 'Rate Chart'                           , NULL                  , true ,   2.10, NULL, NULL, NULL, true , true)
    ,( 214,  208, 'Proc Payment'                         , NULL                  , true ,   4.00, NULL, NULL, NULL, true , true)
    ,( 215,  208, 'Proc Bank Payment'                    , NULL                  , true ,   5.00, NULL, NULL, NULL, true , true)
    -- ============ &3 Inventory (menu 3, 23 rows) ============
    ,(   3, NULL, '&3 Inventory'                         , NULL                  , true ,   3.00, '0', NULL, NULL, true , false)
    ,(  29,    3, 'Item Master'                          , 'CTRL+I'              , true ,   1.00, NULL, NULL, NULL, true , true)
    ,(  30,    3, 'Change Selling'                       , 'CTRL+G'              , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  31,    3, 'Change Selling (Purchase)'            , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  32,    3, 'Sticker Printing'                     , NULL                  , false,   5.00, NULL, NULL, NULL, true , false)
    ,(  33,    3, 'Product Kits'                         , NULL                  , false,   6.00, NULL, NULL, NULL, true , false)
    ,(  34,    3, 'Master'                               , NULL                  , true ,   7.00, NULL, NULL, NULL, true , false)
    ,(  35,   34, 'Item Group Master'                    , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  36,   34, 'Item Brand Master'                    , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,(  37,   34, 'Item Section Master'                  , NULL                  , true ,   3.00, NULL, NULL, NULL, true , true)
    ,(  38,   34, 'Unit Master'                          , NULL                  , true ,   4.00, NULL, NULL, NULL, true , false)
    ,(  39,   34, 'Godown Master'                        , NULL                  , true ,   5.00, NULL, NULL, NULL, true , false)
    ,(  40,   34, 'Tax Master'                           , NULL                  , true ,   6.00, NULL, NULL, NULL, true , false)
    ,(  46,  164, 'Reorder - Quick'                      , NULL                  , true ,   2.00, NULL, NULL, NULL, true , true)
    ,( 115,    3, 'Item Group wise Discount'             , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 164,    3, 'Reorder'                              , NULL                  , false,   6.00, NULL, NULL, NULL, true , false)
    ,( 176,    3, 'Cost Price - Bulk Change'             , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 178,    3, 'Allow to Change Master Price'         , NULL                  , false,   8.00, NULL, NULL, NULL, true , false)
    ,( 216,  164, 'Reorder - Advanced'                   , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 217,  164, 'Reorder - Bulk Update'                , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,( 238,    3, 'Custom Sticker'                       , NULL                  , false,   5.10, NULL, NULL, NULL, true , false)
    ,( 240,   34, 'item category master'                 , 'item-category-master', true ,   2.10, NULL, NULL, NULL, true , false)
    ,( 244,   34, 'Item Qty wise Price'                  , NULL                  , true ,   7.00, NULL, NULL, NULL, true , false)
    -- ============ &4 Stock (menu 4, 19 rows) ============
    ,(   4, NULL, '&4 Stock'                             , NULL                  , true ,   4.00, '0', NULL, NULL, true , false)
    ,(  41,    4, 'Stock Transfer'                       , 'CTRL+T'              , false,   1.00, NULL, NULL, NULL, true , true)
    ,(  42,    4, 'Split Stock'                          , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  43,    4, 'Production'                           , 'CTRL+K'              , false,   3.00, NULL, NULL, NULL, true , true)
    ,(  44,    4, 'Opening Stock'                        , NULL                  , true ,   4.00, NULL, NULL, NULL, true , false)
    ,(  45,    4, 'Physical Stock Update'                , 'CTRL+SHIFT+U'        , true ,   5.00, NULL, NULL, NULL, true , false)
    ,( 107,    4, 'Stock Transfer (Third Party)'         , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 145,    4, 'Stock Exchange'                       , NULL                  , false,   8.00, NULL, NULL, NULL, true , false)
    ,( 170,    4, 'Gate Inward Entry'                    , NULL                  , false,  10.00, NULL, NULL, NULL, true , false)
    ,( 171,    4, 'Gate Inward Pending'                  , NULL                  , false,  11.00, NULL, NULL, NULL, true , false)
    ,( 173,    4, 'Gate Outward Entry'                   , NULL                  , false,  10.00, NULL, NULL, NULL, true , false)
    ,( 192,    4, 'Branch Outward'                       , NULL                  , false,  12.00, NULL, NULL, NULL, true , false)
    ,( 193,    4, 'Branch Inward'                        , NULL                  , false,  13.00, NULL, NULL, NULL, true , false)
    ,( 197,    4, 'Own Consumption'                      , NULL                  , false,   2.10, NULL, NULL, NULL, true , false)
    ,( 222,    4, 'Meat Shop'                            , NULL                  , false,  14.00, NULL, NULL, NULL, true , false)
    ,( 223,  222, 'Daily Avg.Weigh Loss'                 , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 224,  222, 'Shop Inward'                          , NULL                  , false,   2.00, NULL, NULL, NULL, true , true)
    ,( 225,  222, 'Meat Inward'                          , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,( 237,    4, 'Godown - Stock Dispatch'              , 'false'               , false,  15.00, NULL, NULL, NULL, true , false)
    -- ============ &5 Accounts (menu 5, 19 rows) ============
    ,(   5, NULL, '&5 Accounts'                          , NULL                  , true ,   5.00, '0', NULL, NULL, true , false)
    ,(  48,    5, 'Bill wise Receipt'                    , 'CTRL+B'              , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  49,    5, 'Bill wise Payment'                    , 'CTRL+SHIFT+B'        , false,   4.00, NULL, NULL, NULL, true , true)
    ,(  51,    5, 'Received Cheques'                     , NULL                  , false,  12.00, NULL, NULL, NULL, true , false)
    ,(  52,    5, 'Issued Cheques'                       , NULL                  , false,  13.00, NULL, NULL, NULL, true , false)
    ,(  53,    5, 'Ledger Master'                        , NULL                  , true ,   2.00, NULL, NULL, NULL, true , true)
    ,(  54,    5, 'Ledger Group Master'                  , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  55,    5, 'Opening Balance'                      , NULL                  , false,   0.00, NULL, NULL, NULL, true , false)
    ,(  99,    5, 'Receipt'                              , NULL                  , false,   6.00, NULL, NULL, NULL, true , false)
    ,( 100,    5, 'Payment'                              , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 101,    5, 'Debit Note'                           , NULL                  , false,   8.00, NULL, NULL, NULL, true , false)
    ,( 102,    5, 'Credit Note'                          , NULL                  , false,   9.00, NULL, NULL, NULL, true , true)
    ,( 103,    5, 'Journal'                              , NULL                  , false,  10.00, NULL, NULL, NULL, true , false)
    ,( 104,    5, 'Contra'                               , NULL                  , false,  11.00, NULL, NULL, NULL, true , true)
    ,( 163,    5, 'GST Expenses'                         , NULL                  , false,  11.00, NULL, NULL, NULL, true , false)
    ,( 179,    5, 'Claim Management'                     , NULL                  , false,  14.00, NULL, NULL, NULL, true , true)
    ,( 185,    5, 'Third Party Bills'                    , NULL                  , false,  15.00, NULL, NULL, NULL, true , false)
    ,( 187,    5, 'Collection Entry'                     , 'false'               , false,  11.10, NULL, NULL, NULL, true , false)
    ,( 188,    5, 'Collection Approval'                  , 'false'               , false,  11.20, NULL, NULL, NULL, true , true)
    -- ============ &6 Reports (menu 6, 21 rows) ============
    ,(   6, NULL, '&6 Reports'                           , NULL                  , true ,   6.00, '0', NULL, NULL, true , false)
    ,(  74,    6, 'Sales Reports'                        , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  76,   74, 'Sales Bills'                          , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 106,    6, 'Audit Logs'                           , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 137,    6, 'Financial Statements'                 , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 138,  137, 'Trial Balance'                        , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 139,  137, 'Balance Sheet'                        , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,( 140,  137, 'Profit && Loss'                       , NULL                  , false,   3.00, NULL, NULL, NULL, true , true)
    ,( 143,  137, 'Account Group Summary'                , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 144,  137, 'Ledger Monthly Summary'               , NULL                  , false,   5.00, NULL, NULL, NULL, true , false)
    ,( 154,  137, 'Profit && Loss (w/o Stock)'           , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,( 156,    6, 'Statutory Reports'                    , NULL                  , false,  10.00, NULL, NULL, NULL, true , false)
    ,( 157,  156, 'TCS Party wise Report'                , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 158,  156, 'TCS Bill wise Report'                 , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 181,  137, 'Day Book Detail'                      , NULL                  , false,   7.00, NULL, NULL, NULL, true , false)
    ,( 183,    6, 'Addl Reports'                         , NULL                  , false,  11.00, NULL, NULL, NULL, true , false)
    ,( 184,  183, 'Monthwise Stock Balance'              , NULL                  , false,   1.00, NULL, NULL, NULL, true , false)
    ,( 186,  183, 'Daily Sales'                          , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,( 194,  183, 'Customer Statement'                   , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,( 232,  183, 'Dash Board'                           , 'true'                , false,   0.01, NULL, NULL, NULL, true , false)
    ,( 234,  183, 'Tender wise Collection'               , 'false'               , false,   5.00, NULL, NULL, NULL, true , false)
    -- ============ &7 Settings (menu 7, 39 rows) ============
    ,(   7, NULL, '&7 Settings'                          , NULL                  , true ,   7.00, '0', NULL, NULL, true , false)
    ,(  56,    7, 'Company Master'                       , NULL                  , true ,   0.00, NULL, NULL, NULL, true , false)
    ,(  57,    7, 'Employee Master'                      , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  58,    7, 'User Administration'                  , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,(  59,    7, 'Module Administration'                , NULL                  , true ,   5.00, NULL, NULL, NULL, true , true)
    ,(  60,    7, 'Configuration'                        , NULL                  , true ,   6.00, NULL, NULL, NULL, true , false)
    ,(  61,   60, 'SMS Configuration'                    , NULL                  , false,   0.00, NULL, NULL, NULL, true , false)
    ,(  62,   60, 'Printing Configuration'               , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  63,   60, 'Barcode Configuration'                , NULL                  , false,   2.00, NULL, NULL, NULL, true , false)
    ,(  64,    7, 'Financial Year'                       , NULL                  , false,   9.00, NULL, NULL, NULL, true , false)
    ,(  65,    7, 'Reset Sequence'                       , NULL                  , false,  10.00, NULL, NULL, NULL, true , false)
    ,(  69,    7, 'Masters'                              , NULL                  , true ,  11.00, NULL, NULL, NULL, true , false)
    ,(  70,   69, 'Department Master'                    , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  71,   69, 'Designation Master'                   , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,(  72,   69, 'Item User Fields'                     , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,(  73,   69, 'Grid Settings'                        , NULL                  , true ,   8.00, NULL, NULL, NULL, true , false)
    ,(  77,   69, 'Dropdown Settings'                    , NULL                  , true ,   7.00, NULL, NULL, NULL, true , false)
    ,(  78,   60, 'Software Configuration'               , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,( 113,    7, 'Bank Details'                         , NULL                  , false,   2.00, NULL, NULL, NULL, true , true)
    ,( 114,    7, 'Change Password'                      , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 150,   69, 'Contact Book'                         , NULL                  , false,   3.00, NULL, NULL, NULL, true , false)
    ,( 159,    7, 'Templates'                            , NULL                  , true ,   6.00, NULL, NULL, NULL, true , false)
    ,( 160,  159, 'Customer Template'                    , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 161,  159, 'Item Template'                        , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 165,    7, 'Letter Pad'                           , NULL                  , false,  10.00, NULL, NULL, NULL, true , false)
    ,( 174,   60, 'Price Level Configuration'            , NULL                  , true ,   4.00, NULL, NULL, NULL, true , false)
    ,( 175,    7, 'Export to Tally'                      , NULL                  , false,  11.00, NULL, NULL, NULL, true , false)
    ,( 180,   60, 'Bug Information'                      , NULL                  , false,   4.00, NULL, NULL, NULL, true , false)
    ,( 190,   60, 'Software License'                     , NULL                  , false,   5.00, NULL, NULL, NULL, true , false)
    ,( 191,    7, 'Branch Master'                        , NULL                  , true ,   0.10, NULL, NULL, NULL, true , false)
    ,( 227,   60, 'What''s App Configuration'            , NULL                  , false,   0.50, NULL, NULL, NULL, true , true)
    ,( 231,    7, 'Print Settings'                       , 'false'               , false,   1.10, NULL, NULL, NULL, true , false)
    ,( 239,   69, 'device list master'                   , 'device-listmaster'   , true ,   4.00, '/icons/desktop/device.png', '/icons/web/device.png', '/icons/mobile/device.png', true , false)
    ,( 241,    7, 'gsp company service'                  , 'gsp sc'              , true ,   2.00, NULL, NULL, NULL, true , false)
    ,( 242,   69, 'ui- table-master'                     , NULL                  , true ,   8.10, NULL, NULL, NULL, true , false)
    ,( 243,   60, 'widget-master'                        , NULL                  , true ,   6.00, NULL, NULL, NULL, true , false)
    ,( 245,   60, 'Charge master'                        , NULL                  , true ,   7.00, NULL, NULL, NULL, true , false)
    ,( 246,   60, 'app settings'                         , NULL                  , true ,   8.00, NULL, NULL, NULL, true , false)
    ,( 248,   60, 'Printing Assignments'                 , NULL                  , true ,   1.20, NULL, NULL, NULL, true , false)
    -- ============ &8 Transport (menu 8, 9 rows) ============
    ,(   8, NULL, '&8 Transport'                         , NULL                  , false,   8.00, '0', NULL, NULL, true , false)
    ,( 126,    8, 'Tripsheet'                            , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,( 127,    8, 'Header Types'                         , NULL                  , true ,   7.00, NULL, NULL, NULL, true , false)
    ,( 128,    8, 'Vehicle Renewals'                     , NULL                  , true ,   6.00, NULL, NULL, NULL, true , true)
    ,( 132,    8, 'Fuel Log'                             , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,( 133,    8, 'Service Log'                          , NULL                  , true ,   4.00, NULL, NULL, NULL, true , true)
    ,( 134,    8, 'Tyre Maintenance'                     , NULL                  , true ,   2.00, NULL, NULL, NULL, true , true)
    ,( 135,    8, 'Service Reminders'                    , NULL                  , true ,   5.00, NULL, NULL, NULL, true , false)
    ,( 136,    8, 'Reports'                              , NULL                  , false,   8.00, NULL, NULL, NULL, true , false)
    -- ============ &9 Attendance (menu 9, 13 rows) ============
    ,(   9, NULL, '&9 Attendance'                        , NULL                  , false,   9.00, '0', NULL, NULL, true , false)
    ,(  84,    9, 'Leave Entry'                          , NULL                  , true ,   0.00, NULL, NULL, NULL, true , false)
    ,(  85,    9, 'Master'                               , NULL                  , true ,   4.00, NULL, NULL, NULL, true , false)
    ,(  86,   85, 'Employee Shift'                       , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  87,   85, 'Attendance Constraint'                , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,(  88,   85, 'Devices'                              , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
    ,(  89,    9, 'Permission Entry'                     , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  90,    9, 'Holiday Entry'                        , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,(  91,    9, 'Weekly Offs'                          , NULL                  , true ,   3.00, NULL, NULL, NULL, true , true)
    ,(  92,    9, 'Reports'                              , NULL                  , true ,   5.00, NULL, NULL, NULL, true , false)
    ,(  93,   92, 'Daily Attendance'                     , NULL                  , true ,   1.00, NULL, NULL, NULL, true , false)
    ,(  94,   92, 'Monthly Attendance'                   , NULL                  , true ,   2.00, NULL, NULL, NULL, true , false)
    ,( 108,   92, 'Monthly Statement'                    , NULL                  , true ,   3.00, NULL, NULL, NULL, true , false)
ON CONFLICT (menu_id) DO NOTHING;

-- Keep the identity sequence ahead of the seeded ids, otherwise the first menu
-- created from the UI reuses id 1 and fails on the primary key.
SELECT setval(
    pg_get_serial_sequence('fixed.menu_master', 'menu_id'),
    (SELECT GREATEST(COALESCE(MAX(menu_id), 0), 1) FROM fixed.menu_master),
    true
);

COMMIT;
