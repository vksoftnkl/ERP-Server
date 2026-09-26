-- ───────────────────────────────────────────────────────────────────────────
--  public.app_setting_def / public.app_setting_value
--
--  One catalog, one override table, and a resolver. Every configurable
--  behaviour in the product is a ROW in app_setting_def — adding a setting is
--  an INSERT, never a column, never a client release. app_setting_value holds
--  only what somebody actually changed; "reset to default" is a DELETE.
--
--  Five layers, shallowest first:
--
--      GLOBAL  <  COMPANY  <  BRANCH  <  DEVICE  <  USER
--
--  The deepest row that matches the caller's (company, branch, device, user)
--  wins; if nothing matches, asd_default_value applies. public.fn_app_settings
--  is the ONLY implementation of that precedence — the client and the server
--  both read it, so neither can drift from the other. Do not rebuild the merge
--  in TypeScript.
--
--  Prisma Migrate cannot express CHECK constraints, partial indexes,
--  NULLS NOT DISTINCT, index storage parameters, triggers or functions, so
--  this migration is hand-written (see prisma/public/appSettings.prisma for
--  the models plus documentation of everything that is DB-only). The two
--  CREATE TABLEs below are byte-for-byte what `prisma migrate diff` generates
--  for those models, with the DB-only constraints folded in.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
--  Catalog
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_setting_def
(
    asd_id             uuid          NOT NULL DEFAULT uuidv7(),

    -- Dotted, lowercase, module-prefixed: 'sales.allow_bill_over_order_qty'.
    -- A key is NEVER renamed — retire the row (asd_is_active = false) and add
    -- a new one, because overrides point here by key, not by id.
    asd_key            character varying(80)  NOT NULL,

    -- Draws the settings-screen tree: module → group → sort order.
    asd_module         character varying(30)  NOT NULL,
    asd_group          character varying(40)  NOT NULL DEFAULT 'General',

    -- ── Shape ────────────────────────────────────────────────────────────
    -- Values are stored as text for every type; the resolver casts on the way
    -- out and tr_asv_check_scope refuses anything that will not cast.
    asd_data_type      character varying(10)  NOT NULL,
    asd_default_value  text,
    -- JSON array of legal values for an enum-ish TEXT setting; NULL = free text.
    asd_allowed_values jsonb,
    asd_min_value      numeric(18, 6),
    asd_max_value      numeric(18, 6),

    -- How deep this setting may be overridden. A per-user override of a
    -- COMPANY-scoped setting is rejected by the trigger, not silently ignored.
    asd_max_scope      character varying(10)  NOT NULL DEFAULT 'COMPANY',

    -- ── How it reads on screen ───────────────────────────────────────────
    asd_label          character varying(120) NOT NULL,
    asd_description    text,
    asd_sort_order     smallint      NOT NULL DEFAULT 0,

    -- ── Lifecycle ────────────────────────────────────────────────────────
    asd_is_active      boolean       NOT NULL DEFAULT true,
    -- true = the client must re-login before the new value takes effect.
    asd_needs_relogin  boolean       NOT NULL DEFAULT false,

    -- ── Audit ────────────────────────────────────────────────────────────
    asd_is_deleted     boolean       NOT NULL DEFAULT false,
    asd_sync_date      timestamp(6) with time zone,
    asd_created_on     timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asd_created_by     character varying(50)  NOT NULL,
    asd_modified_on    timestamp(6) with time zone,
    asd_modified_by    character varying(50),

    CONSTRAINT app_setting_def_pkey PRIMARY KEY (asd_id),

    CONSTRAINT ck_asd_key CHECK (asd_key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),

    CONSTRAINT ck_asd_data_type CHECK (
        asd_data_type IN ('BOOL', 'INT', 'DECIMAL', 'TEXT', 'UUID', 'DATE', 'JSON')),

    CONSTRAINT ck_asd_max_scope CHECK (
        asd_max_scope IN ('GLOBAL', 'COMPANY', 'BRANCH', 'DEVICE', 'USER')),

    -- A range that cannot contain anything is a typo, not a policy.
    CONSTRAINT ck_asd_range CHECK (
        asd_min_value IS NULL OR asd_max_value IS NULL OR asd_min_value <= asd_max_value),

    -- asd_allowed_values is a list, or it is nothing.
    CONSTRAINT ck_asd_allowed_values CHECK (
        asd_allowed_values IS NULL OR jsonb_typeof(asd_allowed_values) = 'array')
);

