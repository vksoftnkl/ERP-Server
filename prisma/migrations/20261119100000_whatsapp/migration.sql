-- ═══════════════════════════════════════════════════════════════════════════
--  WhatsApp option B (Meta Cloud API through wa-relay), step P1 (client DB)
--                                                                 2026-11-17
--  Folder: prisma/migrations/20261119100000_whatsapp/ (share copy:
--  Shared/Prathap/whatsapp/sql/whatsapp-p1-migration.sql).
--
--  Plan: Shared/Prathap/whatsapp/whatsapp-plan-v1-2026-11-17.md §3 (client DB),
--  §5.4 (rights), §5.6 (codes), §14 (Q1-Q5 as recommended, plan APPROVED
--  17/11); answers whatsapp-answers-v1-2026-11-17.md (Q12 = fail at once, no
--  queue, so no hold-days setting); relay codes wa-relay-keys-2026-11-17.md §5.
--  Sorts after 20261118120000_mobile_bills_receipts. Every id and name below
--  was checked against the live dev DB on 2026-11-17.
--
--   0 · guards: every pinned id / name is free or already ours.
--   1 · accounts.acc_voucher_types.vchr_whatsapp_after_post boolean NOT NULL
--       DEFAULT false (beside vchr_print_after_post; all OFF, Q3).
--   2 · accounts.acc_ledger_master: led_wa_lang varchar(5) + ck_led_wa_lang
--       (NULL / en / ta; NULL = the company's default), led_wa_reminders_off_on
--       and led_wa_all_off_on timestamptz (the opt-out dates). All nullable.
--   3 · public.wa_connection (wac_): this server's link to the relay, one live
--       row per company (ux_wac_company, partial). No sync column: it never
--       pushes to a cloud.
--   4 · public.wa_template (wat_): mirror of the relay's templates per
--       company. No sync column. The plan's wat_synced_on is named
--       wat_pulled_on here: a timestamp named *synced_on makes v_sync_tables
--       list the table (cloud push) and the registry expect it as the sync
--       column, both of which the plan rules out. wat_category is varchar(20):
--       AUTHENTICATION is 14 characters.
--   5 · public.wa_message_log (wml_), PARTITION BY LIST (wml_acc_year): one
--       row per send try. PK (wml_id, wml_acc_year), no other UNIQUE (syncs
--       from offline sites). The plan's CHECKs, the six indexes, and the
--       standard sync triggers + pending index (skipped where the sync
--       functions are absent).
--   6 · public.ensure_acc_year_partitions: the live body (last redefined by
--       20261117100000_delivery_tracking, unchanged since) copied forward,
--       plus wa_message_log; partitions backfilled for every year
--       public.txn_status_log has a partition for (pg_inherits).
--   7 · settings whatsapp.* (module WHATSAPP, scope COMPANY): 9 keys.
--   8 · print purpose PARTY_STATEMENT (REPORT / PARTY_STATEMENT, 1 copy,
--       shared). The A5 design itself ships in P3.
--   9 · menus 307 WhatsApp (under 60, 85.00), 308 Payment Reminders (under 6,
--       7.60), 309 WhatsApp Log (under 6, 25.00), all HIDDEN (decision 19).
--       Rights (Q13): 307 view + edit to each live Edit-on-303 holder; 308
--       view + print + export to each live View-on-279 holder, post (the new
--       right) to nobody; 309 view + export to the same 279 viewers and to
--       the 307 editors, post (retry) to the 307 editors only.
--  10 · public.db_table_master 1401-1403 (new WHATSAPP block 14xx).
--  11 · grid 222 "MAIN LIST - WHATSAPP LOG" + 32 columns (prisma/seed/
--       WhatsApp_Grid_222.sql carries the same). Tokens p_company_id,
--       p_branch_id, p_from, p_to, p_kind, p_status, p_party_id, compared as
--       text. No grid SQL holds a comment marker.
--  12 · fixed.error_message: 62 WA_* rows (the 49 codes of plan §5.6, 4 more
--       for relay answers the ERP surfaces, 9 field= variants of
--       WA_SETTING_INVALID), catalogue 2026-11-17.5.
--       prisma/seed/Error_Messages.json carries the same rows.
--
--  No business-logic function or trigger: the only function touched is the
--  existing partition helper; the sync triggers are the existing local-only
--  infrastructure, guarded. Every statement is re-runnable. On a fresh
--  database menus and grids are seeded after the migrations, so those parts
--  no-op here and the seed files carry the rows.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pinned ids / names free (or already ours) ─────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, '; ') INTO v_clash FROM (
        SELECT format('menu %s (%s)', m.menu_id, m.menu_name) AS x
          FROM fixed.menu_master m
          JOIN (VALUES (307, 'WhatsApp'::text), (308, 'Payment Reminders'), (309, 'WhatsApp Log')) v(id, name)
            ON v.id = m.menu_id
         WHERE m.menu_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('grid %s (%s)', g.grid_id, g.grid_name)
          FROM fixed.grid_details g
         WHERE g.grid_id = 222 AND g.grid_name IS DISTINCT FROM 'MAIN LIST - WHATSAPP LOG'
        UNION ALL
        SELECT format('grid column %s (grid %s)', c.grid_column_id, c.grid_id)
          FROM fixed.grid_columns c
         WHERE c.grid_column_id::text LIKE '01a1e9b5-2220-%'
           AND c.grid_id <> 222
        UNION ALL
        SELECT format('db_table_master %s is %s.%s', d.dtm_id, d.dtm_schema, d.dtm_table)
          FROM public.db_table_master d
          JOIN (VALUES (1401, 'wa_connection'::text), (1402, 'wa_template'), (1403, 'wa_message_log')) v(id, tbl)
            ON v.id = d.dtm_id
         WHERE (d.dtm_schema::text, d.dtm_table::text) IS DISTINCT FROM ('public', v.tbl)
        UNION ALL
        SELECT format('print purpose %s (%s / %s)', p.ppo_code, p.ppo_src_module, p.ppo_doc_type)
          FROM public.print_purpose p
         WHERE (p.ppo_id = '01a1e9b5-5b97-7e6b-b45e-c8d18c824c15'::uuid
                OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = 'party_statement' AND p.ppo_is_deleted = false))
           AND (p.ppo_id, upper(p.ppo_code::text), p.ppo_src_module::text, p.ppo_doc_type::text)
               IS DISTINCT FROM ('01a1e9b5-5b97-7e6b-b45e-c8d18c824c15'::uuid, 'PARTY_STATEMENT', 'REPORT', 'PARTY_STATEMENT')
        UNION ALL
        SELECT format('setting %s (%s, %s)', s.asd_key, s.asd_data_type, s.asd_max_scope)
          FROM public.app_setting_def s
          JOIN (VALUES ('whatsapp.reminder_gap_days'::text, 'INT'::text), ('whatsapp.reminder_from', 'TEXT'),
                       ('whatsapp.reminder_to', 'TEXT'), ('whatsapp.default_language', 'TEXT'),
                       ('whatsapp.rate_per_message', 'DECIMAL'), ('whatsapp.rate_gst_percent', 'DECIMAL'),
                       ('whatsapp.fallback_click_to_chat', 'BOOL'), ('whatsapp.log_retention_years', 'INT'),
                       ('whatsapp.bulk_max_parties', 'INT')) v(k, typ)
            ON v.k = s.asd_key
         WHERE (s.asd_data_type::text, s.asd_max_scope::text) IS DISTINCT FROM (v.typ, 'COMPANY')
        UNION ALL
        SELECT format('column %s.%s already exists as %s', c.table_name, c.column_name, c.data_type)
          FROM information_schema.columns c
          JOIN (VALUES ('acc_voucher_types'::text, 'vchr_whatsapp_after_post'::text, 'boolean'::text),
                       ('acc_ledger_master', 'led_wa_lang', 'character varying'),
                       ('acc_ledger_master', 'led_wa_reminders_off_on', 'timestamp with time zone'),
                       ('acc_ledger_master', 'led_wa_all_off_on', 'timestamp with time zone')) v(tbl, col, typ)
            ON c.table_schema = 'accounts' AND c.table_name = v.tbl AND c.column_name = v.col
         WHERE c.data_type IS DISTINCT FROM v.typ
    ) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'WhatsApp P1: ids or names already taken: %. Pick free ones here, in the seed files and in the server code.', v_clash;
    END IF;
