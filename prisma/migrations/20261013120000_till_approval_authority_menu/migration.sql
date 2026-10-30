-- ═══════════════════════════════════════════════════════════════════════════
--  Till Approval Authority gets its own menu — notes 111  2026-10-13
--
--  Menu 276 "Till Approval Setup" was one screen with two tabs: the rules
--  (WHEN an approval is needed) and the authority (WHO may give it). The
--  client now has two list screens (the user's call), and each family is
--  judged on its own menu (TILL_MENU in till-enum.ts,
--  till-masters.controller.ts):
--
--    276  Till Approval Rules      renamed from "Till Approval Setup"   approval-rules/*
--    285  Till Approval Authority  new, 5.10, under 271 Till            approval-authorities/*
--
--  285: VIEW · CREATE · EDIT · DELETE · EXPORT. It takes 276's visibility, so
--  it shows wherever Approval Setup showed.
--
--  Rights: whoever held a right on 276 holds the same on 285, so the split
--  takes nothing away; handing out approval powers can then be revoked on its
--  own. A user with a row on 285 already keeps it.
--
--  The id is PINNED and the same rows are in prisma/seed/Menu_Master.sql: the
--  client resolves screens by id (form_sales_menu.h) and user_menus stores
--  rights by id, and on a fresh database the tree is a seed that runs after
--  migrations (so nothing is inserted here while 271 is absent). 285 already
--  taken by a DIFFERENT menu stops the migration. A site that re-labelled 276
--  keeps its label.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 285
       AND m.menu_name <> 'Till Approval Authority';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Till Approval Authority menu: id already taken by another menu: %. Pick a free id here, in Menu_Master.sql and in TILL_MENU (till-enum.ts).', v_clash;
    END IF;
END $$;

UPDATE fixed.menu_master
   SET menu_name = 'Till Approval Rules', menu_modified_on = now()
 WHERE menu_id = 276 AND menu_name = 'Till Approval Setup';

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 285, 271, 'Till Approval Authority',
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 276), false),
       5.10, true, false, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 285);

-- 276's grants, copied onto 285.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, n.menu_id, u.um_can_view, u.um_can_create, u.um_can_edit, u.um_can_delete,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       u.um_sort_order, false, u.um_created_by, u.um_can_post, u.um_can_cancel,
       u.um_can_amend, u.um_can_override, u.um_can_retender
  FROM public.user_menus u
  JOIN fixed.menu_master n ON n.menu_id = 285
 WHERE u.um_menu_id = 276
   AND u.um_is_deleted = false
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 285 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_name, menu_position, menu_visiblity, menu_verbs
--   FROM fixed.menu_master WHERE menu_parent = 271 ORDER BY menu_position;