-- Non-partial, so Prisma owns it (declared as @unique on the model).
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_setting_def_key
    ON public.app_setting_def USING btree (asd_key);

-- Partial → invisible to Prisma → declared here ONLY. This is the settings
-- screen's own read path: everything live, in tree order.
CREATE INDEX IF NOT EXISTS ix_asd_module
    ON public.app_setting_def USING btree
    (asd_module, asd_group, asd_sort_order)
    WITH (fillfactor = 100, deduplicate_items = True)
    WHERE asd_is_deleted = false AND asd_is_active = true;

COMMENT ON TABLE public.app_setting_def IS
    'Catalog of every configurable setting. One row per setting, forever; a new setting is an INSERT, and retiring one is asd_is_active = false (never a rename, never a DROP).';


-- ───────────────────────────────────────────────────────────────────────────
--  Overrides
--
--  Exactly one id column is populated, and it is the one asv_scope names —
--  a BRANCH row carries the branch and nothing else (branch ids are globally
--  unique, so the company would only be a second copy of the same fact that
--  could go stale). That is what makes ux_asv_scope_target "one row per
--  (setting, scope target)" and the resolver's per-layer lookup unambiguous.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_setting_value
(
    asv_id          uuid          NOT NULL DEFAULT uuidv7(),

    asv_setting_key character varying(80) NOT NULL,
    asv_scope       character varying(10) NOT NULL,

    asv_company_id  uuid,
    asv_branch_id   uuid,
    asv_device_id   uuid,
    asv_user_id     uuid,

    -- NULL = "explicitly nothing", which is NOT the same as having no row at
    -- all: no row means inherit the layer above, a NULL row means this layer
    -- deliberately blanks the setting and the resolver omits the key.
    asv_value       text,
    asv_remarks     character varying(250),

    -- ── Audit ────────────────────────────────────────────────────────────
    asv_is_deleted  boolean       NOT NULL DEFAULT false,
    asv_sync_date   timestamp(6) with time zone,
    asv_created_on  timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    asv_created_by  character varying(50) NOT NULL,
    asv_modified_on timestamp(6) with time zone,
    asv_modified_by character varying(50),

    CONSTRAINT app_setting_value_pkey PRIMARY KEY (asv_id),

    CONSTRAINT ck_asv_scope CHECK (
        asv_scope IN ('GLOBAL', 'COMPANY', 'BRANCH', 'DEVICE', 'USER')),

    -- The id columns must agree with asv_scope: the target, and only the target.
    CONSTRAINT ck_asv_scope_ids CHECK (
        CASE asv_scope
            WHEN 'GLOBAL'  THEN asv_company_id IS NULL
                            AND asv_branch_id  IS NULL
                            AND asv_device_id  IS NULL
                            AND asv_user_id    IS NULL
            WHEN 'COMPANY' THEN asv_company_id IS NOT NULL
                            AND asv_branch_id  IS NULL
                            AND asv_device_id  IS NULL
                            AND asv_user_id    IS NULL
            WHEN 'BRANCH'  THEN asv_branch_id  IS NOT NULL
                            AND asv_company_id IS NULL
                            AND asv_device_id  IS NULL
                            AND asv_user_id    IS NULL
            WHEN 'DEVICE'  THEN asv_device_id  IS NOT NULL
                            AND asv_company_id IS NULL
                            AND asv_branch_id  IS NULL
                            AND asv_user_id    IS NULL
            WHEN 'USER'    THEN asv_user_id    IS NOT NULL
                            AND asv_company_id IS NULL
                            AND asv_branch_id  IS NULL
                            AND asv_device_id  IS NULL
            ELSE false
        END)
);

-- RESTRICT: a catalog row that somebody has overridden is retired, never deleted.
ALTER TABLE public.app_setting_value
    ADD CONSTRAINT fk_asv_setting FOREIGN KEY (asv_setting_key)
    REFERENCES public.app_setting_def (asd_key) ON UPDATE CASCADE ON DELETE RESTRICT;

