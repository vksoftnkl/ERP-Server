-- ───────────────────────────────────────────────────────────────────────────
--  public.fn_app_settings_effective(company, branch, device, user)
--
--  One row per LIVE setting, carrying the catalog row and — where one matched
--  the caller — the override row that won, plus the value the two come to.
--
--  fn_app_settings (20260812120000) answers the same question as a flat jsonb
--  object: keys and cast values, nothing else. That is what a client needs to
--  APPLY a setting. It is not enough to EDIT one: a screen showing "40%,
--  set on this branch" needs the asv_id to edit or reset, the scope it was set
--  at, and the label / type / bounds to draw the control at all. Two round
--  trips (resolve + list overrides) cannot answer it either — the list says
--  which overrides exist, not which of them the caller actually sees.
--
--  The five-layer precedence is written ONCE, here. fn_app_settings is
--  rewritten below to read this function rather than repeat the ladder, so the
--  flat object and the editable view can never disagree about which layer won.
--
--  GLOBAL < COMPANY < BRANCH < DEVICE < USER, exactly as before: the deepest
--  override matching the ids supplied wins, and where none matches the
--  catalog's asd_default_value applies. Every id is optional and additive — a
--  layer whose id is NULL simply never matches.
--
--  Unlike fn_app_settings, a setting that resolves to NOTHING is still
--  RETURNED, with effective_value NULL and source naming where that nothing
--  came from. The settings screen has to draw an empty box; the client applying
--  a rule does not want the key at all.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_app_settings_effective(
    p_company_id uuid DEFAULT NULL,
    p_branch_id  uuid DEFAULT NULL,
    p_device_id  uuid DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL)
    RETURNS TABLE
            (
                -- ── The catalog row (always present) ─────────────────────
                out_asd_id            uuid,
                out_asd_key           character varying(80),
                out_asd_module        character varying(30),
                out_asd_group         character varying(40),
                out_asd_data_type     character varying(10),
                out_asd_default_value text,
                out_asd_allowed_values jsonb,
                out_asd_min_value     numeric(18, 6),
                out_asd_max_value     numeric(18, 6),
                out_asd_max_scope     character varying(10),
                out_asd_label         character varying(120),
                out_asd_description   text,
                out_asd_sort_order    smallint,
                out_asd_needs_relogin boolean,

                -- ── The winning override (NULL when the default stands) ──
                out_asv_id            uuid,
                out_asv_scope         character varying(10),
                out_asv_company_id    uuid,
                out_asv_branch_id     uuid,
                out_asv_device_id     uuid,
                out_asv_user_id       uuid,
                out_asv_value         text,
                out_asv_remarks       character varying(250),
                out_asv_sync_date     timestamp(6) with time zone,
                out_asv_created_on    timestamp(6) with time zone,
                out_asv_created_by    character varying(50),
                out_asv_modified_on   timestamp(6) with time zone,
                out_asv_modified_by   character varying(50),

                -- ── What the two come to ────────────────────────────────
                -- Raw text, as stored. The caller casts by out_asd_data_type,
                -- or reads fn_app_settings, which does it for them.
                out_effective_value   text,
                -- OVERRIDE | DEFAULT. Read from the ROW's existence, not from
                -- the value: an override that deliberately blanks a setting is
                -- still an override, and a screen has to offer Reset on it.
                out_source            text
            )
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
AS
$$
WITH live AS (SELECT *
              FROM public.app_setting_def
              WHERE asd_is_deleted = false
                AND asd_is_active = true),
     winner AS (SELECT DISTINCT ON (v.asv_setting_key) v.*
                FROM public.app_setting_value v
                         JOIN live l ON l.asd_key = v.asv_setting_key
                WHERE v.asv_is_deleted = false
                  AND (v.asv_scope = 'GLOBAL'
                    OR (v.asv_scope = 'COMPANY' AND v.asv_company_id = p_company_id)
                    OR (v.asv_scope = 'BRANCH' AND v.asv_branch_id = p_branch_id)
                    OR (v.asv_scope = 'DEVICE' AND v.asv_device_id = p_device_id)
                    OR (v.asv_scope = 'USER' AND v.asv_user_id = p_user_id))
                ORDER BY v.asv_setting_key,
                         CASE v.asv_scope
                             WHEN 'GLOBAL' THEN 1 WHEN 'COMPANY' THEN 2 WHEN 'BRANCH' THEN 3
                             WHEN 'DEVICE' THEN 4 WHEN 'USER' THEN 5 END DESC)
