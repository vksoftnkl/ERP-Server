-- ═══════════════════════════════════════════════════════════════════════════
--  Account Day Summary — the menu its routes are judged on        2026-10-12
--
--  reports/day-summary (plan Prathap/report/plan-backend-account-day-summary.md
--  §10). The report writes nothing and needs no table, column, function or
--  index (D6: it drives from the legs, ix_av_daybook, and joins headers by pk);
--  this file only adds the menu every /reports/day-summary/* route checks in
--  public.user_menus (um_can_view).
--
--    284  Account Day Summary   under 137 Financial Statements, at 0.60 —
--                               just after 258 Ledger Statement. Visible.
--                               VIEW · PRINT · EXPORT (a read-only report).
--
--  181 "Day Book Detail" (hidden) is NOT changed: it opens the same screen on
--  the Vouchers tab, and the routes accept view on 284 OR 181 (D8) — the
--  Ledger Statement's 258 / 144 pattern.
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
    SELECT menu_name INTO v_name FROM fixed.menu_master WHERE menu_id = 284;
    IF v_name IS NOT NULL AND v_name <> 'Account Day Summary' THEN
        RAISE EXCEPTION 'Account Day Summary: menu id 284 is already "%". Pick a free id in this migration, in Menu_Master.sql and in day-summary.service.ts.', v_name;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 284, 137, 'Account Day Summary', true, 0.60, true, false, '{VIEW,PRINT,EXPORT}'::text[],
       now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 137)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 284);

-- The sequence never hands out the pinned id: GREATEST, so a box whose sequence
-- already ran past 284 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));
