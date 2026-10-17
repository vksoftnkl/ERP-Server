-- ═══════════════════════════════════════════════════════════════════════════
--  Party-wise Outstanding — the menu its routes are judged on     2026-10-09
--
--  reports/party-outstanding (plan Prathap/report/plan-backend-party-outstanding.md
--  §10). The report writes nothing and needs no table, column, function or
--  index (§7.1: the existing ix_abl_open / ix_abj_bill / ix_abl_parent carry it);
--  this file only adds the menu every /reports/party-outstanding/* route checks
--  in public.user_menus (um_can_view).
--
--    279  Party-wise Outstanding   under 137 Financial Statements, at 0.60 —
--                                  just after 258 Ledger Statement. Visible.
--                                  VIEW · PRINT · EXPORT (a read-only report).
--
--  ONE menu with the Side combo (decision O5): Receivable and Payable are the
--  same right. 3.0 had two (97 Customer Outstandings, 112 Supplier
--  Outstandings); split only if a role must see one side and not the other.
--
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql: the
--  client resolves screens by id and user_menus stores rights by id, and on a
--  fresh database the tree is a seed that runs after migrations (so nothing is
--  inserted here while 137 is absent). An id already taken by a DIFFERENT menu
--  stops the migration.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_name text;
BEGIN
    SELECT menu_name INTO v_name FROM fixed.menu_master WHERE menu_id = 279;
    IF v_name IS NOT NULL AND v_name <> 'Party-wise Outstanding' THEN
        RAISE EXCEPTION 'Party-wise Outstanding: menu id 279 is already "%". Pick a free id in this migration, in Menu_Master.sql and in party-outstanding.service.ts.', v_name;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 279, 137, 'Party-wise Outstanding', true, 0.60, true, false, '{VIEW,PRINT,EXPORT}'::text[],
       now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 137)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 279);

-- The sequence never hands out the pinned id: GREATEST, so a box whose sequence
-- already ran past 279 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));
