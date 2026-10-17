-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 120 — the plain error wording lives on the server. Every refusal
--  carries a `code` (notes 119); the words a cashier reads for it ("Cannot take
--  payment · Your till is waiting for supervisor OK. · Do: Call supervisor.")
--  are rows here, which the exception filters attach to each error as `user`,
--  and which GET /error-messages hands the apps to cache.
--
--    1. fixed.error_message — one row per code × variant × language
--    2. fixed.error_message_catalogue — the one version of the loaded
--       catalogue (the apps' `since`)
--
--  The rows are data the user approves in the share's wording files: they are
--  loaded by the TS seed `error-messages` from prisma/seed/Error_Messages.json,
--  never written here.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · the rows ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed.error_message (
    erm_id           uuid                     NOT NULL DEFAULT uuidv7(),
    -- the code as an error carries it (TILL_SESSION_NOT_OPEN), or a prefix row
    -- ending in * (HOLD_*) that words every code of it with no row of its own
    erm_code         character varying(60)    NOT NULL,
    -- '' = the plain row; field=<name> · <key>=<value> · <key>=* (any value):
    -- the same code worded by an extra field of the error (status, field)
    erm_variant      character varying(60)    NOT NULL DEFAULT '',
    erm_lang         character varying(10)    NOT NULL DEFAULT 'en',
    erm_title        character varying(60)    NOT NULL,
    erm_line         character varying(200)   NOT NULL,
    erm_todo         character varying(200)   NOT NULL,
    erm_is_active    boolean                  NOT NULL DEFAULT true,
    erm_created_on   timestamp with time zone NOT NULL DEFAULT now(),
    erm_modified_on  timestamp with time zone,
    erm_sync_date    timestamp with time zone,
    CONSTRAINT pk_error_message PRIMARY KEY (erm_id),
    CONSTRAINT uq_error_message UNIQUE (erm_code, erm_variant, erm_lang),
    CONSTRAINT ck_erm_code CHECK (erm_code ~ '^[A-Z0-9_]+\*?$'),
    CONSTRAINT ck_erm_variant CHECK (erm_variant = '' OR erm_variant ~ '^[A-Za-z0-9_.]+=.+$'),
    CONSTRAINT ck_erm_lang CHECK (erm_lang ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT ck_erm_words CHECK (btrim(erm_title) <> '' AND btrim(erm_line) <> '' AND btrim(erm_todo) <> '')
);

COMMENT ON TABLE fixed.error_message IS
    'Notes 120: the plain words for an error code, per variant and language. Loaded from prisma/seed/Error_Messages.json (the user approves the wording in the share files); attached to every error as `user` by the exception filters; served by GET /error-messages.';


-- ── 2 · the catalogue version ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed.error_message_catalogue (
    emc_id         smallint                 NOT NULL DEFAULT 1,
    emc_version    character varying(40)    NOT NULL,
    emc_row_count  integer                  NOT NULL DEFAULT 0,
    emc_loaded_on  timestamp with time zone NOT NULL DEFAULT now(),
    emc_sync_date  timestamp with time zone,
    CONSTRAINT pk_error_message_catalogue PRIMARY KEY (emc_id),
    CONSTRAINT ck_emc_one_row CHECK (emc_id = 1)
);

COMMENT ON TABLE fixed.error_message_catalogue IS
    'Notes 120: the one version of fixed.error_message (the seed file''s), which the apps send back as `since`.';


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT emc_version, emc_row_count, emc_loaded_on FROM fixed.error_message_catalogue;
-- SELECT erm_code, erm_variant, erm_title FROM fixed.error_message WHERE erm_is_active ORDER BY 1, 2;
