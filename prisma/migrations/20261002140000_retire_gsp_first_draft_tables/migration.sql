-- ═══════════════════════════════════════════════════════════════════════════
--  Retire the first-draft GSP tables. 2026-10-02.
--
--  fixed.gsp_provider_master and fixed.gsp_company_service were replaced by
--  the public.gst_* family (20260921120000), whose footer left this drop to be
--  run by hand. It runs here instead, on purpose: the GSP Provider Master and
--  GSP Company Service modules are removed in the same change, and GSTIN
--  lookup now takes its endpoint and ASP id/password from env
--  (GST_LOOKUP_ENDPOINT, GST_LOOKUP_ASP_ID, GST_LOOKUP_ASP_PASSWORD) — nothing
--  reads either table any more. The rows they held (2 providers, 1 company
--  mapping, sandbox credentials) are dropped with them.
--
--  The screen goes first: grid 27 was the company-service list, SELECTing from
--  the old table, and menu 241 was its form. Removed the way 20260930130000
--  removed grid 5 — guarded on the name, columns first — and dropped from
--  prisma/seed/Menu_Master.sql, Form_Section.sql, Form_Field.sql,
--  Grid_Details.sql and Grid_Columns.sql in the same change, so a fresh
--  database does not seed it back. user_menus refuses a menu delete
--  (ON DELETE RESTRICT), so those rights go before the menu; form_section 20
--  and its form_field rows cascade.
--
--  audit.audit_screen 'GSP Provider Master' / 'GSP Company Service' and their
--  audit_log rows stay: they are history, and the screen SQL is only parsed
--  for field labels, never run against the table.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM fixed.grid_columns c
 USING fixed.grid_details g
 WHERE c.grid_id = g.grid_id
   AND g.grid_id = 27
   AND g.grid_name = 'gsp company service';

DELETE FROM fixed.grid_details
 WHERE grid_id = 27
   AND grid_name = 'gsp company service';

DELETE FROM public.user_menus um
 USING fixed.menu_master m
 WHERE um.um_menu_id = m.menu_id
   AND m.menu_id = 241
   AND m.menu_name = 'gsp company service';

DELETE FROM fixed.menu_master
 WHERE menu_id = 241
   AND menu_name = 'gsp company service';

DROP TABLE IF EXISTS fixed.gsp_company_service;
DROP TABLE IF EXISTS fixed.gsp_provider_master;
