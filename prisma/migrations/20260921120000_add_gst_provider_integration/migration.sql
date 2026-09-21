-- ═══════════════════════════════════════════════════════════════════════════
--  GST Suvidha Provider (GSP) integration
--
--  Replaces the two first-draft tables fixed.gsp_provider_master and
--  fixed.gsp_company_service, which modelled ONE provider making ONE call:
--  a single gsp_base_url + gsp_route, credentials sitting on the provider
--  row, and csg_gsp_provider_id carrying no foreign key at all. Every GST
--  service needs at least four calls (authenticate, generate, cancel, fetch),
--  so that shape was already exhausted by the first provider.
--
--  What this migration is for. Four services go out over a GSP:
--      EINVOICE      — IRN generate / cancel / fetch
--      EWAYBILL      — generate, Part-B vehicle update, extend, cancel
--      GSTIN_VERIFY  — taxpayer lookup behind the GSTIN fetch buttons
--      GSTR          — returns push and filing status
--  and the business result of all of them ALREADY has a home:
--  accounts.acc_voucher_doc_einvoice (gde_) and acc_voucher_doc_ewaybill
--  (gdw_). Nothing here restates an IRN, an ack number or an e-way bill
--  number. These tables describe HOW to reach a provider and WHERE in its
--  reply each of those facts is hiding.
--
--  The design constraint that shaped everything: adding a SECOND provider
--  must be an INSERT, not a deployment. So the route of every call
--  (gst_provider_endpoint), the shape of every reply
--  (gst_provider_field_map) and the meaning of every error code
--  (gst_provider_error_map) are rows, not code.
--
--  ── Placement ───────────────────────────────────────────────────────────
--  Everything lives in `public`, for the reason the app-settings tables give
--  about themselves: every module has settings, and no module should reach
--  into another's schema to read them. GST is the same shape — sales raises
--  the IRN, purchase verifies a supplier's GSTIN, accounts files the return
--  — so it belongs to no single module's schema.
--
--  `fixed` was the first draft's home and is rejected on two grounds. It is
--  read-only reference data that the numbered chain never writes to
--  (state_codes, device_list_master), whereas a credential is company-scoped
--  and admin-edited and a session row is rewritten every six hours. And
--  public.ensure_acc_year_partitions does not know about `fixed` at all — a
--  partitioned table there is silently skipped by the April 1st ritual and
--  fails at the first insert of the new year. gst_api_log is partitioned
--  today; putting the family anywhere else builds that trap in on purpose.
--
--  Nothing here touches `fixed`. The only dependencies are public.companys,
--  public.branch_master and the two accounts.acc_voucher_doc_* tables.
--
--  ── What this migration does NOT do ─────────────────────────────────────
--  It does not drop fixed.gsp_provider_master or fixed.gsp_company_service.
--  Both hold rows in this database (2 and 1 at the time of writing) and a
--  drop that turns out to have mattered is recoverable from nowhere. The
--  retirement script, with the field-by-field map of where each old column
--  went, is at the bottom of this file and is run BY HAND.
--
--  House rules: uuidv7() keys (PostgreSQL 18 built-in), varchar + CHECK for
--  statuses, pk_/ux_/ck_/fk_ constraint names, ix_/ux_ indexes, the standard
--  audit block. The config tables are MASTERS — no acc_year, no
--  partitioning. public.gst_api_log is the one transaction table here and is
--  partitioned by acc_year like public.txn_status_log.
-- ═══════════════════════════════════════════════════════════════════════════

-- No CREATE SCHEMA: everything below is in `public`, which always exists.


