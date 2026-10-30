-- ═══════════════════════════════════════════════════════════════════════════
--  Print Templates (menu 62) — its list as a registered grid      2026-10-30
--
--  The desktop's template list was its own table over /print-templates/list
--  because printing had no grid row (print_template_list.h said so). This is
--  that row, so the screen becomes a NexCrudMasterPage like every other
--  master list: Grid Master sets its columns, widths and order; search,
--  sort, paging and Excel come from the shared page.
--
--    grid    'MAIN LIST - PRINT TEMPLATES' — this company's designs and the
--            shipped ones it may use (the /print-templates/list reading of
--            ptlCompanyId), with:
--              published   'rev N', or 'not published' (resolves for nobody;
--                          the column's condition paints it amber)
--              engine      the published revision's, else the newest's
--              latest      the newest live revision and its status
--              used_by     React's usedBy() text over ACTIVE assignments of
--                          this company and the every-company ones:
--                          '—' | 'every counter' | '2 counters, 1 branch,
--                          company-wide'
--    tokens  (send every one; '' = no filter)
--              iptl_company_id  the session company (required)
--              iptl_active      'true' = active designs only
--              iptl_purpose_id  a print_purpose ppo_id
--              iptl_state       'PUBLISHED' | 'UNPUBLISHED'
--              iptl_owned       'true' = this company's own designs only
--              iptl_engine      JSON_BANDS | HTML_CSS | …
--
--  Takes grid id 196 where it is free; elsewhere the sequence picks one. The
--  desktop finds the grid by NAME, the id is only its fallback. No sync calls:
--  fixed.grid_* rows carry no sync triggers.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_id = 196)
            THEN nextval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'))
            ELSE 196 END,
       'MAIN LIST - PRINT TEMPLATES',
       'Print designs (menu 62): this company''s and the shipped ones it may use — purpose, owner, published revision, engine, who prints with it.',
       'Desktop',
       'Code', 'Ascending',
       $grid$
SELECT t.ptl_id,
       t.ptl_company_id,
       t.ptl_purpose_id,
       t.ptl_published_rev_id,
       t.ptl_code,
       t.ptl_name,
       p.ppo_code AS purpose_code,
       COALESCE(NULLIF(p.ppo_name, ''), p.ppo_code) AS purpose_name,
       CASE WHEN t.ptl_company_id IS NULL THEN 'Shipped' ELSE COALESCE(c.comp_name, 'Company') END AS owner,
       CASE WHEN pv.ptv_id IS NULL THEN 'not published' ELSE 'rev ' || pv.ptv_rev_no END AS published,
       COALESCE(pv.ptv_engine, lv.ptv_engine) AS engine,
       CASE WHEN lv.ptv_id IS NULL THEN '' ELSE 'rev ' || lv.ptv_rev_no || ' · ' || lv.ptv_status END AS latest,
       CASE WHEN t.ptl_forked_from_id IS NULL THEN ''
            ELSE COALESCE(f.ptl_code, '?') || COALESCE(' rev ' || t.ptl_forked_from_rev, '') END AS cloned_from,
       u.used_by,
       u.assignments,
       CASE WHEN t.ptl_is_active THEN 'Yes' ELSE 'No' END AS active,
       t.ptl_modified_on
  FROM public.print_template t
  LEFT JOIN public.print_purpose p ON p.ppo_id = t.ptl_purpose_id
  LEFT JOIN public.companys c ON c.comp_id = t.ptl_company_id
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
$grid$,
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details WHERE grid_name = 'MAIN LIST - PRINT TEMPLATES');

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_condition, grid_column_condition_color,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       v.cond, v.cond_color,
       false, false, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        -- Keys the screen reads off the row (open, clone, retire); never shown.
        ( 1, '#',                8.00, 'Left',   false, false, NULL::text, NULL::text, 'Text',     'ptl_id'),
        ( 2, 'Company',          8.00, 'Left',   false, false, NULL,       NULL,       'Text',     'ptl_company_id'),
        ( 3, 'Purpose Id',       8.00, 'Left',   false, false, NULL,       NULL,       'Text',     'ptl_purpose_id'),
        ( 4, 'Published Rev Id', 8.00, 'Left',   false, false, NULL,       NULL,       'Text',     'ptl_published_rev_id'),
        ( 5, 'Code',            14.00, 'Left',   true,  true,  NULL,       NULL,       'Text',     'ptl_code'),
        ( 6, 'Name',            20.00, 'Left',   true,  true,  NULL,       NULL,       'Text',     'ptl_name'),
        ( 7, 'Purpose Code',    12.00, 'Left',   false, true,  NULL,       NULL,       'Text',     'purpose_code'),
        ( 8, 'Purpose',         15.00, 'Left',   true,  true,  NULL,       NULL,       'Text',     'purpose_name'),
        ( 9, 'Owner',           14.00, 'Left',   true,  true,  NULL,       NULL,       'Text',     'owner'),
        -- Not published = resolves for nobody: amber, as the old list painted it.
        (10, 'Published',       10.00, 'Center', true,  false, '== not published', '#FEF6E7', 'Text', 'published'),
        (11, 'Engine',          10.00, 'Center', true,  false, NULL,       NULL,       'Text',     'engine'),
        (12, 'Latest',          12.00, 'Left',   false, false, NULL,       NULL,       'Text',     'latest'),
        (13, 'Cloned From',     14.00, 'Left',   true,  false, NULL,       NULL,       'Text',     'cloned_from'),
        (14, 'Used By',         16.00, 'Left',   true,  false, NULL,       NULL,       'Text',     'used_by'),
        (15, 'Assignments',      8.00, 'Right',  false, false, NULL,       NULL,       'Number',   'assignments'),
        (16, 'Active',           6.00, 'Center', true,  false, '== No',    '#ECEFF3',  'Text',     'active'),
        (17, 'Modified On',     10.00, 'Center', false, false, NULL,       NULL,       'DateTime', 'ptl_modified_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, cond, cond_color, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - PRINT TEMPLATES'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              GREATEST((SELECT max(grid_id) FROM fixed.grid_details),
                       (SELECT last_value FROM fixed.grid_details_grid_id_seq)))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;