SELECT l.asd_id,
       l.asd_key,
       l.asd_module,
       l.asd_group,
       l.asd_data_type,
       l.asd_default_value,
       l.asd_allowed_values,
       l.asd_min_value,
       l.asd_max_value,
       l.asd_max_scope,
       l.asd_label,
       l.asd_description,
       l.asd_sort_order,
       l.asd_needs_relogin,
       w.asv_id,
       w.asv_scope,
       w.asv_company_id,
       w.asv_branch_id,
       w.asv_device_id,
       w.asv_user_id,
       w.asv_value,
       w.asv_remarks,
       w.asv_sync_date,
       w.asv_created_on,
       w.asv_created_by,
       w.asv_modified_on,
       w.asv_modified_by,
       CASE WHEN w.asv_id IS NOT NULL THEN w.asv_value ELSE l.asd_default_value END,
       CASE WHEN w.asv_id IS NOT NULL THEN 'OVERRIDE' ELSE 'DEFAULT' END
FROM live l
         LEFT JOIN winner w ON w.asv_setting_key = l.asd_key
-- The order the settings screen draws its tree in, and the one ix_asd_module
-- is built on.
ORDER BY l.asd_module, l.asd_group, l.asd_sort_order, l.asd_key;
$$;

COMMENT ON FUNCTION public.fn_app_settings_effective(uuid, uuid, uuid, uuid) IS
    'One row per live setting for one caller: the catalog row, the override row that won (NULL when the default stands), and the effective raw value. The single implementation of the GLOBAL < COMPANY < BRANCH < DEVICE < USER precedence — fn_app_settings reads it rather than repeating the ladder.';


-- ───────────────────────────────────────────────────────────────────────────
--  fn_app_settings, rebuilt on top
--
--  Same signature, same answer, same casts as 20260812120000 — the ladder just
--  moved into fn_app_settings_effective instead of being spelled out twice.
--  Keys whose effective value is NULL are still omitted entirely, so a client
--  can treat "absent" as "unset" without distinguishing two flavours of
--  nothing.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_app_settings(
    p_company_id uuid DEFAULT NULL,
    p_branch_id  uuid DEFAULT NULL,
    p_device_id  uuid DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL)
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
AS
$$
SELECT COALESCE(
               jsonb_object_agg(
                       e.out_asd_key,
                       CASE e.out_asd_data_type
                           WHEN 'BOOL' THEN to_jsonb(e.out_effective_value::boolean)
                           WHEN 'INT' THEN to_jsonb(e.out_effective_value::bigint)
                           WHEN 'DECIMAL' THEN to_jsonb(e.out_effective_value::numeric)
                           WHEN 'JSON' THEN e.out_effective_value::jsonb
                           ELSE to_jsonb(e.out_effective_value) END),  -- TEXT | UUID | DATE stay strings
               '{}'::jsonb)
FROM public.fn_app_settings_effective(p_company_id, p_branch_id, p_device_id, p_user_id) e
WHERE e.out_effective_value IS NOT NULL;
$$;

COMMENT ON FUNCTION public.fn_app_settings(uuid, uuid, uuid, uuid) IS
    'The resolved settings object for one caller as jsonb, values cast per asd_data_type and NULL-valued keys omitted. A thin cast over fn_app_settings_effective, which owns the precedence. Single source of truth — do not reimplement the merge in application code.';
