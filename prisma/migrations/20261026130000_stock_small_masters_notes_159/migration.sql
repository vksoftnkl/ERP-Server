-- ═══════════════════════════════════════════════════════════════════════════
--  Stock small masters — notes 159 (2026-10-26)
--
--    1. menu 293 Stock Reasons (the Qt StockReasonList over grid 188) and
--       294 Ageing Slabs, under Item Masters (34), after Tracking Presets
--    2. menu 249 Tracking Presets gains CREATE and EDIT: the presets get write
--       routes (POST /stock-track-presets/save, /deactivate), judged on 249
--
--  Guarded on menu 34 existing: on a FRESH database migrations run before the
--  menu seed and this is a no-op — prisma/seed/Menu_Master.sql carries the same
--  rows and verbs.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · the two menus ──────────────────────────────────────────────────────
INSERT INTO fixed.menu_master
    (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position,
     menu_icon_location_desktop, menu_icon_location_web, menu_icon_location_mobile,
     menu_is_active, menu_separator, menu_verbs)
SELECT v.menu_id, 34, v.menu_name, NULL, true, v.menu_position, NULL, NULL, NULL, true, false, v.verbs::text[]
  FROM (VALUES
    -- A master: shared reasons plus the company's own (POST /stock/reasons,
    -- /stock/reasons/deactivate).
    (293, 'Stock Reasons'::varchar, 110::numeric, '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}'),
    -- One ladder per company, saved whole: VIEW reads it, EDIT saves / reverts.
    (294, 'Ageing Slabs',           120,          '{VIEW,EDIT}')
  ) AS v(menu_id, menu_name, menu_position, verbs)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = 34)
ON CONFLICT (menu_id) DO NOTHING;


-- ── 2 · Tracking Presets can now be created and edited ─────────────────────
-- Guarded on the list 20260930170000 gave it, so a site that edited the row
-- keeps its own answer.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,PRINT}', menu_modified_on = now()
 WHERE menu_id = 249
   AND menu_verbs = '{VIEW,PRINT}';
