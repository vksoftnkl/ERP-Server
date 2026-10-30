-- db_table_master.dtm_sync_col: the name of the table's sync-date column, the
-- timestamp the offline -> cloud push stamps and whose NULL means "changed
-- since the last push". The names are not uniform ('item_sync_date',
-- 'saa_synced_on', 'price_lvl_SyncDate', 'dropdown_columns_sync_on'), hence
-- the registry. NULL = the table has none (acc_cheque_book, _prisma_migrations,
-- _erp_seed_history). varchar(63) = a PostgreSQL identifier.
--
-- Values come from prisma/seed/Db_Table_Master.sql like every other registry
-- column (seeds run after migrations, so nothing is filled in here).
-- v_db_table_master_drift reports SYNC_COLUMN where the catalogue disagrees:
-- the named column is missing or not the table's sync column, or the table
-- has one the registry does not name. The rule for "the table's sync column"
-- is the one the cloud-sync view v_sync_tables uses: a timestamp column whose
-- name ends in sync_date / sync_on / synced_on / syncdate, *_sync_date first.
ALTER TABLE public.db_table_master
  ADD COLUMN IF NOT EXISTS dtm_sync_col varchar(63);

COMMENT ON COLUMN public.db_table_master.dtm_sync_col IS
  'The table''s sync-date column: the timestamp the cloud push stamps, NULL in it = changed since the last push. NULL = the table has none. From the seed; SYNC_COLUMN in v_db_table_master_drift when the catalogue disagrees.';

-- ── the registry view: the column sits next to dtm_col_prefix ─────────────
-- CREATE OR REPLACE can only append, so the view is re-created; nothing
-- depends on it. Otherwise 20261023140000 verbatim.
DROP VIEW IF EXISTS public.v_db_table_master;
CREATE VIEW public.v_db_table_master AS
SELECT d.dtm_id,
       d.dtm_schema,
       d.dtm_table,
       d.dtm_parent_id,
       p.dtm_table                               AS dtm_parent_table,
       d.dtm_name,
       d.dtm_kind,
       d.dtm_module,
       d.dtm_col_prefix,
       d.dtm_sync_col,
       d.dtm_menu_id,
       m.menu_name                               AS dtm_menu_name,
       d.dtm_write_mode,
       d.dtm_retention_days,
       d.dtm_description,
       d.dtm_is_active,
       c.oid IS NOT NULL                         AS dtm_exists,
       COALESCE(c.relkind = 'p', false)          AS dtm_is_partitioned,
       CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) END AS dtm_partition_key,
       (SELECT count(*) FROM pg_inherits i WHERE i.inhparent = c.oid)::int AS dtm_partition_count,
       s.est_rows                                AS dtm_est_rows,
       s.total_bytes                             AS dtm_total_bytes
  FROM public.db_table_master d
  LEFT JOIN public.db_table_master p ON p.dtm_id = d.dtm_parent_id
  LEFT JOIN fixed.menu_master m      ON m.menu_id = d.dtm_menu_id
  LEFT JOIN pg_class c               ON c.oid = to_regclass(format('%I.%I', d.dtm_schema, d.dtm_table))
  LEFT JOIN LATERAL (
        SELECT sum(GREATEST(lc.reltuples, 0))::bigint      AS est_rows,
               sum(pg_total_relation_size(lc.oid))::bigint AS total_bytes
          FROM (SELECT c.oid AS relid WHERE c.relkind = 'r'
                UNION ALL
                SELECT t.relid FROM pg_partition_tree(c.oid) t WHERE t.isleaf AND c.relkind = 'p') leaf
          JOIN pg_class lc ON lc.oid = leaf.relid
       ) s ON c.oid IS NOT NULL;

-- ── the drift view gains SYNC_COLUMN; the first three branches unchanged ──
CREATE OR REPLACE VIEW public.v_db_table_master_drift AS
SELECT 'UNREGISTERED'::text AS drift, n.nspname::text AS drift_schema, c.relname::text AS drift_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p')
   AND NOT c.relispartition
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg\_%'
   AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                    WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e')
   AND NOT EXISTS (SELECT 1 FROM public.db_table_master d
                    WHERE d.dtm_schema = n.nspname AND d.dtm_table = c.relname)
UNION ALL
SELECT 'MISSING', d.dtm_schema, d.dtm_table
  FROM public.db_table_master d
 WHERE to_regclass(format('%I.%I', d.dtm_schema, d.dtm_table)) IS NULL
UNION ALL
SELECT 'PARTITION', d.dtm_schema, d.dtm_table
  FROM public.db_table_master d
  JOIN pg_class c ON c.oid = to_regclass(format('%I.%I', d.dtm_schema, d.dtm_table))
 WHERE c.relispartition
UNION ALL
SELECT 'SYNC_COLUMN', d.dtm_schema, d.dtm_table
  FROM public.db_table_master d
  JOIN pg_class c ON c.oid = to_regclass(format('%I.%I', d.dtm_schema, d.dtm_table))
  LEFT JOIN LATERAL (
        SELECT a.attname::text AS col
          FROM pg_attribute a
         WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
           AND a.atttypid IN ('timestamptz'::regtype, 'timestamp'::regtype)
           AND a.attname ~* '(sync_date|sync_on|synced_on|syncdate)$'
         ORDER BY (a.attname ~* 'sync_date$') DESC, a.attnum
         LIMIT 1
       ) s ON true
 WHERE d.dtm_sync_col IS DISTINCT FROM s.col;
