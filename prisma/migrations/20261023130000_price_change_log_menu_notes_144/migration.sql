-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 144 — menu 290 "Price Change Log"                      2026-10-23
--
--  The Qt Price Change Log report reads /item-price-log/list | get | days |
--  item-history | gaps (src/modules/Inventory/item-price-log). Who may see it
--  was left open by notes 144, so the plan's default stands: a normal menu
--  right, VIEW on this menu. This file only adds the menu:
--
--    290  Price Change Log   under 6 Reports, at 1.50 — just after 106 Audit
--                            Logs. VIEW · PRINT · EXPORT (a read-only report).
--
--  No user is granted it here; rights are given in User Administration.
--
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql (the
--  client resolves screens by id, user_menus stores rights by id, and
--  PRICE_MENU_ID.PRICE_CHANGE_LOG names it); on a fresh database the tree is a
--  seed that runs after migrations, so nothing is inserted here while 6 is
--  absent. 290 taken by another menu stops this.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 290
       AND m.menu_name <> 'Price Change Log';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Price Change Log menu: id already taken by another menu: %. Pick a free id here, in Menu_Master.sql and in PRICE_MENU_ID (price-change-log.types.ts).', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 290, 6, 'Price Change Log', true, 1.50, true, false, '{VIEW,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 6)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 290);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id = 290;
