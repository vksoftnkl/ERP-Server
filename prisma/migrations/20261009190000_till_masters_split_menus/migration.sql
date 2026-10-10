-- ═══════════════════════════════════════════════════════════════════════════
--  Till Masters split into four screens, four menus — notes 101  2026-10-09
--
--  Menu 275 "Till Masters" was one screen with four tabs and one right for
--  all four masters. The client now has four list screens (the user's call),
--  and each master is judged on its own menu (TILL_MENU in till-enum.ts,
--  till-masters.controller.ts):
--
--    275  Till Counters    renamed from "Till Masters"   counters/*
--    280  Till Safes       new, 4.10                     safes/*
--    281  Till Reasons     new, 4.20                     reasons/*
--    282  Denominations    new, 4.30                     denominations/*
--                          (denominations/list: Open Till 272 VIEW, else 282 VIEW)
--
--  All four: VIEW · CREATE · EDIT · DELETE · EXPORT, under 271 Till. The new
--  rows take 275's visibility, so they show wherever Till Masters showed.
--
--  Rights: whoever held a right on 275 holds the same on 280–282, so the split
--  takes nothing away; each can then be revoked on its own. A user with a row
--  on a new menu already keeps it.
--
--  Ids are PINNED and the same rows are in prisma/seed/Menu_Master.sql: the
--  client resolves screens by id (form_sales_menu.h) and user_menus stores
--  rights by id, and on a fresh database the tree is a seed that runs after
--  migrations (so nothing is inserted here while 271 is absent). An id
--  already taken by a DIFFERENT menu stops the migration. A site that
--  re-labelled 275 keeps its label.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('%s (%s)', m.menu_id, m.menu_name), ', ' ORDER BY m.menu_id)
      INTO v_clash
      FROM fixed.menu_master m
      JOIN (VALUES (280, 'Till Safes'), (281, 'Till Reasons'), (282, 'Denominations'))
           AS v(id, name) ON v.id = m.menu_id
     WHERE m.menu_name <> v.name;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Till master menus: id(s) already taken by another menu: %. Pick free ids here, in Menu_Master.sql and in TILL_MENU (till-enum.ts).', v_clash;
    END IF;
END $$;

UPDATE fixed.menu_master
   SET menu_name = 'Till Counters', menu_modified_on = now()
 WHERE menu_id = 275 AND menu_name = 'Till Masters';

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT v.id, 271, v.name,
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 275), false),
       v.pos, true, false, '{VIEW,CREATE,EDIT,DELETE,EXPORT}'::text[], now(), now()
  FROM (VALUES (280, 'Till Safes',    4.10),
               (281, 'Till Reasons',  4.20),
               (282, 'Denominations', 4.30)) AS v(id, name, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = v.id)
 ORDER BY v.id;

-- 275's grants, copied onto each new menu.
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
  JOIN fixed.menu_master n ON n.menu_id IN (280, 281, 282)
 WHERE u.um_menu_id = 275
   AND u.um_is_deleted = false
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 282 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_name, menu_position, menu_visiblity, menu_verbs
--   FROM fixed.menu_master WHERE menu_parent = 271 ORDER BY menu_position;
