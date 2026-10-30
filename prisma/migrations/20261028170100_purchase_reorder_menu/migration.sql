-- ═══════════════════════════════════════════════════════════════════════════
--  Menu 296 "Reorder → PO" under Purchase (2) — plan DOC-02 (WS3, 2026-10-28).
--  Data only. Rights are granted per user on the User Rights screen — nobody
--  gets it here. The screen's routes check the Purchase Order rights (menu 23).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.menu_master (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator, menu_verbs)
VALUES (296, 2, 'Reorder → PO', true, 2.50, true, false, '{VIEW,CREATE,EXPORT}')
ON CONFLICT (menu_id) DO NOTHING;

-- keep the serial ahead of the hand-picked id
SELECT setval('fixed.menu_master_menu_id_seq', GREATEST((SELECT max(menu_id) FROM fixed.menu_master), (SELECT last_value FROM fixed.menu_master_menu_id_seq)));
