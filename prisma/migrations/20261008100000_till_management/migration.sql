-- ═══════════════════════════════════════════════════════════════════════════
--  47 · TILL MANAGEMENT — counters, cashier sessions, counts, cash movements,
--       variances, approvals, the safe and the business day      2026-10-08
--
--  The 47_till_management.sql file of the share, made a migration so the live
--  box gets it through deploy.sh (which runs migrations and never seeds), the
--  way 20261002150000 shipped 46_gst_menus.sql.
--
--  Design: till/TILL_DESIGN.md (this file is its §6). 3.0 HAD
--  public.pos_sess_logs / pos_sess_pays / pos_sess_discr / pos_sess_denom +
--  app_utils.fx_pos_session / fx_pos_payments. NOTHING IS CARRIED.
--
--  HOUSE RULES THIS FILE KEEPS
--   * NO new function, NO trigger, NO view. All logic lives in NestJS
--     (TillSessionService, TillLedgerService, TillApprovalService …). The DB
--     keeps CHECKs, GENERATED columns, FKs and indexes only. (Two EXISTING
--     functions are restated below — see the differences.)
--   * Schema `accounts`, not a new one.
--   * Transaction tables are LIST-partitioned by acc_year, PK (id, acc_year).
--     Masters are not partitioned.
--   * Amounts are numeric(15,2), POSITIVE; direction is a column (kind /
--     dr_cr), never a sign. 3.0 stored a cash-out as a negative amount.
--   * company_id NULL on a master = shared by every company (on purpose).
--   * OFFLINE (sales/offline-sync-invariants.md): every row has exactly ONE
--     writing site. The store server writes counters' sessions, counts,
--     movements, approvals and events; the cloud (HO) writes only
--     till_session_review. No CHECK or unique index spans rows that two
--     sites could write — "one open session per OPERATOR" is a service rule
--     plus a reconciliation query, NOT an index (an operator could be signed
--     in at two offline sites). "One open session per COUNTER" IS an index:
--     a counter belongs to one site.
--   * GENERATED columns (tbd_cash_variance, tss_*_variance, tvr_variance,
--     tcl_amount) must be left out of any sync push column list. The Prisma
--     models mark them @default(dbgenerated()); never write them.
--
--  DIFFERENCES FROM THE SHARE FILE
--   1. No BEGIN / COMMIT: Prisma runs the migration in its own transaction.
--   2. §10.1 — the four new ledger roles are also added to
--      accounts.fn_ledger_map_catalogue(), restated in full. Without that,
--      fn_seed_ledger_map() refuses every boot ("These active roles are not in
--      accounts.fn_ledger_map_catalogue()") — the slip 20260922060000 and
--      20260926163000 each had to repair. Their homes:
--        SAFE_CASH          Store Safe Cash         CASH     Cash-in-Hand
--        CASH_IN_TRANSIT    Cash in Transit         CASH     Cash-in-Hand
--        CASH_SHORT_EXCESS  Cash Short & Excess     EXPENSE  Indirect Expenses
--        TENDER_SUSPENSE    Till Variance Suspense  GENERAL  Current Assets
--      CASH_IN_TRANSIT sits under Cash-in-Hand so a CRem stays a valid Tally
--      Contra (both sides cash / bank). TENDER_SUSPENSE is NOT under
--      'Suspense A/c': that group's nature is Liabilities here, and the role
--      wants Assets — §2.5 of the seed would refuse the pair.
--      The map is then seeded (p_skip_if_no_chart = true, as 20260929090000).
--   3. §10.2 — the voucher-type serial is kept ahead of any pinned id a seed
--      may carry (as 20260929090000 does).
--   4. §11 — the year roll. The share file trusts
--      public.fn_create_year_partitions; that function exists on this dev box
--      but was never in the migration history (20260922040000's correction),
--      so a database built from migrations — the VPS — does not have it. The
--      helper deploy.sh and the application call is
--      public.ensure_acc_year_partitions, so it is restated here (from the live
--      definition, which matches 20260922100000) with the nine till tables
--      added, parent before child. Partitions are made for 2026-2027 and every
--      year in public.fiscal_years or already partitioned on sales.sale_bill.
--   5. prisma/seed/Acc_Tender_Types.sql carries ttm_close_mode / ttm_handover:
--      on a fresh database the tender types are seeded AFTER migrations, so
--      §1.8's UPDATE finds nothing and the seed alone sets them.
--
--  PostgreSQL 18 (uuidv7(), NULLS NOT DISTINCT).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  §1  MASTERS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1.1 the safe / cash office — where drawer cash goes ───────────────────
CREATE TABLE IF NOT EXISTS accounts.till_safe
(
    tsf_id                uuid          NOT NULL DEFAULT uuidv7(),
    tsf_company_id        uuid          NOT NULL,
    tsf_branch_id         uuid          NOT NULL,
    tsf_code              character varying(20)  NOT NULL,
    tsf_name              character varying(100) NOT NULL,
    tsf_ledger_id         uuid          NOT NULL,        -- the SAFE_CASH ledger this safe posts to
    tsf_insured_limit     numeric(15,2) NOT NULL DEFAULT 0,  -- 0 = none; above it the day close asks for a remittance
    tsf_is_default        boolean       NOT NULL DEFAULT false,
    tsf_remarks           character varying(250),
    tsf_is_active         boolean       NOT NULL DEFAULT true,
    tsf_is_deleted        boolean       NOT NULL DEFAULT false,
    tsf_sync_date         timestamptz,
    tsf_created_on        timestamptz   NOT NULL DEFAULT now(),
    tsf_created_by        character varying(50),
    tsf_modified_on       timestamptz,
    tsf_modified_by       character varying(50),
    CONSTRAINT pk_till_safe PRIMARY KEY (tsf_id),
    CONSTRAINT fk_tsf_ledger FOREIGN KEY (tsf_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tsf_limit CHECK (tsf_insured_limit >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tsf_code
    ON accounts.till_safe (tsf_company_id, tsf_branch_id, upper(tsf_code)) WHERE tsf_is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tsf_default
    ON accounts.till_safe (tsf_company_id, tsf_branch_id) WHERE tsf_is_deleted = false AND tsf_is_default;

-- ── 1.2 the counter — a physical lane with (usually) one cash drawer ──────
--  The accountability unit is the DRAWER. A device is the PC/tablet bolted to
--  it; replacing a dead PC re-points tcn_device_id and history stays on the
--  counter.
CREATE TABLE IF NOT EXISTS accounts.till_counter
(
    tcn_id                uuid          NOT NULL DEFAULT uuidv7(),
    tcn_company_id        uuid          NOT NULL,
    tcn_branch_id         uuid          NOT NULL,
    tcn_code              character varying(20)  NOT NULL,      -- C01, EXP1, RET
    tcn_name              character varying(100) NOT NULL,
    tcn_kind              character varying(20)  NOT NULL DEFAULT 'POS',
    tcn_drawer_mode       character varying(10)  NOT NULL DEFAULT 'DRAWER',
    tcn_device_id         uuid,                                  -- fixed.device_master (Desktop/Mobile only, never Web); NULL = any device may claim it
    tcn_safe_id           uuid,                                  -- where its drops go; NULL = the branch default safe
    tcn_default_float     numeric(15,2) NOT NULL DEFAULT 0,
    tcn_cash_alert_limit  numeric(15,2) NOT NULL DEFAULT 0,      -- 0 = off; above it: "pickup due"
    tcn_cash_block_limit  numeric(15,2) NOT NULL DEFAULT 0,      -- 0 = off; above it billing stops until a pickup
    tcn_z_last_no         integer       NOT NULL DEFAULT 0,      -- running Z number, never reset (written by the session close)
    tcn_requires_session  boolean       NOT NULL DEFAULT true,
    tcn_sort_order        integer       NOT NULL DEFAULT 0,
    tcn_remarks           character varying(250),
    tcn_is_active         boolean       NOT NULL DEFAULT true,
    tcn_is_deleted        boolean       NOT NULL DEFAULT false,
    tcn_sync_date         timestamptz,
    tcn_created_on        timestamptz   NOT NULL DEFAULT now(),
    tcn_created_by        character varying(50),
    tcn_modified_on       timestamptz,
    tcn_modified_by       character varying(50),
    CONSTRAINT pk_till_counter PRIMARY KEY (tcn_id),
    CONSTRAINT fk_tcn_device FOREIGN KEY (tcn_device_id)
        REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_tcn_safe FOREIGN KEY (tcn_safe_id)
        REFERENCES accounts.till_safe (tsf_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tcn_kind CHECK (tcn_kind::text = ANY (ARRAY[
        'POS','EXPRESS','RETURNS_DESK','SERVICE_DESK','CASH_OFFICE','MOBILE','SELF_CHECKOUT'])),
    -- TRAY = removable cash insert that travels with the cashier;
    -- NONE  = cashless lane (card/UPI only): a session is still opened, nothing is counted in DENOM mode
    CONSTRAINT ck_tcn_drawer CHECK (tcn_drawer_mode::text = ANY (ARRAY['DRAWER','TRAY','NONE'])),
    CONSTRAINT ck_tcn_amounts CHECK (tcn_default_float >= 0 AND tcn_cash_alert_limit >= 0
        AND tcn_cash_block_limit >= 0 AND tcn_z_last_no >= 0
        AND (tcn_cash_block_limit = 0 OR tcn_cash_alert_limit = 0 OR tcn_cash_block_limit >= tcn_cash_alert_limit))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tcn_code
    ON accounts.till_counter (tcn_company_id, tcn_branch_id, upper(tcn_code)) WHERE tcn_is_deleted = false;
-- one device drives one counter at a time
CREATE UNIQUE INDEX IF NOT EXISTS ux_tcn_device
    ON accounts.till_counter (tcn_device_id) WHERE tcn_is_deleted = false AND tcn_device_id IS NOT NULL;

-- ── 1.3 NO till operator table — the till reads the user and the employee ─
--  (decided 2026-10-07; till/plan-till-operator-to-user.md). Every fact a
--  till needs about a person already has a home:
--    PIN ............ public.user_master.usr_pin_hash (set via the user API)
--    employee ....... public.user_master.usr_employee_id
--    shortage RECOVER  public.employee_master.emp_loan_ledger_id — the staff
--                      advance ledger the employee save creates (notes 95)
--    may open a till  a user_menus right on the Open Till menu
--    approver level . accounts.till_approval_authority (§1.7)
--    float .......... the counter's default (till_counter); a different
--                      float at open is a FLOAT_MISMATCH approval
--  The DROP only clears a draft of this file that created the table.
DROP TABLE IF EXISTS accounts.till_operator;

-- ── 1.4 controlled reasons (3.0 hard-coded six strings in the client) ─────
CREATE TABLE IF NOT EXISTS accounts.till_reason
(
    trs_id                uuid          NOT NULL DEFAULT uuidv7(),
    trs_company_id        uuid,                                  -- NULL = shipped / shared
    trs_category          character varying(20)  NOT NULL,
    trs_code              character varying(30)  NOT NULL,
    trs_name              character varying(100) NOT NULL,
    trs_ledger_id         uuid,                                  -- PAID_OUT/PAID_IN: default ledger
    trs_needs_note        boolean       NOT NULL DEFAULT false,
    trs_needs_ref         boolean       NOT NULL DEFAULT false,  -- PAID_OUT: the supplier bill / voucher no
    trs_max_amount        numeric(15,2) NOT NULL DEFAULT 0,      -- 0 = no cap of its own (the approval rule still applies)
    trs_sort_order        integer       NOT NULL DEFAULT 0,
    trs_is_active         boolean       NOT NULL DEFAULT true,
    trs_is_deleted        boolean       NOT NULL DEFAULT false,
    trs_sync_date         timestamptz,
    trs_created_on        timestamptz   NOT NULL DEFAULT now(),
    trs_created_by        character varying(50),
    trs_modified_on       timestamptz,
    trs_modified_by       character varying(50),
    CONSTRAINT pk_till_reason PRIMARY KEY (trs_id),
    CONSTRAINT fk_trs_ledger FOREIGN KEY (trs_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_trs_category CHECK (trs_category::text = ANY (ARRAY[
        'VARIANCE','FLOAT_MISMATCH','PAID_OUT','PAID_IN','PICKUP','NO_SALE','SUSPEND',
        'FORCE_CLOSE','REOPEN','SESSION_VOID','MOVEMENT_VOID','DAY_REOPEN','REPRINT',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','REFUND'])),
    CONSTRAINT ck_trs_amount CHECK (trs_max_amount >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_trs_code
    ON accounts.till_reason (trs_company_id, trs_category, upper(trs_code)) NULLS NOT DISTINCT
    WHERE trs_is_deleted = false;

-- ── 1.5 denominations (3.0 hard-coded them in the .ui) ────────────────────
CREATE TABLE IF NOT EXISTS accounts.till_denomination
(
    tdn_id                uuid          NOT NULL DEFAULT uuidv7(),
    tdn_company_id        uuid,                                  -- NULL = shared
    tdn_currency          character(3)  NOT NULL DEFAULT 'INR',
    tdn_value             numeric(12,2) NOT NULL,
    tdn_kind              character varying(5)   NOT NULL,       -- NOTE | COIN
    tdn_label             character varying(20)  NOT NULL,
    tdn_bundle_qty        integer       NOT NULL DEFAULT 0,      -- notes per strapped bundle (100); 0 = not bundled
    tdn_sort_order        integer       NOT NULL DEFAULT 0,
    tdn_valid_to          date,                                  -- withdrawn notes stop being offered after this
    tdn_is_active         boolean       NOT NULL DEFAULT true,
    tdn_is_deleted        boolean       NOT NULL DEFAULT false,
    tdn_sync_date         timestamptz,
    tdn_created_on        timestamptz   NOT NULL DEFAULT now(),
    tdn_created_by        character varying(50),
    tdn_modified_on       timestamptz,
    tdn_modified_by       character varying(50),
    CONSTRAINT pk_till_denomination PRIMARY KEY (tdn_id),
    CONSTRAINT ck_tdn_kind CHECK (tdn_kind::text = ANY (ARRAY['NOTE','COIN'])),
    CONSTRAINT ck_tdn_value CHECK (tdn_value > 0 AND tdn_bundle_qty >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tdn_value
    ON accounts.till_denomination (tdn_company_id, tdn_currency, tdn_value, tdn_kind) NULLS NOT DISTINCT
    WHERE tdn_is_deleted = false;

-- ── 1.6 approval RULES — when does an event need a second person ──────────
--  Resolution (TillApprovalService.ruleFor, same shape as StatutoryService):
--  branch row > company row > shipped row (both NULL), then latest
--  tar_effective_from <= business date. LIMIT 1. One rule per event per scope.
CREATE TABLE IF NOT EXISTS accounts.till_approval_rule
(
    tar_id                uuid          NOT NULL DEFAULT uuidv7(),
    tar_company_id        uuid,
    tar_branch_id         uuid,
    tar_event_code        character varying(30)  NOT NULL,
    tar_mode              character varying(12)  NOT NULL,       -- NEVER | ALWAYS | OVER_AMOUNT | OVER_COUNT | OVER_PERCENT
    tar_threshold_amount  numeric(15,2) NOT NULL DEFAULT 0,
    tar_threshold_count   integer       NOT NULL DEFAULT 0,      -- per session
    tar_threshold_percent numeric(7,3)  NOT NULL DEFAULT 0,
    tar_channel           character varying(12)  NOT NULL DEFAULT 'EITHER',  -- COUNTER | REMOTE | EITHER
    tar_min_role          character varying(20)  NOT NULL DEFAULT 'SUPERVISOR',
    tar_two_person        boolean       NOT NULL DEFAULT false,  -- needs two distinct approvers
    tar_allow_self        boolean       NOT NULL DEFAULT false,  -- requester may approve own request
    tar_blocks_till       boolean       NOT NULL DEFAULT true,   -- the counter waits (false = record now, review later)
    tar_expire_minutes    integer       NOT NULL DEFAULT 0,      -- 0 = a PENDING request never expires
    tar_effective_from    date          NOT NULL DEFAULT DATE '2000-01-01',
    tar_remarks           character varying(250),
    tar_is_active         boolean       NOT NULL DEFAULT true,
    tar_is_deleted        boolean       NOT NULL DEFAULT false,
    tar_sync_date         timestamptz,
    tar_created_on        timestamptz   NOT NULL DEFAULT now(),
    tar_created_by        character varying(50),
    tar_modified_on       timestamptz,
    tar_modified_by       character varying(50),
    CONSTRAINT pk_till_approval_rule PRIMARY KEY (tar_id),
    CONSTRAINT ck_tar_event CHECK (tar_event_code::text = ANY (ARRAY[
        -- till
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','PAID_OUT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        -- reserved for the void / counter-control module (SIX_TXN_CONTROLS §7) — same table, same gate
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK'])),
    CONSTRAINT ck_tar_mode CHECK (tar_mode::text = ANY (ARRAY['NEVER','ALWAYS','OVER_AMOUNT','OVER_COUNT','OVER_PERCENT'])),
    CONSTRAINT ck_tar_channel CHECK (tar_channel::text = ANY (ARRAY['COUNTER','REMOTE','EITHER'])),
    CONSTRAINT ck_tar_role CHECK (tar_min_role::text = ANY (ARRAY[
        'SUPERVISOR','STORE_MANAGER','CASH_OFFICE','AREA_MANAGER','HO_FINANCE'])),
    CONSTRAINT ck_tar_thresholds CHECK (tar_threshold_amount >= 0 AND tar_threshold_count >= 0
        AND tar_threshold_percent >= 0 AND tar_expire_minutes >= 0),
    CONSTRAINT ck_tar_scope CHECK (tar_branch_id IS NULL OR tar_company_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tar_scope
    ON accounts.till_approval_rule (tar_company_id, tar_branch_id, tar_event_code, tar_effective_from) NULLS NOT DISTINCT
    WHERE tar_is_deleted = false;

-- ── 1.7 approval AUTHORITY — who may approve what, up to how much ─────────
--  Branch NULL = every branch of the company (area manager / HO).
--  Company NULL = every company (group finance).
CREATE TABLE IF NOT EXISTS accounts.till_approval_authority
(
    taa_id                uuid          NOT NULL DEFAULT uuidv7(),
    taa_user_id           uuid          NOT NULL,
    taa_company_id        uuid,
    taa_branch_id         uuid,
    taa_role              character varying(20)  NOT NULL,       -- the level this grant confers
    taa_event_code        character varying(30),                 -- NULL = every event
    taa_max_amount        numeric(15,2),                         -- NULL = no ceiling
    taa_can_remote        boolean       NOT NULL DEFAULT false,  -- may approve from outside the counter (inbox / mobile)
    taa_valid_from        date          NOT NULL DEFAULT CURRENT_DATE,
    taa_valid_to          date,
    taa_remarks           character varying(250),
    taa_is_active         boolean       NOT NULL DEFAULT true,
    taa_is_deleted        boolean       NOT NULL DEFAULT false,
    taa_sync_date         timestamptz,
    taa_created_on        timestamptz   NOT NULL DEFAULT now(),
    taa_created_by        character varying(50),
    taa_modified_on       timestamptz,
    taa_modified_by       character varying(50),
    CONSTRAINT pk_till_approval_authority PRIMARY KEY (taa_id),
    CONSTRAINT ck_taa_role CHECK (taa_role::text = ANY (ARRAY[
        'SUPERVISOR','STORE_MANAGER','CASH_OFFICE','AREA_MANAGER','HO_FINANCE'])),
    CONSTRAINT ck_taa_amount CHECK (taa_max_amount IS NULL OR taa_max_amount >= 0),
    CONSTRAINT ck_taa_dates CHECK (taa_valid_to IS NULL OR taa_valid_to >= taa_valid_from),
    CONSTRAINT ck_taa_scope CHECK (taa_branch_id IS NULL OR taa_company_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_taa_lookup
    ON accounts.till_approval_authority (taa_user_id, taa_company_id, taa_branch_id)
    WHERE taa_is_deleted = false AND taa_is_active;

-- ── 1.8 how each tender type is closed — a column on the existing table ───
--  DENOM     cash: counted by denomination
--  SLIPS     card / cheque / gift voucher: slips counted + amount + batch ref
--  STATEMENT UPI / wallet / bank: nothing to count at the till; reconciled
--            against the provider statement later (td_settle_* already exist)
--  NONE      credit / temp credit / loyalty / RRN: not money in the drawer
ALTER TABLE accounts.acc_tender_types
    ADD COLUMN IF NOT EXISTS ttm_close_mode character varying(10) NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS ttm_handover   boolean NOT NULL DEFAULT false;  -- the instrument physically goes to the safe
DO $$ BEGIN
    ALTER TABLE accounts.acc_tender_types ADD CONSTRAINT ck_ttm_close_mode
        CHECK (ttm_close_mode::text = ANY (ARRAY['DENOM','SLIPS','STATEMENT','NONE']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- On a fresh database the tender types are a seed that has not run yet, so
-- this finds nothing; prisma/seed/Acc_Tender_Types.sql carries the same values.
UPDATE accounts.acc_tender_types SET ttm_close_mode = v.m, ttm_handover = v.h
FROM (VALUES ('CASH','DENOM',true), ('CARD','SLIPS',false), ('UPI','STATEMENT',false),
             ('WALLET','STATEMENT',false), ('CHEQUE','SLIPS',true), ('BANK','STATEMENT',false),
             ('RRN','NONE',false), ('TEMP_CR','NONE',false), ('CREDIT','NONE',false),
             ('LOYALTY','NONE',false), ('VOUCHER','SLIPS',true)) AS v(t, m, h)
WHERE ttm_type_name = v.t;


-- ═══════════════════════════════════════════════════════════════════════════
--  §2  THE BUSINESS DAY — one per branch per trading date
-- ═══════════════════════════════════════════════════════════════════════════
--  The business date is NOT the calendar date: a store open till 01:00 books
--  its 00:30 sales to yesterday (setting till.day_cutoff). Every session hangs
--  off a day; DAY CLOSE is the store's Z and the moment SALES_DAY_CLOSED
--  (already used by /bills/retender) starts refusing.
CREATE TABLE IF NOT EXISTS accounts.till_business_day
(
    tbd_id                uuid          NOT NULL DEFAULT uuidv7(),
    tbd_company_id        uuid          NOT NULL,
    tbd_branch_id         uuid          NOT NULL,
    tbd_tenant_id         uuid,
    tbd_acc_year          character(9)  NOT NULL,
    tbd_business_date     date          NOT NULL,
    tbd_status            character varying(10)  NOT NULL DEFAULT 'OPEN',   -- OPEN | CLOSING | CLOSED
    tbd_opened_on         timestamptz   NOT NULL DEFAULT now(),
    tbd_opened_by         uuid          NOT NULL,
    tbd_closing_on        timestamptz,
    tbd_closed_on         timestamptz,
    tbd_closed_by         uuid,
    tbd_z_no              integer,                               -- store Z, running per branch, never reset
    tbd_reopen_count      integer       NOT NULL DEFAULT 0,
    -- ── frozen at close by TillDayService; never recomputed ─────────────
    tbd_session_count     integer       NOT NULL DEFAULT 0,
    tbd_bill_count        integer       NOT NULL DEFAULT 0,
    tbd_net_sales         numeric(15,2) NOT NULL DEFAULT 0,
    tbd_cash_expected     numeric(15,2) NOT NULL DEFAULT 0,
    tbd_cash_counted      numeric(15,2) NOT NULL DEFAULT 0,
    tbd_noncash_variance  numeric(15,2) NOT NULL DEFAULT 0,
    tbd_safe_opening      numeric(15,2) NOT NULL DEFAULT 0,
    tbd_safe_expected     numeric(15,2) NOT NULL DEFAULT 0,
    tbd_safe_counted      numeric(15,2),                         -- NULL = no safe count (setting allowed it)
    tbd_remitted          numeric(15,2) NOT NULL DEFAULT 0,
    tbd_exception_count   integer       NOT NULL DEFAULT 0,      -- approvals + force closes + no-sales in the day
    tbd_close_approval_id uuid,                                  -- DAY_CLOSE_EXCEPTION, when one fired
    tbd_print_count       smallint      NOT NULL DEFAULT 0,
    tbd_notes             character varying(500),
    tbd_is_deleted        boolean       NOT NULL DEFAULT false,
    tbd_sync_date         timestamptz,
    tbd_created_on        timestamptz   NOT NULL DEFAULT now(),
    tbd_created_by        character varying(50),
    tbd_modified_on       timestamptz,
    tbd_modified_by       character varying(50),
    tbd_cash_variance     numeric(15,2) GENERATED ALWAYS AS (tbd_cash_counted - tbd_cash_expected) STORED,
    CONSTRAINT pk_till_business_day PRIMARY KEY (tbd_id, tbd_acc_year),
    -- the session's FK carries the date too, so a session can never sit on another day's date
    CONSTRAINT uq_tbd_id_date UNIQUE (tbd_id, tbd_acc_year, tbd_business_date),
    -- the partition year must be the business date's financial year (April–March)
    CONSTRAINT ck_tbd_year CHECK (tbd_acc_year = (
        (extract(year FROM tbd_business_date)::int - CASE WHEN extract(month FROM tbd_business_date) < 4 THEN 1 ELSE 0 END)::text || '-' ||
        (extract(year FROM tbd_business_date)::int - CASE WHEN extract(month FROM tbd_business_date) < 4 THEN 1 ELSE 0 END + 1)::text)),
    CONSTRAINT ck_tbd_status CHECK (tbd_status::text = ANY (ARRAY['OPEN','CLOSING','CLOSED'])),
    CONSTRAINT ck_tbd_closed CHECK ((tbd_status = 'CLOSED') = (tbd_closed_on IS NOT NULL AND tbd_closed_by IS NOT NULL)),
    CONSTRAINT ck_tbd_counts CHECK (tbd_session_count >= 0 AND tbd_bill_count >= 0
        AND tbd_reopen_count >= 0 AND tbd_exception_count >= 0 AND tbd_remitted >= 0)
) PARTITION BY LIST (tbd_acc_year);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tbd_date
    ON accounts.till_business_day (tbd_company_id, tbd_branch_id, tbd_business_date, tbd_acc_year)
    WHERE tbd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tbd_open
    ON accounts.till_business_day (tbd_company_id, tbd_branch_id, tbd_status)
    WHERE tbd_is_deleted = false AND tbd_status <> 'CLOSED';


-- ═══════════════════════════════════════════════════════════════════════════
--  §3  THE SESSION — one cashier, one drawer, one stretch of time
-- ═══════════════════════════════════════════════════════════════════════════
--  This is the row every *_session_id in the product was always meant to
--  point at (sale_bill/return/dc/quotation/order, acc_tender_detail,
--  acc_voucher_header, acc_bill_adjustment, acc_temp_credit, txn_hold,
--  loyalty_ledger, txn_status_log …). Those columns stay FK-less: they are on
--  partitioned tables of other years and an offline push must never fail on
--  ordering. TillSessionService validates the id at post time instead.
--
--  LIFECYCLE  (TILL_DESIGN.md §5.2)
--    OPEN ⇄ SUSPENDED → COUNTING → PENDING_APPROVAL → CLOSED
--      └→ VOIDED (opened in error, nothing written in it)
--    CLOSED → OPEN again only by SESSION_REOPEN (approval), counted again.
--    Force close = a supervisor drives COUNTING/CLOSED for an absent cashier;
--    tss_force_closed records it.
CREATE TABLE IF NOT EXISTS accounts.till_session
(
    tss_id                uuid          NOT NULL DEFAULT uuidv7(),
    tss_company_id        uuid          NOT NULL,
    tss_branch_id         uuid          NOT NULL,
    tss_tenant_id         uuid,
    tss_acc_year          character(9)  NOT NULL,
    tss_day_id            uuid          NOT NULL,
    tss_business_date     date          NOT NULL,
    tss_counter_id        uuid          NOT NULL,
    tss_device_id         uuid          NOT NULL,                -- the device that opened it; money posts only from it (plan-till-counter-claim.md)
    tss_operator_id       uuid          NOT NULL,                -- user_master.usr_id of the accountable cashier
    tss_session_no        character varying(30)  NOT NULL,       -- C01-260407-02 (counter-date-seq), printed
    tss_day_seq           integer       NOT NULL,                -- nth session of this counter on this business date
    tss_status            character varying(16)  NOT NULL DEFAULT 'OPEN',

    -- ── open ─────────────────────────────────────────────────────────────
    tss_opened_on         timestamptz   NOT NULL DEFAULT now(),
    tss_float_mode        character varying(8)   NOT NULL,       -- ISSUED (from the safe) | CARRIED (left in the drawer) | NONE
    tss_prev_session_id   uuid,                                  -- CARRIED / handover: whose drawer this was
    tss_float_issued      numeric(15,2) NOT NULL DEFAULT 0,      -- what the safe / previous close says is in it
    tss_float_counted     numeric(15,2) NOT NULL DEFAULT 0,      -- what the cashier counted at open
    tss_open_count_id     uuid,
    tss_float_approval_id uuid,                                  -- FLOAT_MISMATCH

    -- ── during ───────────────────────────────────────────────────────────
    tss_suspend_count     integer       NOT NULL DEFAULT 0,
    tss_suspended_on      timestamptz,                           -- set while SUSPENDED

    -- ── close ────────────────────────────────────────────────────────────
    tss_billing_ended_on  timestamptz,                           -- the moment it stopped taking money
    tss_count_mode        character varying(6),                  -- BLIND | OPEN
    tss_count_place       character varying(12),                 -- COUNTER | CASH_OFFICE
    tss_close_count_id    uuid,                                  -- the FINAL count (attempts are all kept)
    tss_count_attempts    smallint      NOT NULL DEFAULT 0,
    tss_counted_on        timestamptz,
    tss_counted_by        uuid,
    tss_witness_by        uuid,                                  -- second person at the count (setting)
    tss_closed_on         timestamptz,
    tss_closed_by         uuid,
    tss_close_approval_id uuid,                                  -- CASH_VARIANCE / NONCASH_VARIANCE / FORCE_CLOSE
    tss_force_closed      boolean       NOT NULL DEFAULT false,
    tss_force_reason_id   uuid,
    tss_reopen_count      smallint      NOT NULL DEFAULT 0,
    tss_z_no              integer,                               -- = the counter's tcn_z_last_no + 1 at close

    -- ── frozen at close by TillLedgerService; never recomputed ───────────
    tss_bill_count        integer       NOT NULL DEFAULT 0,
    tss_return_count      integer       NOT NULL DEFAULT 0,
    tss_receipt_count     integer       NOT NULL DEFAULT 0,
    tss_no_sale_count     integer       NOT NULL DEFAULT 0,
    tss_void_count        integer       NOT NULL DEFAULT 0,
    tss_void_line_count   integer       NOT NULL DEFAULT 0,
    tss_net_sales         numeric(15,2) NOT NULL DEFAULT 0,
    tss_cash_expected     numeric(15,2) NOT NULL DEFAULT 0,
    tss_cash_counted      numeric(15,2) NOT NULL DEFAULT 0,
    tss_noncash_expected  numeric(15,2) NOT NULL DEFAULT 0,
    tss_noncash_counted   numeric(15,2) NOT NULL DEFAULT 0,
    tss_handed_over       numeric(15,2) NOT NULL DEFAULT 0,      -- cash that went to the safe at close
    tss_float_left        numeric(15,2) NOT NULL DEFAULT 0,      -- cash left in the drawer for the next session
    tss_variance_status   character varying(16)  NOT NULL DEFAULT 'NONE',

    tss_print_count       smallint      NOT NULL DEFAULT 0,
    tss_notes             character varying(500),
    tss_is_deleted        boolean       NOT NULL DEFAULT false,
    tss_sync_date         timestamptz,
    tss_created_on        timestamptz   NOT NULL DEFAULT now(),
    tss_created_by        character varying(50),
    tss_modified_on       timestamptz,
    tss_modified_by       character varying(50),

    tss_float_variance    numeric(15,2) GENERATED ALWAYS AS (tss_float_counted - tss_float_issued) STORED,
    tss_cash_variance     numeric(15,2) GENERATED ALWAYS AS (tss_cash_counted - tss_cash_expected) STORED,
    tss_noncash_variance  numeric(15,2) GENERATED ALWAYS AS (tss_noncash_counted - tss_noncash_expected) STORED,

    CONSTRAINT pk_till_session PRIMARY KEY (tss_id, tss_acc_year),
    CONSTRAINT fk_tss_day FOREIGN KEY (tss_day_id, tss_acc_year, tss_business_date)
        REFERENCES accounts.till_business_day (tbd_id, tbd_acc_year, tbd_business_date) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- the partition year must be the business date's financial year (April–March)
    CONSTRAINT ck_tss_year CHECK (tss_acc_year = (
        (extract(year FROM tss_business_date)::int - CASE WHEN extract(month FROM tss_business_date) < 4 THEN 1 ELSE 0 END)::text || '-' ||
        (extract(year FROM tss_business_date)::int - CASE WHEN extract(month FROM tss_business_date) < 4 THEN 1 ELSE 0 END + 1)::text)),
    CONSTRAINT fk_tss_counter FOREIGN KEY (tss_counter_id)
        REFERENCES accounts.till_counter (tcn_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tss_status CHECK (tss_status::text = ANY (ARRAY[
        'OPEN','SUSPENDED','COUNTING','PENDING_APPROVAL','CLOSED','VOIDED'])),
    CONSTRAINT ck_tss_float_mode CHECK (tss_float_mode::text = ANY (ARRAY['ISSUED','CARRIED','NONE'])),
    CONSTRAINT ck_tss_carried CHECK (tss_float_mode <> 'CARRIED' OR tss_prev_session_id IS NOT NULL),
    CONSTRAINT ck_tss_count_mode CHECK (tss_count_mode IS NULL OR tss_count_mode::text = ANY (ARRAY['BLIND','OPEN'])),
    CONSTRAINT ck_tss_count_place CHECK (tss_count_place IS NULL OR tss_count_place::text = ANY (ARRAY['COUNTER','CASH_OFFICE'])),
    CONSTRAINT ck_tss_variance_status CHECK (tss_variance_status::text = ANY (ARRAY[
        'NONE','WITHIN_TOLERANCE','PENDING','ACCEPTED','RECOVER','INVESTIGATE'])),
    CONSTRAINT ck_tss_suspended CHECK ((tss_status = 'SUSPENDED') = (tss_suspended_on IS NOT NULL)),
    CONSTRAINT ck_tss_closed CHECK ((tss_status IN ('CLOSED','VOIDED')) = (tss_closed_on IS NOT NULL AND tss_closed_by IS NOT NULL)),
    CONSTRAINT ck_tss_counted CHECK (tss_status NOT IN ('PENDING_APPROVAL','CLOSED')
        OR (tss_close_count_id IS NOT NULL AND tss_counted_on IS NOT NULL AND tss_billing_ended_on IS NOT NULL)),
    CONSTRAINT ck_tss_force CHECK (NOT tss_force_closed OR tss_force_reason_id IS NOT NULL),
    CONSTRAINT ck_tss_amounts CHECK (tss_float_issued >= 0 AND tss_float_counted >= 0
        AND tss_cash_counted >= 0 AND tss_noncash_counted >= 0 AND tss_handed_over >= 0 AND tss_float_left >= 0
        AND tss_day_seq > 0 AND tss_count_attempts >= 0 AND tss_suspend_count >= 0 AND tss_reopen_count >= 0),
    -- what is in the drawer at close either went to the safe or stayed as float
    CONSTRAINT ck_tss_disposal CHECK (tss_status <> 'CLOSED' OR tss_handed_over + tss_float_left = tss_cash_counted)
) PARTITION BY LIST (tss_acc_year);

-- One live session per COUNTER (a counter belongs to one site, so this is
-- single-writer and safe offline). Includes acc_year because a unique index
-- on a partitioned table must; the service closes the year-crossing gap.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tss_counter_live
    ON accounts.till_session (tss_counter_id, tss_acc_year)
    WHERE tss_is_deleted = false AND tss_status IN ('OPEN','SUSPENDED','COUNTING');
CREATE UNIQUE INDEX IF NOT EXISTS ux_tss_no
    ON accounts.till_session (tss_company_id, tss_branch_id, tss_session_no, tss_acc_year)
    WHERE tss_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tss_day
    ON accounts.till_session (tss_day_id, tss_acc_year) WHERE tss_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tss_operator
    ON accounts.till_session (tss_operator_id, tss_business_date) WHERE tss_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tss_live
    ON accounts.till_session (tss_company_id, tss_branch_id, tss_status)
    WHERE tss_is_deleted = false AND tss_status NOT IN ('CLOSED','VOIDED');
-- Reconciliation: a CLOSED session with a variance nobody has decided on.
CREATE INDEX IF NOT EXISTS ix_tss_variance_open
    ON accounts.till_session (tss_company_id, tss_branch_id, tss_business_date)
    WHERE tss_is_deleted = false AND tss_status = 'CLOSED' AND tss_variance_status IN ('PENDING','INVESTIGATE');


-- ═══════════════════════════════════════════════════════════════════════════
--  §4  COUNTS — every time somebody counts money, one header + its lines
-- ═══════════════════════════════════════════════════════════════════════════
--  3.0 DELETEd and re-INSERTed the count on every close/approve, so a recount
--  erased the first count. Here every attempt is its own row and stays.
--  tct_expected is what the system expected AT THAT MOMENT — stored even when
--  the count was blind and the cashier never saw it.
CREATE TABLE IF NOT EXISTS accounts.till_count
(
    tct_id                uuid          NOT NULL DEFAULT uuidv7(),
    tct_company_id        uuid          NOT NULL,
    tct_branch_id         uuid          NOT NULL,
    tct_tenant_id         uuid,
    tct_acc_year          character(9)  NOT NULL,
    tct_kind              character varying(12)  NOT NULL,
    tct_session_id        uuid,                                  -- NULL for a SAFE count
    tct_safe_id           uuid,                                  -- SAFE / DROP_VERIFY
    tct_movement_id       uuid,                                  -- DROP_VERIFY / FLOAT_ISSUE / PICKUP: the movement counted
    tct_attempt_no        smallint      NOT NULL DEFAULT 1,
    tct_is_final          boolean       NOT NULL DEFAULT false,  -- the attempt the session close used
    tct_is_blind          boolean       NOT NULL DEFAULT false,
    tct_counted_on        timestamptz   NOT NULL DEFAULT now(),
    tct_counted_by        uuid          NOT NULL,
    tct_witness_by        uuid,
    tct_device_id         uuid,
    tct_total_counted     numeric(15,2) NOT NULL DEFAULT 0,
    tct_expected          numeric(15,2),                         -- system figure at count time (NULL for SURPRISE before compute)
    tct_notes             character varying(500),
    tct_is_deleted        boolean       NOT NULL DEFAULT false,
    tct_sync_date         timestamptz,
    tct_created_on        timestamptz   NOT NULL DEFAULT now(),
    tct_created_by        character varying(50),
    CONSTRAINT pk_till_count PRIMARY KEY (tct_id, tct_acc_year),
    CONSTRAINT ck_tct_kind CHECK (tct_kind::text = ANY (ARRAY[
        'OPEN','CLOSE','RECOUNT','HANDOVER','SURPRISE','FLOAT_ISSUE','PICKUP','DROP_VERIFY','SAFE'])),
    CONSTRAINT ck_tct_owner CHECK (tct_session_id IS NOT NULL OR tct_safe_id IS NOT NULL),
    CONSTRAINT ck_tct_amounts CHECK (tct_total_counted >= 0 AND tct_attempt_no > 0),
    CONSTRAINT ck_tct_witness CHECK (tct_witness_by IS NULL OR tct_witness_by <> tct_counted_by)
) PARTITION BY LIST (tct_acc_year);
CREATE INDEX IF NOT EXISTS ix_tct_session
    ON accounts.till_count (tct_session_id, tct_acc_year, tct_kind, tct_attempt_no) WHERE tct_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tct_safe
    ON accounts.till_count (tct_safe_id, tct_counted_on) WHERE tct_is_deleted = false AND tct_safe_id IS NOT NULL;
-- one final OPEN count and one final CLOSE-side count per session (the final close
-- attempt may be a CLOSE or a RECOUNT — both are the close)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tct_final
    ON accounts.till_count (tct_session_id, (CASE WHEN tct_kind = 'OPEN' THEN 'OPEN' ELSE 'CLOSE' END), tct_acc_year)
    WHERE tct_is_deleted = false AND tct_is_final AND tct_session_id IS NOT NULL AND tct_kind IN ('OPEN','CLOSE','RECOUNT');

CREATE TABLE IF NOT EXISTS accounts.till_count_line
(
    tcl_id                uuid          NOT NULL DEFAULT uuidv7(),
    tcl_acc_year          character(9)  NOT NULL,
    tcl_count_id          uuid          NOT NULL,
    tcl_row_no            integer       NOT NULL,
    tcl_tender_type_id    integer       NOT NULL,                -- acc_tender_types
    tcl_tender_id         uuid,                                  -- acc_tender_master (two UPI QRs = two lines)
    tcl_denomination_id   uuid,                                  -- DENOM lines
    tcl_face_value        numeric(12,2) NOT NULL DEFAULT 0,      -- DENOM: the note value; else 0
    tcl_qty               numeric(12,0) NOT NULL DEFAULT 0,      -- DENOM: pieces; SLIPS: slips
    tcl_entered_amount    numeric(15,2) NOT NULL DEFAULT 0,      -- SLIPS / loose coin total typed
    tcl_batch_ref         character varying(50),                 -- card EDC batch no / cheque bundle ref
    tcl_amount            numeric(15,2) GENERATED ALWAYS AS (
                              CASE WHEN tcl_denomination_id IS NOT NULL THEN tcl_face_value * tcl_qty
                                   ELSE tcl_entered_amount END) STORED,
    tcl_sync_date         timestamptz,
    CONSTRAINT pk_till_count_line PRIMARY KEY (tcl_id, tcl_acc_year),
    CONSTRAINT fk_tcl_count FOREIGN KEY (tcl_count_id, tcl_acc_year)
        REFERENCES accounts.till_count (tct_id, tct_acc_year) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_tcl_tender_type FOREIGN KEY (tcl_tender_type_id)
        REFERENCES accounts.acc_tender_types (ttm_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tcl_denom FOREIGN KEY (tcl_denomination_id)
        REFERENCES accounts.till_denomination (tdn_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tcl_values CHECK (tcl_face_value >= 0 AND tcl_qty >= 0 AND tcl_entered_amount >= 0),
    CONSTRAINT ck_tcl_denom CHECK ((tcl_denomination_id IS NULL) = (tcl_face_value = 0))
) PARTITION BY LIST (tcl_acc_year);
CREATE INDEX IF NOT EXISTS ix_tcl_count
    ON accounts.till_count_line (tcl_count_id, tcl_acc_year, tcl_row_no);


-- ═══════════════════════════════════════════════════════════════════════════
--  §5  CASH MOVEMENTS — every non-sale movement of money through a drawer
--      or the safe. Each POSTED row has exactly one accounting voucher.
-- ═══════════════════════════════════════════════════════════════════════════
--   kind            from → to            voucher   Dr / Cr
--   FLOAT_ISSUE     SAFE → TILL          TFlt      Till cash / Safe
--   TOP_UP          SAFE → TILL          TFlt      Till cash / Safe          (change mid-shift)
--   PICKUP          TILL → SAFE          TDrp      Safe / Till cash          (supervisor takes it)
--   DROP            TILL → SAFE          TDrp      Safe / Till cash          (cashier drops a sealed bag)
--   CLOSE_HANDOVER  TILL → SAFE          TDrp      Safe / Till cash          (counted cash at close)
--   PAID_OUT        TILL → LEDGER        TPOut     expense or party / Till cash
--   PAID_IN         LEDGER → TILL        TPIn      Till cash / income or party
--   REMIT           SAFE → TRANSIT/BANK  CRem      Cash-in-transit (or bank) / Safe
--   SAFE_TRANSFER   SAFE → SAFE          CRem      other safe / this safe
--   EXCHANGE        TILL ↔ SAFE          none      net zero; counted both ways, logged (change for a 2000)
--  Till cash ledger = the branch's CASH tender ledger (acc_tender_master
--  .tnd_ledger_id) — ONE source of truth, so a sale and a payout hit the same
--  ledger. Session = the sub-ledger, via avh_session_id (already a column).
CREATE TABLE IF NOT EXISTS accounts.till_cash_movement
(
    tcm_id                uuid          NOT NULL DEFAULT uuidv7(),
    tcm_company_id        uuid          NOT NULL,
    tcm_branch_id         uuid          NOT NULL,
    tcm_tenant_id         uuid,
    tcm_acc_year          character(9)  NOT NULL,
    tcm_kind              character varying(16)  NOT NULL,
    tcm_doc_no            character varying(40)  NOT NULL,       -- from acc_voucher_seq for the voucher type
    tcm_doc_date          date          NOT NULL,                -- = the business date
    tcm_day_id            uuid          NOT NULL,
    tcm_session_id        uuid,                                  -- NULL only for REMIT / SAFE_TRANSFER
    tcm_safe_id           uuid,                                  -- the safe side, when there is one
    tcm_to_safe_id        uuid,                                  -- SAFE_TRANSFER target
    tcm_amount            numeric(15,2) NOT NULL,
    tcm_ledger_id         uuid,                                  -- PAID_OUT / PAID_IN counter-ledger; REMIT: bank / transit
    tcm_reason_id         uuid,
    tcm_ref_no            character varying(50),                 -- supplier bill no, deposit slip no
    tcm_ref_date          date,
    tcm_party_name        character varying(150),                -- who took / gave the cash (free text, PAID_OUT)
    tcm_count_id          uuid,                                  -- denomination count of what moved
    tcm_bag_no            character varying(30),                 -- DROP / REMIT: tamper-evident bag
    tcm_seal_no           character varying(30),
    tcm_cit_agency        character varying(100),                -- REMIT: cash-in-transit company
    tcm_done_by           uuid          NOT NULL,                -- who handled the cash
    tcm_witness_by        uuid,                                  -- second person (PICKUP always)
    tcm_approval_id       uuid,
    tcm_voucher_id        uuid,                                  -- the posted acc_voucher_header
    tcm_voucher_acc_year  character(9),
    tcm_status            character varying(8)   NOT NULL DEFAULT 'POSTED',   -- POSTED | VOIDED
    tcm_void_reason_id    uuid,
    tcm_voided_on         timestamptz,
    tcm_voided_by         uuid,
    tcm_void_approval_id  uuid,
    tcm_print_count       smallint      NOT NULL DEFAULT 0,
    tcm_device_id         uuid,
    tcm_notes             character varying(500),
    tcm_is_deleted        boolean       NOT NULL DEFAULT false,
    tcm_sync_date         timestamptz,
    tcm_created_on        timestamptz   NOT NULL DEFAULT now(),
    tcm_created_by        character varying(50),
    tcm_modified_on       timestamptz,
    tcm_modified_by       character varying(50),
    CONSTRAINT pk_till_cash_movement PRIMARY KEY (tcm_id, tcm_acc_year),
    CONSTRAINT fk_tcm_ledger FOREIGN KEY (tcm_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tcm_reason FOREIGN KEY (tcm_reason_id)
        REFERENCES accounts.till_reason (trs_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tcm_safe FOREIGN KEY (tcm_safe_id)
        REFERENCES accounts.till_safe (tsf_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tcm_kind CHECK (tcm_kind::text = ANY (ARRAY[
        'FLOAT_ISSUE','TOP_UP','PICKUP','DROP','CLOSE_HANDOVER','PAID_OUT','PAID_IN',
        'REMIT','SAFE_TRANSFER','EXCHANGE'])),
    CONSTRAINT ck_tcm_status CHECK (tcm_status::text = ANY (ARRAY['POSTED','VOIDED'])),
    CONSTRAINT ck_tcm_amount CHECK (tcm_amount > 0),
    -- shape per kind: what each kind must carry
    CONSTRAINT ck_tcm_session CHECK ((tcm_kind IN ('REMIT','SAFE_TRANSFER')) = (tcm_session_id IS NULL)),
    CONSTRAINT ck_tcm_safe CHECK (tcm_kind IN ('PAID_OUT','PAID_IN') OR tcm_safe_id IS NOT NULL),
    CONSTRAINT ck_tcm_ledger CHECK (tcm_kind NOT IN ('PAID_OUT','PAID_IN','REMIT') OR tcm_ledger_id IS NOT NULL),
    CONSTRAINT ck_tcm_reason CHECK (tcm_kind NOT IN ('PAID_OUT','PAID_IN','PICKUP') OR tcm_reason_id IS NOT NULL),
    CONSTRAINT ck_tcm_transfer CHECK ((tcm_kind = 'SAFE_TRANSFER') = (tcm_to_safe_id IS NOT NULL)),
    CONSTRAINT ck_tcm_witness CHECK (tcm_witness_by IS NULL OR tcm_witness_by <> tcm_done_by),
    -- the supervisor takes the cash, the cashier signs for it (§5.6)
    CONSTRAINT ck_tcm_pickup_witness CHECK (tcm_kind <> 'PICKUP' OR tcm_witness_by IS NOT NULL),
    CONSTRAINT ck_tcm_void CHECK ((tcm_status = 'VOIDED') =
        (tcm_voided_on IS NOT NULL AND tcm_voided_by IS NOT NULL AND tcm_void_reason_id IS NOT NULL)),
    CONSTRAINT ck_tcm_voucher_pair CHECK ((tcm_voucher_id IS NULL) = (tcm_voucher_acc_year IS NULL))
) PARTITION BY LIST (tcm_acc_year);
CREATE INDEX IF NOT EXISTS ix_tcm_session
    ON accounts.till_cash_movement (tcm_session_id, tcm_acc_year, tcm_kind) WHERE tcm_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tcm_day
    ON accounts.till_cash_movement (tcm_day_id, tcm_acc_year) WHERE tcm_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tcm_safe
    ON accounts.till_cash_movement (tcm_safe_id, tcm_doc_date) WHERE tcm_is_deleted = false AND tcm_status = 'POSTED';
CREATE UNIQUE INDEX IF NOT EXISTS ux_tcm_doc_no
    ON accounts.till_cash_movement (tcm_company_id, tcm_branch_id, tcm_kind, tcm_doc_no, tcm_acc_year)
    WHERE tcm_is_deleted = false;
-- Reconciliation: a POSTED movement that never got its voucher.
CREATE INDEX IF NOT EXISTS ix_tcm_unposted
    ON accounts.till_cash_movement (tcm_company_id, tcm_branch_id)
    WHERE tcm_is_deleted = false AND tcm_status = 'POSTED' AND tcm_kind <> 'EXCHANGE' AND tcm_voucher_id IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §6  VARIANCE — per session, per tender: what was decided about the gap
-- ═══════════════════════════════════════════════════════════════════════════
--  Treatment → posting (TVar voucher, journal):
--    WITHIN_TOLERANCE  short/excess ≤ till.cash_tolerance → Cash Short & Excess, auto
--    EXPENSE           Cash Short & Excess (CASH_SHORT_EXCESS role)
--    RECOVER           the cashier's staff advance ledger: tss_operator_id → usr_employee_id
--                      → emp_loan_ledger_id (none → refused TILL_LEDGER_UNMAPPED)
--    SUSPENSE          TENDER_SUSPENSE role — under investigation, cleared later by a journal
--    RETENDERED        no posting: the gap was a wrong tender, fixed by /bills/retender
--                      before the close (non-cash differences should end here)
--  A variance row is never edited after it posts; a changed decision is a
--  REVERSED row plus a new one. Stage OPEN = the float mismatch at session
--  open (open_amount = issued/carried, counted = float counted); posting it
--  keeps the session's till-cash legs reconcilable (TILL_DESIGN.md §5.7).
CREATE TABLE IF NOT EXISTS accounts.till_variance
(
    tvr_id                uuid          NOT NULL DEFAULT uuidv7(),
    tvr_company_id        uuid          NOT NULL,
    tvr_branch_id         uuid          NOT NULL,
    tvr_tenant_id         uuid,
    tvr_acc_year          character(9)  NOT NULL,
    tvr_session_id        uuid          NOT NULL,
    tvr_stage             character varying(5)   NOT NULL DEFAULT 'CLOSE',  -- OPEN (float mismatch) | CLOSE
    tvr_tender_type_id    integer       NOT NULL,
    tvr_tender_id         uuid,
    tvr_open_amount       numeric(15,2) NOT NULL DEFAULT 0,      -- float (cash only)
    tvr_sales_amount      numeric(15,2) NOT NULL DEFAULT 0,      -- sale tenders taken
    tvr_refund_amount     numeric(15,2) NOT NULL DEFAULT 0,      -- refunds paid
    tvr_receipt_amount    numeric(15,2) NOT NULL DEFAULT 0,      -- receipts / advances / temp-credit collections
    tvr_moved_in          numeric(15,2) NOT NULL DEFAULT 0,      -- TOP_UP + PAID_IN
    tvr_moved_out         numeric(15,2) NOT NULL DEFAULT 0,      -- PICKUP + DROP + PAID_OUT
    tvr_txn_count         integer       NOT NULL DEFAULT 0,
    tvr_expected          numeric(15,2) NOT NULL,
    tvr_counted           numeric(15,2) NOT NULL,
    tvr_slip_count        integer,
    tvr_tolerance         numeric(15,2) NOT NULL DEFAULT 0,      -- the tolerance that applied, snapshot
    tvr_treatment         character varying(16)  NOT NULL DEFAULT 'PENDING',
    tvr_reason_id         uuid,
    tvr_recovery_ledger_id uuid,
    tvr_approval_id       uuid,
    tvr_voucher_id        uuid,
    tvr_voucher_acc_year  character(9),
    tvr_status            character varying(10)  NOT NULL DEFAULT 'OPEN',      -- OPEN | POSTED | REVERSED
    tvr_reverses_id       uuid,
    tvr_decided_by        uuid,
    tvr_decided_on        timestamptz,
    tvr_notes             character varying(500),
    tvr_is_deleted        boolean       NOT NULL DEFAULT false,
    tvr_sync_date         timestamptz,
    tvr_created_on        timestamptz   NOT NULL DEFAULT now(),
    tvr_created_by        character varying(50),
    tvr_modified_on       timestamptz,
    tvr_modified_by       character varying(50),
    tvr_variance          numeric(15,2) GENERATED ALWAYS AS (tvr_counted - tvr_expected) STORED,
    CONSTRAINT pk_till_variance PRIMARY KEY (tvr_id, tvr_acc_year),
    CONSTRAINT fk_tvr_session FOREIGN KEY (tvr_session_id, tvr_acc_year)
        REFERENCES accounts.till_session (tss_id, tss_acc_year) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tvr_tender_type FOREIGN KEY (tvr_tender_type_id)
        REFERENCES accounts.acc_tender_types (ttm_type_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_tvr_reason FOREIGN KEY (tvr_reason_id)
        REFERENCES accounts.till_reason (trs_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tvr_treatment CHECK (tvr_treatment::text = ANY (ARRAY[
        'PENDING','WITHIN_TOLERANCE','EXPENSE','RECOVER','SUSPENSE','RETENDERED'])),
    CONSTRAINT ck_tvr_status CHECK (tvr_status::text = ANY (ARRAY['OPEN','POSTED','REVERSED'])),
    CONSTRAINT ck_tvr_stage CHECK (tvr_stage::text = ANY (ARRAY['OPEN','CLOSE'])),
    -- an OPEN-stage row is the float: issued vs counted, cash only, nothing else in it
    CONSTRAINT ck_tvr_open_stage CHECK (tvr_stage = 'CLOSE' OR (tvr_tender_type_id = 1
        AND tvr_sales_amount = 0 AND tvr_refund_amount = 0 AND tvr_receipt_amount = 0
        AND tvr_moved_in = 0 AND tvr_moved_out = 0)),
    -- the single-row arithmetic of the expectation (one row's own sums: allowed)
    CONSTRAINT ck_tvr_expected CHECK (tvr_expected = tvr_open_amount + tvr_sales_amount - tvr_refund_amount
        + tvr_receipt_amount + tvr_moved_in - tvr_moved_out),
    CONSTRAINT ck_tvr_counted CHECK (tvr_counted >= 0 AND tvr_tolerance >= 0 AND tvr_txn_count >= 0),
    -- float and drawer movements exist only for CASH (tender type 1)
    CONSTRAINT ck_tvr_cash_terms CHECK (tvr_tender_type_id = 1
        OR (tvr_open_amount = 0 AND tvr_moved_in = 0 AND tvr_moved_out = 0)),
    CONSTRAINT ck_tvr_recover CHECK (tvr_treatment <> 'RECOVER' OR tvr_recovery_ledger_id IS NOT NULL),
    CONSTRAINT ck_tvr_reason CHECK (tvr_treatment IN ('PENDING','WITHIN_TOLERANCE','RETENDERED')
        OR tvr_counted = tvr_expected OR tvr_reason_id IS NOT NULL),
    CONSTRAINT ck_tvr_decided CHECK (tvr_treatment = 'PENDING' OR (tvr_decided_by IS NOT NULL AND tvr_decided_on IS NOT NULL)),
    CONSTRAINT ck_tvr_voucher_pair CHECK ((tvr_voucher_id IS NULL) = (tvr_voucher_acc_year IS NULL))
) PARTITION BY LIST (tvr_acc_year);
CREATE INDEX IF NOT EXISTS ix_tvr_session
    ON accounts.till_variance (tvr_session_id, tvr_acc_year) WHERE tvr_is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_tvr_live
    ON accounts.till_variance (tvr_session_id, tvr_stage, tvr_tender_type_id, tvr_tender_id, tvr_acc_year) NULLS NOT DISTINCT
    WHERE tvr_is_deleted = false AND tvr_status <> 'REVERSED';
CREATE INDEX IF NOT EXISTS ix_tvr_pending
    ON accounts.till_variance (tvr_company_id, tvr_branch_id)
    WHERE tvr_is_deleted = false AND tvr_status = 'OPEN' AND tvr_treatment IN ('PENDING','SUSPENSE');


-- ═══════════════════════════════════════════════════════════════════════════
--  §7  APPROVALS — one row per request, decided once. Generic on purpose:
--      the void / price-override / reprint gates (SIX_TXN_CONTROLS §7) write
--      here too, so "every override in a session" is one query.
-- ═══════════════════════════════════════════════════════════════════════════
--  NOT a voucher approval step (those stay withdrawn: DRAFT→POSTED→CANCELLED).
--  This approves an EXCEPTION — a variance, a payout over a limit, a drawer
--  opened with no sale — and records who let it through.
--
--  COUNTER channel: approver types their PIN on the cashier's screen; the
--    STORE server verifies usr_pin_hash and writes the decision in the same
--    call. Works with the cloud unreachable.
--  REMOTE channel: request sits PENDING; an approver with taa_can_remote
--    decides from the inbox / mobile THROUGH THE STORE SERVER'S API, so the
--    decision row is still written by the store (one writer per row). HO
--    reviews after the fact go to till_session_review, never here.
CREATE TABLE IF NOT EXISTS accounts.till_approval
(
    tap_id                uuid          NOT NULL DEFAULT uuidv7(),
    tap_company_id        uuid          NOT NULL,
    tap_branch_id         uuid          NOT NULL,
    tap_tenant_id         uuid,
    tap_acc_year          character(9)  NOT NULL,
    tap_event_code        character varying(30)  NOT NULL,       -- ck_tar_event's list
    tap_session_id        uuid,
    tap_counter_id        uuid,
    tap_src_doc_type      character varying(30),                 -- TILL_SESSION | TILL_MOVEMENT | SALE_BILL …
    tap_src_doc_id        uuid,
    tap_src_refno         character varying(100),
    tap_amount            numeric(15,2) NOT NULL DEFAULT 0,
    tap_count_in_session  integer       NOT NULL DEFAULT 0,      -- how many of this event already in the session
    tap_rule_id           uuid,
    tap_rule_snapshot     jsonb,                                 -- mode/threshold/role as they were when it fired
    tap_required_role     character varying(20)  NOT NULL,
    tap_two_person        boolean       NOT NULL DEFAULT false,
    tap_self_allowed      boolean       NOT NULL DEFAULT false,
    tap_channel           character varying(8)   NOT NULL DEFAULT 'COUNTER',   -- COUNTER | REMOTE
    tap_requested_by      uuid          NOT NULL,
    tap_requested_on      timestamptz   NOT NULL DEFAULT now(),
    tap_reason_id         uuid,
    tap_request_note      character varying(500),
    tap_status            character varying(10)  NOT NULL DEFAULT 'PENDING',
    tap_decided_by        uuid,
    tap_decided_on        timestamptz,
    tap_decided_device_id uuid,
    tap_decision_note     character varying(500),
    tap_second_by         uuid,
    tap_second_on         timestamptz,
    tap_expires_on        timestamptz,
    tap_device_id         uuid,
    tap_is_deleted        boolean       NOT NULL DEFAULT false,
    tap_sync_date         timestamptz,
    tap_created_on        timestamptz   NOT NULL DEFAULT now(),
    tap_modified_on       timestamptz,
    CONSTRAINT pk_till_approval PRIMARY KEY (tap_id, tap_acc_year),
    CONSTRAINT fk_tap_reason FOREIGN KEY (tap_reason_id)
        REFERENCES accounts.till_reason (trs_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_tap_status CHECK (tap_status::text = ANY (ARRAY['PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED'])),
    CONSTRAINT ck_tap_channel CHECK (tap_channel::text = ANY (ARRAY['COUNTER','REMOTE'])),
    CONSTRAINT ck_tap_decided CHECK ((tap_status IN ('APPROVED','REJECTED')) = (tap_decided_by IS NOT NULL AND tap_decided_on IS NOT NULL)),
    -- no self-approval unless the rule that fired said so (snapshotted on the row)
    CONSTRAINT ck_tap_self CHECK (tap_self_allowed OR tap_decided_by IS NULL OR tap_decided_by <> tap_requested_by),
    -- two-person: the second approver is a third person, and an APPROVED two-person request has one
    CONSTRAINT ck_tap_second CHECK (tap_second_by IS NULL
        OR (tap_second_by <> tap_requested_by AND tap_second_by <> tap_decided_by AND tap_second_on IS NOT NULL)),
    CONSTRAINT ck_tap_two_person CHECK (NOT tap_two_person OR tap_status <> 'APPROVED' OR tap_second_by IS NOT NULL),
    CONSTRAINT ck_tap_amount CHECK (tap_amount >= 0 AND tap_count_in_session >= 0),
    -- the same lists as the rule (restated with it in 48 / 49)
    CONSTRAINT ck_tap_event CHECK (tap_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','PAID_OUT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK'])),
    CONSTRAINT ck_tap_role CHECK (tap_required_role::text = ANY (ARRAY[
        'SUPERVISOR','STORE_MANAGER','CASH_OFFICE','AREA_MANAGER','HO_FINANCE']))
) PARTITION BY LIST (tap_acc_year);
CREATE INDEX IF NOT EXISTS ix_tap_pending
    ON accounts.till_approval (tap_company_id, tap_branch_id, tap_requested_on)
    WHERE tap_is_deleted = false AND tap_status = 'PENDING';
CREATE INDEX IF NOT EXISTS ix_tap_session
    ON accounts.till_approval (tap_session_id, tap_acc_year, tap_event_code) WHERE tap_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tap_doc
    ON accounts.till_approval (tap_src_doc_type, tap_src_doc_id) WHERE tap_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_tap_approver
    ON accounts.till_approval (tap_decided_by, tap_decided_on) WHERE tap_is_deleted = false AND tap_decided_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §8  EVENTS — the append-only till journal (3.0: one text blob, sess_log_rec)
-- ═══════════════════════════════════════════════════════════════════════════
--  INSERT only, never UPDATE: TillEventService is the single writer and a
--  test asserts no other file writes it (the stock_ledger pattern).
--  Client-side facts (drawer kicked, no-sale, X read, idle lock) arrive in
--  batches via /till/events/batch with their own device timestamps;
--  tev_event_on is the DEVICE time, tev_created_on the arrival.
CREATE TABLE IF NOT EXISTS accounts.till_event
(
    tev_id                uuid          NOT NULL DEFAULT uuidv7(),
    tev_company_id        uuid          NOT NULL,
    tev_branch_id         uuid          NOT NULL,
    tev_acc_year          character(9)  NOT NULL,
    tev_event_code        character varying(30)  NOT NULL,
    tev_event_on          timestamptz   NOT NULL,
    tev_session_id        uuid,
    tev_day_id            uuid,
    tev_counter_id        uuid,
    tev_device_id         uuid,
    tev_user_id           uuid,
    tev_src_doc_type      character varying(30),
    tev_src_doc_id        uuid,
    tev_src_refno         character varying(100),
    tev_amount            numeric(15,2),
    tev_reason_id         uuid,
    tev_approval_id       uuid,
    tev_client_seq        bigint,                                -- device-local sequence: a batch re-sent is idempotent
    tev_payload           jsonb,
    tev_sync_date         timestamptz,
    tev_created_on        timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT pk_till_event PRIMARY KEY (tev_id, tev_acc_year),
    CONSTRAINT ck_tev_code CHECK (tev_event_code::text = ANY (ARRAY[
        'DAY_OPEN','DAY_CLOSING','DAY_CLOSE','DAY_REOPEN',
        'SESSION_OPEN','SESSION_SUSPEND','SESSION_RESUME','SESSION_END_BILLING','SESSION_COUNT',
        'SESSION_RECOUNT','SESSION_CLOSE','SESSION_FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID','SESSION_IDLE_LOCK',
        'SESSION_DEVICE_MOVE','COUNTER_RELINK',   -- plan-till-counter-claim.md §3.3/§3.4
        'DRAWER_OPEN_SALE','NO_SALE','DRAWER_LEFT_OPEN','X_REPORT','Z_REPORT','REPRINT',
        'CASH_ALERT','CASH_BLOCK','CASH_UNBLOCK',
        'MOVEMENT_POSTED','MOVEMENT_VOIDED','VARIANCE_DECIDED',
        'APPROVAL_REQUESTED','APPROVAL_DECIDED','APPROVAL_EXPIRED',
        'PRICE_OVERRIDE','LINE_VOID','BILL_VOID','RETENDER','REFUND_CASH',
        'OFFLINE_START','OFFLINE_END','LOGIN','LOGOUT','PIN_FAIL',
        -- offline: a device still holding unsent bills at end billing; a bill that
        -- reached a session after it closed (accepted, never refused); the cut-off
        'SYNC_PENDING_AT_CLOSE','LATE_ARRIVAL','SESSION_DAY_ENDED']))
) PARTITION BY LIST (tev_acc_year);
CREATE INDEX IF NOT EXISTS ix_tev_session
    ON accounts.till_event (tev_session_id, tev_acc_year, tev_event_on);
CREATE INDEX IF NOT EXISTS ix_tev_branch_code
    ON accounts.till_event (tev_company_id, tev_branch_id, tev_event_code, tev_event_on);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tev_client_seq
    ON accounts.till_event (tev_device_id, tev_client_seq, tev_acc_year)
    WHERE tev_device_id IS NOT NULL AND tev_client_seq IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §9  HO REVIEW — written at the CLOUD only, append-only
-- ═══════════════════════════════════════════════════════════════════════════
--  Sync is push-only (store → cloud, upsert by PK). If HO updated a store-
--  owned session row, the store's next push would overwrite it. So HO's view
--  of a session lives in its own rows that no store ever writes.
CREATE TABLE IF NOT EXISTS accounts.till_session_review
(
    tsr_id                uuid          NOT NULL DEFAULT uuidv7(),
    tsr_company_id        uuid          NOT NULL,
    tsr_branch_id         uuid          NOT NULL,
    tsr_acc_year          character(9)  NOT NULL,
    tsr_session_id        uuid,                                  -- a session, or
    tsr_day_id            uuid,                                  -- a whole day
    tsr_outcome           character varying(16)  NOT NULL,
    tsr_reviewed_by       uuid          NOT NULL,
    tsr_reviewed_on       timestamptz   NOT NULL DEFAULT now(),
    tsr_note              character varying(1000),
    tsr_ref_voucher_id    uuid,                                  -- the journal HO raised (suspense cleared, recovery…)
    tsr_ref_voucher_acc_year character(9),
    tsr_sync_date         timestamptz,
    tsr_created_on        timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT pk_till_session_review PRIMARY KEY (tsr_id, tsr_acc_year),
    CONSTRAINT ck_tsr_target CHECK (tsr_session_id IS NOT NULL OR tsr_day_id IS NOT NULL),
    CONSTRAINT ck_tsr_outcome CHECK (tsr_outcome::text = ANY (ARRAY[
        'OK','QUERY','ESCALATED','RECOVERY_ORDERED','WRITTEN_OFF','SUSPENSE_CLEARED','BANK_MATCHED']))
) PARTITION BY LIST (tsr_acc_year);
CREATE INDEX IF NOT EXISTS ix_tsr_session
    ON accounts.till_session_review (tsr_session_id, tsr_acc_year);
CREATE INDEX IF NOT EXISTS ix_tsr_day
    ON accounts.till_session_review (tsr_day_id, tsr_acc_year);


-- ═══════════════════════════════════════════════════════════════════════════
--  §10  SEEDS — ledger roles, voucher types, settings, reasons, denominations,
--       default approval rules. All idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 10.1 ledger roles (the acc_ledger_map screen maps them) ────────────────
--  No TILL_CASH role on purpose: the till cash ledger IS the branch's CASH
--  tender ledger (acc_tender_master.tnd_ledger_id). Two sources would drift.
--  alr_group is NOT NULL with ck_alr_group (no TILL group exists); SHARED fits
--  — these roles are used by the till, the safe and HO journals alike.
INSERT INTO accounts.acc_ledger_role (alr_role, alr_label, alr_group, alr_want_nature, alr_want_type, alr_sort_order)
VALUES ('SAFE_CASH',         'Store safe / main cash',            'SHARED', 'Assets',   NULL,      610),
       ('CASH_IN_TRANSIT',   'Cash in transit (to bank)',         'SHARED', 'Assets',   NULL,      620),
       ('CASH_SHORT_EXCESS', 'Cash short & excess',               'SHARED', 'Expenses', 'EXPENSE', 630),
       ('TENDER_SUSPENSE',   'Till variance under investigation', 'SHARED', 'Assets',   NULL,      640)
ON CONFLICT (alr_role) DO NOTHING;

--  The catalogue, restated — character for character as 20260929090000 left
--  it (the live definition agrees), with the TILL rows appended. See
--  difference 2 in the header for why each ledger sits where it does.
CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
 RETURNS TABLE(role_code text, ledger_name text, ledger_type text, duty_head text, group_name text)
 LANGUAGE sql
 IMMUTABLE
AS $$
    SELECT *
      FROM (VALUES
        -- role                 ledger name                       type        duty head         group
        -- ── REVENUE ────────────────────────────────────────────────────────
        ('SALES',              'Sales Account',                  'INCOME',   NULL,             'Sales Accounts'),
        ('SALES_RETURN',       'Sales Return',                   'INCOME',   NULL,             'Sales Accounts'),
        -- ── OUTPUT_TAX ─────────────────────────────────────────────────────
        ('OUTPUT_CGST',        'Output CGST',                    'TAX',      'Central Tax',    'Duties & Taxes'),
        ('OUTPUT_SGST',        'Output SGST',                    'TAX',      'State Tax',      'Duties & Taxes'),
        ('OUTPUT_IGST',        'Output IGST',                    'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('OUTPUT_CESS',        'Output Cess',                    'TAX',      'Cess',           'Duties & Taxes'),
        ('OUTPUT_ACESS',       'Output State Cess',              'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── PURCHASE ───────────────────────────────────────────────────────
        ('PURCHASE',           'Purchase Account',               'EXPENSE',  NULL,             'Purchase Accounts'),
        ('PURCHASE_RETURN',    'Purchase Return',                'EXPENSE',  NULL,             'Purchase Accounts'),
        -- ── INPUT_TAX ──────────────────────────────────────────────────────
        ('INPUT_CGST',         'Input CGST',                     'TAX',      'Central Tax',    'Duties & Taxes'),
        ('INPUT_SGST',         'Input SGST',                     'TAX',      'State Tax',      'Duties & Taxes'),
        ('INPUT_IGST',         'Input IGST',                     'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('INPUT_CESS',         'Input Cess',                     'TAX',      'Cess',           'Duties & Taxes'),
        ('INPUT_ACESS',        'Input State Cess',               'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── SHARED ─────────────────────────────────────────────────────────
        ('ROUND_OFF',          'Round Off',                      'ROUNDOFF', NULL,             'Indirect Expenses'),
        ('DISCOUNT_ALLOWED',   'Discount Allowed',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('WRITE_OFF',          'Bad Debts Written Off',          'EXPENSE',  NULL,             'Indirect Expenses'),
        ('ADVANCE_RECEIVED',   'Customer Advances Received',     'GENERAL',  NULL,             'Current Liabilities'),
        ('OPENING_DIFFERENCE', 'Difference in Opening Balances', 'GENERAL',  NULL,             'Suspense A/c'),
        ('RETAINED_EARNINGS',  'Retained Earnings',              'GENERAL',  NULL,             'Reserves & Surplus'),
        -- ── FUTURE — nothing posts to these yet ────────────────────────────
        ('TCS_PAYABLE',        'TCS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        ('TDS_PAYABLE',        'TDS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        -- ── RECEIPT — 20260915120000 ───────────────────────────────────────
        ('TDS_RECEIVABLE',      'TDS Receivable',              'GENERAL', NULL, 'Current Assets'),
        ('BANK_CHARGES',        'Bank Charges',                'EXPENSE', NULL, 'Indirect Expenses'),
        ('SURCHARGE_RECOVERED', 'Card Surcharge Recovered',    'INCOME',  NULL, 'Indirect Incomes'),
        ('CLAIMS_ALLOWED',      'Customer Claims Allowed',     'EXPENSE', NULL, 'Indirect Expenses'),
        ('INTEREST_INCOME',     'Interest on Overdue',         'INCOME',  NULL, 'Indirect Incomes'),
        -- ── RECEIVED CHEQUES — 20260916120000 ──────────────────────────────
        ('BOUNCE_CHARGES_RECOVERED', 'Cheque Bounce Charges Recovered', 'INCOME', NULL, 'Indirect Incomes'),
        -- ── SALES DOCUMENTS — 20260921220000 §8, catalogued here ───────────
        ('COGS',               'Cost of Goods Sold',            'EXPENSE', NULL, 'Direct Expenses'),
        ('INVENTORY',          'Stock in Hand',                  NULL,     NULL, 'Stock-in-Hand'),
        ('LOYALTY_REDEMPTION', 'Loyalty Points Redeemed',       'EXPENSE', NULL, 'Indirect Expenses'),
        ('SCHEME_DISCOUNT',    'Scheme Discount Allowed',       'EXPENSE', NULL, 'Indirect Expenses'),
        -- ── VOUCHER REGISTER — 20260925160000 §4, catalogued here ──────────
        ('INTEREST_PAID',      'Interest Paid',                 'EXPENSE',  NULL,             'Indirect Expenses'),
        ('RATE_DIFFERENCE',    'Rate Difference',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('RCM_CGST_PAYABLE',   'RCM CGST Payable',              'TAX',      'Central Tax',    'Duties & Taxes'),
        ('RCM_SGST_PAYABLE',   'RCM SGST Payable',              'TAX',      'State Tax',      'Duties & Taxes'),
        ('RCM_IGST_PAYABLE',   'RCM IGST Payable',              'TAX',      'Integrated Tax', 'Duties & Taxes'),
        -- ── STOCK → ACCOUNTS — 20260928100000 §1.9 ─────────────────────────
        ('STOCK_SHORTAGE',     'Stock Shortage',                'EXPENSE',  NULL,             'Indirect Expenses'),
        ('STOCK_EXCESS',       'Stock Excess',                  'INCOME',   NULL,             'Indirect Incomes'),
        -- ── PAYMENT — 20260929090000 ───────────────────────────────────────
        --  The payment's three, the mirrors of ADVANCE_RECEIVED, DISCOUNT_ALLOWED
        --  and WRITE_OFF. ADVANCE_PAID is GENERAL for the reason ADVANCE_RECEIVED
        --  is: it constrains the NATURE (Assets) and lets the chart choose.
        ('ADVANCE_PAID',          'Advances to Suppliers',        'GENERAL',  NULL,             'Loans & Advances (Asset)'),
        ('DISCOUNT_RECEIVED',     'Discount Received',            'INCOME',   NULL,             'Indirect Incomes'),
        ('BALANCES_WRITTEN_BACK', 'Balances Written Back',        'INCOME',   NULL,             'Indirect Incomes'),
        -- ── TILL — 20261008100000 (share file 47 §10.1) ────────────────────
        --  The safe and cash-in-transit are cash: both under Cash-in-Hand, so
        --  TFlt / TDrp / CRem stay valid Tally Contras. TENDER_SUSPENSE wants
        --  Assets, and 'Suspense A/c' is a Liabilities group here — so it
        --  sits under Current Assets.
        ('SAFE_CASH',          'Store Safe Cash',               'CASH',     NULL,             'Cash-in-Hand'),
        ('CASH_IN_TRANSIT',    'Cash in Transit',               'CASH',     NULL,             'Cash-in-Hand'),
        ('CASH_SHORT_EXCESS',  'Cash Short & Excess',           'EXPENSE',  NULL,             'Indirect Expenses'),
        ('TENDER_SUSPENSE',    'Till Variance Suspense',        'GENERAL',  NULL,             'Current Assets')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

-- p_skip_if_no_chart = true: on a fresh database, and on the shadow database
-- `migrate dev` replays into, the chart is a SEED that has not run yet;
-- Acc_Ledger_Map.sql maps it at first boot. Here it creates the four global
-- ledgers the catalogue names and maps the four roles to them.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20261008100000');

-- ── 10.2 voucher types — one per accounting shape (Tally needs the base type)
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT * FROM (VALUES
 ('TFlt',  'Till Float Issue',     'TFlt',  'ACCOUNTING'::accounts."VoucherCategory", 'CONTRA'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode", 'tfl', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
          true, false, true,  false, 'TILL FLOAT ISSUE',   340, true, true, 'Contra',  'Contra',  'system'),
 ('TDrp',  'Till Cash Drop',       'TDrp',  'ACCOUNTING'::accounts."VoucherCategory", 'CONTRA'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode", 'tdr', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
          true, false, true,  false, 'TILL CASH DROP',     341, true, true, 'Contra',  'Contra',  'system'),
 ('TPOut', 'Till Paid Out',        'TPOut', 'ACCOUNTING'::accounts."VoucherCategory", 'PAYMENT'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode", 'tpo', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
          true, false, true,  false, 'PAID OUT',           342, true, true, 'Payment', 'Payment', 'system'),
 ('TPIn',  'Till Paid In',         'TPIn',  'ACCOUNTING'::accounts."VoucherCategory", 'RECEIPT'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode", 'tpi', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
          true, false, true,  false, 'PAID IN',            343, true, true, 'Receipt', 'Receipt', 'system'),
 ('TVar',  'Till Variance',        'TVar',  'ACCOUNTING'::accounts."VoucherCategory", 'JOURNAL'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode", 'tva', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
          true, false, false, false, 'TILL SHORT / EXCESS', 344, true, true, 'Journal', 'Journal', 'system'),
 -- REMIT may go to a bank (bank=true) or to cash-in-transit (neither) — like
 -- TndC, which it is depends on the row; both false.
 ('CRem',  'Cash Remittance',      'CRem',  'ACCOUNTING'::accounts."VoucherCategory", 'CONTRA'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode", 'crm', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
          true, false, false, false, 'CASH REMITTANCE',    345, true, true, 'Contra',  'Contra',  'system')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.column1)
ORDER BY v.column17;   -- ids in vchr_sort_order order

-- The serial stays ahead of any pinned id a seed may carry.
SELECT setval(pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
              (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types), true)
 WHERE pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id') IS NOT NULL;

-- number series: clone the Bil rows' company/branch/year/device for each new type
-- (a database with no Bil series yet gets them from findOrCreateSequence on first use)
INSERT INTO accounts.acc_voucher_seq
    (seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year, seq_device_id, seq_device_code, seq_period_key,
     seq_last_no, seq_voucher_prefix, seq_company_code, seq_branch_code, seq_voucher_suffix, seq_no_width)
SELECT t.vchr_type_id, s.seq_company_id, s.seq_branch_id, s.seq_acc_year, s.seq_device_id, s.seq_device_code, s.seq_period_key,
       0, t.vchr_no_prefix, s.seq_company_code, s.seq_branch_code, t.vchr_no_suffix, t.vchr_no_width
FROM accounts.acc_voucher_seq s
JOIN accounts.acc_voucher_types b ON b.vchr_type_id = s.seq_vchr_type_id AND b.vchr_type_code = 'Bil'
CROSS JOIN accounts.acc_voucher_types t
WHERE t.vchr_type_code IN ('TFlt','TDrp','TPOut','TPIn','TVar','CRem')
  AND s.seq_is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq x
                  WHERE x.seq_vchr_type_id = t.vchr_type_id AND x.seq_company_id = s.seq_company_id
                    AND x.seq_branch_id = s.seq_branch_id AND x.seq_acc_year = s.seq_acc_year
                    AND x.seq_device_code = s.seq_device_code AND x.seq_period_key = s.seq_period_key);

-- ── 10.3 settings (precedence GLOBAL < COMPANY < BRANCH < DEVICE < USER) ──
--  Approval THRESHOLDS are not settings — they are till_approval_rule rows.
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT v.asd_key, v.asd_module, v.asd_group, v.asd_data_type, v.asd_default_value, v.asd_allowed_values::jsonb,
       v.asd_max_scope, v.asd_label, v.asd_description, v.asd_sort_order, 'system' FROM (VALUES
 ('till.require_session',      'TILL', 'Session', 'BOOL',    'true',  NULL, 'DEVICE',
  'Billing needs an open till session', 'false only for back-office devices that never take money.', 10),
 ('till.day_cutoff',           'TILL', 'Day',     'TEXT',    '04:00', NULL, 'BRANCH',
  'Business day cut-off (HH:MM)', 'Sales before this time belong to the previous business date.', 11),
 ('till.day_auto_open',        'TILL', 'Day',     'BOOL',    'true',  NULL, 'BRANCH',
  'First session opens the business day', 'false = a manager must Day Open before any session.', 12),
 ('till.float_mode',           'TILL', 'Session', 'TEXT',    'ISSUED', '["ISSUED","CARRIED"]', 'BRANCH',
  'Opening float', 'ISSUED = counted out of the safe each session; CARRIED = the previous close left it in the drawer.', 13),
 ('till.handover_mode',        'TILL', 'Session', 'TEXT',    'FULL_CLOSE', '["FULL_CLOSE","HANDOVER_COUNT"]', 'BRANCH',
  'Shift change on one counter', 'FULL_CLOSE = drawer to the safe, new float; HANDOVER_COUNT = both cashiers count, the count is the next opening.', 14),
 ('till.blind_close',          'TILL', 'Close',   'BOOL',    'true',  NULL, 'BRANCH',
  'Blind close', 'The cashier counts without seeing what the system expects.', 15),
 ('till.max_recounts',         'TILL', 'Close',   'INT',     '1',     NULL, 'BRANCH',
  'Recounts allowed before the variance stands', 'Each attempt is kept. Over this needs RECOUNT approval.', 16),
 ('till.count_place',          'TILL', 'Close',   'TEXT',    'COUNTER', '["COUNTER","CASH_OFFICE"]', 'BRANCH',
  'Where the close count happens', 'CASH_OFFICE = the cashier ends billing and hands the sealed drawer over.', 17),
 ('till.close_witness',        'TILL', 'Close',   'BOOL',    'false', NULL, 'BRANCH',
  'Close count needs a witness', 'A second person signs the count.', 18),
 ('till.cash_tolerance',       'TILL', 'Close',   'DECIMAL', '10',    NULL, 'BRANCH',
  'Cash variance auto-accepted up to', 'Within it: WITHIN_TOLERANCE, posted to short & excess with no approval.', 19),
 ('till.noncash_tolerance',    'TILL', 'Close',   'DECIMAL', '0',     NULL, 'BRANCH',
  'Non-cash variance auto-accepted up to', 'Non-cash gaps are normally a wrong tender: fix by re-tender.', 20),
 ('till.close_with_holds',     'TILL', 'Close',   'TEXT',    'RELEASE', '["BLOCK","RELEASE"]', 'BRANCH',
  'Held bills at close', 'RELEASE = the holds go to the branch pool, any counter resumes them; BLOCK = close refused.', 21),
 ('till.variance_default',     'TILL', 'Close',   'TEXT',    'EXPENSE', '["EXPENSE","RECOVER","SUSPENSE"]', 'COMPANY',
  'Default treatment of an approved cash variance', 'The approver may change it per variance.', 22),
 ('till.idle_lock_minutes',    'TILL', 'Session', 'INT',     '0',     NULL, 'DEVICE',
  'Lock the till after idle minutes', '0 = off. Locked = SUSPENDED until the same cashier (or a supervisor) unlocks.', 23),
 ('till.session_max_hours',    'TILL', 'Session', 'INT',     '14',    NULL, 'BRANCH',
  'Session open longer than (hours) is flagged', 'Shows on the cockpit; a candidate for force close.', 24),
 ('till.day_close_safe_count', 'TILL', 'Day',     'BOOL',    'true',  NULL, 'BRANCH',
  'Day close needs a safe count', '', 25),
 ('till.no_sale_reason',       'TILL', 'Session', 'BOOL',    'true',  NULL, 'BRANCH',
  'No-sale drawer open needs a reason', '', 26),
 ('till.single_operator',      'TILL', 'Session', 'BOOL',    'false', NULL, 'BRANCH',
  'One person runs the shop', 'true = every approval rule allows self-approval (snapshotted onto tap_self_allowed), so the owner-cashier is never blocked by a second-person rule. Pair with blind_close=false and float_mode=CARRIED.', 9)
) AS v(asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order)
ON CONFLICT (asd_key) DO NOTHING;

-- ── 10.4 shipped reasons (company NULL = shared) ─────────────────────────
INSERT INTO accounts.till_reason (trs_company_id, trs_category, trs_code, trs_name, trs_needs_note, trs_needs_ref, trs_sort_order, trs_created_by)
SELECT NULL, v.c, v.k, v.n, v.note, v.ref, v.s, 'system' FROM (VALUES
 ('VARIANCE','COUNT_ERROR','Counting error',false,false,10), ('VARIANCE','CHANGE_GIVEN','Wrong change given',false,false,20),
 ('VARIANCE','WRONG_TENDER','Wrong tender keyed',false,false,30), ('VARIANCE','UNRECORDED_SALE','Sale not billed',true,false,40),
 ('VARIANCE','FAKE_NOTE','Counterfeit note',true,false,50), ('VARIANCE','SYSTEM','System error',true,false,60),
 ('VARIANCE','SUSPECTED_THEFT','Suspected theft',true,false,70), ('VARIANCE','UNKNOWN','Unknown',true,false,99),
 ('FLOAT_MISMATCH','SAFE_SHORT','Safe gave less',false,false,10), ('FLOAT_MISMATCH','PREV_SHORT','Previous drawer short',false,false,20),
 ('FLOAT_MISMATCH','UNKNOWN','Unknown',true,false,99),
 ('PAID_OUT','PETTY_EXPENSE','Petty expense',false,true,10), ('PAID_OUT','SUPPLIER','Supplier COD payment',false,true,20),
 ('PAID_OUT','STAFF_ADVANCE','Staff advance',true,false,30), ('PAID_OUT','FREIGHT','Freight / porter',false,false,40),
 ('PAID_OUT','OTHER','Other',true,false,99),
 ('PAID_IN','MISC_INCOME','Miscellaneous income',true,false,10), ('PAID_IN','SCRAP','Scrap / carton sale',false,false,20),
 ('PAID_IN','STAFF_RETURN','Staff advance returned',true,false,30), ('PAID_IN','OTHER','Other',true,false,99),
 ('PICKUP','CASH_LIMIT','Cash over limit',false,false,10), ('PICKUP','SCHEDULED','Scheduled pickup',false,false,20),
 ('PICKUP','SECURITY','Security',false,false,30),
 ('NO_SALE','CHANGE','Change for customer',false,false,10), ('NO_SALE','CHECK_DRAWER','Check drawer',false,false,20),
 ('NO_SALE','OTHER','Other',true,false,99),
 ('SUSPEND','BREAK','Break',false,false,10), ('SUSPEND','MEAL','Meal',false,false,20), ('SUSPEND','HELP','Helping floor',false,false,30),
 ('FORCE_CLOSE','ABSENT','Cashier left / absent',true,false,10), ('FORCE_CLOSE','DEVICE_DEAD','Device failure',true,false,20),
 ('FORCE_CLOSE','OTHER','Other',true,false,99),
 ('REOPEN','MISSED_TXN','Transaction missed before close',true,false,10), ('REOPEN','COUNT_ERROR','Count keyed wrong',true,false,20),
 ('SESSION_VOID','OPENED_IN_ERROR','Opened in error',false,false,10),
 ('MOVEMENT_VOID','KEYED_WRONG','Keyed wrong',true,false,10), ('MOVEMENT_VOID','DUPLICATE','Duplicate',false,false,20),
 ('DAY_REOPEN','LATE_TXN','Late transaction',true,false,10), ('DAY_REOPEN','CORRECTION','Correction',true,false,20)
) AS v(c, k, n, note, ref, s)
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_reason r
                  WHERE r.trs_company_id IS NULL AND upper(r.trs_code) = v.k AND r.trs_is_deleted = false
                    -- 48 renames PAID_OUT → EXPENSE: a re-run of 47 after 48 must not re-seed it
                    AND r.trs_category IN (v.c, CASE WHEN v.c = 'PAID_OUT' THEN 'EXPENSE' END));

-- ── 10.5 INR denominations ───────────────────────────────────────────────
INSERT INTO accounts.till_denomination (tdn_company_id, tdn_currency, tdn_value, tdn_kind, tdn_label, tdn_bundle_qty, tdn_sort_order, tdn_created_by)
SELECT NULL, 'INR', v.val, v.k, v.l, v.b, v.s, 'system' FROM (VALUES
 (500.00,'NOTE','₹500',100,10), (200.00,'NOTE','₹200',100,20), (100.00,'NOTE','₹100',100,30),
 (50.00,'NOTE','₹50',100,40),   (20.00,'NOTE','₹20',100,50),   (10.00,'NOTE','₹10',100,60),
 (20.00,'COIN','₹20 coin',0,70), (10.00,'COIN','₹10 coin',0,80), (5.00,'COIN','₹5',0,90),
 (2.00,'COIN','₹2',0,100),       (1.00,'COIN','₹1',0,110)
) AS v(val, k, l, b, s)
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_denomination d
                  WHERE d.tdn_company_id IS NULL AND d.tdn_currency = 'INR' AND d.tdn_value = v.val
                    AND d.tdn_kind = v.k AND d.tdn_is_deleted = false);

-- ── 10.6 shipped approval rules (company/branch NULL; override per company/branch)
INSERT INTO accounts.till_approval_rule
    (tar_company_id, tar_branch_id, tar_event_code, tar_mode, tar_threshold_amount, tar_threshold_count,
     tar_channel, tar_min_role, tar_two_person, tar_allow_self, tar_blocks_till, tar_remarks, tar_created_by)
SELECT NULL, NULL, v.e, v.m, v.amt, v.cnt, v.ch, v.r, v.two, false, v.blk, v.rem, 'system' FROM (VALUES
 ('FLOAT_MISMATCH',      'OVER_AMOUNT',    0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  'any opening difference'),
 ('CASH_VARIANCE',       'OVER_AMOUNT',   10, 0, 'EITHER',  'SUPERVISOR',    false, true,  'beyond till.cash_tolerance; authority amount decides the level'),
 ('NONCASH_VARIANCE',    'OVER_AMOUNT',    0, 0, 'EITHER',  'STORE_MANAGER', false, true,  'non-cash gaps should be re-tendered first'),
 ('PAID_OUT',            'OVER_AMOUNT',  500, 0, 'COUNTER', 'SUPERVISOR',    false, true,  ''),
 ('PAID_IN',             'NEVER',          0, 0, 'COUNTER', 'SUPERVISOR',    false, false, ''),
 ('PICKUP',              'ALWAYS',         0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  'the supervisor taking it IS the approver; cashier witnesses'),
 ('TOP_UP',              'ALWAYS',         0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  ''),
 ('NO_SALE',             'OVER_COUNT',     0, 3, 'COUNTER', 'SUPERVISOR',    false, true,  'first 3 per session free, logged'),
 ('CASH_LIMIT_OVERRIDE', 'ALWAYS',         0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  'bill past tcn_cash_block_limit'),
 ('SUSPEND_LONG',        'NEVER',          0, 0, 'EITHER',  'SUPERVISOR',    false, false, ''),
 ('FORCE_CLOSE',         'ALWAYS',         0, 0, 'EITHER',  'STORE_MANAGER', false, true,  ''),
 ('SESSION_REOPEN',      'ALWAYS',         0, 0, 'EITHER',  'STORE_MANAGER', false, true,  ''),
 ('SESSION_VOID',        'ALWAYS',         0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  'only when nothing was written in it'),
 ('MOVEMENT_VOID',       'ALWAYS',         0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  ''),
 ('RECOUNT',             'OVER_COUNT',     0, 1, 'COUNTER', 'SUPERVISOR',    false, true,  'past till.max_recounts'),
 ('DAY_CLOSE_EXCEPTION', 'ALWAYS',         0, 0, 'EITHER',  'STORE_MANAGER', false, true,  'pending variance / approval / force close in the day'),
 ('DAY_REOPEN',          'ALWAYS',         0, 0, 'EITHER',  'AREA_MANAGER',  false, true,  'EITHER: a store cut off from the internet can still reopen with the area manager on site'),
 ('SAFE_VARIANCE',       'OVER_AMOUNT',    0, 0, 'EITHER',  'STORE_MANAGER', true,  true,  'two-person on the safe'),
 ('REMITTANCE',          'NEVER',          0, 0, 'COUNTER', 'CASH_OFFICE',   false, false, ''),
 ('COUNTER_RELINK',      'ALWAYS',         0, 0, 'COUNTER', 'SUPERVISOR',    false, true,  'link a counter to this device (dead PC) or move a live session to it')
) AS v(e, m, amt, cnt, ch, r, two, blk, rem)
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_approval_rule x
                  WHERE x.tar_company_id IS NULL AND x.tar_branch_id IS NULL AND x.tar_is_deleted = false
                    -- 48 renames PAID_OUT → EXPENSE: a re-run of 47 after 48 must not re-seed it
                    AND x.tar_event_code IN (v.e, CASE WHEN v.e = 'PAID_OUT' THEN 'EXPENSE' END));


-- ═══════════════════════════════════════════════════════════════════════════
--  §11  PARTITIONS — the year roll, and the years that exist today
-- ═══════════════════════════════════════════════════════════════════════════
--  public.ensure_acc_year_partitions is the helper deploy.sh calls for the
--  current and next FY on every run, and the one receipt.guards.ts names to an
--  operator. It is restated from the live definition (= 20260922100000) with
--  the nine till tables added before the stock call, parent before child:
--  day → session → variance, count → count line. See difference 4.
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

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

DO $partitions$
DECLARE
    v_year text;
    t      text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT y FROM (
            SELECT '2026-2027'::text AS y
            UNION
            SELECT btrim(fy_year_name) FROM public.fiscal_years WHERE is_deleted = false
            UNION
            SELECT replace(substring(c.relname from '([0-9]{4}_[0-9]{4})$'), '_', '-')
              FROM pg_class c
              JOIN pg_inherits i ON i.inhrelid = c.oid
              JOIN pg_class    p ON p.oid      = i.inhparent
             WHERE p.relname = 'sale_bill'
               AND c.relname ~ '[0-9]{4}_[0-9]{4}$'
        ) s
        WHERE y ~ '^[0-9]{4}-[0-9]{4}$'
        ORDER BY 1
    LOOP
        FOREACH t IN ARRAY ARRAY['till_business_day','till_session','till_count','till_count_line',
                                 'till_cash_movement','till_variance','till_approval','till_event',
                                 'till_session_review'] LOOP
            EXECUTE format('CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.%I FOR VALUES IN (%L)',
                           t || '_' || replace(v_year, '-', '_'), t, v_year);
        END LOOP;
    END LOOP;
END $partitions$;
