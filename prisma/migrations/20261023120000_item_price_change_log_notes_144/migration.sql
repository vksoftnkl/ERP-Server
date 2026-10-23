-- ════════════════════════════════════════════════════════════════════════════
-- 20261023120000_item_price_change_log_notes_144 — the price change log TABLE
--
-- Spec:   inventory/plan-price-change-log.md + inventory/notes-144-price-change-log-approved.md
--         (approved by the user: separate table, qty slabs included, report
--         access by menu right).
-- Source: handed over as 50_item_price_change_log.sql (2026-10-23).
-- Runs:   once, in one transaction. Re-runnable: every statement is IF NOT
--         EXISTS / OR REPLACE.
--
-- This is ONLY the table. On its own it records nothing: rows are written by
-- the API (PriceMasterWriter → PriceChangeLog.record, plan §2), in the same
-- transaction as each price write. No trigger and no function of its own.
-- Append-only is the API's to enforce (no update / delete method or route); a
-- REVOKE would do nothing where the API connects as the table owner.
--
-- Where this departs from the handed-over file, and why:
--   · the two sync triggers and the sync "pending" index are created only when
--     fn_sync_mark_dirty / fn_sync_log_delete exist. They come from
--     20260923120000_offline_cloud_sync, which is kept out of git (.gitignore)
--     and so is absent on the VPS; an unconditional CREATE TRIGGER would fail
--     the deploy there (P3009). Same guard as 20260925170000_tds_rates. Where
--     the functions exist, the statements are the file's own — exactly what
--     public.sync_install_triggers() creates per table.
--   · ipcl_sync_date itself is unconditional: the committed Prisma fragment
--     declares it, so every database must have it (see 20260925110000).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventory.item_price_change_log (
  ipcl_id              uuid         PRIMARY KEY DEFAULT uuidv7(),
  ipcl_changed_on      timestamptz  NOT NULL DEFAULT now(),
  ipcl_change_set_id   uuid         NOT NULL,              -- one save / one request
  ipcl_price_table     varchar(4)   NOT NULL,              -- IPM item_price_master | IQP item_qty_price
  ipcl_row_id          uuid         NOT NULL,              -- ipm_id / iqp_id
  ipcl_action          varchar(10)  NOT NULL,              -- CREATE | UPDATE | DELETE | RESTORE | REKEY
  ipcl_source          varchar(30)  NOT NULL,              -- ITEM_CARD | CHANGE_SELLING_PRICE | QTY_PRICE | BUCKET_REKEY | IMPORT
  ipcl_menu_id         integer,

  -- where the price applies (AFTER for create/update/restore/rekey, BEFORE for delete)
  ipcl_company_id      uuid,                               -- NULL = shared item / chain price
  ipcl_branch_id       uuid,                               -- NULL = all branches
  ipcl_item_id         uuid         NOT NULL,
  ipcl_unit_id         uuid,                               -- iuc_id
  ipcl_godown_id       uuid,                               -- IPM only
  ipcl_party_id        uuid,                               -- IQP only
  ipcl_price_level     smallint,                           -- IQP only
  ipcl_bucket_mrp      numeric(18,2),                      -- IPM only
  ipcl_bucket_sp       numeric(18,2),                      -- IPM only
  ipcl_effective_from  date,
  ipcl_effective_to    date,

  -- names as they were at the time of the change
  ipcl_item_code       varchar(60),
  ipcl_item_name       varchar(250),
  ipcl_unit_name       varchar(60),
  ipcl_branch_name     varchar(120),
  ipcl_godown_name     varchar(120),
  ipcl_party_name      varchar(250),

  -- who / from where — from the token and the request context, never the body
  ipcl_user_id         uuid,
  ipcl_user_name       varchar(150),
  ipcl_device_id       uuid,
  ipcl_device_name     varchar(150),
  ipcl_ip              varchar(60),
  ipcl_app             varchar(30),                        -- DESKTOP | WEB | API | SYSTEM
  ipcl_reason          varchar(500),
  ipcl_sync_date       timestamptz,                        -- offline sync: NULL = not yet synced

  -- what: every column of the row, before and after (raw column names)
  ipcl_before          jsonb,
  ipcl_after           jsonb,
  ipcl_changed         text[]       NOT NULL,

  -- figures the report filters and sorts on
  ipcl_old_price_a     numeric GENERATED ALWAYS AS ((ipcl_before ->> 'ipm_sales_price_a')::numeric) STORED,
  ipcl_new_price_a     numeric GENERATED ALWAYS AS ((ipcl_after  ->> 'ipm_sales_price_a')::numeric) STORED,
  ipcl_old_mrp         numeric GENERATED ALWAYS AS ((ipcl_before ->> 'ipm_max_price')::numeric)     STORED,
  ipcl_new_mrp         numeric GENERATED ALWAYS AS ((ipcl_after  ->> 'ipm_max_price')::numeric)     STORED,
  ipcl_old_cost        numeric GENERATED ALWAYS AS ((ipcl_before ->> 'ipm_cost_price')::numeric)    STORED,
  ipcl_new_cost        numeric GENERATED ALWAYS AS ((ipcl_after  ->> 'ipm_cost_price')::numeric)    STORED,
  ipcl_old_slab_price  numeric GENERATED ALWAYS AS ((ipcl_before ->> 'iqp_price')::numeric)         STORED,
  ipcl_new_slab_price  numeric GENERATED ALWAYS AS ((ipcl_after  ->> 'iqp_price')::numeric)         STORED,
  ipcl_slab_from_qty   numeric GENERATED ALWAYS AS ((COALESCE(ipcl_after, ipcl_before) ->> 'iqp_from_qty')::numeric) STORED,
  ipcl_slab_to_qty     numeric GENERATED ALWAYS AS ((COALESCE(ipcl_after, ipcl_before) ->> 'iqp_to_qty')::numeric)   STORED,

  CONSTRAINT ck_ipcl_table   CHECK (ipcl_price_table IN ('IPM', 'IQP')),
  CONSTRAINT ck_ipcl_action  CHECK (ipcl_action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'REKEY')),
  CONSTRAINT ck_ipcl_source  CHECK (ipcl_source IN ('ITEM_CARD', 'CHANGE_SELLING_PRICE', 'QTY_PRICE',
                                                    'BUCKET_REKEY', 'IMPORT')),
  CONSTRAINT ck_ipcl_app     CHECK (ipcl_app IS NULL OR ipcl_app IN ('DESKTOP', 'WEB', 'API', 'SYSTEM')),
  CONSTRAINT ck_ipcl_shape   CHECK (
        (ipcl_action = 'CREATE' AND ipcl_before IS NULL     AND ipcl_after IS NOT NULL)
     OR (ipcl_action = 'DELETE' AND ipcl_before IS NOT NULL AND ipcl_after IS NULL)
     OR (ipcl_action IN ('UPDATE', 'RESTORE', 'REKEY') AND ipcl_before IS NOT NULL AND ipcl_after IS NOT NULL)),
  CONSTRAINT ck_ipcl_changed CHECK (cardinality(ipcl_changed) > 0)
);

