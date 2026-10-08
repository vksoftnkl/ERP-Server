-- ═══════════════════════════════════════════════════════════════════════════
--  Till menus — the rights the /till/* routes are judged on       2026-10-08
--
--  TILL_DESIGN.md REV 1, build phase 1 (src/modules/till). 47 created the
--  tables; nothing created a menu, and every till route is judged on a
--  public.user_menus flag (the receipt / payment rule: no SUPER ADMIN bypass).
--
--    271  Till                 the group, under &1 Sales (1), after Cashier Screen
--    272  Open Till            the CASHIER's own session
--                              VIEW   current / get my session
--                              CREATE open a session ("may open a till", 47 §1.3)
--                              EDIT   suspend · resume · end billing · count · close
--                              PRINT  X read (phase 4)
--    273  Till Sessions        a SUPERVISOR's view of every session of the branch
--                              VIEW   get any session · EXPORT the list
--                              OVERRIDE  the expected figures a blind close hides
--                                     (§5.4 — until the approval authority grid of
--                                     phase 3 decides who is a supervisor)
--                              PRINT  Z reprint (phase 4)
--    274  Business Day         VIEW get · CREATE Day Open (till.day_auto_open=false)
--    275  Till Masters         counters · safes · reasons · denominations
--    276  Till Approval Setup  approval rules · approval authority (who may approve
--                              what, up to how much — granted apart from the rest)
--
--  HIDDEN until the client screens ship (flip menu_visiblity then), the way
--  20261002150000 shipped the GST menus. Rights work on a hidden menu.
--
--  Ids are PINNED and the same rows are in prisma/seed/Menu_Master.sql: the
--  client resolves screens by id and user_menus stores rights by id, and on a
--  fresh database the tree is a seed that runs after migrations (so nothing is
--  inserted here while menu 1 is absent). An id already taken by a DIFFERENT
--  menu stops the migration — granting "Open Till" onto somebody else's screen
--  would be worse than a failed deploy.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('%s (%s)', m.menu_id, m.menu_name), ', ' ORDER BY m.menu_id)
      INTO v_clash
      FROM fixed.menu_master m
      JOIN (VALUES (271, 'Till'), (272, 'Open Till'), (273, 'Till Sessions'),
                   (274, 'Business Day'), (275, 'Till Masters'), (276, 'Till Approval Setup'))
           AS v(id, name) ON v.id = m.menu_id
     WHERE m.menu_name <> v.name;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Till menus: id(s) already taken by another menu: %. Pick free ids in this migration and in Menu_Master.sql.', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT v.id, v.parent, v.name, false, v.pos, true, v.sep, v.verbs::text[], now(), now()
  FROM (VALUES
        (271,   1, 'Till',                18.10, true,  '{VIEW}'),
        (272, 271, 'Open Till',            1.00, false, '{VIEW,CREATE,EDIT,PRINT}'),
        (273, 271, 'Till Sessions',        2.00, false, '{VIEW,PRINT,EXPORT,OVERRIDE}'),
        (274, 271, 'Business Day',         3.00, false, '{VIEW,CREATE}'),
        (275, 271, 'Till Masters',         4.00, true,  '{VIEW,CREATE,EDIT,DELETE,EXPORT}'),
        (276, 271, 'Till Approval Setup',  5.00, false, '{VIEW,CREATE,EDIT,DELETE,EXPORT}')
       ) AS v(id, parent, name, pos, sep, verbs)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 1)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = v.id)
 ORDER BY v.id;   -- parent first for reading; the self-FK is checked at statement end anyway

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 276 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));
