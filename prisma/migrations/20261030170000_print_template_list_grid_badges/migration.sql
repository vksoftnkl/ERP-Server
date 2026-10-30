-- ═══════════════════════════════════════════════════════════════════════════
--  Print Templates grid — pills like the other lists                2026-10-30
--
--  The desktop paints a status pill from a column's TEXT (TxnBadgePalette) and
--  a boolean column as an Active / Inactive pill on its own. The grid shipped
--  with free text there ('rev 3', the company name, 'Yes'), so nothing was a
--  pill. This gives each one a fixed word:
--
--    state      NEW   'PUBLISHED' | 'NOT PUBLISHED' — the column that says
--                     whether any counter can print the design
--    owner            'SHIPPED' | 'OWN' (was 'Shipped' / the company name; the
--                     list only ever shows this company's own designs)
--    published        'rev N', or '—' when nothing is (was 'not published',
--                     painted amber by a column condition — the pill says it now)
--    ptl_is_active    the boolean itself (was 'Yes' / 'No')
--
--  Columns and their order are this migration's; a width is moved only while it
--  is still the value 20261030160000 left, so one set in Grid Master stays.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_details
   SET grid_sql = $grid$
SELECT t.ptl_id,
       t.ptl_company_id,
       t.ptl_purpose_id,
       t.ptl_published_rev_id,
       t.ptl_code,
       t.ptl_name,
       p.ppo_code AS purpose_code,
       COALESCE(NULLIF(p.ppo_name, ''), p.ppo_code) AS purpose_name,
       CASE WHEN t.ptl_company_id IS NULL THEN 'SHIPPED' ELSE 'OWN' END AS owner,
       CASE WHEN pv.ptv_id IS NULL THEN 'NOT PUBLISHED' ELSE 'PUBLISHED' END AS state,
       CASE WHEN pv.ptv_id IS NULL THEN '—' ELSE 'rev ' || pv.ptv_rev_no END AS published,
       COALESCE(pv.ptv_engine, lv.ptv_engine) AS engine,
       CASE WHEN lv.ptv_id IS NULL THEN '' ELSE 'rev ' || lv.ptv_rev_no || ' · ' || lv.ptv_status END AS latest,
       CASE WHEN t.ptl_forked_from_id IS NULL THEN ''
            ELSE COALESCE(f.ptl_code, '?') || COALESCE(' rev ' || t.ptl_forked_from_rev, '') END AS cloned_from,
       u.used_by,
       u.assignments,
       t.ptl_is_active,
       t.ptl_modified_on
  FROM public.print_template t
  LEFT JOIN public.print_purpose p ON p.ppo_id = t.ptl_purpose_id
  LEFT JOIN public.print_template_version pv ON pv.ptv_id = t.ptl_published_rev_id
  LEFT JOIN LATERAL (SELECT v.ptv_id, v.ptv_rev_no, v.ptv_status, v.ptv_engine
                       FROM public.print_template_version v
                      WHERE v.ptv_template_id = t.ptl_id AND v.ptv_is_deleted = false
                      ORDER BY v.ptv_rev_no DESC LIMIT 1) lv ON true
  LEFT JOIN public.print_template f ON f.ptl_id = t.ptl_forked_from_id
  LEFT JOIN LATERAL (
       SELECT count(*) AS assignments,
              CASE WHEN count(*) = 0 THEN '—'
                   WHEN count(*) FILTER (WHERE a.pta_device_id IS NULL AND a.pta_branch_id IS NULL) > 0
                        AND count(a.pta_device_id) = 0 AND count(a.pta_branch_id) = 0 THEN 'every counter'
                   ELSE concat_ws(', ',
                        CASE WHEN count(DISTINCT a.pta_device_id) > 0
                             THEN count(DISTINCT a.pta_device_id) || CASE WHEN count(DISTINCT a.pta_device_id) = 1 THEN ' counter' ELSE ' counters' END END,
                        CASE WHEN count(DISTINCT a.pta_branch_id) > 0
                             THEN count(DISTINCT a.pta_branch_id) || CASE WHEN count(DISTINCT a.pta_branch_id) = 1 THEN ' branch' ELSE ' branches' END END,
                        CASE WHEN count(*) FILTER (WHERE a.pta_device_id IS NULL AND a.pta_branch_id IS NULL) > 0
                             THEN 'company-wide' END)
              END AS used_by
         FROM public.print_template_assignment a
        WHERE a.pta_template_id = t.ptl_id
          AND a.pta_is_deleted = false
          AND a.pta_is_active = true
          AND (a.pta_company_id = iptl_company_id::uuid OR a.pta_company_id IS NULL)) u ON true
 WHERE t.ptl_is_deleted = false
   AND (t.ptl_company_id = iptl_company_id::uuid
        OR (t.ptl_company_id IS NULL AND NULLIF(iptl_owned, '') IS NULL))
   AND (NULLIF(iptl_active, '') IS NULL OR t.ptl_is_active = true)
   AND (NULLIF(iptl_purpose_id, '') IS NULL OR t.ptl_purpose_id = NULLIF(iptl_purpose_id, '')::uuid)
   AND (NULLIF(iptl_state, '') IS NULL
        OR (iptl_state = 'PUBLISHED'   AND t.ptl_published_rev_id IS NOT NULL)
        OR (iptl_state = 'UNPUBLISHED' AND t.ptl_published_rev_id IS NULL))
   AND (NULLIF(iptl_engine, '') IS NULL OR COALESCE(pv.ptv_engine, lv.ptv_engine) = iptl_engine)
 ORDER BY t.ptl_code
$grid$
 WHERE grid_name = 'MAIN LIST - PRINT TEMPLATES';

-- The new State column, beside Owner.
INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, 18, 'State', 11.00, 'Center', true, true,
       false, false, 'Text', false, 10, 'state', 'system'
  FROM fixed.grid_details g
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c
                    WHERE c.grid_id = g.grid_id AND c.grid_column_sql_field_name = 'state');

-- Active reads the boolean; Published loses its amber condition (State says it).
UPDATE fixed.grid_columns c
   SET grid_column_sql_field_name = 'ptl_is_active',
       grid_column_data_type      = 'Boolean',
       grid_column_condition       = NULL,
       grid_column_condition_color = NULL
  FROM fixed.grid_details g
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = 'active';

UPDATE fixed.grid_columns c
   SET grid_column_condition       = NULL,
       grid_column_condition_color = NULL
  FROM fixed.grid_details g
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = 'published';

-- Order: keys, Code, Name, Purpose, Owner, State, Published, Engine, Cloned
-- From, Used By, Active.
UPDATE fixed.grid_columns c
   SET grid_column_position = v.pos
  FROM fixed.grid_details g,
       (VALUES ('published', 11), ('engine', 12), ('latest', 13), ('cloned_from', 14),
               ('used_by', 15), ('assignments', 16), ('ptl_is_active', 17), ('ptl_modified_on', 18)
       ) AS v(field, pos)
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = v.field;

-- Widths to 100 with the State column in, where still at the shipped value.
UPDATE fixed.grid_columns c
   SET grid_column_width = v.new_width
  FROM fixed.grid_details g,
       (VALUES ('ptl_code',     13.00, 12.00),
               ('owner',        12.00,  8.00),
               ('published',     8.00,  6.00),
               ('engine',        9.00,  8.00),
               ('cloned_from',  11.00, 10.00),
               ('used_by',      12.00, 10.00)
       ) AS v(field, old_width, new_width)
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND c.grid_id = g.grid_id
   AND c.grid_column_sql_field_name = v.field
   AND c.grid_column_width = v.old_width;