END $$;


-- ── 1 · accounts.acc_voucher_types.vchr_whatsapp_after_post (Q3) ───────────
-- Constant default: existing rows take false with no rewrite. Every tick OFF
-- to start (Q3); 307 and 303 switch it per type, child types included.
ALTER TABLE accounts.acc_voucher_types
    ADD COLUMN IF NOT EXISTS vchr_whatsapp_after_post boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN accounts.acc_voucher_types.vchr_whatsapp_after_post IS
    'WhatsApp on Post (20261119100000): after a post of this type commits, the server sends the document on WhatsApp unless the post said waOnPost = false. Phase 1: Sales Bill and its child types, Sales Order, Receipt (Bill-wise). All false to start (Q3).';


-- ── 2 · accounts.acc_ledger_master: message language and opt-out dates ────
-- The party (one partyId = led_id) carries them, not the customer row
-- (decision 15: cus_enable_sms / cus_overdue_sms / led_allow_sms are not
-- reused). They ride the existing whole-row ledger push.
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_wa_lang             varchar(5),
    ADD COLUMN IF NOT EXISTS led_wa_reminders_off_on timestamptz,
    ADD COLUMN IF NOT EXISTS led_wa_all_off_on       timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'accounts.acc_ledger_master'::regclass AND conname = 'ck_led_wa_lang') THEN
        ALTER TABLE accounts.acc_ledger_master
            ADD CONSTRAINT ck_led_wa_lang CHECK (led_wa_lang IS NULL OR led_wa_lang IN ('en', 'ta'));
    END IF;
END $$;

COMMENT ON COLUMN accounts.acc_ledger_master.led_wa_lang IS
    'WhatsApp message language for this party: en | ta; NULL = the company setting whatsapp.default_language (Q7).';
COMMENT ON COLUMN accounts.acc_ledger_master.led_wa_reminders_off_on IS
    'Set when the party tapped "Stop reminders" (or by hand): payment reminders are skipped (WA_REMINDERS_STOPPED); bills, receipts and orders still go. Cleared only by Allow again (Edit on 10, logged).';
COMMENT ON COLUMN accounts.acc_ledger_master.led_wa_all_off_on IS
    'Set when the party typed STOP: every WhatsApp message to it is skipped (WA_OPTED_OUT). Cleared only by Allow again (Edit on 10, logged).';


