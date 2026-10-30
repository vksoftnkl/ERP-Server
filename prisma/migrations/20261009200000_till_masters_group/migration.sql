-- ═══════════════════════════════════════════════════════════════════════════
--  A "Till Masters" group under Till — notes 102                 2026-10-09
--
--  The four master screens of notes 101 (20261009190000) move into their own
--  group under 271 Till (the user's call):
--
--    271  Till
--         272 Open Till · 273 Till Sessions · 274 Business Day     (as they are)
--         283 Till Masters          NEW group, 4.00, VIEW only
--             275 Till Counters     1.00
--             280 Till Safes        2.00
--             281 Till Reasons      3.00
--             282 Denominations     4.00
--         276 Till Approval Setup   5.00                           (stays here)
--
--  The group takes 271's separator and 275's visibility. The screens keep
--  their ids, verbs and rights (each is still judged on its own menu). A group
--  shows only to a user holding VIEW on it, so everyone who can view any of
--  275 / 280 / 281 / 282 gets VIEW on 283.
--
--  Id 283 is PINNED and the same rows are in prisma/seed/Menu_Master.sql (on a
--  fresh database the tree is the seed, which runs after migrations, so
--  nothing happens here while 271 is absent). An id already taken by a
--  DIFFERENT menu stops the migration. A screen a site has already moved
--  somewhere else (parent no longer 271) keeps its place.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_name text;
BEGIN
    SELECT menu_name INTO v_name FROM fixed.menu_master WHERE menu_id = 283;
    IF v_name IS NOT NULL AND v_name <> 'Till Masters' THEN
        RAISE EXCEPTION 'Till Masters group: menu id 283 is already "%". Pick a free id here and in Menu_Master.sql.', v_name;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 283, 271, 'Till Masters',
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 275), false),
       4.00, true,
       COALESCE((SELECT x.menu_separator FROM fixed.menu_master x WHERE x.menu_id = 271), false),
       '{VIEW}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 283);

UPDATE fixed.menu_master m
   SET menu_parent = 283, menu_position = v.pos, menu_modified_on = now()
  FROM (VALUES (275, 1.00), (280, 2.00), (281, 3.00), (282, 4.00)) AS v(id, pos)
 WHERE m.menu_id = v.id
   AND m.menu_parent = 271
   AND EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 283);

-- VIEW on the group for whoever can view one of its screens.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_visibility, um_created_by)
SELECT DISTINCT ON (u.um_user_id) u.um_user_id, 283, true, true, u.um_created_by
  FROM public.user_menus u
 WHERE u.um_menu_id IN (275, 280, 281, 282)
   AND u.um_is_deleted = false
   AND u.um_can_view = true
   AND EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 283)
 ORDER BY u.um_user_id, u.um_menu_id
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_position, menu_verbs
--   FROM fixed.menu_master WHERE menu_parent IN (271, 283) ORDER BY menu_parent, menu_position;