-- CASCADE everywhere else: a branch that is gone cannot keep outvoting its company.
ALTER TABLE public.app_setting_value
    ADD CONSTRAINT fk_asv_company FOREIGN KEY (asv_company_id)
    REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.app_setting_value
    ADD CONSTRAINT fk_asv_branch FOREIGN KEY (asv_branch_id)
    REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.app_setting_value
    ADD CONSTRAINT fk_asv_device FOREIGN KEY (asv_device_id)
    REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.app_setting_value
    ADD CONSTRAINT fk_asv_user FOREIGN KEY (asv_user_id)
    REFERENCES public.user_master (usr_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- One live override per (setting, scope target). NULLS NOT DISTINCT is the
-- whole point: without it every GLOBAL row would be unique against every other
-- GLOBAL row and the layer could hold ten conflicting answers. Partial AND
-- NULLS NOT DISTINCT — Prisma can express neither, so it lives here only.
CREATE UNIQUE INDEX IF NOT EXISTS ux_asv_scope_target
    ON public.app_setting_value USING btree
    (asv_setting_key, asv_company_id, asv_branch_id, asv_device_id, asv_user_id)
    NULLS NOT DISTINCT
    WITH (fillfactor = 100, deduplicate_items = True)
    WHERE asv_is_deleted = false;

-- "Show me everything this company has changed" — the settings screen's diff view.
CREATE INDEX IF NOT EXISTS ix_asv_company
    ON public.app_setting_value USING btree
    (asv_company_id, asv_setting_key)
    WITH (fillfactor = 100, deduplicate_items = True)
    WHERE asv_is_deleted = false;

COMMENT ON TABLE public.app_setting_value IS
    'Setting overrides, one row per (setting, scope target). A row exists only where somebody changed something; "reset to default" is a DELETE, never a write of the default value.';


-- ───────────────────────────────────────────────────────────────────────────
--  fn_asv_check_scope() / tr_asv_check_scope
--
--  What a CHECK cannot do, because it needs the catalog row: refuse an
--  override deeper than asd_max_scope, refuse a value that will not cast to
--  asd_data_type, and refuse one outside asd_allowed_values / min / max.
--  Enforcing this at write time is what lets the resolver cast blindly.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_asv_check_scope()
    RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_def      public.app_setting_def%ROWTYPE;
    v_rank     integer;
    v_max_rank integer;
    v_num      numeric;
BEGIN
    SELECT *
    INTO v_def
    FROM public.app_setting_def
    WHERE asd_key = NEW.asv_setting_key
      AND asd_is_deleted = false;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'app_setting_value: unknown setting key "%"', NEW.asv_setting_key
            USING ERRCODE = '23514';
    END IF;

    IF v_def.asd_is_active = false THEN
        RAISE EXCEPTION 'app_setting_value: setting "%" is retired and can no longer be overridden',
            NEW.asv_setting_key USING ERRCODE = '23514';
    END IF;

    -- ── Depth ────────────────────────────────────────────────────────────
    v_rank := CASE NEW.asv_scope
                  WHEN 'GLOBAL' THEN 1 WHEN 'COMPANY' THEN 2 WHEN 'BRANCH' THEN 3
                  WHEN 'DEVICE' THEN 4 WHEN 'USER' THEN 5 END;
    v_max_rank := CASE v_def.asd_max_scope
                      WHEN 'GLOBAL' THEN 1 WHEN 'COMPANY' THEN 2 WHEN 'BRANCH' THEN 3
                      WHEN 'DEVICE' THEN 4 WHEN 'USER' THEN 5 END;

    IF v_rank > v_max_rank THEN
        RAISE EXCEPTION 'app_setting_value: setting "%" may not be overridden below % scope (got %)',
            NEW.asv_setting_key, v_def.asd_max_scope, NEW.asv_scope USING ERRCODE = '23514';
    END IF;

    -- ── Value ────────────────────────────────────────────────────────────
    -- NULL is always legal: it is the deliberate blank, not a missing value.
    IF NEW.asv_value IS NOT NULL THEN
        BEGIN
            CASE v_def.asd_data_type
                WHEN 'BOOL'    THEN PERFORM NEW.asv_value::boolean;
                WHEN 'INT'     THEN PERFORM NEW.asv_value::bigint;
                WHEN 'DECIMAL' THEN PERFORM NEW.asv_value::numeric;
                WHEN 'UUID'    THEN PERFORM NEW.asv_value::uuid;
                WHEN 'DATE'    THEN PERFORM NEW.asv_value::date;
                WHEN 'JSON'    THEN PERFORM NEW.asv_value::jsonb;
                ELSE           NULL;   -- TEXT takes anything
            END CASE;
        EXCEPTION
            WHEN others THEN
                RAISE EXCEPTION 'app_setting_value: "%" is not a valid % for setting "%"',
                    NEW.asv_value, v_def.asd_data_type, NEW.asv_setting_key
                    USING ERRCODE = '23514';
        END;

        IF v_def.asd_allowed_values IS NOT NULL
            AND NOT (v_def.asd_allowed_values @> to_jsonb(NEW.asv_value)) THEN
            RAISE EXCEPTION 'app_setting_value: "%" is not one of the allowed values % for setting "%"',
                NEW.asv_value, v_def.asd_allowed_values::text, NEW.asv_setting_key
                USING ERRCODE = '23514';
        END IF;

        IF v_def.asd_data_type IN ('INT', 'DECIMAL')
            AND (v_def.asd_min_value IS NOT NULL OR v_def.asd_max_value IS NOT NULL) THEN
            v_num := NEW.asv_value::numeric;

            IF v_def.asd_min_value IS NOT NULL AND v_num < v_def.asd_min_value THEN
                RAISE EXCEPTION 'app_setting_value: % is below the minimum % for setting "%"',
                    v_num, v_def.asd_min_value, NEW.asv_setting_key USING ERRCODE = '23514';
            END IF;

            IF v_def.asd_max_value IS NOT NULL AND v_num > v_def.asd_max_value THEN
                RAISE EXCEPTION 'app_setting_value: % is above the maximum % for setting "%"',
                    v_num, v_def.asd_max_value, NEW.asv_setting_key USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_asv_check_scope() IS
    'BEFORE INSERT/UPDATE guard on app_setting_value: the override may not be deeper than the catalog''s asd_max_scope, and asv_value must cast to asd_data_type and sit inside asd_allowed_values / asd_min_value / asd_max_value.';

DROP TRIGGER IF EXISTS tr_asv_check_scope ON public.app_setting_value;

CREATE TRIGGER tr_asv_check_scope
    BEFORE INSERT OR UPDATE OF asv_setting_key, asv_scope, asv_value
    ON public.app_setting_value
    FOR EACH ROW
EXECUTE FUNCTION public.fn_asv_check_scope();


-- ───────────────────────────────────────────────────────────────────────────
--  fn_app_settings(company, branch, device, user) → jsonb
--
--  The whole resolved settings object for one caller, keyed by asd_key and
--  cast to the JSON type asd_data_type implies (BOOL → true, INT → 7,
--  DECIMAL → 12.5, JSON → the object itself, everything else → a string).
--
--  The deepest matching override wins. A key whose effective value is NULL —
--  no default and no override, or an override that deliberately blanks it —
--  is omitted entirely, so the client can treat "absent" as "unset" without
--  distinguishing two flavours of nothing.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_app_settings(
    p_company_id uuid DEFAULT NULL,
    p_branch_id  uuid DEFAULT NULL,
    p_device_id  uuid DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL)
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
AS
$$
WITH live AS (SELECT asd_key, asd_data_type, asd_default_value
              FROM public.app_setting_def
              WHERE asd_is_deleted = false
                AND asd_is_active = true),
     winner AS (SELECT DISTINCT ON (v.asv_setting_key)
                    v.asv_setting_key AS asd_key,
                    v.asv_value
                FROM public.app_setting_value v
                JOIN live l ON l.asd_key = v.asv_setting_key
                WHERE v.asv_is_deleted = false
                  AND (v.asv_scope = 'GLOBAL'
                    OR (v.asv_scope = 'COMPANY' AND v.asv_company_id = p_company_id)
                    OR (v.asv_scope = 'BRANCH' AND v.asv_branch_id = p_branch_id)
                    OR (v.asv_scope = 'DEVICE' AND v.asv_device_id = p_device_id)
                    OR (v.asv_scope = 'USER' AND v.asv_user_id = p_user_id))
                ORDER BY v.asv_setting_key,
                         CASE v.asv_scope
                             WHEN 'GLOBAL' THEN 1 WHEN 'COMPANY' THEN 2 WHEN 'BRANCH' THEN 3
                             WHEN 'DEVICE' THEN 4 WHEN 'USER' THEN 5 END DESC),
     resolved AS (SELECT l.asd_key,
                         l.asd_data_type,
                         CASE WHEN w.asd_key IS NOT NULL
                                  THEN w.asv_value        -- an override row exists, NULL included
                              ELSE l.asd_default_value END AS val
                  FROM live l
                           LEFT JOIN winner w ON w.asd_key = l.asd_key)
SELECT COALESCE(
               jsonb_object_agg(
                       asd_key,
                       CASE asd_data_type
                           WHEN 'BOOL' THEN to_jsonb(val::boolean)
                           WHEN 'INT' THEN to_jsonb(val::bigint)
                           WHEN 'DECIMAL' THEN to_jsonb(val::numeric)
                           WHEN 'JSON' THEN val::jsonb
                           ELSE to_jsonb(val) END),   -- TEXT | UUID | DATE stay strings
               '{}'::jsonb)
FROM resolved
WHERE val IS NOT NULL;
$$;

COMMENT ON FUNCTION public.fn_app_settings(uuid, uuid, uuid, uuid) IS
    'The resolved settings object for one caller as jsonb, GLOBAL < COMPANY < BRANCH < DEVICE < USER, values cast per asd_data_type and NULL-valued keys omitted. Single source of precedence — do not reimplement the merge in application code.';


-- ───────────────────────────────────────────────────────────────────────────
--  fn_app_setting(key, company, branch, device, user) → text
--
--  One key, same precedence, raw text (cast at the call site: it is the server
--  rule that knows whether it wanted a boolean or a numeric). NULL means the
--  setting resolves to nothing — or does not exist, which for a caller
--  checking a rule is the same answer.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_app_setting(
    p_key        character varying,
    p_company_id uuid DEFAULT NULL,
    p_branch_id  uuid DEFAULT NULL,
    p_device_id  uuid DEFAULT NULL,
    p_user_id    uuid DEFAULT NULL)
    RETURNS text
    LANGUAGE sql
    STABLE
    PARALLEL SAFE
AS
$$
SELECT COALESCE(
               (SELECT v.asv_value
                FROM public.app_setting_value v
                WHERE v.asv_setting_key = p_key
                  AND v.asv_is_deleted = false
                  AND (v.asv_scope = 'GLOBAL'
                    OR (v.asv_scope = 'COMPANY' AND v.asv_company_id = p_company_id)
                    OR (v.asv_scope = 'BRANCH' AND v.asv_branch_id = p_branch_id)
                    OR (v.asv_scope = 'DEVICE' AND v.asv_device_id = p_device_id)
                    OR (v.asv_scope = 'USER' AND v.asv_user_id = p_user_id))
                ORDER BY CASE v.asv_scope
                             WHEN 'GLOBAL' THEN 1 WHEN 'COMPANY' THEN 2 WHEN 'BRANCH' THEN 3
                             WHEN 'DEVICE' THEN 4 WHEN 'USER' THEN 5 END DESC
                LIMIT 1),
               (SELECT d.asd_default_value
                FROM public.app_setting_def d
                WHERE d.asd_key = p_key
                  AND d.asd_is_deleted = false
                  AND d.asd_is_active = true));
$$;

COMMENT ON FUNCTION public.fn_app_setting(character varying, uuid, uuid, uuid, uuid) IS
    'One setting resolved for one caller, as raw text. Same precedence as fn_app_settings; cast at the call site.';


-- ───────────────────────────────────────────────────────────────────────────
--  Catalog seed
--
--  The starting set. Idempotent (ON CONFLICT on asd_key), so replaying this
--  migration on a shadow database or re-running it after keys have been added
--  by hand changes nothing. Later settings are plain INSERTs into
--  app_setting_def — they do not need a migration at all.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def (asd_key, asd_module, asd_group, asd_data_type,
                                    asd_default_value, asd_allowed_values,
                                    asd_min_value, asd_max_value, asd_max_scope,
                                    asd_label, asd_description, asd_sort_order,
                                    asd_needs_relogin, asd_created_by)
VALUES
    -- ── Sales ────────────────────────────────────────────────────────────
    ('sales.allow_rate_edit', 'sales', 'Billing', 'BOOL', 'true', NULL, NULL, NULL, 'USER',
     'Allow rate edit on the bill', 'Operator may type over the rate the price level supplied.', 10, false, 'SYSTEM'),
    ('sales.max_discount_percent', 'sales', 'Billing', 'DECIMAL', '10', NULL, 0, 100, 'USER',
     'Maximum discount %', 'Highest discount an operator may give on a line without an override.', 20, false, 'SYSTEM'),
    ('sales.allow_bill_over_order_qty', 'sales', 'Billing', 'BOOL', 'false', NULL, NULL, NULL, 'BRANCH',
     'Allow billing more than ordered', 'Permit a bill line to exceed the quantity on the order it was raised from.', 30, false, 'SYSTEM'),
    ('sales.allow_negative_stock', 'sales', 'Billing', 'BOOL', 'false', NULL, NULL, NULL, 'BRANCH',
     'Allow negative stock', 'Permit a sale that takes an item below zero on hand.', 40, false, 'SYSTEM'),
    ('sales.round_off_bill_total', 'sales', 'Billing', 'BOOL', 'true', NULL, NULL, NULL, 'COMPANY',
     'Round off bill total', 'Round the net payable to the nearest rupee and post the difference to round-off.', 50, false, 'SYSTEM'),
    ('sales.quotation_validity_days', 'sales', 'Quotation', 'INT', '15', NULL, 1, 365, 'COMPANY',
     'Quotation validity (days)', 'Default validity stamped on a new quotation.', 60, false, 'SYSTEM'),
    ('sales.hold_expiry_minutes', 'sales', 'Counter', 'INT', '240', NULL, 5, 1440, 'DEVICE',
     'Hold expiry (minutes)', 'How long a parked bill stays in the hold list before it is swept.', 70, false, 'SYSTEM'),

    -- ── Accounts ─────────────────────────────────────────────────────────
    ('accounts.credit_limit_check', 'accounts', 'Credit Control', 'TEXT', 'WARN',
     '["OFF", "WARN", "BLOCK"]'::jsonb, NULL, NULL, 'BRANCH',
     'Credit limit check', 'What happens when a party is over its credit limit or ageing days.', 10, false, 'SYSTEM'),
    ('accounts.allow_backdated_entry', 'accounts', 'Vouchers', 'BOOL', 'false', NULL, NULL, NULL, 'COMPANY',
     'Allow back-dated entry', 'Permit saving a voucher dated before today.', 20, false, 'SYSTEM'),
    ('accounts.backdated_entry_days', 'accounts', 'Vouchers', 'INT', '0', NULL, 0, 365, 'COMPANY',
     'Back-dated entry window (days)', 'How far back a voucher may be dated when back-dated entry is allowed.', 30, false, 'SYSTEM'),

    -- ── Inventory ────────────────────────────────────────────────────────
    ('inventory.enforce_batch_on_issue', 'inventory', 'Batches', 'BOOL', 'true', NULL, NULL, NULL, 'BRANCH',
     'Batch required on issue', 'A batch-tracked item cannot leave stock without naming its batch.', 10, false, 'SYSTEM'),
    ('inventory.batch_expiry_alert_days', 'inventory', 'Batches', 'INT', '30', NULL, 0, 365, 'COMPANY',
     'Expiry alert (days)', 'Warn this many days before a batch expires.', 20, false, 'SYSTEM'),

    -- ── Print ────────────────────────────────────────────────────────────
    ('print.print_after_save', 'print', 'Output', 'BOOL', 'true', NULL, NULL, NULL, 'DEVICE',
     'Print after save', 'Send the document to the printer as soon as it is saved.', 10, false, 'SYSTEM'),
    ('print.bill_copies', 'print', 'Output', 'INT', '1', NULL, 1, 5, 'DEVICE',
     'Bill copies', 'Number of copies printed per bill.', 20, false, 'SYSTEM'),
    ('print.default_printer', 'print', 'Output', 'TEXT', NULL, NULL, NULL, NULL, 'DEVICE',
     'Default printer', 'Printer name as the workstation knows it. Blank = the OS default.', 30, false, 'SYSTEM'),

    -- ── System ───────────────────────────────────────────────────────────
    ('system.date_format', 'system', 'Display', 'TEXT', 'dd-MM-yyyy',
     '["dd-MM-yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "MM/dd/yyyy"]'::jsonb, NULL, NULL, 'USER',
     'Date format', 'How dates are shown and typed throughout the client.', 10, false, 'SYSTEM'),
    ('system.decimal_places_qty', 'system', 'Display', 'INT', '2', NULL, 0, 4, 'COMPANY',
     'Decimals — quantity', 'Decimal places shown for quantities.', 20, false, 'SYSTEM'),
    ('system.decimal_places_rate', 'system', 'Display', 'INT', '2', NULL, 0, 4, 'COMPANY',
     'Decimals — rate', 'Decimal places shown for rates and amounts.', 30, false, 'SYSTEM'),
    ('system.session_idle_timeout_min', 'system', 'Security', 'INT', '30', NULL, 5, 480, 'USER',
     'Idle timeout (minutes)', 'Log the operator out after this much inactivity.', 40, true, 'SYSTEM'),
    ('system.enable_audit_trail', 'system', 'Security', 'BOOL', 'true', NULL, NULL, NULL, 'GLOBAL',
     'Enable audit trail', 'Record every change in the audit schema. Installation-wide.', 50, true, 'SYSTEM')
ON CONFLICT (asd_key) DO NOTHING;