-- ── 3 · public.wa_connection: this server's link to the relay ──────────────
-- One live row per company on this server; no row = not activated. Never
-- syncs (no sync column), so the partial unique index cannot clash.
CREATE TABLE IF NOT EXISTS public.wa_connection (
    wac_id                uuid           NOT NULL DEFAULT uuidv7(),
    wac_company_id        uuid           NOT NULL,
    wac_state             varchar(14)    NOT NULL DEFAULT 'ACTIVATED',
    wac_relay_url         varchar(200)   NOT NULL,
    wac_shop_code         varchar(12)    NOT NULL,
    wac_install_id        uuid           NOT NULL,
    wac_key_enc           text           NOT NULL,
    wac_key_version       smallint       NOT NULL DEFAULT 1,
    wac_key_prefix        varchar(12)    NOT NULL,
    wac_key_issued_on     timestamptz(6) NOT NULL,
    wac_display_name      varchar(150),
    wac_display_phone     varchar(30),
    wac_waba_id           varchar(40),
    wac_phone_number_id   varchar(40),
    wac_quality           varchar(10),
    wac_msg_limit         integer,
    wac_connected_on      timestamptz(6),
    wac_event_cursor      bigint         NOT NULL DEFAULT 0,
    wac_last_poll_on      timestamptz(6),
    wac_last_poll_ok_on   timestamptz(6),
    wac_last_poll_error   varchar(200),
    wac_poll_lease_until  timestamptz(6),
    wac_poll_lease_by     varchar(60),
    wac_fast_poll_until   timestamptz(6),
    wac_is_deleted        boolean        NOT NULL DEFAULT false,
    wac_created_on        timestamptz(6) NOT NULL DEFAULT now(),
    wac_created_by        varchar(60)    NOT NULL,
    wac_modified_on       timestamptz(6),
    wac_modified_by       varchar(60),
    CONSTRAINT pk_wa_connection PRIMARY KEY (wac_id),
    CONSTRAINT ck_wac_state CHECK (wac_state IN ('ACTIVATED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'SUSPENDED')),
    CONSTRAINT ck_wac_key_ver CHECK (wac_key_version >= 1),
    CONSTRAINT fk_wac_company FOREIGN KEY (wac_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wac_company
    ON public.wa_connection (wac_company_id) WHERE wac_is_deleted = false;

COMMENT ON TABLE public.wa_connection IS 'WhatsApp: this server''s link to wa-relay, one live row per company (no row = not activated). Holds the install key AES-256-GCM encrypted (WA_CRED_KEY, gcm:v<n>: envelope), never in clear. Never syncs: it describes this install only.';
COMMENT ON COLUMN public.wa_connection.wac_event_cursor IS 'The last relay event id applied; the poller asks GET /v1/events?after=<cursor>.';
COMMENT ON COLUMN public.wa_connection.wac_poll_lease_until IS 'Only the process holding an unexpired lease pulls events (the dev box runs the API twice on one DB).';


-- ── 4 · public.wa_template: mirror of the relay's templates ────────────────
CREATE TABLE IF NOT EXISTS public.wa_template (
    wat_id           uuid           NOT NULL DEFAULT uuidv7(),
    wat_company_id   uuid           NOT NULL,
    wat_name         varchar(60)    NOT NULL,
    wat_lang         varchar(8)     NOT NULL,
    wat_purpose      varchar(10)    NOT NULL,
    wat_category     varchar(20),
    wat_status       varchar(14)    NOT NULL,
    wat_reason       varchar(300),
    wat_body         text,
    wat_params       jsonb          NOT NULL DEFAULT '[]'::jsonb,
    wat_header_kind  varchar(10)    NOT NULL DEFAULT 'NONE',
    wat_buttons      jsonb          NOT NULL DEFAULT '[]'::jsonb,
    wat_status_on    timestamptz(6),
    wat_pulled_on    timestamptz(6) NOT NULL DEFAULT now(),
    wat_created_on   timestamptz(6) NOT NULL DEFAULT now(),
    CONSTRAINT pk_wa_template PRIMARY KEY (wat_id),
    CONSTRAINT ck_wat_lang CHECK (wat_lang ~ '^[a-z]{2}(_[A-Z]{2})?$'),
    CONSTRAINT ck_wat_purpose CHECK (wat_purpose IN ('BILL', 'ORDER', 'RECEIPT', 'REMINDER', 'TEST')),
    CONSTRAINT ck_wat_status CHECK (wat_status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'NOT_SUBMITTED')),
    CONSTRAINT ck_wat_header_kind CHECK (wat_header_kind IN ('NONE', 'DOCUMENT')),
    CONSTRAINT fk_wat_company FOREIGN KEY (wat_company_id) REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wat_company_name_lang
    ON public.wa_template (wat_company_id, wat_name, wat_lang);

COMMENT ON TABLE public.wa_template IS 'WhatsApp: the relay''s templates for this company (nex_*_v1 in en / ta, hello_world en_US), refreshed from GET /v1/connection. Never syncs.';
COMMENT ON COLUMN public.wa_template.wat_pulled_on IS 'When this row was last refreshed from the relay. Deliberately not named *synced_on: that name would make the cloud push treat the table as synced.';


-- ── 5 · public.wa_message_log: one row per send try ────────────────────────
-- Written by the sends (SENDING / SKIPPED), updated by the statuses the
-- poller applies, in any order (no CHECK across the status columns). Syncs
-- from offline sites: uuidv7 PK, no other UNIQUE.
CREATE TABLE IF NOT EXISTS public.wa_message_log (
    wml_id               uuid           NOT NULL DEFAULT uuidv7(),
    wml_acc_year         character(9)   NOT NULL,
    wml_company_id       uuid           NOT NULL,
    wml_branch_id        uuid,
    wml_kind             varchar(10)    NOT NULL,
    wml_trigger          varchar(8)     NOT NULL,
    wml_batch_id         uuid,
    wml_src_doc_type     varchar(30),
    wml_src_doc_id       uuid,
    wml_src_acc_year     character(9),
    wml_src_doc_refno    varchar(100),
    wml_vchr_type_id     integer,
    wml_party_id         uuid,
    wml_party_name       varchar(150),
    wml_as_on            date,
    wml_phone            varchar(16),
    wml_phone_source     varchar(8),
    wml_template_name    varchar(60),
    wml_lang_wanted      varchar(8),
    wml_lang_sent        varchar(8),
    wml_lang_note        varchar(120),
    wml_params           jsonb,
    wml_pdf_version_id   uuid,
    wml_pdf_bytes        integer,
    wml_pdf_filename     varchar(100),
    wml_status           varchar(10)    NOT NULL,
    wml_sending_on       timestamptz(6),
    wml_sent_on          timestamptz(6),
    wml_delivered_on     timestamptz(6),
    wml_read_on          timestamptz(6),
    wml_failed_on        timestamptz(6),
    wml_error_code       varchar(30),
    wml_meta_error_code  integer,
    wml_error_text       varchar(300),
    wml_meta_message_id  varchar(128),
    wml_relay_msg_id     uuid,
    wml_try_no           smallint       NOT NULL DEFAULT 1,
    wml_retry_of         uuid,
    wml_reply            varchar(16),
    wml_reply_on         timestamptz(6),
    wml_gap_override     boolean        NOT NULL DEFAULT false,
    wml_override_reason  varchar(200),
    wml_cost_rate        numeric(10,4),
    wml_cost_gst_pct     numeric(5,2),
    wml_device_id        text,
    wml_user_id          uuid,
    wml_user_name        varchar(60),
    wml_purged_on        timestamptz(6),
    wml_is_deleted       boolean        NOT NULL DEFAULT false,
    wml_sync_date        timestamptz(6),
    wml_created_on       timestamptz(6) NOT NULL DEFAULT now(),
    wml_created_by       varchar(60)    NOT NULL,
    wml_modified_on      timestamptz(6),
    CONSTRAINT pk_wa_message_log PRIMARY KEY (wml_id, wml_acc_year),
    CONSTRAINT ck_wml_acc_year CHECK (wml_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
                                      AND right(wml_acc_year::text, 4)::integer = left(wml_acc_year::text, 4)::integer + 1),
    CONSTRAINT ck_wml_kind CHECK (wml_kind IN ('BILL', 'ORDER', 'RECEIPT', 'REMINDER', 'TEST')),
    CONSTRAINT ck_wml_trigger CHECK (wml_trigger IN ('ON_POST', 'MANUAL', 'BULK', 'RETRY', 'TEST')),
    CONSTRAINT ck_wml_src_doc_type CHECK (wml_src_doc_type IS NULL OR wml_src_doc_type IN ('SALE_BILL', 'SALES_ORDER', 'RECEIPT')),
    CONSTRAINT ck_wml_phone_source CHECK (wml_phone_source IS NULL OR wml_phone_source IN ('WHATSAPP', 'PHONE1', 'PHONE2', 'TYPED')),
    CONSTRAINT ck_wml_status CHECK (wml_status IN ('SKIPPED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    CONSTRAINT ck_wml_try_no CHECK (wml_try_no >= 1),
    CONSTRAINT ck_wml_reply CHECK (wml_reply IS NULL OR wml_reply IN ('PAID_ALREADY', 'STOP_REMINDERS', 'STOP_ALL')),
    CONSTRAINT ck_wml_doc CHECK ((wml_kind IN ('BILL', 'ORDER', 'RECEIPT')) = (wml_src_doc_id IS NOT NULL)),
    CONSTRAINT ck_wml_party CHECK (wml_kind = 'TEST' OR wml_party_id IS NOT NULL),
    CONSTRAINT ck_wml_error CHECK (wml_status NOT IN ('SKIPPED', 'FAILED') OR wml_error_code IS NOT NULL)
) PARTITION BY LIST (wml_acc_year);

-- None UNIQUE: nothing here can clash when two sites' rows meet at sync.
CREATE INDEX IF NOT EXISTS ix_wml_company_time
    ON public.wa_message_log (wml_company_id, wml_created_on DESC);
CREATE INDEX IF NOT EXISTS ix_wml_doc
    ON public.wa_message_log (wml_src_doc_type, wml_src_doc_id);
CREATE INDEX IF NOT EXISTS ix_wml_party_kind
    ON public.wa_message_log (wml_company_id, wml_party_id, wml_kind, wml_created_on DESC);
CREATE INDEX IF NOT EXISTS ix_wml_meta
    ON public.wa_message_log (wml_meta_message_id) WHERE wml_meta_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_wml_batch
    ON public.wa_message_log (wml_batch_id) WHERE wml_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_wml_sending
    ON public.wa_message_log (wml_created_on) WHERE wml_status = 'SENDING';

COMMENT ON TABLE public.wa_message_log IS 'WhatsApp: one row per send try (bill, order, receipt, payment reminder, test). Statuses SENT < DELIVERED < READ arrive in any order; FAILED replaces only SENDING / SENT. After whatsapp.log_retention_years the number, params, Meta ids, error text and party name are set NULL (wml_purged_on); kind, status, dates, party id and cost stay for the counts.';
COMMENT ON COLUMN public.wa_message_log.wml_acc_year IS 'The company''s accounting year on the SEND date (partition key); the document''s own year is wml_src_acc_year.';
COMMENT ON COLUMN public.wa_message_log.wml_id IS 'Also the relay clientRef (its idempotency key per install).';

-- Sync triggers + pending index for the log only (what
-- public.sync_install_triggers() does per table). Skipped where the sync
-- functions are absent (the VPS: cloud sync is local-only), as 20261117100000.
DO $sync$
BEGIN
    IF to_regprocedure('public.fn_sync_mark_dirty()') IS NULL
       OR to_regprocedure('public.fn_sync_log_delete()') IS NULL THEN
        RAISE NOTICE 'whatsapp: sync functions absent, sync triggers skipped';
        RETURN;
    END IF;
    EXECUTE format('CREATE OR REPLACE TRIGGER zz_sync_mark_dirty BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_sync_mark_dirty(%L)',
                   'wa_message_log', 'wml_sync_date');
    EXECUTE format('CREATE OR REPLACE TRIGGER zz_sync_log_delete AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_sync_log_delete(%L, %L, %L, %L)',
                   'wa_message_log', 'public', 'wa_message_log', 'wml_id', 'wml_acc_year');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I, %I) WHERE %I IS NULL',
                   'ix_sync_pending_wa_message_log', 'wa_message_log', 'wml_id', 'wml_acc_year', 'wml_sync_date');
END $sync$;


-- ── 6 · ensure_acc_year_partitions: + wa_message_log ───────────────────────
-- The live body (last redefined by 20261117100000_delivery_tracking; read back
-- with pg_get_functiondef on 2026-11-17, unchanged by DC / mobile) copied
-- forward, with the log appended before the stock engine's call.
CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character)
 RETURNS void
 LANGUAGE plpgsql
AS $function$

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
    --  Header BEFORE lines: acc_vouchers carries fk_av_header into it.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_header FOR VALUES IN (%L)',
        'acc_voucher_header_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_vouchers FOR VALUES IN (%L)',
        'acc_vouchers_' || v_suffix, v_year);

    -- ── Added by 20260921120000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
        'gst_api_log_' || v_suffix, v_year);

    -- ── Added by 20260921140000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_ledger FOR VALUES IN (%L)',
        'loyalty_ledger_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem FOR VALUES IN (%L)',
        'loyalty_gift_redeem_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_gift_redeem_item FOR VALUES IN (%L)',
        'loyalty_gift_redeem_item_' || v_suffix, v_year);

    -- ── Added by 20260921160000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_coupon_txn FOR VALUES IN (%L)',
        'loyalty_coupon_txn_' || v_suffix, v_year);

    -- ── Added by 20260921180000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.promotion_usage FOR VALUES IN (%L)',
        'promotion_usage_' || v_suffix, v_year);

    -- ── Added by 20260921200000 ──────────────────────────────────────────
    --  The six sales documents. Parent before child throughout.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_return FOR VALUES IN (%L)',
        'sale_return_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_return_item FOR VALUES IN (%L)',
        'sale_return_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc FOR VALUES IN (%L)',
        'sale_dc_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_item FOR VALUES IN (%L)',
        'sale_dc_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_return FOR VALUES IN (%L)',
        'sale_dc_return_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_dc_return_item FOR VALUES IN (%L)',
        'sale_dc_return_item_' || v_suffix, v_year);

    -- ── Added by 20260922000000 ──────────────────────────────────────────
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_temp_credit FOR VALUES IN (%L)',
        'acc_temp_credit_' || v_suffix, v_year);

    -- ── Added by 20260922040000 ──────────────────────────────────────────
    --  The transport band. Written for every goods-moving document that has a
    --  consignment, so a missing partition stops a dispatch.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_transport_detail FOR VALUES IN (%L)',
        'txn_transport_detail_' || v_suffix, v_year);

    -- ── Added by 20260922100000 ──────────────────────────────────
    --  The GST document band. The register carries fk_*_gdr from the other
    --  three, so it is created first.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_register FOR VALUES IN (%L)',
        'acc_voucher_doc_register_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_detail FOR VALUES IN (%L)',
        'acc_voucher_doc_detail_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_einvoice FOR VALUES IN (%L)',
        'acc_voucher_doc_einvoice_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_doc_ewaybill FOR VALUES IN (%L)',
        'acc_voucher_doc_ewaybill_' || v_suffix, v_year);

    -- ── Added by 20261008100000 — till management (share file 47) ────────
    --  Parent before child: day → session → variance, count → count line.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_business_day FOR VALUES IN (%L)',
        'till_business_day_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_session FOR VALUES IN (%L)',
        'till_session_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_count FOR VALUES IN (%L)',
        'till_count_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_count_line FOR VALUES IN (%L)',
        'till_count_line_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_cash_movement FOR VALUES IN (%L)',
        'till_cash_movement_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_variance FOR VALUES IN (%L)',
        'till_variance_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_approval FOR VALUES IN (%L)',
        'till_approval_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_event FOR VALUES IN (%L)',
        'till_event_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_session_review FOR VALUES IN (%L)',
        'till_session_review_' || v_suffix, v_year);

    -- ── Added by 20261008130000 — non-cash tender control (share file 49) ─
    --  Import before line: acc_settlement_line carries fk_asl_import.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_settlement_import FOR VALUES IN (%L)',
        'acc_settlement_import_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_settlement_line FOR VALUES IN (%L)',
        'acc_settlement_line_' || v_suffix, v_year);

    -- ── Added by 20261017150000 — void bill (REV 2) ───────────────────────
    --  The void evidence row, and print_log, whose "printed before the void"
    --  rows it reads: both year-partitioned, neither was in the roll before.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.till_void FOR VALUES IN (%L)',
        'till_void_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.print_log FOR VALUES IN (%L)',
        'print_log_' || v_suffix, v_year);

    -- ── Added by 20261117100000 — delivery tracking P1 ────────────────────
    --  The note before its lines (fk_sdni_note); the events last.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_note FOR VALUES IN (%L)',
        'sale_delivery_note_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_note_item FOR VALUES IN (%L)',
        'sale_delivery_note_item_' || v_suffix, v_year);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_delivery_event FOR VALUES IN (%L)',
        'sale_delivery_event_' || v_suffix, v_year);

    -- ── Added by 20261119100000 — WhatsApp message log ──────────────────
    --  One row per send try; written by the send paths, updated by statuses.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.wa_message_log FOR VALUES IN (%L)',
        'wa_message_log_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$function$;

