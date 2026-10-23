-- ════════════════════════════════════════════════════════════════════════════
-- 20261023140000_db_table_master — the table registry
--
-- One row per table in the database saying WHAT it is: a master, a
-- transaction, a ledger, a balance, a log, a setting, a UI definition or
-- plumbing. Modelled on fixed.menu_master: an int id, a self-parent
-- (dtm_parent_id: an item / line table points at its header, a child master at
-- its master), a name, an active flag and the created / modified / sync dates.
--
-- Rows come from prisma/seed/Db_Table_Master.sql (ids written out, like
-- Menu_Master.sql); a migration cannot read seeded data and runs before seeds.
--
-- Registered: every ordinary table and every partitioned PARENT. Never a
-- partition (sale_bill_2026_2027 ...) — the catalog already knows those.
--
-- Not stored, because pg_catalog already knows it and a copy would go stale:
-- partitioning, partition key, row counts, size. public.v_db_table_master
-- joins them on.
--
-- public.v_db_table_master_drift lists what the registry and the database
-- disagree on — a table with no row (UNREGISTERED), a row with no table
-- (MISSING), a row naming a partition (PARTITION). test/db-table-master
-- .e2e-spec.ts fails while it is not empty.
--
-- Runs: once, in one transaction. Re-runnable: IF NOT EXISTS / OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.db_table_master (
  dtm_id              serial        NOT NULL,
  dtm_schema          varchar(63)   NOT NULL,
  dtm_table           varchar(63)   NOT NULL,              -- partitioned PARENT only
  dtm_parent_id       integer,                             -- line -> header, child master -> master
  dtm_name            varchar(200)  NOT NULL,              -- 'Sale Bill Item'
  dtm_kind            varchar(20)   NOT NULL,              -- see ck_dtm_kind
  dtm_module          varchar(30),                         -- CORE HR UI AUDIT SYSTEM ACCOUNTS TILL SALES LOYALTY PURCHASE INVENTORY STOCK GST PRINT TRANSPORT
  dtm_col_prefix      varchar(30),                         -- 'sbi_'; NOT unique (stl_, atc_, sdr_, tax_ are each used twice)
  dtm_menu_id         integer,                             -- the screen that maintains it
  dtm_write_mode      varchar(12)   NOT NULL DEFAULT 'EDITABLE',  -- see ck_dtm_write_mode
  dtm_retention_days  integer,                             -- NULL = kept forever
  dtm_description     text,
  dtm_is_active       boolean       NOT NULL DEFAULT true, -- false = retired, table kept
  dtm_created_on      timestamptz   NOT NULL DEFAULT now(),
  dtm_modified_on     timestamptz,
  dtm_sync_date       timestamptz,                         -- offline sync: NULL = not yet synced

  CONSTRAINT pk_db_table_master PRIMARY KEY (dtm_id),
  CONSTRAINT uq_dtm_table UNIQUE (dtm_schema, dtm_table),
  CONSTRAINT fk_dtm_parent FOREIGN KEY (dtm_parent_id)
    REFERENCES public.db_table_master (dtm_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_dtm_menu FOREIGN KEY (dtm_menu_id)
    REFERENCES fixed.menu_master (menu_id) ON DELETE SET NULL ON UPDATE CASCADE,

  -- MASTER       things a document picks from (item, customer, ledger, godown)
  -- TRANSACTION  numbered, dated documents a user raises, and their lines
  -- LEDGER       movements the posting engine writes from a transaction
  -- BALANCE      running totals / snapshots, rebuildable from a ledger
  -- LOG          history: who did what when
  -- SETTING      rules and switches, per company / branch / device
  -- METADATA     definitions the apps are built from (menus, grids, catalogues)
  -- SYSTEM       plumbing with no business meaning
  CONSTRAINT ck_dtm_kind CHECK (dtm_kind IN
    ('MASTER', 'TRANSACTION', 'LEDGER', 'BALANCE', 'LOG', 'SETTING', 'METADATA', 'SYSTEM')),
  -- EDITABLE     screens / the API save and change rows
  -- APPEND_ONLY  insert only; a correction is a new (reversing) row
  --              (sync / bookkeeping stamps do not count as changes)
  -- DERIVED      written only by server posting / engine / job code from
  --              other tables, never saved directly by a screen
  CONSTRAINT ck_dtm_write_mode CHECK (dtm_write_mode IN ('EDITABLE', 'APPEND_ONLY', 'DERIVED')),
  CONSTRAINT ck_dtm_retention  CHECK (dtm_retention_days IS NULL OR dtm_retention_days > 0),
  CONSTRAINT ck_dtm_parent     CHECK (dtm_parent_id IS DISTINCT FROM dtm_id)
);

CREATE INDEX IF NOT EXISTS ix_dtm_parent ON public.db_table_master (dtm_parent_id);
CREATE INDEX IF NOT EXISTS ix_dtm_menu   ON public.db_table_master (dtm_menu_id);

-- ── sync: exactly what public.sync_install_triggers() creates per table ──
-- Skipped where the sync functions are absent: they come from
-- 20260923120000_offline_cloud_sync, which is kept out of git, so an
-- unconditional CREATE TRIGGER would fail the deploy on the VPS.
DO $$
BEGIN
  IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
     OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
    RAISE NOTICE 'db_table_master: sync functions absent, sync triggers skipped';
    RETURN;
  END IF;
  CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON public.db_table_master
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty('dtm_sync_date');
  CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON public.db_table_master
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete('public', 'db_table_master', 'dtm_id');
  CREATE INDEX IF NOT EXISTS ix_sync_pending_db_table_master
    ON public.db_table_master (dtm_id) WHERE dtm_sync_date IS NULL;
END $$;

-- ── the registry with what the catalog knows ─────────────────────────────
-- dtm_est_rows is the planner's estimate (reltuples) summed over the leaf
-- partitions: 0 until the table has been ANALYZEd, never an exact count.
-- pg_partition_tree() returns nothing for an ordinary table, hence the UNION.
CREATE OR REPLACE VIEW public.v_db_table_master AS
SELECT d.dtm_id,
       d.dtm_schema,
       d.dtm_table,
       d.dtm_parent_id,
       p.dtm_table                               AS dtm_parent_table,
       d.dtm_name,
       d.dtm_kind,
       d.dtm_module,
       d.dtm_col_prefix,
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

-- ── what the registry and the database disagree on ───────────────────────
-- Every schema except the system ones, so a table in a NEW schema is caught
-- too; tables an extension owns are not ours to register.
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
 WHERE c.relispartition;

COMMENT ON TABLE public.db_table_master IS
  'The table registry: what every table is (MASTER / TRANSACTION / LEDGER / BALANCE / LOG / SETTING / METADATA / SYSTEM), its header, module and screen. Rows from prisma/seed/Db_Table_Master.sql; v_db_table_master_drift lists what is unregistered.';
