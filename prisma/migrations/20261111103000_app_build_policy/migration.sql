-- ════════════════════════════════════════════════════════════════════════════
-- 20261111103000_app_build_policy — Part B Step 2 Rev 2: build match + logout on update
--
-- Spec:   Part B Step 2 Rev 2 (2026-11-11), §3B, §4, §5.1 and decision D2.
--         app_build_policy  the client build the backend expects, per platform
--         app_auth_state    token epoch + the backend build it was last raised for
-- Name:   sorts after 20261111100000_stock_reservation_source_live_only, the newest
--         migration on DEV-v1 when this was written. Rename at merge time if
--         newer ones have landed.
-- Runs:   once, in one transaction. Re-runnable: every statement is IF NOT
--         EXISTS / ON CONFLICT DO NOTHING.
--
-- EXPAND-ONLY. No existing table changes. The seeded rows switch nothing on:
-- every platform starts at abp_enforce = false (no build check), and the epoch
-- starts at 0, which is what a token minted before Rev 2 (no `ep` claim) reads
-- as. The first backend start with APP_BUILD + a compat manifest raises the
-- epoch to 1 and logs everyone out once (that start IS a backend update).
--
-- Rollback before production = drop the two tables and delete this row from
-- _prisma_migrations. The API then fails open: no build check, epoch 0.
--
-- Conventions: uuidv7() keys, timestamptz(6), the standard audit block, CHECKs
-- here only (Prisma cannot express them). No sync triggers: both tables
-- describe this server, not business data, and are not pushed by the sync.
-- ════════════════════════════════════════════════════════════════════════════

-- ── app_build_policy ─────────────────────────────────────────────────────────
-- One row per platform. abp_enforce = true: a login / refresh whose X-App-Build
-- is not exactly abp_expected_build gets 426 UPDATE_REQUIRED.
-- abp_source: 'manifest' rows are rewritten from the bundled compat manifest
-- when the backend build changes; 'manual' rows (set through the admin API)
-- are left alone until an admin hands them back to the manifest.
CREATE TABLE IF NOT EXISTS public.app_build_policy (
  abp_id              uuid            PRIMARY KEY DEFAULT uuidv7(),
  abp_platform        varchar(16)     NOT NULL,                     -- web | desktop | mobile
  abp_enforce         boolean         NOT NULL DEFAULT false,       -- false = no build check
  abp_expected_build  integer,                                      -- the one build a client must run
  abp_message         text,                                         -- shown to the user on 426
  abp_download_url    varchar(500),                                 -- installer / store / reload link
  abp_source          varchar(16)     NOT NULL DEFAULT 'manifest',  -- manifest | manual

  abp_is_active       boolean         NOT NULL DEFAULT true,
  abp_is_deleted      boolean         NOT NULL DEFAULT false,
  abp_sync_date       timestamptz(6),
  abp_created_on      timestamptz(6)  NOT NULL DEFAULT now(),
  abp_created_by      text,
  abp_modified_on     timestamptz(6),
  abp_modified_by     text,

  CONSTRAINT ck_abp_platform        CHECK (abp_platform IN ('web', 'desktop', 'mobile')),
  CONSTRAINT ck_abp_expected_build  CHECK (abp_expected_build IS NULL OR abp_expected_build > 0),
  CONSTRAINT ck_abp_source          CHECK (abp_source IN ('manifest', 'manual')),
  -- Enforcing with no expected build would refuse every client of the platform.
  CONSTRAINT ck_abp_enforce_build   CHECK (NOT abp_enforce OR abp_expected_build IS NOT NULL)
);

-- Not partial on abp_is_deleted: the API upserts on it.
CREATE UNIQUE INDEX IF NOT EXISTS ux_abp_platform
  ON public.app_build_policy (abp_platform);

INSERT INTO public.app_build_policy (abp_platform, abp_enforce, abp_source, abp_created_by)
VALUES ('web', false, 'manifest', 'migration'),
       ('desktop', false, 'manifest', 'migration'),
       ('mobile', false, 'manifest', 'migration')
ON CONFLICT (abp_platform) DO NOTHING;

-- ── app_auth_state ───────────────────────────────────────────────────────────
-- One row (aas_key = 'auth'). Every access and refresh token carries the epoch
-- it was minted under (`ep`); a token below aas_token_epoch is refused with 401
-- AUTH_BACKEND_UPDATED. At startup, under an advisory lock, a backend whose
-- APP_BUILD differs from aas_last_build raises the epoch by one and records
-- its build, in the same transaction that writes the manifest into
-- app_build_policy. A restart on the same build changes nothing.
CREATE TABLE IF NOT EXISTS public.app_auth_state (
  aas_id                uuid            PRIMARY KEY DEFAULT uuidv7(),
  aas_key               varchar(32)     NOT NULL,                 -- 'auth' (the only row)
  aas_token_epoch       integer         NOT NULL DEFAULT 0,       -- tokens below it are dead
  aas_last_build        integer,                                  -- APP_BUILD the epoch was last raised for; NULL = never
  aas_last_version      varchar(32),                              -- APP_VERSION at that start (support info)
  aas_last_commit       varchar(40),                              -- APP_COMMIT at that start (support info)
  aas_epoch_changed_on  timestamptz(6),

  aas_is_active         boolean         NOT NULL DEFAULT true,
  aas_is_deleted        boolean         NOT NULL DEFAULT false,
  aas_sync_date         timestamptz(6),
  aas_created_on        timestamptz(6)  NOT NULL DEFAULT now(),
  aas_created_by        text,
  aas_modified_on       timestamptz(6),
  aas_modified_by       text,

  CONSTRAINT ck_aas_key          CHECK (aas_key IN ('auth')),
  CONSTRAINT ck_aas_token_epoch  CHECK (aas_token_epoch >= 0),
  CONSTRAINT ck_aas_last_build   CHECK (aas_last_build IS NULL OR aas_last_build > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_aas_key
  ON public.app_auth_state (aas_key);

INSERT INTO public.app_auth_state (aas_key, aas_token_epoch, aas_created_by)
VALUES ('auth', 0, 'migration')
ON CONFLICT (aas_key) DO NOTHING;
