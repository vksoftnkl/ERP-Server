-- ═══════════════════════════════════════════════════════════════════════════
--  42 — Company theme: colour tokens on app_theme_master          2026-09-30
--
--  Plan: theme/plan-app-theme.md (§2 Data, §2.5 registrations); API in
--  src/modules/settings/appTheme. This is the 42_app_theme_tokens.sql file as
--  run by hand on 192.168.0.106 on 2026-09-30, made a migration so the live box
--  gets it through deploy.sh (which runs migrations and never seeds). It is
--  idempotent, so applying it on a database that already ran the file changes
--  nothing but re-writing grid 125's columns.
--
--  Differences from the file, both additive:
--    * before the menu / grid inserts, their id sequences are caught up with
--      max(id) — the live box is seeded separately and a sequence behind its
--      pinned ids would make the insert collide (P3009);
--    * ux_thm_name: a theme name is unique among live rows,
--      case-insensitively — what POST /app-themes/save answers 409 on.
--
--  WHAT IT DOES
--    1. app_theme_master gets the CONTENT of a theme: thm_tokens (jsonb, a flat
--       { "<key>": "#rrggbb" } object of the 33 semantic colour keys), thm_base
--       (LIGHT/DARK, DARK reserved), thm_is_default (exactly one), remarks and
--       the audit columns every other master has.
--    2. thm_id gets a sequence, so /app-themes/save omits the id on create.
--    3. The three existing rows (1 MAROON, 2 YELLOW, 3 BLUE) are filled.
--       MAROON = what the Qt client is painted today, and the default.
--    4. Menu "App Themes" under Configuration (60), hidden until the phase-2
--       screen exists; grid "MAIN LIST - APP THEMES" (Desktop); three
--       SYSTEM/Display settings for the UI sizes (§5.3).
--  No CSS in the database, ever. Key names are checked by the API
--  (APP_THEME_TOKEN_KEYS), values by ck_thm_tokens.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.app_theme_master
    ADD COLUMN IF NOT EXISTS thm_base        varchar(5)  NOT NULL DEFAULT 'LIGHT',
    ADD COLUMN IF NOT EXISTS thm_tokens      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS thm_is_default  boolean     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS thm_remarks     varchar(250),
    ADD COLUMN IF NOT EXISTS thm_created_on  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS thm_created_by  varchar(100),
    ADD COLUMN IF NOT EXISTS thm_modified_on timestamptz,
    ADD COLUMN IF NOT EXISTS thm_modified_by varchar(100);

COMMENT ON COLUMN public.app_theme_master.thm_tokens IS
    'Flat object { "<token key>": "#rrggbb" | "#rrggbbaa" }. A missing key means "the client''s compiled default". Keys are validated by the API (APP_THEME_TOKEN_KEYS), values by ck_thm_tokens. Never CSS.';
COMMENT ON COLUMN public.app_theme_master.thm_base IS
    'LIGHT or DARK: which client template the tokens fill. Phase 1 ships LIGHT only.';
COMMENT ON COLUMN public.app_theme_master.thm_is_default IS
    'The theme a company with a NULL comp_stylesheet_id gets. Exactly one live row (ux_thm_default).';

-- ── 2. thm_id sequence (the table had a bare integer key) ────────────────────
CREATE SEQUENCE IF NOT EXISTS public.app_theme_master_thm_id_seq
    AS integer OWNED BY public.app_theme_master.thm_id;
SELECT setval('public.app_theme_master_thm_id_seq',
              COALESCE((SELECT max(thm_id) FROM public.app_theme_master), 0) + 1,
              false);
ALTER TABLE public.app_theme_master
    ALTER COLUMN thm_id SET DEFAULT nextval('public.app_theme_master_thm_id_seq');