-- Backfill: the log's partitions for every year public.txn_status_log has a
-- partition for (read from pg_inherits, never hard-coded). Only this table is
-- touched here; the other tables' partitions are left as they are.
DO $$
DECLARE
    v_year text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT substring(pg_get_expr(c.relpartbound, c.oid) FROM '''([0-9]{4}-[0-9]{4})''')
          FROM pg_inherits i
          JOIN pg_class c ON c.oid = i.inhrelid
         WHERE i.inhparent = 'public.txn_status_log'::regclass
         ORDER BY 1
    LOOP
        CONTINUE WHEN v_year IS NULL;
        EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.wa_message_log FOR VALUES IN (%L)',
                       'wa_message_log_' || replace(v_year, '-', '_'), v_year);
    END LOOP;
END $$;


-- ── 7 · settings whatsapp.* (Q5, Q7, Q15, Q16, Q19; no hold-days: Q12) ─────
-- Per company. Times are stored 24-hour HH:mm (screens show 12-hour); the
-- server checks their shape (WA_SETTING_INVALID field=reminderFrom / To).
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values,
     asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES
    ('whatsapp.reminder_gap_days', 'WHATSAPP', 'Reminders', 'INT', '3', NULL,
     0, 30, 'COMPANY', 'Days between reminders to one party',
     'A party gets at most one payment reminder in this many days; sending sooner asks first and is logged (WA_REMINDER_GAP). 0 = no gap.',
     10, 'system'),
    ('whatsapp.reminder_from', 'WHATSAPP', 'Reminders', 'TEXT', '09:00', NULL,
     NULL, NULL, 'COMPANY', 'Send reminders from',
     'Payment reminders go only from this time (24-hour HH:mm, IST). Outside the hours they are refused (WA_REMINDER_HOURS, Q3). Bills, receipts and orders go at any time.',
     20, 'system'),
    ('whatsapp.reminder_to', 'WHATSAPP', 'Reminders', 'TEXT', '20:00', NULL,
     NULL, NULL, 'COMPANY', 'Send reminders until',
     'Payment reminders go only until this time (24-hour HH:mm, IST); later than Send reminders from.',
     30, 'system'),
    ('whatsapp.bulk_max_parties', 'WHATSAPP', 'Reminders', 'INT', '250', NULL,
     1, 1000, 'COMPANY', 'Most parties in one bulk send',
     'Payment Reminders (menu 308) refuses a send with more ticked parties than this (WA_BATCH_TOO_BIG).',
     40, 'system'),
    ('whatsapp.default_language', 'WHATSAPP', 'Messages', 'TEXT', 'en', '["en", "ta"]'::jsonb,
     NULL, NULL, 'COMPANY', 'Message language for new parties',
     'The language of a party whose Message language is empty. If that template is not approved yet, English goes and the log says so (Q7).',
     50, 'system'),
    ('whatsapp.fallback_click_to_chat', 'WHATSAPP', 'Messages', 'BOOL', 'true', NULL,
     NULL, NULL, 'COMPANY', 'When not connected, open the chat on this PC',
     'While WhatsApp is not connected (or a send failed), the screens offer the old click-to-chat instead (Q15).',
     60, 'system'),
    ('whatsapp.rate_per_message', 'WHATSAPP', 'Cost', 'DECIMAL', '0.115', NULL,
     0, NULL, 'COMPANY', 'Meta''s rate per message (approx.)',
     'Rupees per message, for the approximate cost shown before a bulk send and kept on each log row (Q16). Meta bills the card on the WhatsApp account.',
     70, 'system'),
    ('whatsapp.rate_gst_percent', 'WHATSAPP', 'Cost', 'DECIMAL', '18', NULL,
     0, 100, 'COMPANY', 'GST on Meta''s charge, %',
     'Added to the approximate cost (a law parameter, so a per-company setting).',
     80, 'system'),
    ('whatsapp.log_retention_years', 'WHATSAPP', 'Log', 'INT', '2', NULL,
     1, 10, 'COMPANY', 'Keep message details for (years)',
     'After this many years the number, message values and Meta ids of a log row are removed; the counts stay (Q19).',
     90, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 8 · print purpose PARTY_STATEMENT (Q4; the design ships in P3) ─────────
-- Shared (company NULL), REPORT like PARTY_OUTSTANDING (131) ... GODOWN_POSITION
-- (134). No template, version, dataset or assignment rows here.
INSERT INTO public.print_purpose
       (ppo_id, ppo_company_id, ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes, ppo_is_active, ppo_is_deleted)
SELECT '01a1e9b5-5b97-7e6b-b45e-c8d18c824c15'::uuid, NULL, 'PARTY_STATEMENT', 'Party Statement', 'REPORT',
       'PARTY_STATEMENT', 1, 'NA', true, 136,
       'The customer-facing "Statement of pending bills as on DD-MM-YYYY" sent as the PDF of a WhatsApp payment reminder (menu 308, Party Outstanding Ctrl+W). One party: params party_id (required), side DR, as_on = the send date; built from the Bill-wise Outstanding A5 datasets. docId = the party (led_id). Design: docs/print-templates/party-statement-a5 (P3).',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p
                    WHERE p.ppo_id = '01a1e9b5-5b97-7e6b-b45e-c8d18c824c15'::uuid
                       OR (p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = 'party_statement' AND p.ppo_is_deleted = false));


