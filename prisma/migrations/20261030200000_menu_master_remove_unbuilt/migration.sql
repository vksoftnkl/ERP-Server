-- Menu Master: only what the code opens (user, 2026-10-30: "remove unused all menu and
-- transport, attendance the whole module i need just simple what we have in our code").
--
-- KEPT = every menu the Qt desktop opens (FormManager registrations, probed from the app,
-- plus 174 Price Level) or the React web client routes (MENU_ROUTES hrefs), the folders
-- above them, and 144 Ledger Monthly Summary: hidden, but ledger-statement grants the
-- statement on view of 258 OR 144, and two users hold only 144.
-- REMOVED = the 137 below, no screen in either client: Sales 46, Purchase 8, Inventory 11, Stock 13, Accounts 6, Reports 16, Settings 15, Transport 9, Attendance 13.
-- Transport (8) and Attendance (9) go whole. 152 e-Invoice / 153 e-Way Bill go too: the sale
-- bill's Shift+F2 / Shift+F3 only say "not built yet" in both clients. 286 is the retired
-- first Cash Office (no route reads it; 287 is the live one).
--
-- Adding one back later: share admin/menu-cleanup-20261030/readd-menus.sql holds every row
-- as it was on dev (parents first) and the db_table_master links, one block per menu, ready
-- for a new migration; then grant it in Users & Rights.
--
-- Safe on any box (P3009, the live VPS is seeded apart from dev): it never RAISEs.
--   * A menu goes only when its id AND its name match (case, '&' and spaces ignored); any
--     other row with that id is left alone and named in a NOTICE.
--   * Leaves first, then the folders they emptied. A folder that still has a child that stays
--     (one this list does not name, or one left alone above) stays too, with a NOTICE, so
--     nothing is ever orphaned (menu_parent would SET NULL).
--   * public.user_menus (ON DELETE RESTRICT) loses the grants of those menus first.
--   * A menu an accounts.acc_voucher_types row points at (ON DELETE RESTRICT) stays (NOTICE).
--   * fixed.form_section rows of a removed menu cascade (none on dev); db_table_master links
--     SET NULL (8 on dev, listed in the share file).
-- No sync calls (the sync triggers on dev fire by themselves; the VPS has none). Re-running
-- it finds nothing to do.

DO $mig$
DECLARE
    v_ok       int[];
    v_batch    int[];
    v_menus    int := 0;
    v_rights   int := 0;
    v_n        int;
    v_skipped  text;
BEGIN
    DROP TABLE IF EXISTS pg_temp._menu_rm;
    CREATE TEMP TABLE _menu_rm (id int PRIMARY KEY, name text NOT NULL) ON COMMIT DROP;
    INSERT INTO _menu_rm (id, name) VALUES
        -- Sales
        (202, 'Agents'),  -- Sales > Agents
        (204, 'Agent Groups Master'),  -- Sales > Agents > Agent Groups Master
        (203, 'Agents Master'),  -- Sales > Agents > Agents Master
        (205, 'Loyalty Program'),  -- Sales > Agents > Loyalty Program
        (207, 'Loyalty Redemption'),  -- Sales > Agents > Loyalty Redemption
        (206, 'Loyalty Status'),  -- Sales > Agents > Loyalty Status
        (212, 'Loyalty Transaction'),  -- Sales > Agents > Loyalty Transaction
        (151, 'Bill Verification'),  -- Sales > Bill Verification
        (131, 'Cashier Screen'),  -- Sales > Cashier Screen
        (142, 'Contract'),  -- Sales > Contract
        (110, 'Customer Reminders'),  -- Sales > Customer Reminders
        (218, 'Data Import'),  -- Sales > Data Import
        (219, 'Import Customers'),  -- Sales > Data Import > Import Customers
        (220, 'Import Invoices'),  -- Sales > Data Import > Import Invoices
        (147, 'Dispatch - Pending Bills'),  -- Sales > Dispatch - Pending Bills
        (141, 'Dispatch Detail'),  -- Sales > Dispatch Detail
        (80, 'Loyalty Redemption'),  -- Sales > Loyalty > Loyalty Redemption
        (235, 'Loyalty Redemption (Item)'),  -- Sales > Loyalty > Loyalty Redemption (Item)
        (236, 'Loyalty Redemption Report (Item-wise)'),  -- Sales > Loyalty > Loyalty Redemption Report (Item-wise)
        (111, 'Mobile Orders'),  -- Sales > Mobile Orders
        (189, 'Optical Prescription'),  -- Sales > Optical Prescription
        (16, 'Order - Invoice'),  -- Sales > Order - Invoice
        (15, 'Pick List'),  -- Sales > Pick List
        (148, 'Pick List - Sales Order'),  -- Sales > Pick List - Sales Order
        (105, 'SO Check Sheet'),  -- Sales > SO Check Sheet
        (172, 'SO Management'),  -- Sales > SO Management
        (229, 'Sale Entry (Bulk)'),  -- Sales > Sale Entry (Bulk)
        (233, 'Sales Bill - Loadman'),  -- Sales > Sales Bill - Loadman
        (162, 'Agent Master'),  -- Sales > Sales Masters > Agent Master
        (228, 'Customer Discount Master'),  -- Sales > Sales Masters > Customer Discount Master
        (129, 'Sales Categories'),  -- Sales > Sales Masters > Sales Categories
        (119, 'Special Discount Customers'),  -- Sales > Sales Masters > Special Discount Customers
        (125, 'Vehicle Master'),  -- Sales > Sales Masters > Vehicle Master
        (13, 'Sales Return'),  -- Sales > Sales Return
        (120, 'Salesman Notices'),  -- Sales > Salesman Notices
        (81, 'Salesman Schemes'),  -- Sales > Salesman Schemes
        (82, 'Salesman Target Schemes'),  -- Sales > Salesman Schemes > Salesman Target Schemes
        (83, 'Salesman Target Status'),  -- Sales > Salesman Schemes > Salesman Target Status
        (198, 'Session Control'),  -- Sales > Session Control
        (201, 'Session Close '),  -- Sales > Session Control > Session Close
        (199, 'Session Management'),  -- Sales > Session Control > Session Management
        (200, 'Session Tender Details'),  -- Sales > Session Control > Session Tender Details
        (122, 'Third Party Bills'),  -- Sales > Third Party Bills
        (286, 'Cash Office'),  -- Sales > Till > Cash Office
        (152, 'e-Invoice'),  -- Sales > e-Invoice
        (153, 'e-Way Bill'),  -- Sales > e-Way Bill
        -- Purchase
        (208, 'Procurement'),  -- Purchase > Procurement
        (209, 'Center Master'),  -- Purchase > Procurement > Center Master
        (210, 'Farmer Master'),  -- Purchase > Procurement > Farmer Master
        (215, 'Proc Bank Payment'),  -- Purchase > Procurement > Proc Bank Payment
        (211, 'Proc Entry'),  -- Purchase > Procurement > Proc Entry
        (214, 'Proc Payment'),  -- Purchase > Procurement > Proc Payment
        (213, 'Rate Chart'),  -- Purchase > Procurement > Rate Chart
        (149, 'Transporters'),  -- Purchase > Purchase Masters > Transporters
        -- Inventory
        (178, 'Allow to Change Master Price'),  -- Inventory > Allow to Change Master Price
        (31, 'Change Selling (Purchase)'),  -- Inventory > Change Selling (Purchase)
        (176, 'Cost Price - Bulk Change'),  -- Inventory > Cost Price - Bulk Change
        (238, 'Custom Sticker'),  -- Inventory > Custom Sticker
        (115, 'Item Group wise Discount'),  -- Inventory > Item Group wise Discount
        (33, 'Product Kits'),  -- Inventory > Product Kits
        (164, 'Reorder'),  -- Inventory > Reorder
        (216, 'Reorder - Advanced'),  -- Inventory > Reorder > Reorder - Advanced
        (217, 'Reorder - Bulk Update'),  -- Inventory > Reorder > Reorder - Bulk Update
        (46, 'Reorder - Quick'),  -- Inventory > Reorder > Reorder - Quick
        (32, 'Sticker Printing'),  -- Inventory > Sticker Printing
        -- Stock
        (170, 'Gate Inward Entry'),  -- Stock > Gate Inward Entry
        (171, 'Gate Inward Pending'),  -- Stock > Gate Inward Pending
        (173, 'Gate Outward Entry'),  -- Stock > Gate Outward Entry
        (237, 'Godown - Stock Dispatch'),  -- Stock > Godown - Stock Dispatch
        (222, 'Meat Shop'),  -- Stock > Meat Shop
        (223, 'Daily Avg.Weigh Loss'),  -- Stock > Meat Shop > Daily Avg.Weigh Loss
        (225, 'Meat Inward'),  -- Stock > Meat Shop > Meat Inward
        (224, 'Shop Inward'),  -- Stock > Meat Shop > Shop Inward
        (197, 'Own Consumption'),  -- Stock > Own Consumption
        (43, 'Production'),  -- Stock > Production
        (42, 'Split Stock'),  -- Stock > Split Stock
        (145, 'Stock Exchange'),  -- Stock > Stock Exchange
        (107, 'Stock Transfer (Third Party)'),  -- Stock > Stock Transfer (Third Party)
        -- Accounts
        (49, 'Bill wise Payment (old)'),  -- Accounts > Bill wise Payment (old)
        (48, 'Bill wise Receipt (old)'),  -- Accounts > Bill wise Receipt (old)
        (179, 'Claim Management'),  -- Accounts > Claim Management
        (188, 'Collection Approval'),  -- Accounts > Collection Approval
        (187, 'Collection Entry'),  -- Accounts > Collection Entry
        (185, 'Third Party Bills'),  -- Accounts > Third Party Bills
        -- Reports
        (143, 'Account Group Summary'),  -- Reports > Accounts Reports > Account Group Summary
        (139, 'Balance Sheet'),  -- Reports > Accounts Reports > Balance Sheet
        (140, 'Profit && Loss'),  -- Reports > Accounts Reports > Profit & Loss
        (154, 'Profit && Loss (w/o Stock)'),  -- Reports > Accounts Reports > Profit & Loss (w/o Stock)
        (138, 'Trial Balance'),  -- Reports > Accounts Reports > Trial Balance
        (183, 'Addl Reports'),  -- Reports > Addl Reports
        (194, 'Customer Statement'),  -- Reports > Addl Reports > Customer Statement
        (186, 'Daily Sales'),  -- Reports > Addl Reports > Daily Sales
        (232, 'Dash Board'),  -- Reports > Addl Reports > Dash Board
        (184, 'Monthwise Stock Balance'),  -- Reports > Addl Reports > Monthwise Stock Balance
        (234, 'Tender wise Collection'),  -- Reports > Addl Reports > Tender wise Collection
        (74, 'Sales Reports'),  -- Reports > Sales Reports
        (76, 'Sales Bills'),  -- Reports > Sales Reports > Sales Bills
        (156, 'Statutory Reports'),  -- Reports > Statutory Reports
        (158, 'TCS Bill wise Report'),  -- Reports > Statutory Reports > TCS Bill wise Report
        (157, 'TCS Party wise Report'),  -- Reports > Statutory Reports > TCS Party wise Report
        -- Settings
        (113, 'Bank Details'),  -- Settings > Bank Details
        (114, 'Change Password'),  -- Settings > Change Password
        (63, 'Barcode Configuration'),  -- Settings > Configuration > Barcode Configuration
        (180, 'Bug Information'),  -- Settings > Configuration > Bug Information
        (61, 'SMS Configuration'),  -- Settings > Configuration > SMS Configuration
        (78, 'Software Configuration'),  -- Settings > Configuration > Software Configuration
        (190, 'Software License'),  -- Settings > Configuration > Software License
        (227, 'What''s App Configuration'),  -- Settings > Configuration > What's App Configuration
        (150, 'Contact Book'),  -- Settings > Employee Masters > Contact Book
        (72, 'Item User Fields'),  -- Settings > Employee Masters > Item User Fields
        (175, 'Export to Tally'),  -- Settings > Export to Tally
        (64, 'Financial Year'),  -- Settings > Financial Year
        (165, 'Letter Pad'),  -- Settings > Letter Pad
        (231, 'Print Settings'),  -- Settings > Print Settings
        (65, 'Reset Sequence'),  -- Settings > Reset Sequence
        -- Transport — the whole module
        (8, '&8 Transport'),  -- Transport
        (132, 'Fuel Log'),  -- Transport > Fuel Log
        (127, 'Header Types'),  -- Transport > Header Types
        (136, 'Reports'),  -- Transport > Reports
        (133, 'Service Log'),  -- Transport > Service Log
        (135, 'Service Reminders'),  -- Transport > Service Reminders
        (126, 'Tripsheet'),  -- Transport > Tripsheet
        (134, 'Tyre Maintenance'),  -- Transport > Tyre Maintenance
        (128, 'Vehicle Renewals'),  -- Transport > Vehicle Renewals
        -- Attendance — the whole module
        (9, '&9 Attendance'),  -- Attendance
        (90, 'Holiday Entry'),  -- Attendance > Holiday Entry
        (84, 'Leave Entry'),  -- Attendance > Leave Entry
        (85, 'Master'),  -- Attendance > Master
        (87, 'Attendance Constraint'),  -- Attendance > Master > Attendance Constraint
        (88, 'Devices'),  -- Attendance > Master > Devices
        (86, 'Employee Shift'),  -- Attendance > Master > Employee Shift
        (89, 'Permission Entry'),  -- Attendance > Permission Entry
        (92, 'Reports'),  -- Attendance > Reports
        (93, 'Daily Attendance'),  -- Attendance > Reports > Daily Attendance
        (94, 'Monthly Attendance'),  -- Attendance > Reports > Monthly Attendance
        (108, 'Monthly Statement'),  -- Attendance > Reports > Monthly Statement
        (91, 'Weekly Offs')   -- Attendance > Weekly Offs
    ;

    SELECT string_agg(r.id || ' ' || r.name || ' (here: ' || coalesce(m.menu_name, 'no such id') || ')', '; ' ORDER BY r.id)
      INTO v_skipped
      FROM _menu_rm r
      LEFT JOIN fixed.menu_master m ON m.menu_id = r.id
     WHERE m.menu_id IS NOT NULL
       AND lower(regexp_replace(replace(m.menu_name, '&', ''), '\s+', '', 'g'))
        <> lower(regexp_replace(replace(r.name,      '&', ''), '\s+', '', 'g'));
    IF v_skipped IS NOT NULL THEN
        RAISE NOTICE 'menu cleanup: left alone, the name differs here: %', v_skipped;
    END IF;

    SELECT array_agg(m.menu_id)
      INTO v_ok
      FROM _menu_rm r
      JOIN fixed.menu_master m
        ON m.menu_id = r.id
       AND lower(regexp_replace(replace(m.menu_name, '&', ''), '\s+', '', 'g'))
         = lower(regexp_replace(replace(r.name,      '&', ''), '\s+', '', 'g'))
     WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_menu_id = m.menu_id);

    SELECT string_agg(DISTINCT t.vchr_menu_id::text, ', ')
      INTO v_skipped
      FROM accounts.acc_voucher_types t
     WHERE t.vchr_menu_id IN (SELECT id FROM _menu_rm);
    IF v_skipped IS NOT NULL THEN
        RAISE NOTICE 'menu cleanup: kept, a voucher type points at it: %', v_skipped;
    END IF;

    -- Leaves first; each pass removes the folders the last one emptied.
    LOOP
        SELECT array_agg(m.menu_id)
          INTO v_batch
          FROM fixed.menu_master m
         WHERE m.menu_id = ANY (v_ok)
           AND NOT EXISTS (SELECT 1 FROM fixed.menu_master c WHERE c.menu_parent = m.menu_id);
        EXIT WHEN v_batch IS NULL;

        DELETE FROM public.user_menus WHERE um_menu_id = ANY (v_batch);
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_rights := v_rights + v_n;

        DELETE FROM fixed.menu_master WHERE menu_id = ANY (v_batch);
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_menus := v_menus + v_n;
    END LOOP;

    SELECT string_agg(m.menu_id || ' ' || m.menu_name, '; ' ORDER BY m.menu_id)
      INTO v_skipped
      FROM fixed.menu_master m
     WHERE m.menu_id = ANY (v_ok);
    IF v_skipped IS NOT NULL THEN
        RAISE NOTICE 'menu cleanup: kept, a menu that stays still sits under it: %', v_skipped;
    END IF;

    RAISE NOTICE 'menu cleanup: % menus removed, % user rights rows with them', v_menus, v_rights;
END
$mig$;
