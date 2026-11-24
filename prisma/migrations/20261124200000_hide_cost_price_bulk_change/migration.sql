-- Hide Cost Price – Bulk Change (menu 298) for everyone (user 2026-11-24).
--
-- Change Selling Price (menu 30) now does bulk cost changes: Filter · F3 picks the items, the Cost
-- cell takes 250 / +20 / -20 / +5% / -5% / =, Change cost · Ctrl+Shift+R moves every / selected /
-- this item's cost by % or Rs, and the prices follow each unit's rule — one cost per unit chain.
-- Keeping both screens meant two ways to the same job with slightly different rules.
--
-- HIDDEN, not removed: the screen, its rights (user_menus) and every price it wrote stay. The client
-- drops a menu whose menu_visiblity is false (menu_window.cpp). Bring it back with
-- menu_visiblity = true. menu_is_active is not touched. Safe to run twice; a fresh database gets the
-- same from the seed (prisma/seed/Menu_Master.sql row 298).
UPDATE fixed.menu_master
   SET menu_visiblity = false
 WHERE menu_id = 298
   AND menu_visiblity IS DISTINCT FROM false;
