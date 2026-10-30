-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase masters menus (plan MST-02 / MST-05) + the GRN / shortage verbs
--
--  A. GRN (196) and Shortage Receipt (195) post and cancel, and their routes
--     check those rights, but the menus never offered the verbs — so a User
--     Rights save writes POST / CANCEL as false (it did, 2026-10-28 10:04).
--  B. Supplier–Item Map, new menu 295 under Purchase Masters (26). The Agents
--     Master already has menu 28 there; it gets its screen, no new row.
--  Data only; nothing else changes. Rights are granted per user on the screen.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.menu_master
   SET menu_verbs = menu_verbs || ARRAY['POST', 'CANCEL']::text[],
       menu_modified_on = now()
 WHERE menu_id IN (195, 196)
   AND NOT ('POST' = ANY (menu_verbs));

INSERT INTO fixed.menu_master (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator, menu_verbs)
VALUES (295, 26, 'Supplier–Item Map', true, 5.00, true, false, '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}')
ON CONFLICT (menu_id) DO NOTHING;

-- keep the serial ahead of the hand-picked id
SELECT setval('fixed.menu_master_menu_id_seq', GREATEST((SELECT max(menu_id) FROM fixed.menu_master), (SELECT last_value FROM fixed.menu_master_menu_id_seq)));