-- ───────────────────────────────────────────────────────────────────────────
--  1. The provider catalogue
--
--  One row per GSP, and nothing that varies per company, per service or per
--  environment. In particular NO base url and NO credentials: the first
--  draft put both here, and both are wrong at this grain — a provider serves
--  several services from several hosts, and its credentials belong to the
--  GSTIN that logs in, not to the provider.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_provider
(
    gpv_id                  uuid NOT NULL DEFAULT uuidv7(),

    -- Short stable handle used in seeds, logs and support calls: 'NIC',
    -- 'CYGNET', 'CLEARTAX'. Never renamed — retire the row instead.
    gpv_code                character varying(20)  NOT NULL,
    gpv_name                character varying(150) NOT NULL,

    -- Where a human goes when the integration misbehaves. Not used by code.
    gpv_portal_url          text,
    gpv_support_email       character varying(120),
    gpv_support_phone       character varying(20),

    -- Defaults inherited by every service and endpoint below unless they
    -- override. A provider-wide timeout is the honest place for "this GSP is
    -- slow"; per-call tuning is still possible further down.
    gpv_timeout_ms          integer  NOT NULL DEFAULT 30000,
    gpv_max_retries         smallint NOT NULL DEFAULT 2,

    -- Calls per minute the contract allows, NULL = unmetered. The dispatcher
    -- throttles on it; a shop with four tills can otherwise trip a limit that
    -- no single till would notice.
    gpv_rate_limit_per_min  smallint,

    gpv_remarks             character varying(500),

    -- ── Lifecycle ────────────────────────────────────────────────────────
    gpv_is_active           boolean NOT NULL DEFAULT true,

    -- ── Audit ────────────────────────────────────────────────────────────
    gpv_is_deleted          boolean NOT NULL DEFAULT false,
    gpv_sync_date           timestamp(6) with time zone,
    gpv_created_on          timestamp(6) with time zone NOT NULL DEFAULT now(),
    gpv_created_by          character varying(50) NOT NULL,
    gpv_modified_on         timestamp(6) with time zone,
    gpv_modified_by         character varying(50),

    CONSTRAINT pk_gst_provider PRIMARY KEY (gpv_id),

    -- A real UNIQUE constraint, not a partial index: nothing FKs the code
    -- today, but a retired provider must keep its code reserved rather than
    -- freeing it for a different company's integration.
    CONSTRAINT ux_gst_provider_code UNIQUE (gpv_code),

    CONSTRAINT ck_gpv_code_shape CHECK (gpv_code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT ck_gpv_timeout    CHECK (gpv_timeout_ms BETWEEN 1000 AND 600000),
    CONSTRAINT ck_gpv_retries    CHECK (gpv_max_retries BETWEEN 0 AND 10),
    CONSTRAINT ck_gpv_rate_limit CHECK (gpv_rate_limit_per_min IS NULL
                                        OR gpv_rate_limit_per_min > 0)
);

ALTER TABLE IF EXISTS public.gst_provider OWNER to postgres;


-- ───────────────────────────────────────────────────────────────────────────
--  2. Provider × service × environment
--
--  This table exists because a base url is NOT a property of a provider.
--  NIC serves e-invoice from einvapi and e-way bill from ewaybillapi — two
--  hosts, one provider — and every GSP publishes a sandbox host beside the
--  production one. Three facts vary together (provider, service,
--  environment), so they are one row.
--
--  Switching a company from sandbox to production is therefore a credential
--  edit, not a config rewrite: the sandbox rows stay exactly where they are.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_provider_service
(
    gps_id                      uuid NOT NULL DEFAULT uuidv7(),
    gps_gpv_id                  uuid NOT NULL,

    gps_service                 character varying(20) NOT NULL,
    gps_environment             character varying(10) NOT NULL,

    -- Scheme + host, no trailing slash. Paths come from the endpoint rows,
    -- version included — Chartered versions eivital (v1.04) and eicore (v1.03)
    -- independently, so the version cannot live up here.
    gps_base_url                text NOT NULL,

    -- Alternate hosts the GSP publishes for the same service. Chartered lists
    -- regional clusters behind DNS round-robin, but names them individually
    -- precisely because the round-robin sometimes has to be bypassed. Trying
    -- them in order is cheaper than a failover to a different PROVIDER, which
    -- is what gcc_priority does — this is the same provider, another door.
    gps_fallback_urls           text[],

    -- How a session is opened. NIC_SEK is the government's own scheme
    -- (AppKey encrypted with the IRP public key, reply carries AuthToken plus
    -- a Sek session key); the rest are ordinary API styles a wrapper GSP
    -- puts in front of it.
    gps_auth_scheme             character varying(20) NOT NULL,

    -- No gps_auth_path. Authenticating is a call like any other, so it is
    -- described where every other call is described: the AUTH row in
    -- gst_provider_endpoint, which also carries the headers, the envelope
    -- descriptors and the redact-before-logging paths that an auth call needs
    -- more than most. A path here as well would be the same fact in two
    -- places, free to disagree, with nothing to say which one wins.

    -- The GSP's own account is NOT here — see gst_provider_account. A GSP
    -- that sells you e-invoice, e-way bill AND returns issues ONE account
    -- covering all of them, so storing it per service would repeat the same
    -- secret across every row this table has for that provider.

    -- How long a token lives when the reply does not say. NIC issues six
    -- hours. The margin is how early to renew — renewing exactly at expiry
    -- races every in-flight request against the clock.
    gps_token_ttl_minutes       smallint NOT NULL DEFAULT 360,
    gps_refresh_margin_minutes  smallint NOT NULL DEFAULT 15,

    -- Whether WE encrypt the payload or the GSP does it for us. This is the
    -- single biggest behavioural difference between talking to NIC directly
    -- and talking to a wrapper, and it is not derivable from anything else.
    gps_payload_encryption      character varying(10) NOT NULL DEFAULT 'NONE',

    -- NULL = inherit the provider's value.
    gps_timeout_ms              integer,
    gps_max_retries             smallint,

    gps_remarks                 character varying(500),

    gps_is_active               boolean NOT NULL DEFAULT true,

    -- ── Audit ────────────────────────────────────────────────────────────
    gps_is_deleted              boolean NOT NULL DEFAULT false,
    gps_sync_date               timestamp(6) with time zone,
    gps_created_on              timestamp(6) with time zone NOT NULL DEFAULT now(),
    gps_created_by              character varying(50) NOT NULL,
    gps_modified_on             timestamp(6) with time zone,
    gps_modified_by             character varying(50),

    CONSTRAINT pk_gst_provider_service PRIMARY KEY (gps_id),

    CONSTRAINT fk_gps_provider FOREIGN KEY (gps_gpv_id)
        REFERENCES public.gst_provider (gpv_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT ck_gps_service CHECK (gps_service::text = ANY (ARRAY[
        'EINVOICE'::text, 'EWAYBILL'::text, 'GSTIN_VERIFY'::text, 'GSTR'::text,
        -- the provider's own account surface (/aspapi/…): balance, settings,
        -- transaction log. Not a statutory service, but it has its own host
        -- and its own endpoints, so it is a service row like any other.
        'ASP_ADMIN'::text])),

    CONSTRAINT ck_gps_environment CHECK (gps_environment::text = ANY (ARRAY[
        'SANDBOX'::text, 'PRODUCTION'::text])),

    CONSTRAINT ck_gps_auth_scheme CHECK (gps_auth_scheme::text = ANY (ARRAY[
        'NIC_SEK'::text, 'OAUTH2'::text, 'API_KEY'::text,
        'BASIC'::text, 'BEARER_STATIC'::text, 'CUSTOM'::text])),

    CONSTRAINT ck_gps_payload_encryption CHECK (gps_payload_encryption::text = ANY (ARRAY[
        'NONE'::text, 'AES_SEK'::text, 'RSA'::text])),

    CONSTRAINT ck_gps_base_url  CHECK (gps_base_url ~ '^https?://'
                                       AND gps_base_url !~ '/$'),
    CONSTRAINT ck_gps_ttl       CHECK (gps_token_ttl_minutes > 0),
    CONSTRAINT ck_gps_margin    CHECK (gps_refresh_margin_minutes >= 0
                                       AND gps_refresh_margin_minutes < gps_token_ttl_minutes),
    CONSTRAINT ck_gps_timeout   CHECK (gps_timeout_ms IS NULL
                                       OR gps_timeout_ms BETWEEN 1000 AND 600000),
    CONSTRAINT ck_gps_retries   CHECK (gps_max_retries IS NULL
                                       OR gps_max_retries BETWEEN 0 AND 10)
);

ALTER TABLE IF EXISTS public.gst_provider_service OWNER to postgres;

-- One live row per provider × service × environment. Without it a second
-- PRODUCTION e-invoice row for the same GSP makes base-url resolution a coin
-- toss, and the seed's own lookups (SELECT gps_id ... WHERE service AND
-- environment) would return an arbitrary one of them.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gps_provider_service_env
    ON public.gst_provider_service USING btree
    (gps_gpv_id, gps_service, gps_environment)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gps_is_deleted = false;

-- FK-covering, and non-partial so the Prisma model can declare it: retiring a
-- provider cascades into this table and should not seq-scan to find out how.
CREATE INDEX IF NOT EXISTS ix_gps_provider
    ON public.gst_provider_service USING btree (gps_gpv_id);


-- ───────────────────────────────────────────────────────────────────────────
--  2b. The GSP's own account — CREDENTIAL #1
--
--  There are two credentials in this integration and they sit at different
--  grains. This is the first: the API credentials the GSP (Chartered,
--  Cygnet, ClearTax …) issues to identify THIS ERP INSTALLATION to their
--  gateway. The second — the taxpayer's own portal user, per GSTIN — is
--  gst_company_credential. Most GSPs need both, and they rotate on
--  different schedules, which is the whole reason they are not one row.
--
--  Grain is provider × ENVIRONMENT, not per service. A GSP that sells
--  e-invoice, e-way bill and returns issues ONE account for all of it; the
--  sandbox account is a different one. Keying it per service would copy the
--  same secret across four rows and make rotation a hunt.
--
--  gpa_service is nevertheless present and NULLABLE, because a few
--  providers do issue separate accounts per service:
--        NULL  -> covers every service this provider offers   (the norm)
--        set   -> overrides the NULL row for that one service (the exception)
--  Resolution is most-specific-wins, the same precedence gst_provider_error_map
--  uses for gem_service:
--
--      SELECT * FROM public.gst_provider_account
--       WHERE gpa_gpv_id = :provider AND gpa_environment = :env
--         AND (gpa_service = :service OR gpa_service IS NULL)
--         AND gpa_is_active AND NOT gpa_is_deleted
--       ORDER BY gpa_service NULLS LAST
--       LIMIT 1;
--
--  A direct-to-NIC provider has NO row here at all: there is no middleman to
--  authenticate to, only the per-GSTIN AppKey on gst_company_credential.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_provider_account
(
    gpa_id                  uuid NOT NULL DEFAULT uuidv7(),
    gpa_gpv_id              uuid NOT NULL,

    gpa_environment         character varying(10) NOT NULL,
    gpa_service             character varying(20),

    -- Your customer / account number with the GSP. Not a secret, and the
    -- first thing their support desk asks for.
    gpa_account_ref         character varying(100),

    -- Application-encrypted, same scheme and key as every other _enc column.
    gpa_client_id_enc       text,
    gpa_client_secret_enc   text,
    gpa_api_key_enc         text,
    gpa_key_version         smallint NOT NULL DEFAULT 1,

    -- Contract window. A GSP contract lapses on a date somebody agreed to a
    -- year ago; without this the first anybody knows is bills not printing.
    gpa_valid_from          date,
    gpa_valid_upto          date,

    -- Most GSPs sell IRNs in blocks. Running the balance down mid-morning
    -- stops every counter at once, so it is worth a column and an alert
    -- rather than a phone call from the shop floor.
    gpa_credit_balance      numeric(14,2),
    gpa_balance_checked_on  timestamp(6) with time zone,

    gpa_last_verified_on    timestamp(6) with time zone,
    gpa_remarks             character varying(500),

    gpa_is_active           boolean NOT NULL DEFAULT true,

    -- ── Audit ────────────────────────────────────────────────────────────
    gpa_is_deleted          boolean NOT NULL DEFAULT false,
    gpa_sync_date           timestamp(6) with time zone,
    gpa_created_on          timestamp(6) with time zone NOT NULL DEFAULT now(),
    gpa_created_by          character varying(50) NOT NULL,
    gpa_modified_on         timestamp(6) with time zone,
    gpa_modified_by         character varying(50),

    CONSTRAINT pk_gst_provider_account PRIMARY KEY (gpa_id),

    CONSTRAINT fk_gpa_provider FOREIGN KEY (gpa_gpv_id)
        REFERENCES public.gst_provider (gpv_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT ck_gpa_environment CHECK (gpa_environment::text = ANY (ARRAY[
        'SANDBOX'::text, 'PRODUCTION'::text])),

    CONSTRAINT ck_gpa_service CHECK (gpa_service IS NULL OR
        gpa_service::text = ANY (ARRAY[
            'EINVOICE'::text, 'EWAYBILL'::text,
            'GSTIN_VERIFY'::text, 'GSTR'::text, 'ASP_ADMIN'::text])),

    CONSTRAINT ck_gpa_key_ver  CHECK (gpa_key_version >= 1),
    CONSTRAINT ck_gpa_validity CHECK (gpa_valid_from IS NULL
                                      OR gpa_valid_upto IS NULL
                                      OR gpa_valid_from <= gpa_valid_upto),
    CONSTRAINT ck_gpa_balance  CHECK (gpa_credit_balance IS NULL
                                      OR gpa_credit_balance >= 0)
);

ALTER TABLE IF EXISTS public.gst_provider_account OWNER to postgres;

-- NULLS NOT DISTINCT: without it two "covers every service" rows for the same
-- provider and environment — both with a NULL service — would each be treated
-- as unique, and the resolution above would pick one of them at random.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gpa_provider_env_service
    ON public.gst_provider_account USING btree
    (gpa_gpv_id, gpa_environment, gpa_service)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gpa_is_deleted = false;

-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_gpa_provider
    ON public.gst_provider_account USING btree (gpa_gpv_id);


-- ───────────────────────────────────────────────────────────────────────────
--  3. One row per call
--
--  This is the table the first draft's single `gsp_route` column was trying
--  to be. An action is the vocabulary the application speaks — the sale bill
--  asks for GENERATE_IRN and does not know, or care, what path that is on
--  this provider.
--
--  The envelope columns are the other half of provider independence. Every
--  GSP wraps the same NIC payload differently: {"Status":1,"Data":{…}} here,
--  {"success":true,"result":{…}} there. Describing the envelope as four
--  paths means the dispatcher can find the payload, decide success and read
--  an error code without knowing whose reply it is holding.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_provider_endpoint
(
    gpe_id                  uuid NOT NULL DEFAULT uuidv7(),
    gpe_gps_id              uuid NOT NULL,

    gpe_action              character varying(30) NOT NULL,

    gpe_http_method         character varying(6)  NOT NULL DEFAULT 'POST',

    -- Appended to gps_base_url. May carry {placeholders} filled from the
    -- request context: {irn}, {gstin}, {ewbNo}, {period}.
    gpe_path_template       text NOT NULL,
    gpe_query_template      text,

    gpe_content_type        character varying(60) NOT NULL DEFAULT 'application/json',

    -- Static/templated headers, e.g.
    --   {"Gstin":"{gstin}","user_name":"{loginId}","AuthToken":"{authToken}"}
    -- Values are substituted from the request context and the live session.
    -- jsonb because the header SET differs per provider, not just the values.
    gpe_headers             jsonb,

    -- The key the body is nested under, if any: 'Data' for NIC-style
    -- wrappers, NULL when the body is posted bare.
    gpe_request_wrapper     character varying(30),

    -- JSONPaths blanked before the exchange is written to public.gst_api_log.
    -- The AUTH request body literally contains the portal password, and the
    -- headers of every other call carry a live AuthToken — logged verbatim
    -- they become credentials with a longer life than the session that
    -- issued them. Redaction is a config row and not a code branch precisely
    -- so that adding a provider cannot forget it.
    gpe_redact_paths        jsonb,

    -- ── Envelope descriptors ─────────────────────────────────────────────
    -- Where the useful object starts, how to tell success, and where the
    -- error code and message live when it is not.
    gpe_response_root_path  text,
    gpe_success_path        text,
    gpe_success_value       character varying(20),
    gpe_error_code_path     text,
    gpe_error_message_path  text,

    -- NULL = inherit the service, which inherits the provider.
    gpe_timeout_ms          integer,
    gpe_max_retries         smallint,

    -- Safe to send again after a timeout. FALSE for GENERATE_IRN: a reply
    -- that never arrived may still have minted an IRN, and the correct
    -- recovery is GET_IRN, not a second generate.
    gpe_is_idempotent       boolean NOT NULL DEFAULT false,

    gpe_remarks             character varying(500),

    gpe_is_active           boolean NOT NULL DEFAULT true,

    -- ── Audit ────────────────────────────────────────────────────────────
    gpe_is_deleted          boolean NOT NULL DEFAULT false,
    gpe_sync_date           timestamp(6) with time zone,
    gpe_created_on          timestamp(6) with time zone NOT NULL DEFAULT now(),
    gpe_created_by          character varying(50) NOT NULL,
    gpe_modified_on         timestamp(6) with time zone,
    gpe_modified_by         character varying(50),

    CONSTRAINT pk_gst_provider_endpoint PRIMARY KEY (gpe_id),

    CONSTRAINT fk_gpe_service FOREIGN KEY (gpe_gps_id)
        REFERENCES public.gst_provider_service (gps_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,

    -- The application's vocabulary. Adding a provider must never add an
    -- action; adding a CAPABILITY may.
    CONSTRAINT ck_gpe_action CHECK (gpe_action::text = ANY (ARRAY[
        'AUTH'::text,
        -- e-invoice
        'GENERATE_IRN'::text, 'CANCEL_IRN'::text,
        'GET_IRN'::text, 'GET_IRN_BY_DOC'::text,
        -- e-way bill. The full vocabulary is seeded here even though a
        -- counter will only ever call a handful, because this list is a
        -- CHECK: adding a value later is an ALTER on a live table, and the
        -- provider's catalogue is already published and finite.
        'GENERATE_EWB'::text, 'GENERATE_EWB_BY_IRN'::text,
        'UPDATE_PART_B'::text, 'UPDATE_TRANSPORTER'::text,
        'EXTEND_VALIDITY'::text, 'CANCEL_EWB'::text, 'REJECT_EWB'::text,
        'CLOSE_EWB'::text, 'GET_EWB'::text, 'PRINT_EWB'::text,
        'GET_EWB_BY_DATE'::text, 'GET_EWB_FOR_TRANSPORTER'::text,
        'GET_EWB_OTHER_PARTY'::text, 'GET_EWB_REJECTED'::text,
        'GENERATE_CONSOLIDATED_EWB'::text, 'REGENERATE_CONSOLIDATED_EWB'::text,
        'GET_CONSOLIDATED_EWB'::text, 'PRINT_CONSOLIDATED_EWB'::text,
        'INIT_MULTI_VEHICLE'::text, 'ADD_MULTI_VEHICLE'::text,
        'CHANGE_MULTI_VEHICLE'::text,
        -- lookups
        'VERIFY_GSTIN'::text, 'SYNC_GSTIN'::text,
        'GET_TRANSIN'::text, 'GET_HSN'::text,
        -- returns
        'GSTR1_SAVE'::text, 'GSTR1_SUBMIT'::text, 'GSTR_STATUS'::text,
        -- housekeeping. Both of these feed OUR OWN tables rather than a
        -- document: GET_API_BALANCE refreshes gpa_credit_balance before it
        -- runs out mid-morning, and GET_ERROR_LIST pulls the provider's
        -- current code list so gst_provider_error_map can be topped up
        -- without waiting to meet each code in production.
        'GET_API_BALANCE'::text, 'GET_ERROR_LIST'::text,
        'HEALTH'::text])),

    CONSTRAINT ck_gpe_http_method CHECK (gpe_http_method::text = ANY (ARRAY[
        'GET'::text, 'POST'::text, 'PUT'::text, 'PATCH'::text, 'DELETE'::text])),

    CONSTRAINT ck_gpe_path      CHECK (gpe_path_template ~ '^/'),
    CONSTRAINT ck_gpe_headers   CHECK (gpe_headers IS NULL
                                       OR jsonb_typeof(gpe_headers) = 'object'),
    CONSTRAINT ck_gpe_redact    CHECK (gpe_redact_paths IS NULL
                                       OR jsonb_typeof(gpe_redact_paths) = 'array'),
    CONSTRAINT ck_gpe_timeout   CHECK (gpe_timeout_ms IS NULL
                                       OR gpe_timeout_ms BETWEEN 1000 AND 600000),
    CONSTRAINT ck_gpe_retries   CHECK (gpe_max_retries IS NULL
                                       OR gpe_max_retries BETWEEN 0 AND 10),

    -- A success test needs both halves or neither.
    CONSTRAINT ck_gpe_success_pair CHECK (
        (gpe_success_path IS NULL     AND gpe_success_value IS NULL) OR
        (gpe_success_path IS NOT NULL AND gpe_success_value IS NOT NULL))
);

ALTER TABLE IF EXISTS public.gst_provider_endpoint OWNER to postgres;

-- One live route per action per service. A second GENERATE_IRN row would
-- make dispatch a coin toss.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gpe_service_action
    ON public.gst_provider_endpoint USING btree (gpe_gps_id, gpe_action)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gpe_is_deleted = false;

-- FK-covering. ux_gpe_service_action leads on the same column but is partial,
-- so the planner may not use it for the cascade.
CREATE INDEX IF NOT EXISTS ix_gpe_service
    ON public.gst_provider_endpoint USING btree (gpe_gps_id);


-- ───────────────────────────────────────────────────────────────────────────
--  4. Field mapping — the half that fills our columns
--
--  RESPONSE rows are the point of this table. They say: whatever this
--  provider calls the IRN, and wherever it buries it, put it in gde_irn.
--  That is what makes provider #2 an INSERT.
--
--  REQUEST rows exist but are deliberately narrow — headers, auth
--  substitution, per-provider wrapper quirks. The invoice body itself is
--  built in code from one canonical DTO, because the NIC schema is ~140
--  nested, conditional, arithmetic-checked fields; expressing that as a flat
--  path map would move a validation problem into data, where nothing can
--  type-check it. Providers differ in how they wrap and encrypt the body.
--  They do not differ in the body: that one belongs to the government.
--
--  gfm_target_column is what closes the loop to the ERP. It names the actual
--  destination — gde_irn, gde_ack_no, gdw_no, gdw_valid_upto — so the write
--  back into accounts.acc_voucher_doc_einvoice / _ewaybill is data-driven
--  too, not a switch statement that has to be edited per provider.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_provider_field_map
(
    gfm_id              uuid NOT NULL DEFAULT uuidv7(),
    gfm_gpe_id          uuid NOT NULL,

    gfm_direction       character varying(10) NOT NULL,

    -- Our canonical name, the contract between the mapping engine and the
    -- rest of the server: 'irn', 'ack_no', 'ack_on', 'signed_invoice',
    -- 'signed_qrcode', 'ewb_no', 'ewb_valid_upto', 'auth_token',
    -- 'session_key', 'expires_on', 'legal_name', 'state_code'.
    gfm_our_field       character varying(60) NOT NULL,

    -- JSONPath into the reply, evaluated from gpe_response_root_path when
    -- that is set: '$.Irn', '$.AckDt', '$.data.result.irn'.
    gfm_their_path      text NOT NULL,

    gfm_data_type       character varying(10) NOT NULL DEFAULT 'TEXT',

    -- Applied after extraction. NIC dates arrive as 'dd/MM/yyyy HH:mm:ss',
    -- the signed invoice is a JWT whose payload holds the real object, and
    -- the QR is base64 — none of which a path expression can undo.
    gfm_transform       character varying(30) NOT NULL DEFAULT 'NONE',
    gfm_format_mask     character varying(40),

    -- A required field that does not arrive fails the call loudly rather
    -- than writing a half-populated e-invoice row.
    gfm_is_required     boolean NOT NULL DEFAULT false,
    gfm_default_value   text,

    -- The physical destination, when this field is persisted:
    -- 'gde_irn', 'gde_ack_no', 'gdw_no', … NULL for values that are only
    -- used in-flight (auth_token, session_key).
    gfm_target_column   character varying(64),

    gfm_sort_order      smallint NOT NULL DEFAULT 0,

    -- ── Audit ────────────────────────────────────────────────────────────
    gfm_is_deleted      boolean NOT NULL DEFAULT false,
    gfm_sync_date       timestamp(6) with time zone,
    gfm_created_on      timestamp(6) with time zone NOT NULL DEFAULT now(),
    gfm_created_by      character varying(50) NOT NULL,
    gfm_modified_on     timestamp(6) with time zone,
    gfm_modified_by     character varying(50),

    CONSTRAINT pk_gst_provider_field_map PRIMARY KEY (gfm_id),

    CONSTRAINT fk_gfm_endpoint FOREIGN KEY (gfm_gpe_id)
        REFERENCES public.gst_provider_endpoint (gpe_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT ck_gfm_direction CHECK (gfm_direction::text = ANY (ARRAY[
        'REQUEST'::text, 'RESPONSE'::text])),

    CONSTRAINT ck_gfm_data_type CHECK (gfm_data_type::text = ANY (ARRAY[
        'TEXT'::text, 'INT'::text, 'DECIMAL'::text, 'BOOL'::text,
        'DATE'::text, 'DATETIME'::text, 'JSON'::text])),

    CONSTRAINT ck_gfm_transform CHECK (gfm_transform::text = ANY (ARRAY[
        'NONE'::text, 'TRIM'::text, 'UPPER'::text, 'LOWER'::text,
        'DATE_DDMMYYYY'::text, 'DATETIME_NIC'::text, 'EPOCH_MS'::text,
        -- Parse using gfm_format_mask. Needed because one provider is not
        -- internally consistent: Chartered's e-invoice returns AckDt in the
        -- NIC 24-hour form, while its e-way bill returns
        -- '16/09/2017 10:30:00 AM' — a 12-hour clock. One transform with a
        -- per-row mask beats a new enum value per date dialect.
        'DATETIME_MASK'::text,
        'BASE64_DECODE'::text, 'JWT_PAYLOAD'::text, 'JSON_PARSE'::text])),

    CONSTRAINT ck_gfm_path  CHECK (gfm_their_path ~ '^\$'),

    -- A required field with a default is a contradiction: the default would
    -- silence exactly the absence the flag exists to catch.
    CONSTRAINT ck_gfm_required_default CHECK (
        gfm_is_required = false OR gfm_default_value IS NULL)
);

ALTER TABLE IF EXISTS public.gst_provider_field_map OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gfm_endpoint_field
    ON public.gst_provider_field_map USING btree
    (gfm_gpe_id, gfm_direction, gfm_our_field)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gfm_is_deleted = false;

-- The mapping engine's own read: one endpoint's rows, in order.
CREATE INDEX IF NOT EXISTS ix_gfm_endpoint
    ON public.gst_provider_field_map USING btree
    (gfm_gpe_id, gfm_direction, gfm_sort_order)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gfm_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  5. Error mapping
--
--  Provider error codes are the other thing that changes when the provider
--  does, and the one place where guessing is expensive. NIC's 2150 means
--  "duplicate IRN" and carries the EXISTING IRN in the error payload — the
--  correct response is to store that IRN and carry on, not to show a red
--  dialog to a person holding a printed bill.
--
--  gem_should_reauth is what turns an expired token into a silent retry.
--  gem_is_retryable is what keeps a validation error from being retried
--  three times before failing anyway.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_provider_error_map
(
    gem_id                  uuid NOT NULL DEFAULT uuidv7(),
    gem_gpv_id              uuid NOT NULL,

    -- NULL = applies to every service of this provider.
    gem_service             character varying(20),

    gem_their_code          character varying(50) NOT NULL,

    gem_our_code            character varying(30) NOT NULL,

    -- Shown to the counter operator. Deliberately not the provider's text,
    -- which is written for a developer.
    gem_message             character varying(500),

    -- What this code MEANS to us, which is not always "a failure". NIC's 2150
    -- refuses a duplicate and hands back the IRN it issued the first time:
    -- treated as an error it strands a printed bill at the counter, treated
    -- as SUCCESS it completes the document with the IRN that already exists.
    gem_treat_as            character varying(10) NOT NULL DEFAULT 'ERROR',

    -- Where that already-issued value hides in the ERROR payload, and which
    -- canonical field it becomes. Without these, gem_treat_as = 'SUCCESS'
    -- would complete a document with no IRN at all.
    gem_extract_path        text,
    gem_canonical_field     character varying(60),

    gem_is_retryable        boolean  NOT NULL DEFAULT false,
    gem_retry_after_seconds integer,

    -- Open a fresh session and replay once. Distinct from retryable: the
    -- same request with the same dead token will fail forever.
    gem_should_reauth       boolean  NOT NULL DEFAULT false,

    -- What to do next, so the handler branches on our word and not on a
    -- provider's number. FETCH_BY_DOC is the safe recovery after an
    -- ambiguous timeout on a generate: ask what exists before making more.
    gem_recovery_action     character varying(20) NOT NULL DEFAULT 'NONE',

    gem_severity            character varying(10) NOT NULL DEFAULT 'ERROR',

    -- ── Audit ────────────────────────────────────────────────────────────
    gem_is_deleted          boolean NOT NULL DEFAULT false,
    gem_sync_date           timestamp(6) with time zone,
    gem_created_on          timestamp(6) with time zone NOT NULL DEFAULT now(),
    gem_created_by          character varying(50) NOT NULL,
    gem_modified_on         timestamp(6) with time zone,
    gem_modified_by         character varying(50),

    CONSTRAINT pk_gst_provider_error_map PRIMARY KEY (gem_id),

    CONSTRAINT fk_gem_provider FOREIGN KEY (gem_gpv_id)
        REFERENCES public.gst_provider (gpv_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT ck_gem_service CHECK (gem_service IS NULL OR
        gem_service::text = ANY (ARRAY[
            'EINVOICE'::text, 'EWAYBILL'::text,
            'GSTIN_VERIFY'::text, 'GSTR'::text, 'ASP_ADMIN'::text])),

    -- Our vocabulary. The application branches on THESE, never on a
    -- provider's number.
    CONSTRAINT ck_gem_our_code CHECK (gem_our_code::text = ANY (ARRAY[
        'DUPLICATE_IRN'::text, 'IRN_NOT_FOUND'::text,
        'CANCEL_WINDOW_EXPIRED'::text,
        'AUTH_FAILED'::text, 'TOKEN_EXPIRED'::text, 'IP_NOT_WHITELISTED'::text,
        'INVALID_GSTIN'::text, 'GSTIN_INACTIVE'::text,
        'VALIDATION'::text, 'DUPLICATE_EWB'::text, 'EWB_NOT_FOUND'::text,
        'RATE_LIMITED'::text, 'UPSTREAM_DOWN'::text, 'TIMEOUT'::text,
        -- Chartered GSP019 'Insufficient ASP Credit': the IRN block ran out.
        -- Not an auth failure and not retryable — somebody has to buy more,
        -- and every counter is stopped until they do.
        'CREDIT_EXHAUSTED'::text,
        -- Chartered GSP502/GSP503: a sandbox-only call sent at production, or
        -- the reverse. Always a configuration error, never a transient one.
        'ENV_MISMATCH'::text,
        'UNKNOWN'::text])),

    CONSTRAINT ck_gem_severity CHECK (gem_severity::text = ANY (ARRAY[
        'INFO'::text, 'WARN'::text, 'ERROR'::text])),

    CONSTRAINT ck_gem_treat_as CHECK (gem_treat_as::text = ANY (ARRAY[
        'ERROR'::text, 'SUCCESS'::text, 'WARNING'::text])),

    CONSTRAINT ck_gem_recovery_action CHECK (gem_recovery_action::text = ANY (ARRAY[
        'NONE'::text, 'REAUTH'::text, 'BACKOFF'::text, 'FETCH_BY_DOC'::text,
        'FAILOVER'::text, 'MANUAL'::text])),

    -- Completing a document from an error payload without saying which value
    -- to lift out of it is how a blank IRN gets written.
    CONSTRAINT ck_gem_extract_pair CHECK (
        gem_treat_as <> 'SUCCESS'
        OR (gem_extract_path IS NOT NULL AND gem_canonical_field IS NOT NULL)),

    CONSTRAINT ck_gem_extract_path CHECK (gem_extract_path IS NULL
                                          OR gem_extract_path ~ '^\$'),

    CONSTRAINT ck_gem_retry_after CHECK (gem_retry_after_seconds IS NULL
                                         OR gem_retry_after_seconds >= 0)
);

ALTER TABLE IF EXISTS public.gst_provider_error_map OWNER to postgres;

-- NULLS NOT DISTINCT: without it, two rows for the same code with a NULL
-- service (the "all services" case) would both be accepted and the lookup
-- would pick one at random.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gem_provider_code
    ON public.gst_provider_error_map USING btree
    (gem_gpv_id, gem_service, gem_their_code)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gem_is_deleted = false;

-- FK-covering.
CREATE INDEX IF NOT EXISTS ix_gem_provider
    ON public.gst_provider_error_map USING btree (gem_gpv_id);


-- ───────────────────────────────────────────────────────────────────────────
--  6. The taxpayer's login — per company, or per branch that files its own
--
--  This is the SECOND of the two credentials. gst_provider_account holds the
--  GSP's own account (this ERP → their gateway). This table holds the
--  taxpayer's portal user (that GSTIN → the IRP, through the GSP). Most GSPs
--  need both, and they rotate on different schedules, which is why they are
--  not on one row.
--
--  The GSTIN is NOT stored here. public.companys.comp_gstin_no is already
--  UNIQUE, so a company row is a registration; a branch with its own
--  registration carries it on public.branch_master. It resolves as
--  COALESCE(branch GSTIN, comp_gstin_no) at call time. A chain in several
--  states is therefore several company rows, or branches with their own
--  GSTIN — either way the credential hangs off the row that already holds
--  the number, and there is no second copy to drift.
--
--  How MANY rows a company needs here is decided by the provider's auth
--  model, not by how many services it uses:
--      gateway GSP (one token for everything)   -> ONE row, gcc_service NULL
--      direct NIC (token per registration)      -> one row per service
--  gst_auth_session hangs off this row, so that choice also decides how many
--  live tokens exist and how many calls to /auth get made. Resolution is
--  most-specific-wins, the same rule gst_provider_account uses:
--
--      SELECT * FROM public.gst_company_credential
--       WHERE gcc_company_id = :co AND gcc_environment = :env
--         AND (gcc_service = :service OR gcc_service IS NULL)
--         AND gcc_is_active AND NOT gcc_is_deleted
--       ORDER BY gcc_service NULLS LAST, gcc_priority
--       LIMIT 1;
--
--  gcc_priority is the answer to "what happens when there are two providers".
--  Priority 1 is the primary and there may be only one per
--  company/branch/service/environment (ux_gcc_primary). Priority 2+ are
--  failovers, tried in order when the primary maps to UPSTREAM_DOWN or
--  RATE_LIMITED. Which one actually served a document is recorded on the
--  document (gde_gcc_id) and on every attempt (gal_gcc_id), so a failover is
--  auditable rather than mysterious.
--
--  Secrets are stored as application-encrypted ciphertext (_enc), not as
--  plaintext and not with pgcrypto — no extension is installed anywhere in
--  this schema, and a key that lives in the same database as the data it
--  protects is decoration. gcc_key_version records which application key
--  wrapped the values so rotation does not require a flag day.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_company_credential
(
    gcc_id                      uuid NOT NULL DEFAULT uuidv7(),

    gcc_company_id              uuid NOT NULL,

    -- NULL = every branch that files under this GSTIN. A branch is named
    -- only when it holds its own registration.
    gcc_branch_id               uuid,

    -- NOTE: no gcc_gstin / gcc_state_code column.
    -- public.companys.comp_gstin_no is already UNIQUE, so a company row IS a
    -- GSTIN registration; a branch that holds its own registration carries it
    -- on public.branch_master. Repeating the number here would be a second
    -- copy that can drift from the first, and there is no version of that
    -- drift that ends well — a credential silently authenticating as a GSTIN
    -- the company no longer has is worse than any join. It is resolved at
    -- call time:
    --
    --      COALESCE(branch GSTIN, comp_gstin_no)
    --
    -- which also makes gcc_branch_id meaningful rather than decorative:
    --      NULL      -> files under the company's own registration
    --      set       -> files under that branch's registration
    gcc_gpv_id                  uuid NOT NULL,

    -- NULLABLE, and the null is the common case for a commercial GSP:
    --      NULL  -> this ONE login covers every service the provider sells
    --               you — e-invoice, e-way bill and returns on one token
    --      set   -> this login is only good for that service
    --
    -- Direct NIC is the "set" case: e-invoice and e-way bill are separate API
    -- registrations on the portal and their tokens are not interchangeable.
    -- A gateway GSP is the NULL case: you authenticate once to THEIR gateway
    -- and spend the token across all their APIs.
    --
    -- This matters more than it looks. gst_auth_session hangs off the
    -- credential, so the shape of this column decides how many tokens exist:
    -- four rows here means four logins to maintain and four calls to /auth,
    -- where one row means one of each. Forcing NOT NULL would have made every
    -- gateway provider look like NIC.
    gcc_service                 character varying(20),
    gcc_environment             character varying(10) NOT NULL,

    -- 1 = primary, 2+ = failover order.
    gcc_priority                smallint NOT NULL DEFAULT 1,

    -- ── Secrets ──────────────────────────────────────────────────────────
    -- The API user of the taxpayer's portal registration — the one created
    -- under API Registration on the e-invoice portal, or issued by the GSP
    -- for this GSTIN. NOT NULL with its password: the pair IS the credential,
    -- and half of it cannot authenticate.
    --
    -- The user name is deliberately NOT encrypted. It is not a secret, and
    -- support has to be able to see WHICH login is failing without holding
    -- the decryption key — the same reason a database user name is not
    -- hashed while its password is.
    gcc_login_id                text NOT NULL,
    gcc_password_enc            text NOT NULL,

    -- NULLABLE, and normally NULL. These are OAuth-style app credentials at
    -- the TAXPAYER level, which only some GSPs issue — a reseller that bills
    -- per GSTIN may hand you a client id and secret for each one. For every
    -- other provider the app credentials belong to the installation and live
    -- on gst_provider_account instead, which is why these are not NOT NULL.
    --
    -- When both are present the MORE SPECIFIC one wins, the same rule
    -- gpa_service and gem_service follow:
    --
    --      client_id     = COALESCE(gcc_client_id_enc,     gpa_client_id_enc)
    --      client_secret = COALESCE(gcc_client_secret_enc, gpa_client_secret_enc)
    --
    -- Filling only one of the pair is meaningless, so ck_gcc_client_pair
    -- below refuses it rather than letting a half-configured login reach the
    -- gateway and fail there.
    gcc_client_id_enc           text,
    gcc_client_secret_enc       text,

    -- NIC's AppKey: 32 random bytes, RSA-encrypted with the IRP public key
    -- at auth time and used to unwrap the Sek that comes back.
    gcc_app_key_enc             text,

    -- Which IRP/GSP public key or certificate the payload encryption uses.
    -- They rotate, and a stale one fails with an opaque decrypt error.
    gcc_public_key_ref          character varying(100),

    -- Which application key encrypted the _enc columns above.
    gcc_key_version             smallint NOT NULL DEFAULT 1,

    -- The static IPs registered with the GSP / on the e-invoice portal for
    -- this GSTIN. Ours, not the provider's — the first draft had a single
    -- inet on the PROVIDER row, where it described nothing. An array because
    -- a chain files one GSTIN from many outlets, each on its own broadband:
    -- the portal whitelist is a list, and so is this.
    gcc_whitelisted_ips         inet[],

    -- ── Validity ─────────────────────────────────────────────────────────
    -- Portal passwords expire. A credential that silently went stale at
    -- midnight is otherwise discovered by a queue of failed bills.
    gcc_valid_from              date,
    gcc_valid_upto              date,
    gcc_password_changed_on     timestamp(6) with time zone,

    -- Stamped by the master screen's Test Connection button and by the first
    -- successful call of the day.
    gcc_last_verified_on        timestamp(6) with time zone,
    gcc_last_error_message      character varying(500),

    gcc_remarks                 character varying(500),

    gcc_is_active               boolean NOT NULL DEFAULT true,

    -- ── Audit ────────────────────────────────────────────────────────────
    gcc_is_deleted              boolean NOT NULL DEFAULT false,
    gcc_sync_date               timestamp(6) with time zone,
    gcc_created_on              timestamp(6) with time zone NOT NULL DEFAULT now(),
    gcc_created_by              character varying(50) NOT NULL,
    gcc_modified_on             timestamp(6) with time zone,
    gcc_modified_by             character varying(50),

    CONSTRAINT pk_gst_company_credential PRIMARY KEY (gcc_id),

    CONSTRAINT fk_gcc_company FOREIGN KEY (gcc_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_gcc_branch FOREIGN KEY (gcc_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- The foreign key the first draft simply did not have.
    CONSTRAINT fk_gcc_provider FOREIGN KEY (gcc_gpv_id)
        REFERENCES public.gst_provider (gpv_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_gcc_service CHECK (gcc_service IS NULL OR
        gcc_service::text = ANY (ARRAY[
            'EINVOICE'::text, 'EWAYBILL'::text,
            'GSTIN_VERIFY'::text, 'GSTR'::text, 'ASP_ADMIN'::text])),

    CONSTRAINT ck_gcc_environment CHECK (gcc_environment::text = ANY (ARRAY[
        'SANDBOX'::text, 'PRODUCTION'::text])),

    -- Both halves of the app credential or neither. One alone cannot
    -- authenticate anywhere, and a half-filled override silently shadows the
    -- provider-level account it was meant to replace.
    CONSTRAINT ck_gcc_client_pair CHECK (
        (gcc_client_id_enc IS NULL) = (gcc_client_secret_enc IS NULL)),

    CONSTRAINT ck_gcc_priority  CHECK (gcc_priority BETWEEN 1 AND 9),
    CONSTRAINT ck_gcc_key_ver   CHECK (gcc_key_version >= 1),
    CONSTRAINT ck_gcc_validity  CHECK (gcc_valid_from IS NULL
                                       OR gcc_valid_upto IS NULL
                                       OR gcc_valid_from <= gcc_valid_upto)
);

ALTER TABLE IF EXISTS public.gst_company_credential OWNER to postgres;

-- One primary per company/GSTIN/service/environment — the same partial
-- unique idiom as ux_tnd_default. Failovers (priority 2+) are unconstrained
-- in count but unique in order.
-- Keyed on company + branch, not on a GSTIN we no longer store. TWO of the
-- key columns are legitimately NULL — branch (files under the company) and
-- service (one login covers them all) — and NULLS NOT DISTINCT is what makes
-- both mean something: without it, two company-wide all-service rows would
-- each be treated as unique and both accepted, and the resolver would pick
-- one at random. Same device as ux_gpa_provider_env_service and
-- ux_gem_provider_code above; it replaces the COALESCE-sentinel idiom, which
-- cannot express a nullable varchar as cleanly as it does a uuid.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gcc_primary
    ON public.gst_company_credential USING btree
    (gcc_company_id, gcc_branch_id, gcc_service, gcc_environment)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gcc_priority = 1 AND gcc_is_active = true AND gcc_is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_gcc_order
    ON public.gst_company_credential USING btree
    (gcc_company_id, gcc_branch_id, gcc_service, gcc_environment, gcc_priority)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gcc_is_deleted = false;

-- The dispatcher's own lookup: give me the live credentials for this
-- company and service, best first.
CREATE INDEX IF NOT EXISTS ix_gcc_lookup
    ON public.gst_company_credential USING btree
    (gcc_company_id, gcc_service, gcc_environment, gcc_priority)
    INCLUDE (gcc_branch_id, gcc_gpv_id, gcc_login_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gcc_is_active = true AND gcc_is_deleted = false;

-- FK-covering, so retiring a branch or a provider does not seq-scan this
-- table looking for dependants.
CREATE INDEX IF NOT EXISTS ix_gcc_branch
    ON public.gst_company_credential USING btree (gcc_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gcc_branch_id IS NOT NULL AND gcc_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_gcc_provider
    ON public.gst_company_credential USING btree (gcc_gpv_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gcc_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  6b. Credentials, resolved — and safe to read
--
--  Does the COALESCE once, so no caller has to remember which of two tables
--  the GSTIN came from.
--
--  It is also the READ BOUNDARY. Not one *_enc column is selected, so the
--  list grid, the reports and any read-only database role can be pointed here
--  and physically cannot return ciphertext — where SELECT * on the table
--  would hand it out to anyone who asked. Grant on this; revoke on the table:
--
--      REVOKE SELECT ON public.gst_company_credential FROM <read_only_role>;
--      GRANT  SELECT ON public.vw_gst_credential      TO   <read_only_role>;
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_gst_credential AS
SELECT
    c.gcc_id,
    c.gcc_company_id,
    c.gcc_branch_id,
    co.comp_name,
    b.br_name,

    -- The whole point of the view. A branch that holds its own registration
    -- overrides the company's; NULL branch means it files under the company.
    COALESCE(b.br_gstin_no,     co.comp_gstin_no)     AS gstin,
    COALESCE(b.br_state_code,   co.comp_state_code)   AS state_code,
    COALESCE(b.br_gst_reg_type, co.comp_gst_reg_type) AS gst_reg_type,

    -- Whether this company is even supposed to be raising IRNs. The flags
    -- already live on companys; reading them here keeps the credential screen
    -- from inventing a second answer.
    co.comp_einvoice_applicable,
    co.comp_eway_applicable,

    c.gcc_gpv_id,
    p.gpv_code,
    p.gpv_name,

    c.gcc_service,
    c.gcc_environment,
    c.gcc_priority,
    (c.gcc_priority = 1)                              AS is_primary,

    c.gcc_login_id,
    -- Not the secret — only whether one has been set, which is all a screen
    -- needs to render "•••••• (saved)" versus an empty box.
    (c.gcc_password_enc IS NOT NULL)                  AS has_password,
    (c.gcc_app_key_enc  IS NOT NULL)                  AS has_app_key,

    c.gcc_whitelisted_ips,
    c.gcc_valid_from,
    c.gcc_valid_upto,
    (c.gcc_valid_upto IS NOT NULL
     AND c.gcc_valid_upto < CURRENT_DATE)             AS is_expired,
    c.gcc_password_changed_on,
    c.gcc_last_verified_on,
    c.gcc_last_error_message,

    c.gcc_is_active,
    c.gcc_created_on,
    c.gcc_created_by,
    c.gcc_modified_on,
    c.gcc_modified_by
  FROM public.gst_company_credential c
  JOIN public.companys        co ON co.comp_id = c.gcc_company_id
  JOIN public.gst_provider    p  ON p.gpv_id   = c.gcc_gpv_id
  LEFT JOIN public.branch_master b ON b.br_id  = c.gcc_branch_id
 WHERE c.gcc_is_deleted = false;

ALTER VIEW IF EXISTS public.vw_gst_credential OWNER to postgres;


-- ───────────────────────────────────────────────────────────────────────────
--  7. The live session
--
--  Separate from the credential on purpose. A token rotates every six hours;
--  writing it back onto the credential row would churn a master's audit
--  trail four times a day, and would put a live bearer token in the same
--  SELECT the configuration screen runs. Nothing in this table is ever
--  returned to the client.
--
--  Rows are written once and never edited, so there is no modified_on/by —
--  the same reasoning as public.txn_status_log. Renewal inserts a new row
--  and retires the old one.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_auth_session
(
    gas_id              uuid NOT NULL DEFAULT uuidv7(),
    gas_gcc_id          uuid NOT NULL,

    -- Encrypted with the same application key as the credential's secrets.
    -- A bearer token in a readable column is a password with a shorter life,
    -- not something less than one.
    gas_auth_token_enc  text NOT NULL,

    -- NIC's Sek — the AES session key every subsequent payload is encrypted
    -- with. Without a column for it the NIC_SEK scheme cannot work at all,
    -- which is why the token column alone was not enough in the first draft.
    gas_session_key_enc text,
    gas_refresh_token_enc text,

    gas_key_version     smallint NOT NULL DEFAULT 1,

    gas_token_type      character varying(20) NOT NULL DEFAULT 'AuthToken',

    gas_issued_on       timestamp(6) with time zone NOT NULL DEFAULT now(),
    gas_expires_on      timestamp(6) with time zone NOT NULL,

    -- What the provider literally sent. NIC returns TokenExpiry as IST local
    -- time with no zone on it; keeping the raw string is the only way to
    -- prove clock skew later.
    gas_expiry_raw      character varying(40),

    -- ── Single-flight refresh ────────────────────────────────────────────
    -- Four tills notice the same expiry in the same second. Without a lease
    -- all four call /auth, which NIC rate-limits hard and the e-way portal
    -- answers by blocking the account. A LEASE and not an advisory lock,
    -- because the auth call is external HTTP and no transaction should be
    -- held open across one: claim in a short transaction, call outside any
    -- transaction, write the result in a second short transaction.
    --
    --   UPDATE public.gst_auth_session
    --      SET gas_lock_by = :worker, gas_lock_upto = now() + interval '60 seconds'
    --    WHERE gas_gcc_id = :cred
    --      AND gas_expires_on <= now() + make_interval(secs => :margin)
    --      AND (gas_lock_upto IS NULL OR gas_lock_upto < now())
    --   RETURNING gas_id, gas_token_version;
    --
    -- One row back and you are the refresher; none and somebody else is, so
    -- wait and re-read. gas_lock_upto expiring is what stops a worker that
    -- died mid-call from freezing every counter behind it.
    gas_lock_by         uuid,
    gas_lock_on         timestamp(6) with time zone,
    gas_lock_upto       timestamp(6) with time zone,

    -- Bumped on every successful refresh. Workers cache the token in memory;
    -- a rejection means "re-read", and a version higher than the cached one
    -- means somebody already fixed it — retry rather than refresh again.
    -- This is also what keeps the Sek from tearing: a payload encrypted with
    -- the previous session key is detectable instead of merely rejected.
    gas_token_version   integer NOT NULL DEFAULT 0,

    gas_is_active       boolean NOT NULL DEFAULT true,

    -- ── Audit (write-once) ───────────────────────────────────────────────
    gas_is_deleted      boolean NOT NULL DEFAULT false,
    gas_sync_date       timestamp(6) with time zone,
    gas_created_on      timestamp(6) with time zone NOT NULL DEFAULT now(),
    gas_created_by      character varying(50) NOT NULL,

    CONSTRAINT pk_gst_auth_session PRIMARY KEY (gas_id),

    CONSTRAINT fk_gas_credential FOREIGN KEY (gas_gcc_id)
        REFERENCES public.gst_company_credential (gcc_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT ck_gas_expiry  CHECK (gas_expires_on > gas_issued_on),
    CONSTRAINT ck_gas_key_ver CHECK (gas_key_version >= 1),
    CONSTRAINT ck_gas_lease   CHECK (gas_lock_upto IS NULL
                                     OR gas_lock_by IS NOT NULL)
)
-- Deliberate deviation from the fillfactor=100 used everywhere else in this
-- schema: this row is UPDATEd on every token refresh and every lease claim.
-- Packing it full guarantees non-HOT updates and index bloat on a table
-- whose whole job is to be written.
WITH (fillfactor=70);

ALTER TABLE IF EXISTS public.gst_auth_session OWNER to postgres;

-- One live session per credential. The lease above is what serialises the
-- refresh; this index is what guarantees there is only ever one row to
-- lease in the first place.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gas_live
    ON public.gst_auth_session USING btree (gas_gcc_id)
    WITH (fillfactor=70, deduplicate_items=True)
    WHERE gas_is_active = true AND gas_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_gas_expiry
    ON public.gst_auth_session USING btree (gas_expires_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gas_is_active = true AND gas_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  8. The call log
--
--  Append-only, one row per HTTP attempt, including the ones that failed.
--  This is a transaction table, not configuration, so it lives in `public`
--  (like txn_status_log) and is LIST-partitioned by acc_year. Section 10
--  below teaches public.ensure_acc_year_partitions about it, so the April
--  1st ritual keeps working with no further edit.
--
--  accounts.acc_voucher_doc_api_log holds the LAST exchange for a document.
--  This table holds every exchange, for every document and for the calls
--  that belong to no document at all (auth, GSTIN lookup). The two are not
--  redundant: one answers "what does this bill look like at the IRP", the
--  other answers "what happened at 10:42 when the counter froze".
--
--  Rows are written once — no modified_on/by, same as txn_status_log.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gst_api_log
(
    gal_id                  uuid           NOT NULL DEFAULT uuidv7(),
    gal_company_id          uuid           NOT NULL,
    gal_branch_id           uuid,
    gal_tenant_id           uuid,
    gal_acc_year            character(9)   NOT NULL,

    -- Which credential (hence which provider) served the attempt. Nullable
    -- because a call can fail before a credential is even resolved.
    gal_gcc_id              uuid,
    gal_gpv_id              uuid,

    gal_service             character varying(20) NOT NULL,
    gal_action              character varying(30) NOT NULL,
    gal_environment         character varying(10) NOT NULL,

    -- ── What it was for ──────────────────────────────────────────────────
    -- Same src-doc pattern as acc_tender_detail and txn_status_log.
    gal_src_module          character varying(20),
    gal_src_doc_type        character varying(30),
    gal_src_doc_id          uuid,
    gal_gdr_id              uuid,

    -- Our key for the attempt. A retry after a timeout reuses it, so a
    -- generate that already succeeded upstream cannot mint a second IRN.
    gal_idempotency_key     character varying(100),
    gal_attempt_no          smallint NOT NULL DEFAULT 1,

    -- ── The exchange ─────────────────────────────────────────────────────
    -- Headers are stored REDACTED per gpe_redact_paths: an auth token in a
    -- log is a credential with a longer life than the session that issued it.
    gal_request_url         text,
    gal_request_headers     jsonb,
    gal_request_payload     jsonb,

    gal_http_status         smallint,
    gal_response_payload    jsonb,

    -- Their code, and what gst_provider_error_map turned it into.
    gal_provider_code       character varying(50),
    gal_our_code            character varying(30),

    gal_is_success          boolean NOT NULL,
    gal_message             character varying(500),

    gal_started_on          timestamp(6) with time zone NOT NULL DEFAULT now(),
    gal_finished_on         timestamp(6) with time zone,
    gal_duration_ms         integer,

    -- ── Audit (write-once) ───────────────────────────────────────────────
    gal_is_deleted          boolean NOT NULL DEFAULT false,
    gal_sync_date           timestamp(6) with time zone,
    gal_created_on          timestamp(6) with time zone NOT NULL DEFAULT now(),
    gal_created_by          character varying(50),

    CONSTRAINT pk_gst_api_log PRIMARY KEY (gal_id, gal_acc_year),

    CONSTRAINT ck_gal_acc_year CHECK (gal_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),

    CONSTRAINT ck_gal_service CHECK (gal_service::text = ANY (ARRAY[
        'EINVOICE'::text, 'EWAYBILL'::text, 'GSTIN_VERIFY'::text, 'GSTR'::text,
        'ASP_ADMIN'::text])),

    CONSTRAINT ck_gal_environment CHECK (gal_environment::text = ANY (ARRAY[
        'SANDBOX'::text, 'PRODUCTION'::text])),

    CONSTRAINT ck_gal_src_module CHECK (gal_src_module IS NULL OR
        gal_src_module::text = ANY (ARRAY[
            'SALES'::text, 'PURCHASE'::text, 'INVENTORY'::text,
            'ACCOUNTS'::text, 'SERVICE'::text, 'JOBWORK'::text,
            'POS'::text, 'OTHER'::text])),

    CONSTRAINT ck_gal_headers  CHECK (gal_request_headers IS NULL
                                      OR jsonb_typeof(gal_request_headers) = 'object'),
    CONSTRAINT ck_gal_attempt  CHECK (gal_attempt_no >= 1),
    CONSTRAINT ck_gal_duration CHECK (gal_duration_ms IS NULL OR gal_duration_ms >= 0)
) PARTITION BY LIST (gal_acc_year);

ALTER TABLE IF EXISTS public.gst_api_log OWNER to postgres;

-- One row per idempotency key per year: the guard that makes a retry safe.
CREATE UNIQUE INDEX IF NOT EXISTS ux_gal_idempotency
    ON public.gst_api_log USING btree (gal_idempotency_key, gal_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gal_idempotency_key IS NOT NULL AND gal_is_deleted = false;

-- "What happened to this bill" — the support question.
CREATE INDEX IF NOT EXISTS ix_gal_src_doc
    ON public.gst_api_log USING btree
    (gal_src_doc_type, gal_src_doc_id, gal_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gal_is_deleted = false;

-- "What is this provider doing today" — the monitoring question.
CREATE INDEX IF NOT EXISTS ix_gal_activity
    ON public.gst_api_log USING btree
    (gal_company_id, gal_service, gal_action, gal_started_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gal_is_deleted = false;

-- The failure queue.
CREATE INDEX IF NOT EXISTS ix_gal_failures
    ON public.gst_api_log USING btree
    (gal_company_id, gal_started_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gal_is_success = false AND gal_is_deleted = false;


-- ───────────────────────────────────────────────────────────────────────────
--  9. Which credential issued the document
--
--  accounts.acc_voucher_doc_einvoice and _ewaybill record WHAT came back but
--  not WHO it came from. With one provider that is merely untidy; with two
--  it is data loss — a cancellation must go back to the provider that
--  issued the IRN, and there is no way to work out which that was after the
--  fact.
--
--  No FK on gde_gcc_id / gdw_gcc_id: the credential is a master that may
--  legitimately be retired while old documents keep pointing at it, and a
--  document must never lose its provenance because somebody tidied the
--  configuration screen. The frozen *_gpv_code beside the id is what keeps
--  the answer readable after that happens.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE accounts.acc_voucher_doc_einvoice
    ADD COLUMN IF NOT EXISTS gde_gcc_id  uuid,
    -- Frozen snapshot beside the id, the way the doc register freezes party
    -- name and GSTIN next to their ids: a credential can be rotated or
    -- retired, and an id pointing at a row somebody deleted answers no
    -- questions at all.
    ADD COLUMN IF NOT EXISTS gde_gpv_code character varying(20),
    -- The IRP, which is NOT the same thing as the GSP. There are several
    -- registrars now, and a cancellation must reach the one that issued the
    -- IRN — you may reach it through a different GSP, but not a different
    -- portal. This is the column stickiness actually hangs on.
    ADD COLUMN IF NOT EXISTS gde_irp_code character varying(10),
    -- When to try again. Without it a failed IRN either retries in a tight
    -- loop against a portal that is rate limiting us, or waits for a person
    -- to notice.
    ADD COLUMN IF NOT EXISTS gde_next_attempt_on timestamp(6) with time zone;

ALTER TABLE accounts.acc_voucher_doc_ewaybill
    ADD COLUMN IF NOT EXISTS gdw_gcc_id  uuid,
    ADD COLUMN IF NOT EXISTS gdw_gpv_code character varying(20),
    -- Where it was raised. An e-way bill generated at the IRP alongside the
    -- IRN cannot have its Part-B updated at the IRP — that goes to the
    -- e-way portal — so the route out is not derivable from the number.
    ADD COLUMN IF NOT EXISTS gdw_generated_via character varying(20),
    ADD COLUMN IF NOT EXISTS gdw_next_attempt_on timestamp(6) with time zone;

COMMENT ON COLUMN accounts.acc_voucher_doc_einvoice.gde_gcc_id IS
    'public.gst_company_credential that generated this IRN. A cancellation must be sent through the same provider and GSTIN.';

COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_gcc_id IS
    'public.gst_company_credential that generated this e-way bill. Part-B updates, extensions and cancellation must go through the same provider.';

COMMENT ON COLUMN accounts.acc_voucher_doc_einvoice.gde_irp_code IS
    'Invoice Registration Portal that issued the IRN (NIC1, NIC2, CLEAR, CYGNET, EY, IRIS). A cancellation must reach this portal; the GSP used to reach it may differ.';

COMMENT ON COLUMN accounts.acc_voucher_doc_ewaybill.gdw_generated_via IS
    'EWB_PORTAL | IRP_WITH_IRN | IRP_BY_IRN — decides where a Part-B update may be sent, which the e-way bill number alone does not tell you.';

-- The retry worklists.
CREATE INDEX IF NOT EXISTS ix_gde_retry
    ON accounts.acc_voucher_doc_einvoice USING btree
    (gde_company_id, gde_next_attempt_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gde_is_deleted = false AND gde_status = 'FAILED';

CREATE INDEX IF NOT EXISTS ix_gdw_retry
    ON accounts.acc_voucher_doc_ewaybill USING btree
    (gdw_company_id, gdw_next_attempt_on)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE gdw_is_deleted = false AND gdw_status = 'FAILED';


-- ───────────────────────────────────────────────────────────────────────────
--  10. Partitions for the log
--
--  public.ensure_acc_year_partitions is the one place that knows which
--  tables are partitioned by acc_year; it carries an explicit list rather
--  than scanning the catalogue. A partitioned table that is not in the list
--  is silently skipped when a fiscal year is opened and fails at the first
--  insert of the new year — which is exactly what the voucher tables did
--  until 20260915120000 caught it. So gst_api_log goes in the list, in the
--  same breath as the table is created.
--
--  Re-stated in full (CREATE OR REPLACE) because that is how every earlier
--  migration has extended it; the body below is 20260915120000's, plus one
--  EXECUTE for gst_api_log.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character)
RETURNS void
LANGUAGE plpgsql
AS $ensure$

DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
BEGIN
    IF v_year !~ '^[0-9]{4}-[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid accounting year %, expected YYYY-YYYY', p_acc_year;
    END IF;

    v_suffix := replace(v_year, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill FOR VALUES IN (%L)',
        'sale_bill_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill_item FOR VALUES IN (%L)',
        'sale_bill_item_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_tender_detail FOR VALUES IN (%L)',
        'acc_tender_detail_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_status_log FOR VALUES IN (%L)',
        'txn_status_log_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_charge_detail FOR VALUES IN (%L)',
        'txn_charge_detail_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_hold FOR VALUES IN (%L)',
        'txn_hold_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order FOR VALUES IN (%L)',
        'sale_order_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order_item FOR VALUES IN (%L)',
        'sale_order_item_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation FOR VALUES IN (%L)',
        'sale_quotation_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation_item FOR VALUES IN (%L)',
        'sale_quotation_item_' || v_suffix, v_year);

    -- The bill is partitioned again as of 20260811090000: on the FY it was
    -- RAISED in, which it keeps for life.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_balance FOR VALUES IN (%L)',
        'acc_bill_balance_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_adjustment FOR VALUES IN (%L)',
        'acc_bill_adjustment_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_opening_balance FOR VALUES IN (%L)',
        'acc_opening_balance_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_pdc_register FOR VALUES IN (%L)',
        'acc_pdc_register_' || v_suffix, v_year);

    -- ── Added by 20260915120000 ──────────────────────────────────────────
    --  The two VOUCHER tables. They were partitioned when they were created
    --  and this function never knew about them, so only the partition that
    --  happened to be made by hand existed — which nothing noticed while
    --  accounts.acc_vouchers held zero rows.
    --
    --  Header BEFORE lines: acc_vouchers carries fk_av_header into it.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_header FOR VALUES IN (%L)',
        'acc_voucher_header_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_vouchers FOR VALUES IN (%L)',
        'acc_vouchers_' || v_suffix, v_year);

    -- ── Added by 20260921120000 ──────────────────────────────────────────
    --  The GSP call log. Every IRN, e-way bill and GSTIN lookup writes a row
    --  here, so a missing partition is a counter that cannot bill on April
    --  1st — the same failure the voucher tables were one migration away
    --  from having.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
        'gst_api_log_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

-- Catch the new table up with the years that already have partitions, rather
-- than naming a hard-coded pair of years that may or may not be the ones this
-- database uses. Reading them off txn_status_log — the other public table on
-- the same key — is what keeps this correct on every installation.
DO $backfill$
DECLARE
    v_year text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT replace(substring(c.relname from '([0-9]{4}_[0-9]{4})$'), '_', '-')
          FROM pg_class c
          JOIN pg_inherits i ON i.inhrelid  = c.oid
          JOIN pg_class    p ON p.oid       = i.inhparent
         WHERE p.relname = 'txn_status_log'
           AND c.relname ~ '[0-9]{4}_[0-9]{4}$'
         ORDER BY 1
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
            'gst_api_log_' || replace(v_year, '-', '_'), v_year);
        RAISE NOTICE 'gst_api_log partition ensured for %', v_year;
    END LOOP;
END
$backfill$;


-- ═══════════════════════════════════════════════════════════════════════════
--  Retiring the first-draft tables — RUN BY HAND, NOT BY THIS MIGRATION
--
--  fixed.gsp_provider_master and fixed.gsp_company_service hold rows in this
--  database. A drop that turns out to have mattered is recoverable from
--  nowhere, so confirm both are empty (or migrate what is in them into the
--  tables above), then run:
--
--      SELECT count(*) FROM fixed.gsp_provider_master;   -- expect 0
--      SELECT count(*) FROM fixed.gsp_company_service;   -- expect 0
--
--      DROP TABLE IF EXISTS fixed.gsp_company_service;
--      DROP TABLE IF EXISTS fixed.gsp_provider_master;
--
--  and delete prisma/fixed/GSPproviderMaster.prisma and
--  prisma/fixed/GSPcompanyService.prisma in the same commit.
--
--  Field-by-field, where the old columns went:
--      gsp_base_url        -> gps_base_url          (per service, per environment)
--      gsp_route           -> gst_provider_endpoint (one row per action)
--      gsp_ip_address      -> gcc_whitelisted_ips   (ours, per GSTIN, an array)
--      gsp_user_name/_password
--                          -> gcc_login_id / gcc_password_enc
--      csg_gsp_provider_id -> gcc_gpv_id            (now with a foreign key)
--      csg_service_type    -> gcc_service           (+ CHECK)
--      csg_euser_name/_password
--                          -> gcc_login_id / gcc_password_enc
--      csg_auth_token, csg_auth_token_valid_till
--                          -> gst_auth_session      (+ the Sek that was missing)
--      csg_company_id      -> gcc_company_id + gcc_branch_id; the GSTIN is NOT
--                             copied — it is read from public.companys, where
--                             comp_gstin_no is already UNIQUE
--      (nothing)           -> gst_provider_account: the GSP's OWN account,
--                             which the first draft had nowhere to put
-- ═══════════════════════════════════════════════════════════════════════════
