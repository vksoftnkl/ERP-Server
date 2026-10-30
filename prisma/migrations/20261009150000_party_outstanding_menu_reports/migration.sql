-- ═══════════════════════════════════════════════════════════════════════════
--  Party Outstanding — straight under Reports                    2026-10-09
--
--  20261009100000_party_outstanding_menu put menu 279 "Party-wise Outstanding"
--  under 137 Financial Statements. The user wants it as "Party Outstanding"
--  directly under 6 Reports, after Financial Statements (7.00). Same id, so
--  every grant in public.user_menus and the service's menu check
--  (PARTY_OUTSTANDING_MENU_ID = 279) stay as they are.
--
--  Moved only while the row is still the one that migration made: a site that
--  has since re-labelled or re-parented 279 keeps its own choice. On a fresh
--  database the tree is the seed (prisma/seed/Menu_Master.sql, which already
--  has 279 under 6), so nothing matches here and this is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.menu_master
   SET menu_parent      = 6,
       menu_name        = 'Party Outstanding',
       menu_position    = 7.50,
       menu_modified_on = now()
 WHERE menu_id = 279
   AND menu_parent = 137
   AND menu_name = 'Party-wise Outstanding'
   AND EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 6);
