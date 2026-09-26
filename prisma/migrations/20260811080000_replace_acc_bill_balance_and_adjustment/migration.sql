-- ───────────────────────────────────────────────────────────────────────────
--  Replace the two bill tables with the redesigned pair.
--
--    accounts.acc_bill_balance      one row per bill  -- NO LONGER PARTITIONED
--    accounts.acc_bill_adjustment   one row per settlement EVENT against a bill
--
--  What changed, and why the tables are dropped rather than altered:
--
--  1. acc_bill_balance loses its partitioning entirely. A bill stays open
--     across financial years, so partitioning it by the year it was raised in
--     put every cross-year settlement through a composite key for no gain.
--     The primary key is now abl_id alone, and abl_acc_year is a reporting
--     filter. That alone rewrites every key and every FK into the table.
--
--  2. acc_bill_adjustment keeps its LIST partitioning but changes its column
--     prefix (aba_ -> abj_) and its whole shape: one SIGNED abj_amount instead
--     of three roll-up columns, an event type per row, and direct references to
--     the tender and the cheque the money arrived on.
--
--  3. The bill's own number moved from abl_bill_refno/abl_bill_date onto
--     abl_doc_refno/abl_doc_date (the old abl_doc_refno held the user's
--     reference); abl_voucher_refno / abl_voucher_date are new, as are the
--     abl_src_* source-document columns, abl_parent_bill_id, abl_settled_on
--     and the generated abl_status.
--
--  Both tables are empty on every environment this runs against (they were
--  built out over 20260806090000 / 20260811060000 / 20260811063038 and never
--  carried transactional data), so the rows are dropped rather than migrated.
--
--  NOTE: abl_alloc_amount / abl_disc_amount / abl_writeoff_amount are declared
--  trigger-maintained from acc_bill_adjustment. The trigger itself is NOT part
--  of this migration -- until it lands, the three columns are whatever the
--  posting code writes, and ck_abl_settled is the only thing holding the line.
-- ───────────────────────────────────────────────────────────────────────────


-- ───────────────────────────────────────────────────────────────────────────
--  1. Out with the old
--
--  acc_vouchers.fk_av_doc pointed at the bill's composite key, which is about
--  to stop existing. Dropped here and re-added against abl_id in section 7.
--  CASCADE on the adjustment table takes its three partitions with it.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_vouchers DROP CONSTRAINT IF EXISTS fk_av_doc;

DROP TABLE IF EXISTS accounts.acc_bill_adjustment CASCADE;
DROP TABLE IF EXISTS accounts.acc_bill_balance   CASCADE;

-- Leftovers from the partitioning rebuild, if that migration's cleanup was
-- ever skipped.
DROP TABLE IF EXISTS accounts.acc_bills_balance        CASCADE;
DROP TABLE IF EXISTS accounts.acc_bills_balance_unpart CASCADE;
DROP TABLE IF EXISTS accounts.acc_bill_adjustment_unpart CASCADE;


-- ───────────────────────────────────────────────────────────────────────────
--  2. fk_abj_cheque needs a target
--
--  acc_voucher_cheques is keyed on chq_id alone, but a settlement names the
--  cheque by (id, year) the same way it names the tender -- and a foreign key
--  can only point at a UNIQUE set of columns. chq_id is already unique, so
--  this index adds no constraint that was not already true; it only makes the
--  pair addressable.
-- ───────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS ux_chq_id_acc_year
    ON accounts.acc_voucher_cheques USING btree (chq_id, chq_acc_year);

COMMENT ON INDEX accounts.ux_chq_id_acc_year IS
    'Target for fk_abj_cheque. Redundant with the primary key on chq_id; exists so (chq_id, chq_acc_year) can be referenced.';