-- ── 3. Invariants the DB keeps ───────────────────────────────────────────────
-- Every value is a colour. IMMUTABLE so it may sit in a CHECK.
CREATE OR REPLACE FUNCTION public.fn_theme_tokens_valid(p jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT p IS NOT NULL
       AND jsonb_typeof(p) = 'object'
       AND NOT EXISTS (SELECT 1
                         FROM jsonb_each_text(p) AS e(k, v)
                        WHERE v !~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$');
$$;
COMMENT ON FUNCTION public.fn_theme_tokens_valid(jsonb) IS
    'true when p is a flat object whose every value is #rrggbb or #rrggbbaa. Used by ck_thm_tokens.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_thm_base') THEN
        ALTER TABLE public.app_theme_master
            ADD CONSTRAINT ck_thm_base CHECK (thm_base IN ('LIGHT', 'DARK'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_thm_tokens') THEN
        ALTER TABLE public.app_theme_master
            ADD CONSTRAINT ck_thm_tokens CHECK (public.fn_theme_tokens_valid(thm_tokens));
    END IF;
END $$;

-- Exactly one default among the live rows.
CREATE UNIQUE INDEX IF NOT EXISTS ux_thm_default
    ON public.app_theme_master (thm_is_default)
    WHERE thm_is_default = true AND thm_is_deleted = false;

-- ── 4. Seed the three rows ───────────────────────────────────────────────────
-- MAROON is the client's palette TODAY (app.qss + theme.h, read 2026-09-30).
-- YELLOW and BLUE are MAROON with the brand-carrying keys overlaid (jsonb ||),
-- so the three rows differ only where a theme should.
WITH maroon AS (
    SELECT $j${
        "primary":            "#7B1113",
        "primary.hover":      "#611010",
        "on.primary":         "#FFFFFF",
        "surface":            "#FFFFFF",
        "surface.alt":        "#F3F4F6",
        "text":               "#111827",
        "text.muted":         "#6B7280",
        "border":             "#E5E7EB",
        "focus":              "#2563EB",
        "title.bg":           "#7B1113",
        "title.fg":           "#FFFFFF",
        "menu.bg":            "#7B1113",
        "menu.fg":            "#FFFFFF",
        "table.header.bg":    "#DDDDDD",
        "table.header.fg":    "#000000",
        "table.row":          "#FFFFFF",
        "table.row.alt":      "#F5F5F5",
        "table.row.hover":    "#F8FBFF",
        "table.selected":     "#0078D7",
        "table.selected.fg":  "#FFFFFF",
        "table.txn.selected": "#B9D8DF",
        "table.checked":      "#98FB98",
        "table.free":         "#FFF4D6",
        "danger":             "#C01C28",
        "danger.bg":          "#FECACA",
        "warning":            "#92400E",
        "warning.bg":         "#FEF3C7",
        "success":            "#15803D",
        "success.bg":         "#DCFCE7",
        "info":               "#2563EB",
        "info.bg":            "#EFF6FF",
        "rate.below":         "#C62828",
        "rate.above":         "#2E7D32"
    }$j$::jsonb AS t
),
seed(thm_id, thm_name, overlay) AS (
    VALUES
      (1, 'MAROON', '{}'::jsonb),
      (2, 'YELLOW', $j${
            "primary":            "#B45309",
            "primary.hover":      "#92400E",
            "title.bg":           "#B45309",
            "menu.bg":            "#B45309",
            "table.header.bg":    "#FEF3C7",
            "table.selected":     "#B45309",
            "table.txn.selected": "#FDE68A"
         }$j$::jsonb),
      (3, 'BLUE',   $j${
            "primary":            "#1D4ED8",
            "primary.hover":      "#1E40AF",
            "title.bg":           "#1D4ED8",
            "menu.bg":            "#1D4ED8",
            "table.header.bg":    "#DBEAFE",
            "table.selected":     "#1D4ED8",
            "table.txn.selected": "#BFDBFE"
         }$j$::jsonb)
)
INSERT INTO public.app_theme_master
       (thm_id, thm_name, thm_base, thm_tokens, thm_is_active, thm_is_deleted, thm_created_by)
SELECT s.thm_id, s.thm_name, 'LIGHT', m.t || s.overlay, true, false, 'SYSTEM'
  FROM seed s CROSS JOIN maroon m
ON CONFLICT (thm_id) DO UPDATE
   SET thm_tokens      = EXCLUDED.thm_tokens,
       thm_base        = EXCLUDED.thm_base,
       thm_modified_on = CURRENT_TIMESTAMP,
       thm_modified_by = 'SYSTEM'
 WHERE app_theme_master.thm_tokens = '{}'::jsonb;      -- never overwrite an edited theme
-- (the existing rows keep their own thm_name; only the palette is filled)

-- MAROON is the default, unless somebody already chose one.
UPDATE public.app_theme_master
   SET thm_is_default = true
 WHERE thm_id = 1
   AND NOT EXISTS (SELECT 1 FROM public.app_theme_master
                    WHERE thm_is_default = true AND thm_is_deleted = false);

-- ── 5. Menu: "App Themes" under Configuration (60), hidden until the screen exists
-- The id sequences first: never behind the ids a seed pinned (see header).
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));
SELECT setval('fixed.grid_details_grid_id_seq',
              GREATEST((SELECT COALESCE(max(grid_id), 0) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)));
INSERT INTO fixed.menu_master
       (menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator, menu_verbs)
SELECT 60, 'App Themes', false, 8.20, true, false,
       '{VIEW,CREATE,EDIT,DELETE,EXPORT}'::text[]
 WHERE NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_parent = 60 AND menu_name = 'App Themes');