-- ── 9 · menus 307 / 308 / 309 (hidden, decision 19); rights (Q13) ──────────
INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_alias, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT v.id, v.parent, v.name, NULL, false, v.pos, true, false, v.verbs::text[], now(), now()
  FROM (VALUES (307, 60, 'WhatsApp',          85.00, '{VIEW,EDIT}'),
               (308, 6,  'Payment Reminders',  7.60, '{VIEW,PRINT,EXPORT,POST}'),
               (309, 6,  'WhatsApp Log',      25.00, '{VIEW,EXPORT,POST}')
       ) v(id, parent, name, pos, verbs)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = v.parent)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = v.id);

-- The sequence never hands out a pinned id: GREATEST, so a box whose sequence
-- already ran past 309 is not wound back.
SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 1) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));

-- 307: each live Edit-on-303 (Voucher Types) holder, the admins who own the
-- on-post ticks: view + edit.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 307, true, false, true, false,
       false, false, true, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 303
   AND u.um_is_deleted = false
   AND u.um_can_edit = true
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 307 AND m.menu_name = 'WhatsApp')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- 308: each live View-on-279 (Party Outstanding) holder: view + print +
-- export. Post (send) is given to nobody; an admin ticks it (Q13).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, 308, true, false, false, false,
       true, true, true, false, false,
       0, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
 WHERE u.um_menu_id = 279
   AND u.um_is_deleted = false
   AND u.um_can_view = true
   AND EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 308 AND m.menu_name = 'Payment Reminders')
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

-- 309: the 279 viewers (view + export) and the 307 editors (view + export +
-- post = retry / resend); one row per user, post when the user is a 307
-- editor (live Edit on 303).
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT DISTINCT ON (s.user_id)
       s.user_id, 309, true, false, false, false,
       false, true, true, false, false,
       0, false, s.created_by,
       EXISTS (SELECT 1 FROM public.user_menus e
                WHERE e.um_user_id = s.user_id AND e.um_menu_id = 303
                  AND e.um_is_deleted = false AND e.um_can_edit = true),
       false, false, false, false
  FROM (SELECT u.um_user_id AS user_id, u.um_created_by AS created_by, 1 AS src
          FROM public.user_menus u
         WHERE u.um_menu_id = 279 AND u.um_is_deleted = false AND u.um_can_view = true
        UNION ALL
        SELECT u.um_user_id, u.um_created_by, 2
          FROM public.user_menus u
         WHERE u.um_menu_id = 303 AND u.um_is_deleted = false AND u.um_can_edit = true) s
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = 309 AND m.menu_name = 'WhatsApp Log')
 ORDER BY s.user_id, s.src
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;


-- ── 10 · table registry rows 1401-1403 (Db_Table_Master.sql carries the same)
INSERT INTO public.db_table_master
       (dtm_id, dtm_schema, dtm_table, dtm_parent_id, dtm_name, dtm_kind, dtm_module,
        dtm_col_prefix, dtm_sync_col, dtm_menu_id, dtm_write_mode, dtm_retention_days, dtm_is_active,
        dtm_description)
