-- Rebuild of the accounts voucher subsystem, replacing the tables dropped in
-- 20260805130000. Six tables:
--
--   acc_voucher_header    voucher head, partitioned by acc_year
--   acc_bills             one row per bill, never partitioned
--   acc_vouchers          double-entry ledger rows, partitioned by acc_year
--   acc_opening_balance   per-ledger opening balance per FY
--   acc_bill_adjustment   settlement rows against a bill
--   acc_pdc_register      post-dated instruments, never partitioned
--
-- Creation order differs from the source script: acc_bills is created BEFORE
-- acc_vouchers because acc_vouchers.fk_av_bill references it.
--
-- NOT included (the source script was truncated before them): the vw_pdc_due
-- view, accounts.fn_recalc_bill(uuid), and the triggers that maintain
-- acc_bills.abl_alloc_amount / abl_disc_amount / abl_writeoff_amount.

-- ───────────────────────────────────────────────────────────────────────────
--  Voucher header
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_voucher_header
(
    avh_voucher_id        uuid           NOT NULL DEFAULT uuidv7(),
    avh_company_id        uuid           NOT NULL,
    avh_branch_id         uuid           NOT NULL,
    avh_tenant_id         uuid,
    avh_acc_year          character(9)   NOT NULL,

    avh_voucher_type_id   integer        NOT NULL,
    -- Nullable on purpose: a draft must not consume a number, or an
    -- abandoned entry leaves a permanent gap in the series.
    avh_voucher_no        bigint,
    avh_voucher_slno      bigint,
    avh_voucher_refno     character varying(50),
    avh_voucher_date      timestamp(6) with time zone NOT NULL,

    -- ── Source document ──────────────────────────────────────────────────
    avh_src_module        character varying(20),
    avh_src_doc_type      character varying(30),
    avh_src_doc_id        uuid,
    avh_usr_refno         character varying(100),
    avh_doc_refno         character varying(100),
    avh_doc_date          date,
    avh_doc_amount        numeric(18,2)  NOT NULL DEFAULT 0,

    avh_adjust_amount     numeric(18,2)  NOT NULL DEFAULT 0,
    avh_round_off         numeric(18,2)  NOT NULL DEFAULT 0,
    avh_total_debit       numeric(18,2)  NOT NULL DEFAULT 0,
    avh_total_credit      numeric(18,2)  NOT NULL DEFAULT 0,

    avh_party_id          uuid           NOT NULL,
    avh_opposite_ledger_id uuid,
    avh_employee_id       uuid[],
    avh_remarks           text,

    -- ── Document lineage ─────────────────────────────────────────────────
    avh_against_voucher_id  uuid,
    avh_against_acc_year    character(9),
    avh_reversal_voucher_id uuid,
    avh_reversal_acc_year   character(9),

    -- ── Lifecycle ────────────────────────────────────────────────────────
    avh_voucher_status    character varying(20) NOT NULL DEFAULT 'DRAFT',
    avh_status_on         timestamp(6) with time zone,
    avh_status_by         uuid,
    avh_posted_on         timestamp(6) with time zone,
    avh_cancel_reason     character varying(250),

    -- ── Where / who ──────────────────────────────────────────────────────
    avh_user_id           uuid           NOT NULL,
    avh_session_id        uuid,
    avh_device_type       character varying(20),
    avh_device_id         text,
    avh_print_count       integer NOT NULL DEFAULT 0,

    -- ── Outbound / export status ─────────────────────────────────────────
    avh_whatsapp_status   character varying(10) NOT NULL DEFAULT 'NA',
    avh_sms_status        character varying(10) NOT NULL DEFAULT 'NA',
    avh_tally_export_status character varying(10) NOT NULL DEFAULT 'PENDING',
    avh_tally_exported_on timestamp(6) with time zone,
    avh_tally_guid        character varying(100),
    avh_tally_error_msg   text,

    -- ── Audit ────────────────────────────────────────────────────────────
    avh_is_active         boolean NOT NULL DEFAULT true,
    avh_is_deleted        boolean NOT NULL DEFAULT false,
    avh_sync_date         timestamp(6) with time zone,
    avh_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    avh_created_by        character varying(50),
    avh_modified_on       timestamp(6) with time zone,
    avh_modified_by       character varying(50),

    CONSTRAINT pk_acc_voucher_header PRIMARY KEY (avh_voucher_id, avh_acc_year),

    CONSTRAINT fk_avh_company FOREIGN KEY (avh_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_branch FOREIGN KEY (avh_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_voucher_type FOREIGN KEY (avh_voucher_type_id)
        REFERENCES accounts.acc_voucher_types (vchr_type_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_party FOREIGN KEY (avh_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_opp_ledger FOREIGN KEY (avh_opposite_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_user FOREIGN KEY (avh_user_id)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_against FOREIGN KEY (avh_against_voucher_id, avh_against_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_avh_reversal FOREIGN KEY (avh_reversal_voucher_id, avh_reversal_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_avh_status CHECK (avh_voucher_status::text = ANY (ARRAY[
        'DRAFT'::text, 'APPROVED'::text, 'POSTED'::text, 'CANCELLED'::text])),
    CONSTRAINT ck_avh_device_type CHECK (avh_device_type IS NULL OR
        avh_device_type::text = ANY (ARRAY[
            'PC'::text, 'WEB'::text, 'MOBILE'::text, 'POS'::text])),
    CONSTRAINT ck_avh_msg_status CHECK (
        avh_whatsapp_status::text = ANY (ARRAY['NA'::text,'PENDING'::text,'SENT'::text,'FAILED'::text]) AND
        avh_sms_status::text      = ANY (ARRAY['NA'::text,'PENDING'::text,'SENT'::text,'FAILED'::text])),
    CONSTRAINT ck_avh_tally_status CHECK (avh_tally_export_status::text = ANY (ARRAY[
        'NA'::text, 'PENDING'::text, 'EXPORTED'::text, 'FAILED'::text])),
    CONSTRAINT ck_avh_amounts CHECK (
        avh_doc_amount >= 0 AND avh_adjust_amount >= 0 AND
        avh_total_debit >= 0 AND avh_total_credit >= 0 AND avh_print_count >= 0),
    CONSTRAINT ck_avh_tally_consistency CHECK (
        avh_tally_export_status <> 'EXPORTED' OR avh_tally_exported_on IS NOT NULL),

    CONSTRAINT ck_avh_acc_year CHECK (
        avh_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(avh_acc_year, 4)::int = LEFT(avh_acc_year, 4)::int + 1),
    CONSTRAINT ck_avh_against_year CHECK (
        avh_against_acc_year IS NULL
        OR (avh_against_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
            AND RIGHT(avh_against_acc_year, 4)::int = LEFT(avh_against_acc_year, 4)::int + 1)),
    CONSTRAINT ck_avh_reversal_year CHECK (
        avh_reversal_acc_year IS NULL
        OR (avh_reversal_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
            AND RIGHT(avh_reversal_acc_year, 4)::int = LEFT(avh_reversal_acc_year, 4)::int + 1)),

    -- ── Lifecycle rules ──────────────────────────────────────────────────

    -- A draft has no number; anything past draft must have one.
    CONSTRAINT ck_avh_no CHECK (
        avh_voucher_status::text = 'DRAFT'
        OR (avh_voucher_no > 0 AND avh_voucher_slno > 0
            AND avh_voucher_refno IS NOT NULL)),

    -- The double-entry guarantee. acc_vouchers cannot enforce this on its
    -- own; the header carries the totals, so it enforces it here.
    CONSTRAINT ck_avh_balanced CHECK (
        avh_voucher_status::text <> 'POSTED'
        OR avh_total_debit = avh_total_credit),

    CONSTRAINT ck_avh_posted_on CHECK (
        avh_voucher_status::text <> 'POSTED' OR avh_posted_on IS NOT NULL),

    -- Anything past draft must say when and by whom.
    CONSTRAINT ck_avh_status_on CHECK (
        avh_voucher_status::text = 'DRAFT'
        OR (avh_status_on IS NOT NULL AND avh_status_by IS NOT NULL)),

    -- Cancellation must carry a reason. MCA Rule 3(1) audit trail.
    CONSTRAINT ck_avh_cancel CHECK (
        avh_voucher_status::text <> 'CANCELLED'
        OR avh_cancel_reason IS NOT NULL),

    -- Source document is all three machine columns or none.
    CONSTRAINT ck_avh_src CHECK (
        (avh_src_doc_id IS NULL AND avh_src_module IS NULL AND avh_src_doc_type IS NULL)
        OR (avh_src_doc_id IS NOT NULL AND avh_src_module IS NOT NULL
            AND avh_src_doc_type IS NOT NULL)),

    CONSTRAINT ck_avh_self CHECK (
        avh_against_voucher_id IS NULL OR avh_against_voucher_id <> avh_voucher_id)
) PARTITION BY LIST (avh_acc_year);

ALTER TABLE IF EXISTS accounts.acc_voucher_header OWNER to postgres;

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Unique indexes on a partitioned table must carry the partition key.

CREATE UNIQUE INDEX ux_avh_voucher_no ON accounts.acc_voucher_header (
    avh_company_id, avh_branch_id, avh_voucher_type_id, avh_acc_year, avh_voucher_no
) WHERE avh_is_deleted = false AND avh_voucher_status <> 'DRAFT';

CREATE UNIQUE INDEX ux_avh_voucher_slno ON accounts.acc_voucher_header (
    avh_company_id, avh_acc_year, avh_voucher_slno
) WHERE avh_is_deleted = false AND avh_voucher_status <> 'DRAFT';

-- Posting idempotency: one voucher per source document.
CREATE UNIQUE INDEX ux_avh_src ON accounts.acc_voucher_header (
    avh_company_id, avh_src_module, avh_src_doc_type, avh_src_doc_id, avh_acc_year
) WHERE avh_src_doc_id IS NOT NULL AND avh_is_deleted = false
    AND avh_voucher_status <> 'CANCELLED';

-- Duplicate supplier invoice guard.
CREATE UNIQUE INDEX ux_avh_doc_refno ON accounts.acc_voucher_header (
    avh_company_id, avh_party_id, avh_voucher_type_id, avh_acc_year, avh_doc_refno
) WHERE avh_doc_refno IS NOT NULL AND avh_is_deleted = false
    AND avh_voucher_status <> 'CANCELLED';

-- Day book, branch register. Posted only — that is what a register means.
CREATE INDEX ix_avh_daybook ON accounts.acc_voucher_header (
    avh_company_id, avh_branch_id, avh_voucher_date
) INCLUDE (avh_voucher_type_id, avh_voucher_no, avh_party_id, avh_doc_amount)
  WHERE avh_is_deleted = false AND avh_voucher_status = 'POSTED';

-- Party statement, outstanding drill-down.
CREATE INDEX ix_avh_party ON accounts.acc_voucher_header (
    avh_company_id, avh_party_id, avh_voucher_date
) WHERE avh_is_deleted = false AND avh_voucher_status = 'POSTED';

-- "Find that supplier bill" search box.
CREATE INDEX ix_avh_doc_lookup ON accounts.acc_voucher_header (
    avh_company_id, avh_doc_refno
) WHERE avh_doc_refno IS NOT NULL AND avh_is_deleted = false;

-- "Resume my unfinished entry" on the receipt screen.
CREATE INDEX ix_avh_my_draft ON accounts.acc_voucher_header (
    avh_company_id, avh_user_id, avh_created_on DESC
) WHERE avh_voucher_status = 'DRAFT' AND avh_is_deleted = false;

-- Approval / posting worklist.
CREATE INDEX ix_avh_pending ON accounts.acc_voucher_header (
    avh_company_id, avh_branch_id, avh_voucher_status, avh_voucher_date
) WHERE avh_voucher_status IN ('DRAFT','APPROVED') AND avh_is_deleted = false;

-- Tally export queue.
CREATE INDEX ix_avh_tally_pending ON accounts.acc_voucher_header (
    avh_company_id, avh_voucher_date
) WHERE avh_tally_export_status IN ('PENDING','FAILED')
    AND avh_voucher_status = 'POSTED' AND avh_is_deleted = false;

-- WhatsApp / SMS dispatch queue.
CREATE INDEX ix_avh_msg_pending ON accounts.acc_voucher_header (
    avh_company_id, avh_created_on
) WHERE (avh_whatsapp_status = 'PENDING' OR avh_sms_status = 'PENDING')
    AND avh_is_deleted = false;

-- Credit note / debit note lineage.
CREATE INDEX ix_avh_against ON accounts.acc_voucher_header (
    avh_against_voucher_id, avh_against_acc_year
) WHERE avh_against_voucher_id IS NOT NULL;

-- avh_employee_id is an array, so it needs GIN to be searchable at all.
CREATE INDEX ix_avh_employee ON accounts.acc_voucher_header
    USING GIN (avh_employee_id) WHERE avh_employee_id IS NOT NULL;

-- ── Partitions (no DEFAULT: a bad acc_year must fail loudly) ───────────────
CREATE TABLE IF NOT EXISTS accounts.acc_voucher_header_2026_2027
    PARTITION OF accounts.acc_voucher_header FOR VALUES IN ('2026-2027');

COMMENT ON COLUMN accounts.acc_voucher_header.avh_voucher_refno IS
    'Our own number, assigned at POSTED. NULL while the entry is a draft so an abandoned draft leaves no gap in the series.';
COMMENT ON COLUMN accounts.acc_voucher_header.avh_doc_refno IS
    'The external or source document number: supplier invoice on a purchase, sale invoice number on a posted sale, deposit slip on a bank receipt. NULL when no external document exists.';
COMMENT ON COLUMN accounts.acc_voucher_header.avh_doc_amount IS
    'Face value of the source document. Differs from total_debit when the voucher carries round-off or partial settlement.';
COMMENT ON COLUMN accounts.acc_voucher_header.avh_voucher_slno IS
    'Company-wide running serial across all voucher types, for gap detection. avh_voucher_no is the per-type number the user sees.';


-- ───────────────────────────────────────────────────────────────────────────
--  Bills
--
--  Created before acc_vouchers: acc_vouchers.fk_av_bill points here.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_bills
(
    abl_id                uuid           NOT NULL DEFAULT uuidv7(),
    abl_company_id        uuid           NOT NULL,
    abl_branch_id         uuid           NOT NULL,   -- branch that RAISED it
    abl_tenant_id         uuid,
    abl_acc_year          character(9)   NOT NULL,   -- FY of origin, filter only

    -- ── Party ────────────────────────────────────────────────────────────
    abl_party_id          uuid           NOT NULL,
    abl_salesman_id       uuid,
    abl_agent_id          uuid,

    -- ── Source document ──────────────────────────────────────────────────
    abl_bill_type         character varying(20) NOT NULL,
    abl_voucher_id        uuid,                      -- NULL for OPENING
    abl_voucher_line_id   uuid,
    abl_voucher_type_id   integer NOT NULL,
    abl_voucher_no        bigint,
    abl_doc_date          date,
    abl_doc_refno         character varying(50),

    -- ── Bill identity ────────────────────────────────────────────────────
    abl_bill_refno        character varying(100) NOT NULL,
    abl_bill_date         date           NOT NULL,
    abl_due_date          date,
    abl_credit_days       smallint       NOT NULL DEFAULT 0,
    abl_grace_days        smallint       NOT NULL DEFAULT 0,
    abl_dr_cr             character(2)   NOT NULL,   -- DR = receivable, CR = payable
    abl_narration         text,

    -- ── Amounts (settled columns are trigger-maintained) ─────────────────
    abl_bill_amount       numeric(18,2)  NOT NULL,
    abl_alloc_amount      numeric(18,2)  NOT NULL DEFAULT 0,
    abl_disc_amount       numeric(18,2)  NOT NULL DEFAULT 0,
    abl_writeoff_amount   numeric(18,2)  NOT NULL DEFAULT 0,
    abl_pending_amount    numeric(18,2)
        GENERATED ALWAYS AS (abl_bill_amount - abl_alloc_amount
                             - abl_disc_amount - abl_writeoff_amount) STORED,

    -- ── Audit ────────────────────────────────────────────────────────────
    abl_is_active         boolean NOT NULL DEFAULT true,
    abl_is_deleted        boolean NOT NULL DEFAULT false,
    abl_sync_date         timestamp(6) with time zone,
    abl_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    abl_created_by        varchar(50),
    abl_modified_on       timestamp(6) with time zone,
    abl_modified_by       varchar(50),

    CONSTRAINT pk_acc_bills PRIMARY KEY (abl_id),

    CONSTRAINT fk_abl_voucher FOREIGN KEY (abl_voucher_id, abl_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abl_voucher_type FOREIGN KEY (abl_voucher_type_id)
        REFERENCES accounts.acc_voucher_types (vchr_type_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abl_party FOREIGN KEY (abl_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_abl_bill_type CHECK (abl_bill_type::text = ANY (ARRAY[
        'SALES'::text, 'PURCHASE'::text, 'OPENING'::text,
        'ADVANCE'::text, 'INTEREST'::text])),
    CONSTRAINT ck_abl_dr_cr     CHECK (abl_dr_cr = ANY (ARRAY['DR'::bpchar, 'CR'::bpchar])),

    CONSTRAINT ck_abl_acc_year  CHECK (
        abl_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(abl_acc_year, 4)::int = LEFT(abl_acc_year, 4)::int + 1),

    -- OPENING has no source voucher; every other type must have one.
    CONSTRAINT ck_abl_voucher   CHECK (
        (abl_bill_type::text = 'OPENING' AND abl_voucher_id IS NULL)
        OR (abl_bill_type::text <> 'OPENING' AND abl_voucher_id IS NOT NULL)),

    CONSTRAINT ck_abl_amount    CHECK (abl_bill_amount > 0),
    CONSTRAINT ck_abl_due_date  CHECK (abl_due_date IS NULL OR abl_due_date >= abl_bill_date),

    -- The over-settlement guard: a bill can never be edited down below what
    -- has already been settled, discounted or written off against it.
    CONSTRAINT ck_abl_settled   CHECK (
        abl_alloc_amount >= 0 AND abl_disc_amount >= 0 AND abl_writeoff_amount >= 0
        AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <= abl_bill_amount)
);

ALTER TABLE IF EXISTS accounts.acc_bills OWNER to postgres;

-- Bill numbers restart each FY, so the FY is part of the key.
CREATE UNIQUE INDEX ux_abl_bill_refno ON accounts.acc_bills (
    abl_company_id, abl_party_id, abl_bill_type, abl_acc_year, abl_bill_refno
) WHERE abl_is_deleted = false;

-- Adjustment screen and ageing report both live on this index.
-- No branch column: outstanding is company-wide for a chain store.
CREATE INDEX ix_abl_open ON accounts.acc_bills (
    abl_company_id, abl_party_id, abl_bill_date
) INCLUDE (abl_bill_refno, abl_bill_amount, abl_pending_amount, abl_dr_cr)
  WHERE abl_is_deleted = false AND abl_pending_amount <> 0;

CREATE INDEX ix_abl_overdue ON accounts.acc_bills (abl_company_id, abl_due_date)
    WHERE abl_is_deleted = false AND abl_pending_amount <> 0;

CREATE INDEX ix_abl_voucher ON accounts.acc_bills (abl_voucher_id, abl_acc_year)
    WHERE abl_voucher_id IS NOT NULL AND abl_is_deleted = false;

CREATE INDEX ix_abl_salesman ON accounts.acc_bills (abl_company_id, abl_salesman_id)
    WHERE abl_is_deleted = false AND abl_pending_amount <> 0;

COMMENT ON TABLE accounts.acc_bills IS
    'One row per bill. Never partitioned and never carried forward at year end — the same row simply stays open across financial years.';
COMMENT ON COLUMN accounts.acc_bills.abl_acc_year IS
    'FY the bill originated in. Reporting filter only, never a partition key.';
COMMENT ON COLUMN accounts.acc_bills.abl_branch_id IS
    'Branch that raised the bill. Settlement may happen at a different branch — that is recorded on the adjustment table.';
COMMENT ON COLUMN accounts.acc_bills.abl_alloc_amount IS
    'Trigger-maintained from the adjustment table. Never write from application code.';


-- ───────────────────────────────────────────────────────────────────────────
--  Ledger rows (double entry)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_vouchers
(
    av_id                 uuid           NOT NULL DEFAULT uuidv7(),
    av_voucher_id         uuid           NOT NULL,
    av_company_id         uuid           NOT NULL,
    av_branch_id          uuid           NOT NULL,
    av_tenant_id          uuid,
    av_acc_year           character(9)   NOT NULL,
    av_voucher_type_id    integer        NOT NULL,
    av_voucher_no         bigint         NOT NULL,
    av_row_no             integer        NOT NULL,
    av_voucher_date       timestamp(6) with time zone NOT NULL,
    av_voucher_refno      character varying(50),
    av_doc_date           date,                      -- source document date
    av_bill_date          timestamp(6) with time zone,
    av_bill_refno         character varying(100),
    av_bill_id            uuid,                      -- hard link to acc_bills

    av_dr_cr              character(2)   NOT NULL,
    av_ledger_id          uuid           NOT NULL,
    av_opp_ledger_id      uuid           NOT NULL,
    av_amount             numeric(18,2)  NOT NULL DEFAULT 0,
    av_signed_amount      numeric(18,2)
        GENERATED ALWAYS AS (CASE WHEN av_dr_cr = 'DR' THEN av_amount
                                  ELSE -av_amount END) STORED,
    av_cost_centre_id     uuid,                      -- FK once the master exists
    av_remarks            text,
    av_session_id         uuid,
    av_user_id            uuid           NOT NULL,

    -- ── Bank / cash reconciliation ───────────────────────────────────────
    av_recon_date         date,
    av_recon_refno        character varying(50),
    av_is_reconciled      boolean
        GENERATED ALWAYS AS (av_recon_date IS NOT NULL) STORED,

    -- ── Audit ────────────────────────────────────────────────────────────
    av_is_active          boolean NOT NULL DEFAULT true,
    av_is_deleted         boolean NOT NULL DEFAULT false,
    av_sync_date          timestamp(6) with time zone,
    av_created_on         timestamp(6) with time zone NOT NULL DEFAULT now(),
    av_created_by         uuid,
    av_modified_on        timestamp(6) with time zone,
    av_modified_by        uuid,

    CONSTRAINT pk_acc_vouchers PRIMARY KEY (av_id, av_acc_year),

    CONSTRAINT fk_av_header FOREIGN KEY (av_voucher_id, av_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_av_ledger FOREIGN KEY (av_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_av_opp_ledger FOREIGN KEY (av_opp_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_av_voucher_type FOREIGN KEY (av_voucher_type_id)
        REFERENCES accounts.acc_voucher_types (vchr_type_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_av_bill FOREIGN KEY (av_bill_id)
        REFERENCES accounts.acc_bills (abl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_av_dr_cr  CHECK (av_dr_cr = ANY (ARRAY['DR'::bpchar, 'CR'::bpchar])),
    CONSTRAINT ck_av_amount CHECK (av_amount > 0),
    CONSTRAINT ck_av_row_no CHECK (av_row_no >= 1),
    CONSTRAINT ck_av_acc_year CHECK (
        av_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(av_acc_year, 4)::int = LEFT(av_acc_year, 4)::int + 1),
    CONSTRAINT ck_av_self CHECK (av_opp_ledger_id IS NULL
                              OR av_opp_ledger_id <> av_ledger_id),
    CONSTRAINT ck_av_recon CHECK (av_recon_refno IS NULL OR av_recon_date IS NOT NULL)
) PARTITION BY LIST (av_acc_year);

ALTER TABLE IF EXISTS accounts.acc_vouchers OWNER to postgres;

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Unique indexes on a partitioned table must carry the partition key.
CREATE UNIQUE INDEX ux_av_voucher_row ON accounts.acc_vouchers (
    av_voucher_id, av_acc_year, av_row_no
) WHERE av_is_deleted = false;

-- The single most important index here: ledger statement and trial balance.
CREATE INDEX ix_av_ledger ON accounts.acc_vouchers (
    av_company_id, av_ledger_id, av_voucher_date
) INCLUDE (av_dr_cr, av_amount, av_signed_amount, av_voucher_no)
  WHERE av_is_deleted = false;

CREATE INDEX ix_av_voucher ON accounts.acc_vouchers (av_voucher_id, av_acc_year);

-- Day book / branch register.
CREATE INDEX ix_av_daybook ON accounts.acc_vouchers (
    av_company_id, av_branch_id, av_voucher_date
) WHERE av_is_deleted = false;

-- Contra analysis: "sales against which cash/bank ledger".
CREATE INDEX ix_av_opp_ledger ON accounts.acc_vouchers (
    av_company_id, av_opp_ledger_id, av_voucher_date
) WHERE av_opp_ledger_id IS NOT NULL AND av_is_deleted = false;

CREATE INDEX ix_av_bill ON accounts.acc_vouchers (av_bill_id)
    WHERE av_bill_id IS NOT NULL AND av_is_deleted = false;

-- Bank reconciliation worklist: unreconciled bank rows only.
CREATE INDEX ix_av_unrecon ON accounts.acc_vouchers (
    av_company_id, av_ledger_id, av_voucher_date
) WHERE av_recon_date IS NULL AND av_is_deleted = false;

-- ── Partitions (no DEFAULT: a bad acc_year must fail loudly) ───────────────
CREATE TABLE IF NOT EXISTS accounts.acc_vouchers_2026_2027
    PARTITION OF accounts.acc_vouchers FOR VALUES IN ('2026-2027');

COMMENT ON COLUMN accounts.acc_vouchers.av_signed_amount IS
    'DR positive, CR negative. Every balance query sums this instead of writing a CASE, and a balanced voucher sums to exactly zero.';
COMMENT ON COLUMN accounts.acc_vouchers.av_opp_ledger_id IS
    'Contra ledger for two-leg vouchers. NULL on multi-leg journals, where no single opposite ledger exists.';


-- ───────────────────────────────────────────────────────────────────────────
--  Opening balances
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_opening_balance (
    op_id             uuid          NOT NULL DEFAULT uuidv7(),

    op_company_id     uuid          NOT NULL,
    op_branch_id      uuid,                          -- NULL = company level
    op_acc_year       char(9)       NOT NULL,        -- '2025-2026'
    op_ledger_id      uuid          NOT NULL,

    op_amount         numeric(18,2) NOT NULL DEFAULT 0,
    op_dr_cr          char(1)       NOT NULL,

    -- CARRY_FORWARD rows are owned by the generator and may be rewritten.
    -- MANUAL and MIGRATION rows are owned by a human and must never be
    -- touched by regeneration.
    op_source         varchar(20)   NOT NULL DEFAULT 'CARRY_FORWARD',

    op_is_stale       boolean       NOT NULL DEFAULT false,
    op_stale_since    timestamptz(6),
    op_generated_at   timestamptz(6),
    op_generated_by   varchar(50),
    op_remarks        text,

    op_is_deleted     boolean       NOT NULL DEFAULT false,
    op_created_at     timestamptz(6) NOT NULL DEFAULT now(),
    op_created_by     varchar(50),
    op_modified_at    timestamptz(6),
    op_modified_by    varchar(50),

    CONSTRAINT pk_acc_opening   PRIMARY KEY (op_id),
    CONSTRAINT ck_op_dr_cr      CHECK (op_dr_cr IN ('D','C')),
    CONSTRAINT ck_op_amount     CHECK (op_amount >= 0),
    CONSTRAINT ck_op_source     CHECK (op_source IN ('CARRY_FORWARD','MANUAL','MIGRATION')),

    -- '2025-2026' only: right year must be left year + 1.
    CONSTRAINT ck_op_acc_year   CHECK (
        op_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(op_acc_year, 4)::int = LEFT(op_acc_year, 4)::int + 1
    )
);

ALTER TABLE IF EXISTS accounts.acc_opening_balance OWNER to postgres;

-- Branch NULL must still collide with branch NULL, so COALESCE it.
CREATE UNIQUE INDEX ux_op_scope ON accounts.acc_opening_balance (
    op_company_id,
    COALESCE(op_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    op_acc_year,
    op_ledger_id
) WHERE op_is_deleted = false;

-- Ledger statement reads exactly one row; keep it index-only.
CREATE INDEX ix_op_lookup ON accounts.acc_opening_balance (
    op_company_id, op_acc_year, op_ledger_id
) INCLUDE (op_amount, op_dr_cr, op_is_stale)
  WHERE op_is_deleted = false;

CREATE INDEX ix_op_stale ON accounts.acc_opening_balance (op_company_id, op_acc_year)
    WHERE op_is_stale = true AND op_is_deleted = false;

COMMENT ON TABLE  accounts.acc_opening_balance IS
    'Opening balance per ledger per financial year. Balance-sheet ledgers only; P&L ledgers always start at zero.';
COMMENT ON COLUMN accounts.acc_opening_balance.op_acc_year IS
    'Financial year label in YYYY-YYYY form, matching fiscal_years.fy_code.';
COMMENT ON COLUMN accounts.acc_opening_balance.op_source IS
    'Regeneration updates CARRY_FORWARD rows only. MANUAL and MIGRATION rows are never overwritten.';


-- ───────────────────────────────────────────────────────────────────────────
--  Bill adjustments (settlement)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_bill_adjustment
(
    aba_id                uuid           NOT NULL DEFAULT uuidv7(),
    aba_company_id        uuid           NOT NULL,
    aba_branch_id         uuid           NOT NULL,   -- branch that COLLECTED
    aba_tenant_id         uuid,
    aba_acc_year          character(9)   NOT NULL,   -- FY of the SETTLEMENT

    -- ── What is being settled ────────────────────────────────────────────
    aba_bill_id           uuid           NOT NULL,
    aba_party_id          uuid           NOT NULL,   -- denormalised from the bill
    aba_salesman_id       uuid,                      -- who collected, for commission

    -- ── The voucher doing the settling ───────────────────────────────────
    aba_voucher_id        uuid           NOT NULL,
    aba_voucher_acc_year  character(9)   NOT NULL,   -- header is partitioned
    aba_voucher_line_id   uuid,
    aba_voucher_type_id   integer        NOT NULL,
    aba_voucher_no        bigint,
    aba_voucher_refno     character varying(50),
    aba_row_no            integer        NOT NULL,
    aba_adj_date          date           NOT NULL,

    aba_adj_type          character varying(20) NOT NULL DEFAULT 'AGAINST_REF',
    aba_dr_cr             character(2)   NOT NULL,

    -- ── Amounts: these three roll up onto acc_bills ──────────────────────
    aba_alloc_amount      numeric(18,2)  NOT NULL DEFAULT 0,
    aba_disc_amount       numeric(18,2)  NOT NULL DEFAULT 0,
    aba_writeoff_amount   numeric(18,2)  NOT NULL DEFAULT 0,
    aba_profit_amount     numeric(18,2)  NOT NULL DEFAULT 0,

    -- Where the non-cash part of the settlement is posted:
    -- Discount Allowed / Bad Debts Written Off / Interest Waived
    aba_effect_ledger_id  uuid,

    -- ── How the money arrived ────────────────────────────────────────────
    aba_settlement_mode   character varying(20),     -- CASH/CHEQUE/UPI/NEFT/CARD
    aba_settlement_ledger_id uuid  NOT NULL,         -- cash or bank ledger
    aba_is_post_dated     boolean        NOT NULL DEFAULT false,
    aba_pdc_due_date      date,
    aba_narration         text,

    -- ── Audit ────────────────────────────────────────────────────────────
    aba_is_active         boolean NOT NULL DEFAULT true,
    aba_is_deleted        boolean NOT NULL DEFAULT false,
    aba_sync_date         timestamp(6) with time zone,
    aba_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    aba_created_by        varchar(50),
    aba_modified_on       timestamp(6) with time zone,
    aba_modified_by       varchar(50),

    CONSTRAINT pk_acc_bill_adjustment PRIMARY KEY (aba_id),

    CONSTRAINT fk_aba_bill FOREIGN KEY (aba_bill_id)
        REFERENCES accounts.acc_bills (abl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aba_voucher FOREIGN KEY (aba_voucher_id, aba_voucher_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_aba_voucher_type FOREIGN KEY (aba_voucher_type_id)
        REFERENCES accounts.acc_voucher_types (vchr_type_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aba_party FOREIGN KEY (aba_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aba_effect_ledger FOREIGN KEY (aba_effect_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aba_settle_ledger FOREIGN KEY (aba_settlement_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_aba_adj_type CHECK (aba_adj_type::text = ANY (ARRAY[
        'AGAINST_REF'::text, 'ADVANCE_ADJ'::text, 'DISCOUNT'::text,
        'WRITE_OFF'::text, 'CREDIT_NOTE'::text, 'INTEREST_WAIVER'::text])),
    CONSTRAINT ck_aba_dr_cr  CHECK (aba_dr_cr = ANY (ARRAY['DR'::bpchar, 'CR'::bpchar])),
    CONSTRAINT ck_aba_row_no CHECK (aba_row_no >= 1),

    CONSTRAINT ck_aba_acc_year CHECK (
        aba_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(aba_acc_year, 4)::int = LEFT(aba_acc_year, 4)::int + 1),
    CONSTRAINT ck_aba_voucher_acc_year CHECK (
        aba_voucher_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(aba_voucher_acc_year, 4)::int = LEFT(aba_voucher_acc_year, 4)::int + 1),

    -- Non-negative, and the row must actually do something.
    CONSTRAINT ck_aba_amounts CHECK (
        aba_alloc_amount >= 0 AND aba_disc_amount >= 0 AND aba_writeoff_amount >= 0
        AND (aba_alloc_amount + aba_disc_amount + aba_writeoff_amount) > 0),

    -- The amount column must match what the row claims to be.
    CONSTRAINT ck_aba_type_amount CHECK (
        (aba_adj_type::text IN ('AGAINST_REF','ADVANCE_ADJ','CREDIT_NOTE')
             AND aba_alloc_amount > 0
             AND aba_disc_amount = 0 AND aba_writeoff_amount = 0)
        OR (aba_adj_type::text = 'DISCOUNT'
             AND aba_disc_amount > 0
             AND aba_alloc_amount = 0 AND aba_writeoff_amount = 0)
        OR (aba_adj_type::text IN ('WRITE_OFF','INTEREST_WAIVER')
             AND aba_writeoff_amount > 0
             AND aba_alloc_amount = 0 AND aba_disc_amount = 0)),

    -- Non-cash settlements must name the P&L ledger they land in.
    CONSTRAINT ck_aba_effect_ledger CHECK (
        aba_adj_type::text NOT IN ('DISCOUNT','WRITE_OFF','INTEREST_WAIVER')
        OR aba_effect_ledger_id IS NOT NULL),

    -- Cash settlements must name where the money went.
    CONSTRAINT ck_aba_settle_ledger CHECK (
        aba_adj_type::text NOT IN ('AGAINST_REF')
        OR aba_settlement_ledger_id IS NOT NULL),

    CONSTRAINT ck_aba_pdc CHECK (
        aba_is_post_dated = false OR aba_pdc_due_date IS NOT NULL)
);

ALTER TABLE IF EXISTS accounts.acc_bill_adjustment OWNER to postgres;

-- One row per voucher line position.
CREATE UNIQUE INDEX ux_aba_voucher_row ON accounts.acc_bill_adjustment (
    aba_voucher_id, aba_voucher_acc_year, aba_row_no
) WHERE aba_is_deleted = false;

-- Drives the roll-up trigger and the bill drill-down screen.
CREATE INDEX ix_aba_bill ON accounts.acc_bill_adjustment (aba_bill_id)
    INCLUDE (aba_alloc_amount, aba_disc_amount, aba_writeoff_amount)
    WHERE aba_is_deleted = false;

CREATE INDEX ix_aba_voucher ON accounts.acc_bill_adjustment (
    aba_voucher_id, aba_voucher_acc_year
) WHERE aba_is_deleted = false;

-- Collection register, party-wise receipt history.
CREATE INDEX ix_aba_party ON accounts.acc_bill_adjustment (
    aba_company_id, aba_party_id, aba_adj_date
) WHERE aba_is_deleted = false;

-- Collection-basis commission for the salesman.
CREATE INDEX ix_aba_salesman ON accounts.acc_bill_adjustment (
    aba_company_id, aba_salesman_id, aba_adj_date
) WHERE aba_is_deleted = false AND aba_salesman_id IS NOT NULL;

-- Post-dated cheques still to mature.
CREATE INDEX ix_aba_pdc ON accounts.acc_bill_adjustment (
    aba_company_id, aba_pdc_due_date
) WHERE aba_is_post_dated = true AND aba_is_deleted = false;

COMMENT ON TABLE accounts.acc_bill_adjustment IS
    'Settlement rows: what a receipt, payment, credit note or journal did to a bill. Not partitioned — a settlement routinely lands in a different FY from the bill it clears.';
COMMENT ON COLUMN accounts.acc_bill_adjustment.aba_acc_year IS
    'FY the settlement happened in. Differs from the bill FY whenever a bill is cleared after year end.';
COMMENT ON COLUMN accounts.acc_bill_adjustment.aba_branch_id IS
    'Branch where the money was collected. May differ from the bill branch — that is the whole point of the chain-store split.';
COMMENT ON COLUMN accounts.acc_bill_adjustment.aba_effect_ledger_id IS
    'P&L ledger for the non-cash part: Discount Allowed, Bad Debts Written Off, Interest Waived.';


-- ───────────────────────────────────────────────────────────────────────────
--  Post-dated instrument register (PDC)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_pdc_register
(
    apd_id                uuid           NOT NULL DEFAULT uuidv7(),
    apd_company_id        uuid           NOT NULL,
    apd_branch_id         uuid           NOT NULL,   -- branch that took it in
    apd_tenant_id         uuid,
    apd_acc_year          character(9)   NOT NULL,   -- FY it was received in

    -- ── Direction ────────────────────────────────────────────────────────
    -- R = receivable, a customer's cheque we hold
    -- P = payable, our cheque handed to a supplier
    apd_tra_type          character(1)   NOT NULL,
    apd_party_id          uuid           NOT NULL,
    apd_salesman_id       uuid,                      -- who collected it

    -- ── The instrument ───────────────────────────────────────────────────
    apd_instrument_type   character varying(20) NOT NULL DEFAULT 'CHEQUE',
    apd_instrument_no     character varying(30) NOT NULL,
    apd_instrument_date   date           NOT NULL,   -- the post-date; maturity
    apd_amount            numeric(18,2)  NOT NULL,
    apd_bank_name         character varying(100),
    apd_bank_branch       character varying(100),
    apd_ifsc              character varying(11),
    apd_micr              character varying(9),
    apd_drawer_name       character varying(150),
    apd_received_on       date           NOT NULL,

    -- Our own bank ledger: where it will be deposited (R) or drawn on (P).
    apd_bank_ledger_id    uuid,

    -- ── Accounting linkage ───────────────────────────────────────────────
    apd_posting_mode      character varying(15) NOT NULL DEFAULT 'ON_CLEARING',
    -- The receipt/payment voucher. NULL under ON_CLEARING until it clears.
    apd_voucher_id        uuid,
    apd_voucher_acc_year  character(9),
    apd_tender_id         uuid,                      -- acc_tender_detail row

    -- ── Lifecycle ────────────────────────────────────────────────────────
    apd_status            character varying(15) NOT NULL DEFAULT 'HELD',
    apd_status_on         timestamp(6) with time zone,
    apd_status_by         character varying(50),
    apd_present_count     integer        NOT NULL DEFAULT 0,

    apd_deposit_date      date,
    apd_deposit_slip_no   character varying(50),

    apd_clear_date        date,
    apd_clear_voucher_id  uuid,
    apd_clear_acc_year    character(9),

    apd_bounce_date       date,
    apd_bounce_reason     character varying(150),
    apd_bounce_charges    numeric(18,2)  NOT NULL DEFAULT 0,
    apd_bounce_voucher_id uuid,                      -- reversal voucher
    apd_bounce_acc_year   character(9),
    apd_charge_voucher_id uuid,                      -- debit note for charges
    apd_charge_acc_year   character(9),

    apd_replaced_by_id    uuid,                      -- fresh cheque given
    apd_cancel_date       date,
    apd_cancel_reason     character varying(250),
    apd_remarks           text,

    -- ── Audit ────────────────────────────────────────────────────────────
    apd_is_active         boolean NOT NULL DEFAULT true,
    apd_is_deleted        boolean NOT NULL DEFAULT false,
    apd_sync_date         timestamp(6) with time zone,
    apd_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    apd_created_by        character varying(50),
    apd_modified_on       timestamp(6) with time zone,
    apd_modified_by       character varying(50),

    CONSTRAINT pk_acc_pdc_register PRIMARY KEY (apd_id),

    CONSTRAINT fk_apd_party FOREIGN KEY (apd_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_apd_bank_ledger FOREIGN KEY (apd_bank_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_apd_voucher FOREIGN KEY (apd_voucher_id, apd_voucher_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_apd_clear_voucher FOREIGN KEY (apd_clear_voucher_id, apd_clear_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_apd_bounce_voucher FOREIGN KEY (apd_bounce_voucher_id, apd_bounce_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_apd_charge_voucher FOREIGN KEY (apd_charge_voucher_id, apd_charge_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_apd_replaced_by FOREIGN KEY (apd_replaced_by_id)
        REFERENCES accounts.acc_pdc_register (apd_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_apd_tra_type CHECK (apd_tra_type = ANY (ARRAY['R'::bpchar, 'P'::bpchar])),
    CONSTRAINT ck_apd_instrument CHECK (apd_instrument_type::text = ANY (ARRAY[
        'CHEQUE'::text, 'DD'::text, 'PAY_ORDER'::text,
        'ECS'::text, 'NACH'::text, 'UPI_MANDATE'::text])),
    CONSTRAINT ck_apd_status CHECK (apd_status::text = ANY (ARRAY[
        'HELD'::text, 'DEPOSITED'::text, 'CLEARED'::text, 'BOUNCED'::text,
        'RETURNED'::text, 'CANCELLED'::text, 'REPLACED'::text])),
    CONSTRAINT ck_apd_posting_mode CHECK (apd_posting_mode::text = ANY (ARRAY[
        'ON_RECEIPT'::text, 'ON_CLEARING'::text])),

    CONSTRAINT ck_apd_amount   CHECK (apd_amount > 0),
    CONSTRAINT ck_apd_charges  CHECK (apd_bounce_charges >= 0),
    CONSTRAINT ck_apd_present  CHECK (apd_present_count >= 0),
    CONSTRAINT ck_apd_acc_year CHECK (
        apd_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(apd_acc_year, 4)::int = LEFT(apd_acc_year, 4)::int + 1),

    -- A post-dated instrument is dated on or after the day it arrived.
    CONSTRAINT ck_apd_dates CHECK (apd_instrument_date >= apd_received_on),

    -- ── Status consistency ───────────────────────────────────────────────
    CONSTRAINT ck_apd_deposited CHECK (
        apd_status::text NOT IN ('DEPOSITED','CLEARED','BOUNCED')
        OR apd_deposit_date IS NOT NULL),
    CONSTRAINT ck_apd_cleared CHECK (
        apd_status::text <> 'CLEARED'
        OR (apd_clear_date IS NOT NULL AND apd_clear_voucher_id IS NOT NULL)),
    CONSTRAINT ck_apd_bounced CHECK (
        apd_status::text <> 'BOUNCED'
        OR (apd_bounce_date IS NOT NULL AND apd_bounce_reason IS NOT NULL)),
    CONSTRAINT ck_apd_replaced CHECK (
        apd_status::text <> 'REPLACED' OR apd_replaced_by_id IS NOT NULL),
    CONSTRAINT ck_apd_cancelled CHECK (
        apd_status::text NOT IN ('CANCELLED','RETURNED')
        OR apd_cancel_reason IS NOT NULL),
    CONSTRAINT ck_apd_self CHECK (
        apd_replaced_by_id IS NULL OR apd_replaced_by_id <> apd_id),

    -- ON_RECEIPT means a voucher exists from day one.
    CONSTRAINT ck_apd_posting CHECK (
        apd_posting_mode::text <> 'ON_RECEIPT'
        OR (apd_voucher_id IS NOT NULL AND apd_voucher_acc_year IS NOT NULL)),

    CONSTRAINT ck_apd_seq CHECK (
        (apd_clear_date  IS NULL OR apd_deposit_date IS NULL OR apd_clear_date  >= apd_deposit_date)
        AND (apd_bounce_date IS NULL OR apd_deposit_date IS NULL OR apd_bounce_date >= apd_deposit_date))
);

ALTER TABLE IF EXISTS accounts.acc_pdc_register OWNER to postgres;

-- ── Indexes ────────────────────────────────────────────────────────────────

-- The same cheque number cannot be registered twice for one party in one FY.
CREATE UNIQUE INDEX ux_apd_instrument ON accounts.acc_pdc_register (
    apd_company_id, apd_party_id, apd_instrument_type,
    apd_instrument_no, apd_acc_year
) WHERE apd_is_deleted = false AND apd_status <> 'CANCELLED';

-- The screen everyone opens every morning: what matures today or is overdue.
CREATE INDEX ix_apd_due ON accounts.acc_pdc_register (
    apd_company_id, apd_instrument_date
) INCLUDE (apd_party_id, apd_amount, apd_instrument_no, apd_bank_name)
  WHERE apd_status IN ('HELD','DEPOSITED') AND apd_is_deleted = false;

-- Party-wise PDC held, for the credit-limit check.
CREATE INDEX ix_apd_party ON accounts.acc_pdc_register (
    apd_company_id, apd_party_id, apd_instrument_date
) WHERE apd_status IN ('HELD','DEPOSITED') AND apd_is_deleted = false;

-- Deposit slip: which cheques go to which of our banks.
CREATE INDEX ix_apd_bank ON accounts.acc_pdc_register (
    apd_company_id, apd_bank_ledger_id, apd_instrument_date
) WHERE apd_status = 'HELD' AND apd_is_deleted = false;

-- Bounce history, and the follow-up worklist.
CREATE INDEX ix_apd_bounced ON accounts.acc_pdc_register (
    apd_company_id, apd_bounce_date
) WHERE apd_status = 'BOUNCED' AND apd_is_deleted = false;

CREATE INDEX ix_apd_branch ON accounts.acc_pdc_register (
    apd_company_id, apd_branch_id, apd_status
) WHERE apd_is_deleted = false;

CREATE INDEX ix_apd_voucher ON accounts.acc_pdc_register (
    apd_voucher_id, apd_voucher_acc_year
) WHERE apd_voucher_id IS NOT NULL;

CREATE INDEX ix_apd_replaced ON accounts.acc_pdc_register (apd_replaced_by_id)
    WHERE apd_replaced_by_id IS NOT NULL;

COMMENT ON TABLE accounts.acc_pdc_register IS
    'Post-dated cheques and mandates, in both directions. Not partitioned: an instrument routinely matures, clears or bounces in a later financial year than the one it was received in.';
COMMENT ON COLUMN accounts.acc_pdc_register.apd_instrument_date IS
    'The post-date written on the cheque. This is the maturity date the due-list works from, not the date it was received.';
COMMENT ON COLUMN accounts.acc_pdc_register.apd_present_count IS
    'How many times it has been sent to the bank. A bounced cheque can be re-presented; this is what distinguishes a first bounce from a repeat.';
COMMENT ON COLUMN accounts.acc_pdc_register.apd_posting_mode IS
    'ON_RECEIPT posts a receipt into a Cheques in Hand ledger immediately. ON_CLEARING posts nothing until the bank clears it, leaving the party outstanding.';