-- ── 6. Grid: MAIN LIST - APP THEMES (Desktop) ────────────────────────────────
-- No grid params: the list is small and shared. Deleted rows are listed too
-- (a Deleted column) so the screen's Restore has something to act on.
-- thm_id / thm_name are not aliased: the client reads them by name (edit / delete).
DO $$
DECLARE
    v_grid bigint;
BEGIN
    SELECT grid_id INTO v_grid
      FROM fixed.grid_details
     WHERE grid_name = 'MAIN LIST - APP THEMES' AND grid_device_type = 'Desktop';

    IF v_grid IS NULL THEN
        INSERT INTO fixed.grid_details
               (grid_name, grid_description, grid_sort_column, grid_sort_order,
                grid_sql, grid_status, grid_is_deleted, grid_device_type, grid_created_by)
        VALUES ('MAIN LIST - APP THEMES',
                'App Themes master list (menu "App Themes" under Configuration). theme/plan-app-theme.md §2.5',
                'thm_id', 'Ascending',
                $sql$
SELECT
    t.thm_id,
    t.thm_name,
    t.thm_base,
    t.thm_is_default,
    t.thm_is_active,
    t.thm_is_deleted,
    (SELECT count(*)
       FROM public.companys c
      WHERE c.comp_stylesheet_id = t.thm_id
        AND COALESCE(c.comp_is_deleted, false) = false)  AS thm_used_by,
    t.thm_remarks,
    t.thm_modified_on
FROM public.app_theme_master t
ORDER BY t.thm_id
$sql$,
                true, false, 'Desktop', 'SYSTEM')
        RETURNING grid_id INTO v_grid;
    END IF;

    -- Widths are percentages and add to 100.
    DELETE FROM fixed.grid_columns WHERE grid_id = v_grid;
    INSERT INTO fixed.grid_columns
        (grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
         grid_column_data_type, grid_column_alignment, grid_column_width,
         grid_column_visibility, grid_column_filter, grid_column_position, grid_column_created_by)
    VALUES
    --        n  heading      sql field          type        align      width  vis    filt  pos
    (v_grid,  1, '#',         'thm_id',          'Number',   'Right',    6.00, true,  false, 1, 'SYSTEM'),
    (v_grid,  2, 'Theme',     'thm_name',        'Text',     'Left',    26.00, true,  true,  2, 'SYSTEM'),
    (v_grid,  3, 'Base',      'thm_base',        'Text',     'Center',   8.00, true,  false, 3, 'SYSTEM'),
    (v_grid,  4, 'Default',   'thm_is_default',  'Boolean',  'Center',   8.00, true,  false, 4, 'SYSTEM'),
    (v_grid,  5, 'Active',    'thm_is_active',   'Boolean',  'Center',   8.00, true,  false, 5, 'SYSTEM'),
    (v_grid,  6, 'Deleted',   'thm_is_deleted',  'Boolean',  'Center',   8.00, true,  false, 6, 'SYSTEM'),
    (v_grid,  7, 'Used by',   'thm_used_by',     'Number',   'Right',    8.00, true,  false, 7, 'SYSTEM'),
    (v_grid,  8, 'Remarks',   'thm_remarks',     'Text',     'Left',    16.00, true,  false, 8, 'SYSTEM'),
    (v_grid,  9, 'Modified',  'thm_modified_on', 'DateTime', 'Center',  12.00, true,  false, 9, 'SYSTEM');
END $$;

-- ── 7. UI size settings (plan §5.3): NOT tokens. Company decides colour,
--       the machine decides icon / header size, the person decides text size.
INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description,
        asd_sort_order, asd_is_active, asd_needs_relogin, asd_created_by)
SELECT v.key, 'SYSTEM', 'Display', 'INT', v.def, v.mn, v.mx, v.scope, v.label, v.descr,
       v.pos, true, false, 'SYSTEM'
  FROM (VALUES
        ('system.ui_font_pt', '10', 8, 16, 'USER',
         'Screen font size (pt)',
         'Base font size of the desktop client, in points. Per user: it is about the reader''s eyes, not the company.',
         26),
        ('system.ui_icon_px', '20', 16, 32, 'DEVICE',
         'Toolbar icon size (px)',
         'Size of toolbar and action icons in the desktop client, in pixels. Per device: a POS touch screen wants bigger targets than a desktop.',
         27),
        ('system.ui_table_header_px', '26', 20, 40, 'DEVICE',
         'Grid header height (px)',
         'Height of grid header rows in the desktop client, in pixels. Per device, for the same reason as the icon size.',
         28)
       ) AS v(key, def, mn, mx, scope, label, descr, pos)
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d WHERE d.asd_key = v.key);

-- ── 8. A theme name is unique among live rows (API: 409 on a clash) ─────────
CREATE UNIQUE INDEX IF NOT EXISTS ux_thm_name
    ON public.app_theme_master (lower(thm_name))
 WHERE thm_is_deleted = false;