SELECT v.id, 'public', v.tbl, NULL, v.name, v.kind, 'WHATSAPP', v.prefix, v.sync_col,
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = v.menu),
       v.write_mode, NULL, true, v.descr
  FROM (VALUES
        (1401, 'wa_connection'::text, 'WhatsApp Connection'::text, 'SETTING'::text, 'wac_'::text, NULL::text, 307, 'EDITABLE'::text,
         'This server''s link to wa-relay, one live row per company: state, shop code, install key (encrypted), the connected number, the event cursor and the poll lease. Never syncs.'::text),
        (1402, 'wa_template', 'WhatsApp Template', 'METADATA', 'wat_', NULL, 307, 'DERIVED',
         'Mirror of the relay''s message templates per company (name x language), with Meta''s approval status. Never syncs.'),
        (1403, 'wa_message_log', 'WhatsApp Message Log', 'LOG', 'wml_', 'wml_sync_date', 309, 'EDITABLE',
         'One row per WhatsApp send try (bill, order, receipt, payment reminder, test) with its statuses, reason and cost; details purged after whatsapp.log_retention_years.')
       ) v(id, tbl, name, kind, prefix, sync_col, menu, write_mode, descr)
 WHERE to_regclass('public.' || v.tbl) IS NOT NULL
ON CONFLICT (dtm_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.db_table_master', 'dtm_id'),
              GREATEST((SELECT COALESCE(max(dtm_id), 1) FROM public.db_table_master),
                       (SELECT last_value FROM public.db_table_master_dtm_id_seq)));


