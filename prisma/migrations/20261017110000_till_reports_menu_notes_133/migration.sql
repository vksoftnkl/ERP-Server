-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 133 — menu 288 "Till Reports"                          2026-10-17
--
--  The Qt Till Reports screen (four read-only tabs: cashier variance,
--  exceptions, approver activity, safe book) reads registered grids only —
--  157, 159-169 and the pickers 133 / 136, dropdown 61 — so no route and no
--  table is added. This file only adds the menu it is opened and granted on:
--
--    288  Till Reports   under 271 Till, at 2.50 — just after 273 Till
--                        Sessions. VIEW · PRINT · EXPORT (a read-only report).
--
--  Visible exactly when Till Sessions (273) is, like 287: the till tree is
--  hidden on a site that has not rolled it out. No user is granted it here;
--  rights are given in User Administration.
--
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql (the
--  client resolves screens by id, user_menus stores rights by id); on a fresh
--  database the tree is a seed that runs after migrations, so nothing is
--  inserted here while 271 is absent. 288 taken by another menu stops this.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 288
       AND m.menu_name <> 'Till Reports';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Till Reports menu: id already taken by another menu: %. Pick a free id here, in Menu_Master.sql and in TILL_MENU (till-enum.ts).', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 288, 271, 'Till Reports',
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 273), false),
       2.50, true, false, '{VIEW,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 288);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id = 288;