-- ───────────────────────────────────────────────────────────────────────────
--  3. The bill
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_bill_balance
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

    -- ── What kind of bill ────────────────────────────────────────────────
    -- SALES / PURCHASE ........ a real invoice
    -- SALES_RETURN /
    -- PURCHASE_RETURN ......... a credit / debit note. It is a BILL in its own
    --                           right: the RRN tender adjusts an invoice
    --                           against it, which needs both sides to exist
    --                           here (see acc_bill_adjustment).
    -- OPENING ................. lump-sum legacy outstanding brought in at
    --                           migration; the only type with no voucher
    -- ADVANCE ................. money received or paid with no bill yet —
    --                           a sale-order booking, a supplier advance
    -- INTEREST ................ overdue interest raised against a parent bill
    -- JOURNAL ................. a party bill reference opened by a JV
    abl_bill_type         character varying(20) NOT NULL,

    -- ── Source document ──────────────────────────────────────────────────
    -- The business document behind the bill, named directly rather than via
    -- the voucher: an ADVANCE has to be able to say WHICH sale order it was
    -- taken against, and every drill-down from a bill list wants the document
    -- without a hop through acc_voucher_header. Identified the same way
    -- acc_tender_detail and txn_status_log identify theirs.
    abl_src_module        character varying(20),
    abl_src_doc_type      character varying(30),
    abl_src_doc_id        uuid,
    abl_src_acc_year      character(9),

    -- INTEREST / a debit note raised against another bill points at it here.
    abl_parent_bill_id    uuid,

    -- ── Posting ──────────────────────────────────────────────────────────
    -- The voucher that opened this bill (posted server-side, after sync).
    -- NULL only for OPENING, which has no voucher — and then the voucher TYPE
    -- is null with it, rather than forcing a dummy type row into the master.
    abl_voucher_id        uuid,
    abl_voucher_line_id   uuid,
    abl_voucher_type_id   integer,
    abl_voucher_no        bigint,
    abl_voucher_date      date,
    abl_voucher_refno     character varying(50),

    -- ── Bill identity ────────────────────────────────────────────────────
    abl_doc_refno         character varying(100) NOT NULL,
    abl_doc_date          date           NOT NULL,
    abl_due_date          date,
    abl_credit_days       smallint       NOT NULL DEFAULT 0,
    abl_grace_days        smallint       NOT NULL DEFAULT 0,
    abl_dr_cr             character(2)   NOT NULL,   -- DR = receivable, CR = payable
    abl_narration         text,

    -- ── Amounts ──────────────────────────────────────────────────────────
    -- The three settled columns are TRIGGER-MAINTAINED from
    -- acc_bill_adjustment. Never written from application code.
    abl_bill_amount       numeric(18,2)  NOT NULL,
    abl_alloc_amount      numeric(18,2)  NOT NULL DEFAULT 0,
    abl_disc_amount       numeric(18,2)  NOT NULL DEFAULT 0,
    abl_writeoff_amount   numeric(18,2)  NOT NULL DEFAULT 0,
    abl_pending_amount    numeric(18,2)
        GENERATED ALWAYS AS (abl_bill_amount - abl_alloc_amount
                             - abl_disc_amount - abl_writeoff_amount) STORED,

    -- Repeats the arithmetic rather than reading abl_pending_amount: a
    -- generated column may not reference another generated column.
    abl_status            character varying(10)
        GENERATED ALWAYS AS (
            CASE WHEN abl_bill_amount - abl_alloc_amount
                      - abl_disc_amount - abl_writeoff_amount <= 0 THEN 'CLOSED'
                 WHEN abl_alloc_amount + abl_disc_amount
                      + abl_writeoff_amount > 0                    THEN 'PARTIAL'
                 ELSE 'OPEN' END) STORED,

    -- When it went to zero. Maintained with the three amounts above, and
    -- CLEARED again if a reversal reopens the bill. Days-to-collect / DSO has
    -- no other source once the row stays open across years, and the partial
    -- indexes below deliberately exclude closed bills.
    abl_settled_on        date,

    -- ── Audit ────────────────────────────────────────────────────────────
    abl_is_active         boolean NOT NULL DEFAULT true,
    abl_is_deleted        boolean NOT NULL DEFAULT false,
    abl_sync_date         timestamp(6) with time zone,
    abl_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    abl_created_by        varchar(50),
    abl_modified_on       timestamp(6) with time zone,
    abl_modified_by       varchar(50),

    CONSTRAINT pk_acc_bill_balance PRIMARY KEY (abl_id),

    CONSTRAINT fk_abl_voucher FOREIGN KEY (abl_voucher_id, abl_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abl_voucher_type FOREIGN KEY (abl_voucher_type_id)
        REFERENCES accounts.acc_voucher_types (vchr_type_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abl_party FOREIGN KEY (abl_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abl_parent FOREIGN KEY (abl_parent_bill_id)
        REFERENCES accounts.acc_bill_balance (abl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_abl_bill_type CHECK (abl_bill_type::text = ANY (ARRAY[
        'SALES'::text, 'PURCHASE'::text,
        'SALES_RETURN'::text, 'PURCHASE_RETURN'::text,
        'OPENING'::text, 'ADVANCE'::text, 'INTEREST'::text, 'JOURNAL'::text])),
    CONSTRAINT ck_abl_dr_cr CHECK (abl_dr_cr = ANY (ARRAY['DR'::bpchar, 'CR'::bpchar])),

    CONSTRAINT ck_abl_acc_year CHECK (
        abl_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(abl_acc_year, 4)::int = LEFT(abl_acc_year, 4)::int + 1),
    CONSTRAINT ck_abl_src_acc_year CHECK (
        abl_src_acc_year IS NULL OR abl_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),

    -- OPENING has no source voucher; every other type must have one, and the
    -- voucher type travels with it.
    CONSTRAINT ck_abl_voucher CHECK (
        (abl_bill_type::text = 'OPENING'
             AND abl_voucher_id IS NULL AND abl_voucher_type_id IS NULL)
        OR (abl_bill_type::text <> 'OPENING'
             AND abl_voucher_id IS NOT NULL AND abl_voucher_type_id IS NOT NULL)),

    -- A source document is named by all three parts or by none.
    CONSTRAINT ck_abl_src_doc CHECK (
        (abl_src_doc_id IS NULL AND abl_src_doc_type IS NULL)
        OR (abl_src_doc_id IS NOT NULL AND abl_src_doc_type IS NOT NULL)),

    -- Interest is always raised ON something.
    CONSTRAINT ck_abl_parent CHECK (
        abl_bill_type::text <> 'INTEREST' OR abl_parent_bill_id IS NOT NULL),
    CONSTRAINT ck_abl_no_self_parent CHECK (
        abl_parent_bill_id IS NULL OR abl_parent_bill_id <> abl_id),

    CONSTRAINT ck_abl_amount CHECK (abl_bill_amount > 0),
    CONSTRAINT ck_abl_due_date CHECK (
        abl_due_date IS NULL OR abl_due_date >= abl_doc_date),
    CONSTRAINT ck_abl_days CHECK (abl_credit_days >= 0 AND abl_grace_days >= 0),

    -- The over-settlement guard: a bill can never be edited down below what
    -- has already been settled, discounted or written off against it — and
    -- equally, adjustments can never add up past the bill. The trigger below
    -- writes through this constraint, so an over-allocation aborts the
    -- adjustment that caused it.
    CONSTRAINT ck_abl_settled CHECK (
        abl_alloc_amount >= 0 AND abl_disc_amount >= 0 AND abl_writeoff_amount >= 0
        AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <= abl_bill_amount)
);

ALTER TABLE IF EXISTS accounts.acc_bill_balance OWNER to postgres;


-- ───────────────────────────────────────────────────────────────────────────
--  Bill indexes
-- ───────────────────────────────────────────────────────────────────────────

-- Bill numbers restart each FY, so the FY is part of the key. NOTE: no branch
-- column — outstanding is company-wide for a chain store, which means two
-- branches must never issue the same refno to the same party in one year.
-- Every series in this system is device/branch prefixed, which is what makes
-- that safe; if a plain numeric series is ever introduced, add the branch.
CREATE UNIQUE INDEX IF NOT EXISTS ux_abl_doc_refno
    ON accounts.acc_bill_balance USING btree
    (abl_company_id, abl_party_id, abl_bill_type, abl_acc_year, abl_doc_refno)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_is_deleted = false;

-- The adjustment screen and the ageing report both live on this index: one
-- party's open bills, oldest first, with everything they show INCLUDEd so the
-- heap is never touched.
CREATE INDEX IF NOT EXISTS ix_abl_open
    ON accounts.acc_bill_balance USING btree
    (abl_company_id, abl_party_id, abl_doc_date)
    INCLUDE (abl_doc_refno, abl_bill_amount, abl_pending_amount, abl_dr_cr)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_is_deleted = false AND abl_pending_amount <> 0;

CREATE INDEX IF NOT EXISTS ix_abl_overdue
    ON accounts.acc_bill_balance USING btree (abl_company_id, abl_due_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_is_deleted = false AND abl_pending_amount <> 0;

CREATE INDEX IF NOT EXISTS ix_abl_voucher
    ON accounts.acc_bill_balance USING btree (abl_voucher_id, abl_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_voucher_id IS NOT NULL AND abl_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_abl_salesman
    ON accounts.acc_bill_balance USING btree (abl_company_id, abl_salesman_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_is_deleted = false AND abl_pending_amount <> 0;

-- Document → its bill. The sale-order screen's advance panel, and every
-- "show me the outstanding this invoice became".
CREATE INDEX IF NOT EXISTS ix_abl_src_doc
    ON accounts.acc_bill_balance USING btree (abl_src_doc_type, abl_src_doc_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_src_doc_id IS NOT NULL AND abl_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_abl_parent
    ON accounts.acc_bill_balance USING btree (abl_parent_bill_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_parent_bill_id IS NOT NULL AND abl_is_deleted = false;


COMMENT ON TABLE accounts.acc_bill_balance IS
    'One row per bill. Never partitioned and never carried forward at year end — the same row simply stays open across financial years.';
COMMENT ON COLUMN accounts.acc_bill_balance.abl_acc_year IS
    'FY the bill originated in. Reporting filter only, never a partition key.';
COMMENT ON COLUMN accounts.acc_bill_balance.abl_branch_id IS
    'Branch that raised the bill. Settlement may happen at a different branch — that is recorded on acc_bill_adjustment.';
COMMENT ON COLUMN accounts.acc_bill_balance.abl_alloc_amount IS
    'Trigger-maintained from acc_bill_adjustment. Never write from application code.';
COMMENT ON COLUMN accounts.acc_bill_balance.abl_disc_amount IS
    'Trigger-maintained from acc_bill_adjustment (settlement discount / cash discount allowed on collection).';
COMMENT ON COLUMN accounts.acc_bill_balance.abl_writeoff_amount IS
    'Trigger-maintained from acc_bill_adjustment (bad debt / rounding write-off).';
COMMENT ON COLUMN accounts.acc_bill_balance.abl_settled_on IS
    'Date the bill last reached zero. Cleared again if a reversal reopens it.';


-- ───────────────────────────────────────────────────────────────────────────
--  4. The adjustment.
--
--  One row per settlement EVENT against one bill: a receipt allocated, an
--  advance applied, a credit note set off, a discount allowed, an amount
--  written off — or the reversal of any of those.
--
--  Partitioned by the year the ADJUSTMENT happened, not the year the bill was
--  raised. That is the whole trick: April's receipts land in April's
--  partition, and the March bill they settle never moves.
--
--  Two-sided settlements (an advance into an invoice, a credit note against
--  an invoice) are TWO rows — one against each bill — pointing at each other
--  through abj_against_bill_id. Both are written in one transaction; neither
--  is meaningful alone.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts.acc_bill_adjustment
(
    abj_id                uuid           NOT NULL DEFAULT uuidv7(),
    abj_company_id        uuid           NOT NULL,
    abj_branch_id         uuid           NOT NULL,   -- branch that SETTLED it
    abj_tenant_id         uuid,
    abj_acc_year          character(9)   NOT NULL,   -- FY of the ADJUSTMENT

    -- ── What is being settled ────────────────────────────────────────────
    -- No acc_year on the bill FK: acc_bill_balance is not partitioned, which
    -- is exactly what makes cross-year settlement a plain foreign key.
    abj_bill_id           uuid           NOT NULL,
    abj_party_id          uuid           NOT NULL,   -- snapshot; ageing groups by it
    abj_row_no            integer        NOT NULL DEFAULT 1,

    -- The other side of a two-sided settlement (advance ↔ invoice,
    -- credit note ↔ invoice). NULL for money that came from outside.
    abj_against_bill_id   uuid,

    -- ── Posting ──────────────────────────────────────────────────────────
    -- The voucher that performed the settlement, with its OWN year.
    abj_voucher_id        uuid,
    abj_voucher_acc_year  character(9),
    abj_voucher_line_id   uuid,

    -- ── The event ────────────────────────────────────────────────────────
    -- ALLOCATION ...... money received / paid against the bill
    -- ADVANCE_ADJUST .. an advance already held being applied to the bill
    -- NOTE_ADJUST ..... a credit / debit note set off against the bill
    -- DISCOUNT ........ settlement discount allowed at collection time
    -- WRITEOFF ........ bad debt or rounding, written off
    -- TRANSFER ........ balance moved to another bill / party
    abj_adj_type          character varying(20) NOT NULL,
    abj_adj_date          date           NOT NULL,
    abj_dr_cr             character(2)   NOT NULL,

    -- SIGNED. A reversal (bounce, cancelled receipt, mis-keyed allocation)
    -- carries the SAME abj_adj_type as the row it undoes and a NEGATIVE
    -- amount, so the roll-ups on acc_bill_balance self-correct and the trail
    -- still shows what happened. Nothing here is ever edited or deleted.
    abj_amount            numeric(18,2)  NOT NULL,

    -- ── How the money moved ──────────────────────────────────────────────
    -- The instrument, for the cases that can independently fail or mature.
    -- CASH / CARD / UPI / WALLET / CHEQUE / BANK / CREDIT_NOTE / ADVANCE /
    -- LOYALTY / VOUCHER / JOURNAL / DISCOUNT / WRITEOFF.
    abj_settlement_mode   character varying(20),
    abj_settlement_ledger_id uuid,

    -- The tender row this settlement came from — one tender, one row, which is
    -- what lets "the cheque part bounced, the cash part stands" be a fact
    -- rather than an arithmetic guess. Also what sales.sale_order_advance_alloc
    -- joins on for an order advance.
    abj_tender_id         uuid,
    abj_tender_acc_year   character(9),

    -- The cheque behind it, when the instrument is one. acc_voucher_cheques
    -- owns its lifecycle; a bounce there writes the reversal row here.
    abj_cheque_id         uuid,
    abj_cheque_acc_year   character(9),
    abj_is_post_dated     boolean NOT NULL DEFAULT false,

    -- ── Reversal ─────────────────────────────────────────────────────────
    abj_reversal_of_id    uuid,
    abj_reversal_reason   character varying(250),

    abj_remarks           character varying(250),
    abj_approved_by       uuid,          -- write-offs and refunds need a sign-off
    abj_user_id           uuid           NOT NULL,
    abj_session_id        uuid,

    -- ── Audit ────────────────────────────────────────────────────────────
    abj_is_deleted        boolean NOT NULL DEFAULT false,
    abj_sync_date         timestamp(6) with time zone,
    abj_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    abj_created_by        varchar(50),
    abj_modified_on       timestamp(6) with time zone,
    abj_modified_by       varchar(50),

    CONSTRAINT pk_acc_bill_adjustment PRIMARY KEY (abj_id, abj_acc_year),

    CONSTRAINT fk_abj_bill FOREIGN KEY (abj_bill_id)
        REFERENCES accounts.acc_bill_balance (abl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abj_against_bill FOREIGN KEY (abj_against_bill_id)
        REFERENCES accounts.acc_bill_balance (abl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abj_party FOREIGN KEY (abj_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abj_voucher FOREIGN KEY (abj_voucher_id, abj_voucher_acc_year)
        REFERENCES accounts.acc_voucher_header (avh_voucher_id, avh_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abj_tender FOREIGN KEY (abj_tender_id, abj_tender_acc_year)
        REFERENCES accounts.acc_tender_detail (td_id, td_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abj_cheque FOREIGN KEY (abj_cheque_id, abj_cheque_acc_year)
        REFERENCES accounts.acc_voucher_cheques (chq_id, chq_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_abj_settlement_ledger FOREIGN KEY (abj_settlement_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_abj_adj_type CHECK (abj_adj_type::text = ANY (ARRAY[
        'ALLOCATION'::text, 'ADVANCE_ADJUST'::text, 'NOTE_ADJUST'::text,
        'DISCOUNT'::text, 'WRITEOFF'::text, 'TRANSFER'::text])),
    CONSTRAINT ck_abj_dr_cr CHECK (abj_dr_cr = ANY (ARRAY['DR'::bpchar, 'CR'::bpchar])),
    CONSTRAINT ck_abj_settlement_mode CHECK (
        abj_settlement_mode IS NULL OR abj_settlement_mode::text = ANY (ARRAY[
            'CASH'::text, 'CARD'::text, 'UPI'::text, 'WALLET'::text,
            'CHEQUE'::text, 'BANK'::text, 'CREDIT_NOTE'::text, 'ADVANCE'::text,
            'LOYALTY'::text, 'VOUCHER'::text, 'JOURNAL'::text,
            'DISCOUNT'::text, 'WRITEOFF'::text, 'MIXED'::text])),

    CONSTRAINT ck_abj_acc_year CHECK (
        abj_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(abj_acc_year, 4)::int = LEFT(abj_acc_year, 4)::int + 1),

    -- A settlement of zero is not an event.
    CONSTRAINT ck_abj_amount CHECK (abj_amount <> 0),

    -- Only a reversal may be negative, and a reversal must always be.
    CONSTRAINT ck_abj_reversal_sign CHECK (
        (abj_reversal_of_id IS NULL     AND abj_amount > 0)
        OR (abj_reversal_of_id IS NOT NULL AND abj_amount < 0)),
    CONSTRAINT ck_abj_no_self_reversal CHECK (
        abj_reversal_of_id IS NULL OR abj_reversal_of_id <> abj_id),

    -- Paired columns travel together or not at all.
    CONSTRAINT ck_abj_tender_pair CHECK (
        (abj_tender_id IS NULL) = (abj_tender_acc_year IS NULL)),
    CONSTRAINT ck_abj_cheque_pair CHECK (
        (abj_cheque_id IS NULL) = (abj_cheque_acc_year IS NULL)),
    CONSTRAINT ck_abj_voucher_pair CHECK (
        (abj_voucher_id IS NULL) = (abj_voucher_acc_year IS NULL)),

    -- A cheque settlement names its cheque; a post-dated flag without one
    -- would leave the PDC report blind.
    CONSTRAINT ck_abj_cheque_mode CHECK (
        abj_settlement_mode::text <> 'CHEQUE' OR abj_cheque_id IS NOT NULL
        OR abj_reversal_of_id IS NOT NULL),
    CONSTRAINT ck_abj_pdc CHECK (
        abj_is_post_dated = false OR abj_cheque_id IS NOT NULL),

    -- The two-sided types must name the bill on the other side; money from
    -- outside must not.
    CONSTRAINT ck_abj_against CHECK (
        (abj_adj_type::text IN ('ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER')
             AND abj_against_bill_id IS NOT NULL)
        OR (abj_adj_type::text IN ('ALLOCATION', 'DISCOUNT', 'WRITEOFF')
             AND abj_against_bill_id IS NULL)),
    CONSTRAINT ck_abj_no_self_against CHECK (
        abj_against_bill_id IS NULL OR abj_against_bill_id <> abj_bill_id),

    -- A write-off is somebody's decision, not a keying accident.
    CONSTRAINT ck_abj_writeoff_approval CHECK (
        abj_adj_type::text <> 'WRITEOFF' OR abj_approved_by IS NOT NULL),

    CONSTRAINT ck_abj_row_no CHECK (abj_row_no >= 1)
) PARTITION BY LIST (abj_acc_year);

ALTER TABLE IF EXISTS accounts.acc_bill_adjustment OWNER to postgres;


-- ───────────────────────────────────────────────────────────────────────────
--  Adjustment indexes
-- ───────────────────────────────────────────────────────────────────────────

-- One bill's settlement history — the drill-down under every outstanding row.
CREATE INDEX IF NOT EXISTS ix_abj_bill
    ON accounts.acc_bill_adjustment USING btree (abj_bill_id, abj_adj_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abj_is_deleted = false;

-- What one receipt/payment voucher settled.
CREATE INDEX IF NOT EXISTS ix_abj_voucher
    ON accounts.acc_bill_adjustment USING btree (abj_voucher_id, abj_voucher_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abj_voucher_id IS NOT NULL AND abj_is_deleted = false;

-- Tender → what it settled. The order screen's advance panel and the
-- "this cheque bounced, what does it reopen" query.
CREATE INDEX IF NOT EXISTS ix_abj_tender
    ON accounts.acc_bill_adjustment USING btree (abj_tender_id, abj_tender_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abj_tender_id IS NOT NULL AND abj_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_abj_cheque
    ON accounts.acc_bill_adjustment USING btree (abj_cheque_id, abj_cheque_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abj_cheque_id IS NOT NULL AND abj_is_deleted = false;

-- Collections by party and period — the receipt register.
CREATE INDEX IF NOT EXISTS ix_abj_party_period
    ON accounts.acc_bill_adjustment USING btree
    (abj_company_id, abj_party_id, abj_adj_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abj_is_deleted = false;

-- A row may be reversed once. Two reversals of one allocation would double
-- back the balance and nothing downstream would notice. CAVEAT: a unique index
-- on a partitioned table must include the partition key, so this is unique per
-- YEAR — a reversal in March and another in April of the same row would both
-- be accepted. Reversing across a year boundary is rare enough to leave to the
-- posting code, which must check before it writes.
CREATE UNIQUE INDEX IF NOT EXISTS ux_abj_reversal
    ON accounts.acc_bill_adjustment USING btree (abj_reversal_of_id, abj_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abj_reversal_of_id IS NOT NULL AND abj_is_deleted = false;


COMMENT ON TABLE accounts.acc_bill_adjustment IS
    'One row per settlement event against one bill. Partitioned by the year of the ADJUSTMENT, so an April receipt against a March bill lands in April.';
COMMENT ON COLUMN accounts.acc_bill_adjustment.abj_amount IS
    'Signed. A reversal repeats the original row type with a negative amount; rows are never edited or deleted.';
COMMENT ON COLUMN accounts.acc_bill_adjustment.abj_tender_id IS
    'The acc_tender_detail row the money came in on — one tender per row, so a bounced cheque reopens only its own share.';


-- ───────────────────────────────────────────────────────────────────────────
--  5. ensure_acc_year_partitions loses the bill, keeps the adjustment
--
--  Same helper as 20260804112944 (extended by 20260808132323, 20260810130000,
--  20260810140000, 20260810160000 and 20260811060000). acc_bills_balance is
--  gone from it — that table no longer exists, and the one that replaced it is
--  not partitioned, so the previous definition would raise on every fiscal
--  year opened from here on.
--
--  txn_charge_detail and txn_hold come back at the same time: 20260810140000
--  and 20260810160000 added them, 20260811060000 replaced the function without
--  them, and the live definition has been silently skipping both ever since.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character(9))
    RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
BEGIN
    -- The partition bound is a literal, so the year is validated rather than
    -- interpolated blind. char(9) makes 'YYYY-YYYY' the only well-formed value.
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
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order_advance_alloc FOR VALUES IN (%L)',
        'sale_order_advance_alloc_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation FOR VALUES IN (%L)',
        'sale_quotation_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation_item FOR VALUES IN (%L)',
        'sale_quotation_item_' || v_suffix, v_year);

    -- accounts.acc_bill_balance is deliberately absent: a bill stays open
    -- across financial years, so it is one unpartitioned table.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_adjustment FOR VALUES IN (%L)',
        'acc_bill_adjustment_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_opening_balance FOR VALUES IN (%L)',
        'acc_opening_balance_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_pdc_register FOR VALUES IN (%L)',
        'acc_pdc_register_' || v_suffix, v_year);
END;
$$;

COMMENT ON FUNCTION public.ensure_acc_year_partitions(character(9)) IS
    'Idempotently creates the sale_bill / sale_bill_item / acc_tender_detail / txn_status_log / txn_charge_detail / txn_hold / sale_order / sale_order_item / sale_order_advance_alloc / sale_quotation / sale_quotation_item / acc_bill_adjustment / acc_opening_balance / acc_pdc_register LIST partitions for one accounting year (YYYY-YYYY). Run it whenever a fiscal year is opened. acc_bill_balance is NOT in the list -- it is not partitioned.';


-- ───────────────────────────────────────────────────────────────────────────
--  6. Partitions for every year on record
--
--  The adjustment table was just recreated, so it has none. Every other parent
--  in the helper already has its partitions and CREATE TABLE IF NOT EXISTS
--  passes straight over them.
-- ───────────────────────────────────────────────────────────────────────────

DO
$$
    DECLARE
        v_year text;
    BEGIN
        FOR v_year IN
            SELECT DISTINCT btrim(fy_year_name)
            FROM public.fiscal_years
            WHERE is_deleted = false
              AND btrim(fy_year_name) ~ '^[0-9]{4}-[0-9]{4}$'
            ORDER BY 1
            LOOP
                PERFORM public.ensure_acc_year_partitions(v_year::character(9));
            END LOOP;
    END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
--  7. Point acc_vouchers back at the bill
--
--  av_doc_acc_year stays as a column -- it still records which year the bill
--  belongs to, and ck_av_doc_pair still makes it travel with av_doc_id -- but
--  it is no longer part of the foreign key: the bill is keyed on abl_id alone
--  now.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_vouchers
    ADD CONSTRAINT fk_av_doc FOREIGN KEY (av_doc_id)
        REFERENCES accounts.acc_bill_balance (abl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;