-- ── 11 · grid 222 (WhatsApp_Grid_222.sql carries the same) ───────────────
-- The 309 log. Tokens are compared as text; every caller sends every token
-- ('' = no filter). Timestamps leave as IST text, 12-hour; sort_key is a
-- sortable IST text for sort_by. The grid SQL holds no comment marker.
INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(222, 'MAIN LIST - WHATSAPP LOG',
 'WhatsApp Log (menu 309): one row per send try, newest first. Tokens (send every one; '''' = no filter): p_company_id, p_branch_id, p_from, p_to (yyyy-MM-dd, on the IST send date), p_kind ('''' / BILL / ORDER / RECEIPT / REMINDER / TEST), p_status ('''' / SKIPPED / SENDING / SENT / DELIVERED / READ / FAILED), p_party_id (led_id). Reason = the plain line of wml_error_code (fixed.error_message, en), else the relay / Meta words; with no error, the language note. Note = the document is now cancelled (read at run time).',
 'sort_key', 'Descending', 'Desktop', true, false, 'system',
$g222$SELECT l.wml_id,
       l.wml_acc_year,
       l.wml_company_id,
       l.wml_branch_id,
       to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS sent_at,
       CASE l.wml_kind WHEN 'BILL' THEN 'Sale bill'
                       WHEN 'ORDER' THEN 'Sales order'
                       WHEN 'RECEIPT' THEN 'Receipt'
                       WHEN 'REMINDER' THEN 'Payment reminder'
                       WHEN 'TEST' THEN 'Test message'
                       ELSE l.wml_kind END AS kind_text,
       CASE WHEN l.wml_src_doc_refno IS NOT NULL THEN l.wml_src_doc_refno
            WHEN l.wml_kind = 'REMINDER' AND l.wml_as_on IS NOT NULL THEN 'Statement as on ' || to_char(l.wml_as_on, 'DD-MM-YYYY')
            ELSE '' END AS doc_text,
       COALESCE(l.wml_party_name, '') AS party_name,
       COALESCE(l.wml_phone, '') AS phone,
       CASE WHEN l.wml_template_name IS NULL THEN ''
            ELSE l.wml_template_name || ' · ' || COALESCE(l.wml_lang_sent, l.wml_lang_wanted, '') END AS template_text,
       CASE l.wml_status WHEN 'SKIPPED' THEN 'Skipped'
                         WHEN 'SENDING' THEN 'Sending'
                         WHEN 'SENT' THEN 'Sent'
                         WHEN 'DELIVERED' THEN 'Delivered'
                         WHEN 'READ' THEN 'Read'
                         WHEN 'FAILED' THEN 'Failed'
                         ELSE l.wml_status END AS status_text,
       to_char(COALESCE(CASE l.wml_status WHEN 'READ' THEN l.wml_read_on
                                          WHEN 'DELIVERED' THEN l.wml_delivered_on
                                          WHEN 'SENT' THEN l.wml_sent_on
                                          WHEN 'FAILED' THEN l.wml_failed_on
                                          WHEN 'SENDING' THEN l.wml_sending_on END,
                        l.wml_created_on) AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS status_at,
       CASE WHEN l.wml_error_code IS NULL THEN COALESCE(l.wml_lang_note, '')
            ELSE COALESCE(e.erm_line, l.wml_error_text, l.wml_error_code) END AS reason_text,
       COALESCE(e.erm_todo, '') AS reason_todo,
       COALESCE(l.wml_error_text, '') AS error_detail,
       CASE l.wml_reply WHEN 'PAID_ALREADY' THEN 'Paid already'
                        WHEN 'STOP_REMINDERS' THEN 'Stop reminders'
                        WHEN 'STOP_ALL' THEN 'STOP'
                        ELSE '' END AS reply_text,
       COALESCE(NULLIF(l.wml_user_name, ''), NULLIF(u.usr_display_name, ''), u.usr_login_name, l.wml_created_by) AS by_name,
       COALESCE(b.br_name, '') AS branch_name,
       l.wml_try_no,
       CASE WHEN COALESCE(sb.sb_status, so.so_status, vh.avh_voucher_status) = 'CANCELLED'
                 AND l.wml_status IN ('SENT', 'DELIVERED', 'READ') THEN 'Cancelled after it was sent'
            WHEN COALESCE(sb.sb_status, so.so_status, vh.avh_voucher_status) = 'CANCELLED' THEN 'Document cancelled'
            ELSE '' END AS note_text,
       l.wml_kind,
       l.wml_status,
       l.wml_trigger,
       l.wml_error_code,
       l.wml_src_doc_type,
       l.wml_src_doc_id,
       l.wml_src_acc_year,
       l.wml_party_id,
       l.wml_retry_of,
       l.wml_batch_id,
       l.wml_gap_override,
       to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS.US') AS sort_key
  FROM public.wa_message_log l
  LEFT JOIN fixed.error_message e ON e.erm_code = l.wml_error_code
                                 AND e.erm_variant = ''
                                 AND e.erm_lang = 'en'
                                 AND e.erm_is_active = true
  LEFT JOIN public.user_master u ON u.usr_id = l.wml_user_id
  LEFT JOIN public.branch_master b ON b.br_id = l.wml_branch_id
  LEFT JOIN sales.sale_bill sb ON l.wml_src_doc_type = 'SALE_BILL'
                              AND sb.sb_id = l.wml_src_doc_id
                              AND sb.sb_acc_year = l.wml_src_acc_year
  LEFT JOIN sales.sale_order so ON l.wml_src_doc_type = 'SALES_ORDER'
                               AND so.so_id = l.wml_src_doc_id
                               AND so.so_acc_year = l.wml_src_acc_year
  LEFT JOIN accounts.acc_voucher_header vh ON l.wml_src_doc_type = 'RECEIPT'
                                          AND vh.avh_voucher_id = l.wml_src_doc_id
                                          AND vh.avh_acc_year = l.wml_src_acc_year
 WHERE l.wml_company_id::text = 'p_company_id'
   AND l.wml_is_deleted = false
   AND ('p_branch_id' = '' OR l.wml_branch_id::text = 'p_branch_id')
   AND (NULLIF('p_from', '') IS NULL OR to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') >= 'p_from')
   AND (NULLIF('p_to', '') IS NULL OR to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= 'p_to')
   AND ('p_kind' = '' OR l.wml_kind = 'p_kind')
   AND ('p_status' = '' OR l.wml_status = 'p_status')
   AND ('p_party_id' = '' OR l.wml_party_id::text = 'p_party_id')
 ORDER BY l.wml_created_on DESC, l.wml_try_no DESC$g222$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    ('01a1e9b5-2220-7000-8000-000000222001'::uuid, 222::bigint, 1::integer, '#'::text, 'wml_id'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean),
    ('01a1e9b5-2220-7000-8000-000000222002', 222, 2, 'Year', 'wml_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222003', 222, 3, 'Company', 'wml_company_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222004', 222, 4, 'Branch id', 'wml_branch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222005', 222, 5, 'Time', 'sent_at', 'Text', 8.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222006', 222, 6, 'Kind', 'kind_text', 'Text', 6.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222007', 222, 7, 'Document', 'doc_text', 'Text', 9.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222008', 222, 8, 'Party', 'party_name', 'Text', 12.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222009', 222, 9, 'Number', 'phone', 'Text', 8.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222010', 222, 10, 'Template · lang', 'template_text', 'Text', 9.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222011', 222, 11, 'Status', 'status_text', 'Text', 5.00, 'Center', true, false),
    ('01a1e9b5-2220-7000-8000-000000222012', 222, 12, 'Status time', 'status_at', 'Text', 8.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222013', 222, 13, 'Reason', 'reason_text', 'Text', 12.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222014', 222, 14, 'To do', 'reason_todo', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222015', 222, 15, 'Detail', 'error_detail', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222016', 222, 16, 'Reply', 'reply_text', 'Text', 5.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222017', 222, 17, 'By', 'by_name', 'Text', 5.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222018', 222, 18, 'Branch', 'branch_name', 'Text', 5.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222019', 222, 19, 'Tries', 'wml_try_no', 'Number', 3.00, 'Right', true, false),
    ('01a1e9b5-2220-7000-8000-000000222020', 222, 20, 'Note', 'note_text', 'Text', 5.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222021', 222, 21, 'Kind code', 'wml_kind', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222022', 222, 22, 'Status code', 'wml_status', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222023', 222, 23, 'Trigger', 'wml_trigger', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222024', 222, 24, 'Error code', 'wml_error_code', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222025', 222, 25, 'Doc type', 'wml_src_doc_type', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222026', 222, 26, 'Doc id', 'wml_src_doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222027', 222, 27, 'Doc year', 'wml_src_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222028', 222, 28, 'Party id', 'wml_party_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222029', 222, 29, 'Retry of', 'wml_retry_of', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222030', 222, 30, 'Batch', 'wml_batch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222031', 222, 31, 'Gap override', 'wml_gap_override', 'Boolean', 0.00, 'Center', false, false),
    ('01a1e9b5-2220-7000-8000-000000222032', 222, 32, 'Sort', 'sort_key', 'Text', 0.00, 'Left', false, false)
       ) v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = v.grid AND d.grid_name = 'MAIN LIST - WHATSAPP LOG')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;


-- ── 12 · plain wording rows (notes 120), catalogue 2026-11-17.5 ──────────
-- The 49 codes of plan §5.6 as worded there; WA_RELAY_BUSY (RELAY_RATE_LIMITED),
-- WA_RELAY_ERROR (RELAY_INTERNAL / RELAY_DB_DOWN / RELAY_NOT_FOUND / an
-- unreadable answer), WA_RELAY_BAD_REQUEST (RELAY_BAD_REQUEST not on `to`) and
-- WA_CONNECT_NOT_FINISHED (a Connect wait that ends without CONNECTED: the
-- relay's connect-code and WABA-taken refusals reach only the browser);
-- 9 field= variants of WA_SETTING_INVALID. prisma/seed/Error_Messages.json
-- carries the same rows, so a deploy that does not run the seed still has them.
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('WA_RIGHT_VIEW', '', 'en', 'Not allowed', 'You cannot open this WhatsApp screen.', 'Ask your admin for View on it.')
    ,('WA_RIGHT_EDIT', '', 'en', 'Not allowed', 'You cannot change WhatsApp settings.', 'Ask your admin for Edit on WhatsApp.')
    ,('WA_RIGHT_POST', '', 'en', 'Not allowed', 'You cannot send reminders or resend messages.', 'Ask your admin for Post on this screen.')
    ,('WA_RIGHT_PRINT', '', 'en', 'Not allowed', 'You cannot send this document.', 'Sending needs the Print right on it.')
    ,('WA_KEY_MISSING', '', 'en', 'WhatsApp not set up', 'This server has no WhatsApp key.', 'Ask VK support to finish the server setup.')
    ,('WA_RELAY_NOT_SET', '', 'en', 'WhatsApp not set up', 'This server does not know the WhatsApp service address.', 'Ask VK support to finish the server setup.')
    ,('WA_RELAY_UNREACHABLE', '', 'en', 'No internet', 'WhatsApp could not be reached from this server.', 'Check the internet, then send again from the WhatsApp Log.')
    ,('WA_ACTIVATION_INVALID', '', 'en', 'Code not accepted', 'This activation code is wrong, used or expired.', 'Check it, or ask VK for a new one.')
    ,('WA_ALREADY_ACTIVATED', '', 'en', 'Already activated', 'WhatsApp is already activated for this company here.', 'Use Connect, or Disconnect first.')
    ,('WA_NOT_ACTIVATED', '', 'en', 'Not activated', 'WhatsApp is not activated for this company.', 'Enter the activation code from VK first.')
    ,('WA_KEY_REVOKED', '', 'en', 'Stopped by VK', 'VK has turned off WhatsApp for this server.', 'Call VK support.')
    ,('WA_SHOP_SUSPENDED', '', 'en', 'Paused by VK', 'VK has paused WhatsApp for this company.', 'Call VK support.')
    ,('WA_NOT_CONNECTED', '', 'en', 'WhatsApp not connected', 'This company has not connected its WhatsApp number.', 'Connect it in Settings › WhatsApp, or use the chat button.')
    ,('WA_ALREADY_CONNECTED', '', 'en', 'Already connected', 'This company''s number is already connected.', 'Disconnect first to change the number.')
    ,('WA_SITE_OFFLINE', '', 'en', 'Main server only', 'WhatsApp is set up and sent from the main server.', 'Do this on the main server.')
    ,('WA_SETTING_INVALID', '', 'en', 'Setting not right', 'This value is not allowed here.', 'Correct it and save again.')
    ,('WA_DOC_NOT_FOUND', '', 'en', 'Not found', 'This document is not there any more.', 'Refresh and try again.')
    ,('WA_DOC_NOT_POSTED', '', 'en', 'Not posted yet', 'Only a posted document can be sent.', 'Post it first.')
    ,('WA_DOC_CANCELLED', '', 'en', 'Cancelled', 'This document is cancelled, so it is not sent.', 'Send the new document instead.')
    ,('WA_PARTY_NOT_FOUND', '', 'en', 'Party not found', 'This party is not there any more.', 'Refresh and try again.')
    ,('WA_NO_NUMBER', '', 'en', 'No mobile number', 'This party has no mobile number.', 'Add one on the customer, or type it on the bill.')
    ,('WA_BAD_NUMBER', '', 'en', 'Not a mobile number', 'The number is a landline or not a full mobile number.', 'Put a mobile number on the customer.')
    ,('WA_OPTED_OUT', '', 'en', 'Customer said STOP', 'This customer asked for no WhatsApp messages.', 'Use Allow again on the customer only if they ask.')
    ,('WA_REMINDERS_STOPPED', '', 'en', 'Reminders stopped', 'This customer tapped Stop reminders.', 'Bills and receipts still go. Allow again only if they ask.')
    ,('WA_REMINDER_GAP', '', 'en', 'Reminded recently', 'This party had a reminder in the last few days.', 'Send anyway only if needed; it is logged.')
    ,('WA_REMINDER_HOURS', '', 'en', 'Outside sending hours', 'Reminders go only between the set hours.', 'Send them in the sending hours.')
    ,('WA_NOTHING_DUE', '', 'en', 'Nothing due', 'This party owes nothing as on this date.', 'No reminder is needed.')
    ,('WA_TEMPLATE_NOT_APPROVED', '', 'en', 'Not approved yet', 'Meta has not approved this message yet.', 'Wait for approval; see Settings › WhatsApp.')
    ,('WA_PDF_NO_DESIGN', '', 'en', 'No print design', 'There is no published print design for this document.', 'Set one in Print Assignments, then send again.')
    ,('WA_PDF_FAILED', '', 'en', 'PDF not made', 'The PDF of this document could not be made.', 'Try again; if it repeats, call VK support.')
    ,('WA_PDF_TOO_BIG', '', 'en', 'PDF too big', 'The PDF is larger than WhatsApp allows.', 'Use a smaller print design.')
    ,('WA_BATCH_EMPTY', '', 'en', 'Nothing ticked', 'No party is ticked to send.', 'Tick the parties first.')
    ,('WA_BATCH_TOO_BIG', '', 'en', 'Too many at once', 'More parties are ticked than one send allows.', 'Send in smaller groups.')
    ,('WA_DAILY_LIMIT', '', 'en', 'Daily limit reached', 'This number may reach only so many new customers a day.', 'Send the rest tomorrow.')
    ,('WA_RETRY_NOT_ALLOWED', '', 'en', 'Still sending', 'This message is still being sent.', 'Wait a moment and refresh.')
    ,('WA_ALREADY_DELIVERED', '', 'en', 'Already delivered', 'This message already reached the customer.', 'Send again only if they ask.')
    ,('WA_SEND_INTERRUPTED', '', 'en', 'Send stopped', 'The server stopped while this message was being sent.', 'Send it again from the WhatsApp Log.')
    ,('WA_ALLOW_AGAIN_CONFIRM', '', 'en', 'Confirm first', 'Allow again only when the customer asked for it.', 'Tick "The customer asked" to go on.')
    ,('WA_META_131026', '', 'en', 'Not on WhatsApp', 'This number cannot get WhatsApp messages.', 'Check the number with the customer.')
    ,('WA_META_131042', '', 'en', 'Meta payment problem', 'Meta refused: the card on the WhatsApp account has a problem.', 'Fix the payment method in WhatsApp Manager.')
    ,('WA_META_130429', '', 'en', 'Too fast', 'Meta''s sending speed limit was reached.', 'Send again in a few minutes.')
    ,('WA_META_131056', '', 'en', 'Too many to one number', 'Too many messages went to this number in a short time.', 'Wait a while, then send again.')
    ,('WA_META_132001', '', 'en', 'Wording missing at Meta', 'Meta does not have this message wording.', 'Call VK support.')
    ,('WA_META_132015', '', 'en', 'Paused by Meta', 'Meta paused this message for low quality.', 'VK will fix it; use the chat button meanwhile.')
    ,('WA_META_131031', '', 'en', 'Account locked', 'Meta has locked this WhatsApp account.', 'Check WhatsApp Manager, or call VK support.')
    ,('WA_META_131053', '', 'en', 'PDF not accepted', 'Meta could not take the PDF.', 'Send again; if it repeats, call VK support.')
    ,('WA_META_132000', '', 'en', 'Message details wrong', 'Meta refused the message details.', 'Call VK support.')
    ,('WA_META_190', '', 'en', 'Link to Meta expired', 'The connection to Meta has expired.', 'Connect WhatsApp again.')
    ,('WA_META_OTHER', '', 'en', 'Meta refused', 'Meta did not send this message.', 'Try later; if it repeats, call VK support.')
    ,('WA_RELAY_BUSY', '', 'en', 'Too many at once', 'The WhatsApp service is busy with this server''s messages.', 'Wait a minute, then send again from the WhatsApp Log.')
    ,('WA_RELAY_ERROR', '', 'en', 'WhatsApp service problem', 'The WhatsApp service had a problem, so this was not sent.', 'Send again in a few minutes; if it repeats, call VK support.')
    ,('WA_RELAY_BAD_REQUEST', '', 'en', 'Message not accepted', 'The WhatsApp service did not accept this message''s details.', 'Call VK support.')
    ,('WA_CONNECT_NOT_FINISHED', '', 'en', 'Connect not finished', 'The WhatsApp sign-up in the browser was closed, failed or took more than 15 minutes.', 'Press Connect again. If the browser said the number is already in use, call VK support.')
    ,('WA_SETTING_INVALID', 'field=reminderGapDays', 'en', 'Setting not right', 'Days between reminders must be 0 to 30.', 'Type a number from 0 to 30.')
    ,('WA_SETTING_INVALID', 'field=reminderFrom', 'en', 'Setting not right', 'The send-from time must be a time like 09:00.', 'Type the time as HH:MM.')
    ,('WA_SETTING_INVALID', 'field=reminderTo', 'en', 'Setting not right', 'The send-until time must be a time like 20:00, later than the send-from time.', 'Type a later time as HH:MM.')
    ,('WA_SETTING_INVALID', 'field=defaultLanguage', 'en', 'Setting not right', 'The message language must be English or Tamil.', 'Pick English or Tamil.')
    ,('WA_SETTING_INVALID', 'field=ratePerMessage', 'en', 'Setting not right', 'The rate per message cannot be below 0.', 'Type 0 or more.')
    ,('WA_SETTING_INVALID', 'field=rateGstPercent', 'en', 'Setting not right', 'GST must be 0 to 100 %.', 'Type a number from 0 to 100.')
    ,('WA_SETTING_INVALID', 'field=logRetentionYears', 'en', 'Setting not right', 'The log can be kept for 1 to 10 years.', 'Type a number from 1 to 10.')
    ,('WA_SETTING_INVALID', 'field=bulkMaxParties', 'en', 'Setting not right', 'One send can take 1 to 1000 parties.', 'Type a number from 1 to 1000.')
    ,('WA_SETTING_INVALID', 'field=onPostTypes', 'en', 'Setting not right', 'Only Sales Bill, Sales Order and Receipt types can send on WhatsApp after posting.', 'Untick the other types.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;
UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-17.5',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-17.5';


-- Checks after deploy (read-only):
-- SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid WHERE i.inhparent = 'public.wa_message_log'::regclass ORDER BY 1;
-- SELECT menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id IN (307, 308, 309);
-- SELECT um_menu_id, count(*), count(*) FILTER (WHERE um_can_post) FROM public.user_menus WHERE um_menu_id IN (307, 308, 309) GROUP BY 1;
-- SELECT asd_key, asd_default_value FROM public.app_setting_def WHERE asd_key LIKE 'whatsapp.%' ORDER BY asd_sort_order;
-- SELECT emc_version, emc_row_count FROM fixed.error_message_catalogue;
-- SELECT * FROM public.v_db_table_master_drift;
