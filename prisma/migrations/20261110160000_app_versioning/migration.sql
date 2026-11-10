-- ════════════════════════════════════════════════════════════════════════════
-- 20261110160000_app_versioning — Part B Step 1: the three app-versioning tables
--
-- Spec:   Part B Step 1 (2026-11-10), §4 table definitions.
--         app_release          one row per released client build, per platform
--         client_installation  which build each user / device is running
--         app_legacy_usage     how often old builds still use a legacy field
-- Name:   handed over as 20261110120000_app_versioning; renamed to 160000 so it
--         sorts after 20261110150000_sales_order_list_actor_name, the newest
--         migration on DEV-v1 when this was written. Rename again at merge time
--         if newer ones have landed.
-- Runs:   once, in one transaction. Re-runnable: every statement is IF NOT
--         EXISTS.
--
-- EXPAND-ONLY. No existing table changes, and nothing in the API reads or
-- writes these tables yet (Step 2 adds the login recording and the update
-- check). Rollback before production = drop the three tables and delete this
-- row from _prisma_migrations. After production: leave them, they are inert.
--
-- Conventions: uuidv7() keys (the PG18 builtin), timestamptz(6), the standard
-- audit block on every table, CHECKs here only (Prisma cannot express them).
--   · No foreign keys on purpose: company / branch / user ids are plain uuids
--     (they match public.user_master.usr_id / usr_company_id, both uuid).
--   · No sync triggers: these rows describe this server's own clients and are
--     not pushed by the offline -> cloud sync.
--   · Every unique index is NOT partial on *_is_deleted, so Step 2 can upsert
--     on it, and a yanked release keeps its build number taken.
-- ════════════════════════════════════════════════════════════════════════════

-- ── app_release ──────────────────────────────────────────────────────────────
-- The latest available build of a platform = its highest arl_build with
-- arl_is_deleted = false. arl_is_deleted = true "yanks" a bad release.
CREATE TABLE IF NOT EXISTS public.app_release (
  arl_id            uuid            PRIMARY KEY DEFAULT uuidv7(),
  arl_platform      varchar(16)     NOT NULL,                   -- web | desktop | mobile
  arl_build         integer         NOT NULL,                   -- the number clients compare; unique per platform
  arl_version       varchar(32)     NOT NULL,                   -- display label only, e.g. 1.2.0
  arl_commit        varchar(40),                                -- short git hash
  arl_severity      varchar(16)     NOT NULL DEFAULT 'normal',  -- normal | recommended | critical
  arl_notes         text,                                       -- release notes
  arl_download_url  varchar(500),                               -- installer / store / updater link
  arl_released_at   timestamptz(6)  NOT NULL DEFAULT now(),

  arl_is_active     boolean         NOT NULL DEFAULT true,
  arl_is_deleted    boolean         NOT NULL DEFAULT false,     -- true = yanked
  arl_sync_date     timestamptz(6),
  arl_created_on    timestamptz(6)  NOT NULL DEFAULT now(),
  arl_created_by    text,
  arl_modified_on   timestamptz(6),
  arl_modified_by   text,

  CONSTRAINT ck_arl_platform CHECK (arl_platform IN ('web', 'desktop', 'mobile')),
  CONSTRAINT ck_arl_build    CHECK (arl_build > 0),
  CONSTRAINT ck_arl_severity CHECK (arl_severity IN ('normal', 'recommended', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_arl_platform_build
  ON public.app_release (arl_platform, arl_build);

-- ── client_installation ──────────────────────────────────────────────────────
-- One row per (company, user, device, platform), upserted at login (Step 2).
CREATE TABLE IF NOT EXISTS public.client_installation (
  cin_id            uuid            PRIMARY KEY DEFAULT uuidv7(),
  cin_company_id    uuid            NOT NULL,                   -- tenant
  cin_branch_id     uuid,
  cin_user_id       uuid            NOT NULL,
  cin_device_id     varchar(100)    NOT NULL DEFAULT 'unknown', -- the client's device id; 'unknown' when it sends none
  cin_platform      varchar(16)     NOT NULL,                   -- web | desktop | mobile
  cin_build         integer,                                    -- NULL = the client sent no build
  cin_version       varchar(32),                                -- support info, as the client sent it
  cin_commit        varchar(40),
  cin_os            varchar(100),
  cin_ip            varchar(60),
  cin_first_seen    timestamptz(6)  NOT NULL DEFAULT now(),
  cin_last_seen     timestamptz(6)  NOT NULL DEFAULT now(),
  cin_last_login    timestamptz(6),

  cin_is_active     boolean         NOT NULL DEFAULT true,
  cin_is_deleted    boolean         NOT NULL DEFAULT false,
  cin_sync_date     timestamptz(6),
  cin_created_on    timestamptz(6)  NOT NULL DEFAULT now(),
  cin_created_by    text,
  cin_modified_on   timestamptz(6),
  cin_modified_by   text,

  CONSTRAINT ck_cin_platform CHECK (cin_platform IN ('web', 'desktop', 'mobile'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cin_device
  ON public.client_installation (cin_company_id, cin_user_id, cin_device_id, cin_platform);
CREATE INDEX IF NOT EXISTS ix_cin_platform_build
  ON public.client_installation (cin_platform, cin_build);
CREATE INDEX IF NOT EXISTS ix_cin_last_seen
  ON public.client_installation (cin_last_seen);

-- ── app_legacy_usage ─────────────────────────────────────────────────────────
-- One counter per (legacy field, platform, build). A field can be removed once
-- no build still in use counts against it.
CREATE TABLE IF NOT EXISTS public.app_legacy_usage (
  alu_id            uuid            PRIMARY KEY DEFAULT uuidv7(),
  alu_name          varchar(100)    NOT NULL,                   -- e.g. sale-bill.request.rate
  alu_platform      varchar(16)     NOT NULL DEFAULT 'unknown', -- web | desktop | mobile | unknown
  alu_build         integer         NOT NULL DEFAULT -1,        -- -1 = unknown build
  alu_count         integer         NOT NULL DEFAULT 0,         -- usage count
  alu_first_seen    timestamptz(6)  NOT NULL DEFAULT now(),
  alu_last_seen     timestamptz(6)  NOT NULL DEFAULT now(),

  alu_is_active     boolean         NOT NULL DEFAULT true,
  alu_is_deleted    boolean         NOT NULL DEFAULT false,
  alu_sync_date     timestamptz(6),
  alu_created_on    timestamptz(6)  NOT NULL DEFAULT now(),
  alu_created_by    text,
  alu_modified_on   timestamptz(6),
  alu_modified_by   text,

  CONSTRAINT ck_alu_platform CHECK (alu_platform IN ('web', 'desktop', 'mobile', 'unknown'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_alu_key
  ON public.app_legacy_usage (alu_name, alu_platform, alu_build);