-- a database where an earlier copy of this file already made the table
ALTER TABLE inventory.item_price_change_log ADD COLUMN IF NOT EXISTS ipcl_sync_date timestamptz;

CREATE INDEX IF NOT EXISTS ix_ipcl_scope_date ON inventory.item_price_change_log (ipcl_company_id, ipcl_branch_id, ipcl_changed_on DESC);
CREATE INDEX IF NOT EXISTS ix_ipcl_item_date  ON inventory.item_price_change_log (ipcl_item_id, ipcl_changed_on DESC);
CREATE INDEX IF NOT EXISTS ix_ipcl_user_date  ON inventory.item_price_change_log (ipcl_user_id, ipcl_changed_on DESC);
CREATE INDEX IF NOT EXISTS ix_ipcl_date       ON inventory.item_price_change_log (ipcl_changed_on DESC);
CREATE INDEX IF NOT EXISTS ix_ipcl_set        ON inventory.item_price_change_log (ipcl_change_set_id);

-- ── sync: exactly what public.sync_install_triggers() creates per table ──
-- Skipped where the sync functions are absent (see the header).
DO $$
BEGIN
  IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
     OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
    RAISE NOTICE 'item_price_change_log: sync functions absent, sync triggers skipped';
    RETURN;
  END IF;
  CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON inventory.item_price_change_log
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty('ipcl_sync_date');
  CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON inventory.item_price_change_log
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete('inventory', 'item_price_change_log', 'ipcl_id');
  CREATE INDEX IF NOT EXISTS ix_sync_pending_item_price_change_log
    ON inventory.item_price_change_log (ipcl_id) WHERE ipcl_sync_date IS NULL;
END $$;

COMMENT ON TABLE inventory.item_price_change_log IS
  'Append-only log of every change to item_price_master (IPM) and item_qty_price (IQP): who, when, where, device, before/after. Written only by the API''s PriceMasterWriter. See inventory/plan-price-change-log.md.';
