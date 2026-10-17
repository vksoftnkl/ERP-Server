-- ═══════════════════════════════════════════════════════════════════════════
--  46 — The two GSP master menus (notes 79)                         2026-10-02
--
--  The 46_gst_menus.sql file of the share, made a migration so the live box
--  gets it through deploy.sh (which runs migrations and never seeds), the way
--  20260930190000 shipped App Themes. Idempotent: each insert is guarded by
--  (parent, name), so a database that already ran the file gains nothing.
--
--  Two rows under Configuration (60), after App Themes (8.20), HIDDEN until the
--  Qt screens ship (flip menu_visiblity then — that is the only change):
--    8.30  GST Providers    gst_provider + services / endpoints / field map /
--                           error map + the GSP's own accounts
--                           VIEW CREATE EDIT DELETE EXPORT
--    8.40  GST Credentials  gst_company_credential, per company / branch ×
--                           service × environment
--                           VIEW CREATE EDIT DELETE EXPORT POST
--                           POST = Verify: it signs in to an outside system,
--                           so it is a right of its own, not part of EDIT.
--
--  src/modules/gst finds both by (parent 60, name), never by id: the ids come
--  from the sequence (267 / 268 on the dry run, NOT the 255 / 256 that
--  plan-qt-gsp.md §0 reserved — notes 79 §5). The final SELECT of the share
--  file prints them; here they are whatever the sequence gives.
--
--  Differences from the file, both additive:
--    * the sequence is caught up with max(menu_id) first — a box seeded with
--      pinned ids and a sequence behind them would collide (P3009);
--    * nothing is inserted while menu 60 is absent: on a fresh database (and
--      the shadow replay) the menu tree is seeded AFTER migrations, so the
--      parent does not exist yet and the self-FK would abort the replay.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

INSERT INTO fixed.menu_master
       (menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator,
        menu_verbs, menu_created_on, menu_modified_on)
SELECT 60, 'GST Providers', false, 8.30, true, false,
       '{VIEW,CREATE,EDIT,DELETE,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 60)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master
                    WHERE menu_parent = 60 AND menu_name = 'GST Providers');

INSERT INTO fixed.menu_master
       (menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator,
        menu_verbs, menu_created_on, menu_modified_on)
SELECT 60, 'GST Credentials', false, 8.40, true, false,
       '{VIEW,CREATE,EDIT,DELETE,EXPORT,POST}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 60)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master
                    WHERE menu_parent = 60 AND menu_name = 'GST Credentials');
