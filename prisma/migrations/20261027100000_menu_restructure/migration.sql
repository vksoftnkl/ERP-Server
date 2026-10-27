-- ═══════════════════════════════════════════════════════════════════════════
--  Menu restructure                                             2026-10-27
--
--  Renames, re-parents and re-numbers the visible menu tree (positions in
--  steps of 10 under each parent), sets the separators, and hides 12 retired
--  or duplicate screens (13, 49, 106, 160, 161, 179, 181, 185, 187, 188, 258,
--  279). Every row is addressed by its pinned menu_id; nothing is inserted
--  into menu_master and no id changes.
--
--  prisma/seed/Menu_Master.sql carries the same name / parent / position /
--  separator / visibility, because a fresh database replays this file into an
--  empty tree (every UPDATE matches nothing) and only then runs the seed.
--
--  A user who holds a screen also gets VIEW on every group above it, so a
--  screen moved under a new group is not hidden from anyone who could open it.
--
--  Rollback: logs/backups/menu_master_user_menus_before_menu_restructure_20261027.sql
--  (data-only pg_dump of fixed.menu_master + public.user_menus taken before this ran).
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.menu_master SET menu_name = '&1 Sales', menu_parent = NULL, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 1;
UPDATE fixed.menu_master SET menu_name = 'Sales Bill', menu_parent = 1, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 12;
UPDATE fixed.menu_master SET menu_name = 'Quotation', menu_parent = 1, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 14;
UPDATE fixed.menu_master SET menu_name = 'Sales Order', menu_parent = 1, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 11;
UPDATE fixed.menu_master SET menu_name = 'Delivery Status', menu_parent = 1, menu_position = 40, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 226;
UPDATE fixed.menu_master SET menu_name = 'Temp Credits', menu_parent = 1, menu_position = 50, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 257;
UPDATE fixed.menu_master SET menu_name = 'Customers', menu_parent = 1, menu_position = 60, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 10;
UPDATE fixed.menu_master SET menu_name = 'Loyalty', menu_parent = 1, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 75;
UPDATE fixed.menu_master SET menu_name = 'Loyalty Programs', menu_parent = 75, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 67;
UPDATE fixed.menu_master SET menu_name = 'Loyalty Status', menu_parent = 75, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 79;
UPDATE fixed.menu_master SET menu_name = 'Offers', menu_parent = 1, menu_position = 80, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 66;
UPDATE fixed.menu_master SET menu_name = 'Promotion Schemes', menu_parent = 66, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 247;
UPDATE fixed.menu_master SET menu_name = 'Till', menu_parent = 1, menu_position = 90, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 271;
UPDATE fixed.menu_master SET menu_name = 'Open Till', menu_parent = 271, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 272;
UPDATE fixed.menu_master SET menu_name = 'Till Sessions', menu_parent = 271, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 273;
UPDATE fixed.menu_master SET menu_name = 'Cash Office', menu_parent = 271, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 287;
UPDATE fixed.menu_master SET menu_name = 'Business Day', menu_parent = 271, menu_position = 40, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 274;
UPDATE fixed.menu_master SET menu_name = 'Cash Position', menu_parent = 271, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 289;
UPDATE fixed.menu_master SET menu_name = 'Till Reports', menu_parent = 271, menu_position = 60, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 288;
UPDATE fixed.menu_master SET menu_name = 'Till Setup', menu_parent = 271, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 283;
UPDATE fixed.menu_master SET menu_name = 'Counters', menu_parent = 283, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 275;
UPDATE fixed.menu_master SET menu_name = 'Safes', menu_parent = 283, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 280;
UPDATE fixed.menu_master SET menu_name = 'Reasons', menu_parent = 283, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 281;
UPDATE fixed.menu_master SET menu_name = 'Denominations', menu_parent = 283, menu_position = 40, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 282;
UPDATE fixed.menu_master SET menu_name = 'Approval Rules', menu_parent = 283, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 276;
UPDATE fixed.menu_master SET menu_name = 'Approval Authority', menu_parent = 283, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 285;
UPDATE fixed.menu_master SET menu_name = 'Sales Masters', menu_parent = 1, menu_position = 100, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 17;
UPDATE fixed.menu_master SET menu_name = 'States', menu_parent = 17, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 18;
UPDATE fixed.menu_master SET menu_name = 'Cities', menu_parent = 17, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 19;
UPDATE fixed.menu_master SET menu_name = 'Areas', menu_parent = 17, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 20;
UPDATE fixed.menu_master SET menu_name = 'Customer Types', menu_parent = 17, menu_position = 40, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 21;
UPDATE fixed.menu_master SET menu_name = 'Tender Types', menu_parent = 17, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 95;
UPDATE fixed.menu_master SET menu_name = 'Freight Charges', menu_parent = 17, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 130;
UPDATE fixed.menu_master SET menu_name = 'Loading Charges', menu_parent = 17, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 177;
UPDATE fixed.menu_master SET menu_name = '&2 Purchase', menu_parent = NULL, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 2;
UPDATE fixed.menu_master SET menu_name = 'Suppliers', menu_parent = 2, menu_position = 10, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 22;
UPDATE fixed.menu_master SET menu_name = 'Purchase Masters', menu_parent = 2, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 26;
UPDATE fixed.menu_master SET menu_name = 'Supplier Groups', menu_parent = 26, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 27;
UPDATE fixed.menu_master SET menu_name = '&3 Inventory', menu_parent = NULL, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 3;
UPDATE fixed.menu_master SET menu_name = 'Items', menu_parent = 3, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 29;
UPDATE fixed.menu_master SET menu_name = 'Change Selling Price', menu_parent = 3, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 30;
UPDATE fixed.menu_master SET menu_name = 'Qty-wise Prices', menu_parent = 3, menu_position = 30, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 244;
UPDATE fixed.menu_master SET menu_name = 'Item Masters', menu_parent = 3, menu_position = 40, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 34;
UPDATE fixed.menu_master SET menu_name = 'Item Groups', menu_parent = 34, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 35;
UPDATE fixed.menu_master SET menu_name = 'Brands', menu_parent = 34, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 36;
UPDATE fixed.menu_master SET menu_name = 'Categories', menu_parent = 34, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 240;
UPDATE fixed.menu_master SET menu_name = 'Sections', menu_parent = 34, menu_position = 40, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 37;
UPDATE fixed.menu_master SET menu_name = 'Units', menu_parent = 34, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 38;
UPDATE fixed.menu_master SET menu_name = 'Sizes', menu_parent = 34, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 291;
UPDATE fixed.menu_master SET menu_name = 'Colours', menu_parent = 34, menu_position = 70, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 292;
UPDATE fixed.menu_master SET menu_name = 'Godowns', menu_parent = 34, menu_position = 80, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 39;
UPDATE fixed.menu_master SET menu_name = 'GST Rates', menu_parent = 34, menu_position = 90, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 40;
UPDATE fixed.menu_master SET menu_name = 'Tracking Presets', menu_parent = 34, menu_position = 100, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 249;
UPDATE fixed.menu_master SET menu_name = '&4 Stock', menu_parent = NULL, menu_position = 40, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 4;
UPDATE fixed.menu_master SET menu_name = 'Opening Stock', menu_parent = 4, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 44;
UPDATE fixed.menu_master SET menu_name = 'Physical Stock', menu_parent = 4, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 45;
UPDATE fixed.menu_master SET menu_name = 'Stock Adjustment', menu_parent = 4, menu_position = 30, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 264;
UPDATE fixed.menu_master SET menu_name = 'Godown Transfer', menu_parent = 4, menu_position = 40, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 41;
UPDATE fixed.menu_master SET menu_name = 'Branch Outward', menu_parent = 4, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 192;
UPDATE fixed.menu_master SET menu_name = 'Branch Inward', menu_parent = 4, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 193;
UPDATE fixed.menu_master SET menu_name = '&5 Accounts', menu_parent = NULL, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 5;
UPDATE fixed.menu_master SET menu_name = 'Receipt (Bill-wise)', menu_parent = 5, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 99;
UPDATE fixed.menu_master SET menu_name = 'Payment (Bill-wise)', menu_parent = 5, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 100;
UPDATE fixed.menu_master SET menu_name = 'Expense Voucher', menu_parent = 5, menu_position = 30, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 277;
UPDATE fixed.menu_master SET menu_name = 'Receipt Voucher', menu_parent = 5, menu_position = 40, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 260;
UPDATE fixed.menu_master SET menu_name = 'Payment Voucher', menu_parent = 5, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 261;
UPDATE fixed.menu_master SET menu_name = 'Contra', menu_parent = 5, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 104;
UPDATE fixed.menu_master SET menu_name = 'Journal', menu_parent = 5, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 103;
UPDATE fixed.menu_master SET menu_name = 'Credit Note', menu_parent = 5, menu_position = 80, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 102;
UPDATE fixed.menu_master SET menu_name = 'Debit Note', menu_parent = 5, menu_position = 90, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 101;
UPDATE fixed.menu_master SET menu_name = 'Sales (Accounting)', menu_parent = 5, menu_position = 100, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 259;
UPDATE fixed.menu_master SET menu_name = 'Purchase (Accounting)', menu_parent = 5, menu_position = 110, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 163;
UPDATE fixed.menu_master SET menu_name = 'Received Cheques', menu_parent = 5, menu_position = 120, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 51;
UPDATE fixed.menu_master SET menu_name = 'Issued Cheques', menu_parent = 5, menu_position = 130, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 52;
UPDATE fixed.menu_master SET menu_name = 'Cheque Books', menu_parent = 5, menu_position = 140, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 263;
UPDATE fixed.menu_master SET menu_name = 'Card / UPI Settlement', menu_parent = 5, menu_position = 150, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 278;
UPDATE fixed.menu_master SET menu_name = 'Voucher Register', menu_parent = 5, menu_position = 160, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 262;
UPDATE fixed.menu_master SET menu_name = 'Ledgers', menu_parent = 5, menu_position = 170, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 53;
UPDATE fixed.menu_master SET menu_name = 'Ledger Groups', menu_parent = 5, menu_position = 180, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 54;
UPDATE fixed.menu_master SET menu_name = 'Opening Balances', menu_parent = 5, menu_position = 190, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 55;
UPDATE fixed.menu_master SET menu_name = '&6 Reports', menu_parent = NULL, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 6;
UPDATE fixed.menu_master SET menu_name = 'Accounts Reports', menu_parent = 6, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 137;
UPDATE fixed.menu_master SET menu_name = 'Day Book by Tender', menu_parent = 137, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 284;
UPDATE fixed.menu_master SET menu_name = 'Price Change Log', menu_parent = 6, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 290;
UPDATE fixed.menu_master SET menu_name = '&7 Settings', menu_parent = NULL, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 7;
UPDATE fixed.menu_master SET menu_name = 'Company', menu_parent = 7, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 56;
UPDATE fixed.menu_master SET menu_name = 'Branches', menu_parent = 7, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 191;
UPDATE fixed.menu_master SET menu_name = 'Employees', menu_parent = 7, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 57;
UPDATE fixed.menu_master SET menu_name = 'Users & Rights', menu_parent = 7, menu_position = 40, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 58;
UPDATE fixed.menu_master SET menu_name = 'Modules', menu_parent = 7, menu_position = 50, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 59;
UPDATE fixed.menu_master SET menu_name = 'Configuration', menu_parent = 7, menu_position = 60, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 60;
UPDATE fixed.menu_master SET menu_name = 'App Settings', menu_parent = 60, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 246;
UPDATE fixed.menu_master SET menu_name = 'Price Levels', menu_parent = 60, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 174;
UPDATE fixed.menu_master SET menu_name = 'Charges', menu_parent = 60, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 245;
UPDATE fixed.menu_master SET menu_name = 'Ledger Mapping', menu_parent = 60, menu_position = 40, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 250;
UPDATE fixed.menu_master SET menu_name = 'GST Providers', menu_parent = 60, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 269;
UPDATE fixed.menu_master SET menu_name = 'GST Credentials', menu_parent = 60, menu_position = 60, menu_separator = true, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 270;
UPDATE fixed.menu_master SET menu_name = 'Print Templates', menu_parent = 60, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 62;
UPDATE fixed.menu_master SET menu_name = 'Print Assignments', menu_parent = 60, menu_position = 80, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 248;
UPDATE fixed.menu_master SET menu_name = 'App Themes', menu_parent = 60, menu_position = 90, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 266;
UPDATE fixed.menu_master SET menu_name = 'Employee Masters', menu_parent = 7, menu_position = 70, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 69;
UPDATE fixed.menu_master SET menu_name = 'Departments', menu_parent = 69, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 70;
UPDATE fixed.menu_master SET menu_name = 'Designations', menu_parent = 69, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 71;
UPDATE fixed.menu_master SET menu_name = 'System Setup', menu_parent = 7, menu_position = 80, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 159;
UPDATE fixed.menu_master SET menu_name = 'Devices', menu_parent = 159, menu_position = 10, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 239;
UPDATE fixed.menu_master SET menu_name = 'Dropdowns', menu_parent = 159, menu_position = 20, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 77;
UPDATE fixed.menu_master SET menu_name = 'Grids', menu_parent = 159, menu_position = 30, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 73;
UPDATE fixed.menu_master SET menu_name = 'UI Tables', menu_parent = 159, menu_position = 40, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 242;
UPDATE fixed.menu_master SET menu_name = 'Widgets', menu_parent = 159, menu_position = 50, menu_separator = false, menu_visiblity = true, menu_modified_on = now() WHERE menu_id = 243;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 13;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 49;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 106;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 179;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 185;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 187;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 188;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 258;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 181;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 279;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 160;
UPDATE fixed.menu_master SET menu_visiblity = false, menu_modified_on = now() WHERE menu_id = 161;
-- a user who holds a screen also holds every group above it (view), so a move hides nothing
INSERT INTO public.user_menus (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT DISTINCT um.um_user_id, anc.menu_id, true, true, um.um_user_id
  FROM public.user_menus um
  JOIN LATERAL (
    WITH RECURSIVE up(menu_id, menu_parent) AS (
      SELECT m.menu_id, m.menu_parent FROM fixed.menu_master m WHERE m.menu_id = um.um_menu_id
      UNION ALL
      SELECT p.menu_id, p.menu_parent FROM fixed.menu_master p JOIN up ON p.menu_id = up.menu_parent)
    SELECT menu_id FROM up WHERE menu_id <> um.um_menu_id) anc ON true
 WHERE um.um_is_deleted = false AND um.um_can_view
ON CONFLICT (um_user_id, um_menu_id) DO UPDATE SET um_can_view = true, um_is_deleted = false
 WHERE public.user_menus.um_can_view = false OR public.user_menus.um_is_deleted;
