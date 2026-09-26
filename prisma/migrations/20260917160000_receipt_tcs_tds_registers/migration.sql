-- ═══════════════════════════════════════════════════════════════════════════
--  §2.13 and §2.14 — bill-wise TCS, and the 27EQ / 26Q register
--
--  Added to the receipt endpoint sheet on 2026-09-15, the same day it was
--  written. Three things:
--
--    1 · acc_bill_balance.abl_tcs_amount   one column
--    2 · accounts.v_bill_tcs               collected / pending, pro-rata
--    3 · acc_tcs_register / acc_tds_register   the quarterly return projection
--
--  ── What this migration does NOT do, and why it matters ──────────────────
--
--  It does not make anything WRITE abl_tcs_amount, because there is nothing to
--  write yet. The sheet says the column is "stamped by the sale bill from the
--  same figure it already puts in gdr_tcs_value" — and as at this migration
--  that premise does not hold:
--
--    · nothing in the codebase writes acc_voucher_doc_register.gdr_tcs_value;
--      the table holds zero rows;
--    · the sale bill has no TCS column of its own (there is no sb_tcs_*), and
--      computes no TCS figure anywhere;
--    · there is no TCS RATE anywhere in this schema. led_is_tcs_applicable,
--      comp_tcs_applicable and cus_tcs_applicable are flags — they say the
--      party is in scope, not what to charge. This is the same gap the receipt
--      module's README already records against §5.1 rule 4: "no rate, no
--      amount to seed."
--
--  So the column lands with DEFAULT 0 and every existing bill is 0, which is
--  the truthful value: no TCS has been charged on any of them. The view and
--  the two registers are built in full, so that when a rate master exists the
--  only work left is the stamp itself.
--
--  Building it now rather than with that work is deliberate: the column has to
--  exist before a bill can carry the figure, and adding a column to a
--  partitioned table with rows in it is the expensive half.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1 · acc_bill_balance.abl_tcs_amount
--
--  A SLICE of abl_bill_amount, not an addition to it. The TCS is already
--  inside what the customer owes, so this column is never summed into
--  anything and never reaches abl_pending_amount (which stays
--  bill - alloc - disc - writeoff, generated, untouched here).
--
--  numeric(14,2) and not (18,2) like its neighbours: 0.1% of a bill cannot
--  need the width the bill needs, and the narrower type is a cheap statement
--  that this is a slice and not a total.
--
--  The ALTER reaches every partition — acc_bill_balance is LIST-partitioned on
--  abl_acc_year.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_bill_balance
    ADD COLUMN IF NOT EXISTS abl_tcs_amount numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN accounts.acc_bill_balance.abl_tcs_amount IS
    '§2.13. TCS under 206C(1H) already contained IN abl_bill_amount, carried here so bill-wise TCS outstanding is answerable without re-deriving it from the invoice. A SLICE, never an addition: it is not summed into abl_pending_amount and must not be. Stamped by the document that raises the bill, from the same figure it puts in acc_voucher_doc_register.gdr_tcs_value. 0 on the RECEIPT basis, where the receipt collects the TCS instead, and 0 on every bill raised before a TCS rate master existed.';

-- It is a slice, so it cannot exceed the bill or go negative.
ALTER TABLE accounts.acc_bill_balance
    DROP CONSTRAINT IF EXISTS ck_abl_tcs_amount;
ALTER TABLE accounts.acc_bill_balance
    ADD CONSTRAINT ck_abl_tcs_amount
    CHECK (abl_tcs_amount >= 0 AND abl_tcs_amount <= abl_bill_amount);


-- ───────────────────────────────────────────────────────────────────────────
--  2 · accounts.v_bill_tcs
--
--  How much of a bill's TCS has been COLLECTED, and how much is still
--  PENDING — pro-rata of what has been allocated against the bill.
--
--  ── Why pro-rata, and not "TCS first" or "TCS last" ─────────────────────
--  A part payment against a bill is a payment against the WHOLE bill. The
--  customer does not choose to pay the goods and withhold the tax, and the
--  department does not accept that they did. So a 50% collection has collected
--  50% of the TCS, and that is the only reading that leaves the liability
--  proportional to the money actually received — which is what 206C(1H)
--  charges on.
--
--  ── Why a view, and not two more stored columns ─────────────────────────
--  Both figures are functions of abl_alloc_amount, which the recompute service
--  owns and rewrites on every post, cancel and PDC maturity. A stored column
--  would be a second copy of a derived number with a second writer to forget,
--  and it would go stale the instant a reversal landed — exactly the failure
--  the receipt module's README describes for abl_alloc_amount itself. The
--  arithmetic here is three multiplications on a row already being read.
--
--  ── Discount and write-off are excluded from the collected base ─────────
--  Only abl_alloc_amount counts. A discount or a write-off is money that never
--  arrived, and TCS is collected on receipts — so a bill settled half by cash
--  and half by a write-off has collected half its TCS, not all of it.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW accounts.v_bill_tcs AS
SELECT b.abl_id                AS bill_id,
       b.abl_acc_year          AS bill_acc_year,
       b.abl_company_id,
       b.abl_branch_id,
       b.abl_party_id,
       b.abl_doc_refno,
       b.abl_doc_date,
       b.abl_bill_amount,
       b.abl_alloc_amount,
       b.abl_tcs_amount,
       -- Collected = tcs x (allocated / bill). Guarded against a zero bill
       -- amount, which ck_abl_amount forbids but a view should not depend on.
       CASE
           WHEN b.abl_bill_amount > 0 AND b.abl_tcs_amount > 0
           THEN round(b.abl_tcs_amount * (b.abl_alloc_amount / b.abl_bill_amount), 2)
           ELSE 0::numeric
       END                     AS tcs_collected,
       -- Pending is the remainder of the SAME rounding, so the two always sum
       -- back to abl_tcs_amount exactly. Computing it as its own pro-rata
       -- would let a half-paisa land in both or neither.
       b.abl_tcs_amount -
       CASE
           WHEN b.abl_bill_amount > 0 AND b.abl_tcs_amount > 0
           THEN round(b.abl_tcs_amount * (b.abl_alloc_amount / b.abl_bill_amount), 2)
           ELSE 0::numeric
       END                     AS tcs_pending
  FROM accounts.acc_bill_balance b
 WHERE b.abl_is_deleted = false
   AND b.abl_is_active  = true;

COMMENT ON VIEW accounts.v_bill_tcs IS
    '§2.13. Bill-wise TCS collected and pending, pro-rata of abl_alloc_amount. A part payment pays the whole bill proportionally, so it collects that proportion of the TCS. Discount and write-off are deliberately NOT in the collected base: TCS is charged on money received, and neither of those arrived. tcs_collected + tcs_pending = abl_tcs_amount exactly, by construction — pending is the remainder of the same rounding, never its own pro-rata.';


-- ───────────────────────────────────────────────────────────────────────────
--  3 · acc_tcs_register — Form 27EQ
--
--  Written at post, never edited, never re-summed. A row is a statement about
--  a moment: at the instant this document posted, this much was collected at
--  this rate on this base for this PAN. The quarterly return is a SELECT over
--  these rows and not a re-derivation from the invoices — because the rate
--  that applied in July is not the rate that applies in November, and a return
--  that recomputed would silently restate a quarter already filed.
--
--  Not partitioned, unlike the money tables. Every read is one company, one
--  FY, one quarter — which an index serves exactly; nothing addresses a row by
--  (id, year); and nobody detaches a filed quarter, because the department can
--  ask for it years later. The practical gain is that these tables need no
--  ensure_acc_year_partitions call, so they cannot fail a receipt at the
--  moment an operator is taking money.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_tcs_register (
    atc_id                  uuid         NOT NULL DEFAULT uuidv7(),
    atc_company_id          uuid         NOT NULL,
    atc_branch_id           uuid         NOT NULL,
    atc_tenant_id           uuid,
    atc_acc_year            character(9) NOT NULL,
    atc_quarter             character(2) NOT NULL,
    atc_party_id            uuid         NOT NULL,
    -- Stamped, not joined: a PAN corrected next year must not retrospectively
    -- change what a filed return said.
    atc_pan                 varchar(10),
    atc_party_name          varchar(150) NOT NULL,
    atc_section             varchar(20)  NOT NULL,
    atc_rate                numeric(6,3) NOT NULL,
    atc_rate_source         varchar(20)  NOT NULL,
    atc_base_amount         numeric(18,2) NOT NULL,
    atc_tax_amount          numeric(18,2) NOT NULL,
    atc_voucher_id          uuid,
    atc_voucher_acc_year    character(9),
    atc_doc_refno           varchar(50),
    atc_doc_date            date         NOT NULL,
    atc_bill_id             uuid,
    atc_bill_acc_year       character(9),
    atc_reversal_of_id      uuid,
    atc_challan_no          varchar(30),
    atc_challan_date        date,
    atc_challan_bsr         varchar(7),
    atc_certificate_no      varchar(30),
    atc_certificate_date    date,
    atc_remarks             varchar(250),
    atc_is_active           boolean      NOT NULL DEFAULT true,
    atc_is_deleted          boolean      NOT NULL DEFAULT false,
    atc_created_on          timestamptz(6) NOT NULL DEFAULT now(),
    atc_created_by          varchar(50),
    atc_modified_on         timestamptz(6),
    atc_modified_by         varchar(50),
    CONSTRAINT pk_acc_tcs_register PRIMARY KEY (atc_id)
);

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_quarter;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_quarter CHECK (atc_quarter IN ('Q1','Q2','Q3','Q4'));

-- Four values, of which only three can occur until a lower-collection
-- certificate can be recorded against a party. CERTIFICATE is declared now
-- because a rate of 0.05% with no recorded reason is indistinguishable from a
-- keying error when the department asks two years on.
ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_rate_source;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_rate_source
    CHECK (atc_rate_source IN ('MASTER','CERTIFICATE','NO_PAN','BELOW_THRESHOLD'));

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_acc_year;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_acc_year CHECK (atc_acc_year ~ '^[0-9]{4}-[0-9]{4}$');

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_rate;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_rate CHECK (atc_rate >= 0 AND atc_rate <= 100);

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_base;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_base CHECK (atc_base_amount >= 0);

-- The voucher is keyed on (id, year) because acc_voucher_header is
-- partitioned, so the two travel together or neither does. Same for the bill.
ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_voucher;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_voucher
    CHECK ((atc_voucher_id IS NULL) = (atc_voucher_acc_year IS NULL));

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_bill;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_bill
    CHECK ((atc_bill_id IS NULL) = (atc_bill_acc_year IS NULL));

-- A reversal's tax is negative and an original's is not — the same shape as
-- ck_abj_reversal_sign on the bill adjustment, and for the same reason: a
-- cancelled document gets a NEW row, because the return that quoted the
-- original was filed.
ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_reversal_sign;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_reversal_sign
    CHECK ((atc_reversal_of_id IS NULL AND atc_tax_amount >= 0)
        OR (atc_reversal_of_id IS NOT NULL AND atc_tax_amount <= 0));

-- A challan is a number, a date and a BSR code together, or it has not been
-- paid yet.
ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS ck_atc_challan;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT ck_atc_challan
    CHECK (num_nonnulls(atc_challan_no, atc_challan_date, atc_challan_bsr) IN (0, 3));

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS fk_atc_party;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT fk_atc_party FOREIGN KEY (atc_party_id)
    REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tcs_register
    DROP CONSTRAINT IF EXISTS fk_atc_reversal_of;
ALTER TABLE accounts.acc_tcs_register
    ADD CONSTRAINT fk_atc_reversal_of FOREIGN KEY (atc_reversal_of_id)
    REFERENCES accounts.acc_tcs_register (atc_id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- The return itself.
CREATE INDEX IF NOT EXISTS ix_atc_return
    ON accounts.acc_tcs_register (atc_company_id, atc_acc_year, atc_quarter, atc_section)
    WHERE atc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_atc_party
    ON accounts.acc_tcs_register (atc_party_id, atc_acc_year)
    WHERE atc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_atc_voucher
    ON accounts.acc_tcs_register (atc_voucher_id, atc_voucher_acc_year)
    WHERE atc_voucher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_atc_bill
    ON accounts.acc_tcs_register (atc_bill_id, atc_bill_acc_year)
    WHERE atc_bill_id IS NOT NULL;
-- Collected but not yet paid over — the question that carries a penalty.
CREATE INDEX IF NOT EXISTS ix_atc_unremitted
    ON accounts.acc_tcs_register (atc_company_id, atc_acc_year, atc_quarter)
    WHERE atc_challan_no IS NULL AND atc_is_deleted = false;

COMMENT ON TABLE accounts.acc_tcs_register IS
    '§2.14. Form 27EQ projection: tax COLLECTED at source, one row per collection. Written at post, never edited, never re-summed — a quarterly return is a SELECT over these rows, not a re-derivation from the invoices, because the rate that applied in July is not the rate that applies in November. A cancelled or amended document gets a NEW reversal row (atc_reversal_of_id, negative tax); the original stays, because the return that quoted it was filed. Not partitioned: every read is one company / FY / quarter, nothing addresses a row by (id, year), and nobody detaches a filed quarter.';

COMMENT ON COLUMN accounts.acc_tcs_register.atc_rate_source IS
    'Why this rate applied: MASTER (the configured rate), CERTIFICATE (a 197 / 206C(9) lower-collection certificate), NO_PAN (206CC''s higher rate), BELOW_THRESHOLD (the 50 lakh threshold was not crossed, so the rate is 0). CERTIFICATE cannot occur until a certificate can be recorded against a party; it is declared now because a reduced rate with no recorded reason is indistinguishable from a keying error when the department asks two years on.';

COMMENT ON COLUMN accounts.acc_tcs_register.atc_bill_id IS
    'The bill this slice belongs to, on accounts.tcs_basis = SALES, where the invoice already carried the TCS and the receipt raises the register row for the TCS slice of that allocation (pro-rata — see accounts.v_bill_tcs). NULL on the RECEIPT basis, where the collection is against the receipt as a whole and not against any one invoice.';


-- ───────────────────────────────────────────────────────────────────────────
--  4 · acc_tds_register — Form 26Q
--
--  The same shape and the same rules; see the comment on acc_tcs_register.
--  Two differences, both structural:
--
--    · atd_direction. DEDUCTED is this company withholding from a supplier
--      (we file); WITHHELD is a customer withholding from us (their filing,
--      our credit to claim — and the receipt is where it is recorded). One
--      table because both are TDS at the same sections and rates, and a party
--      is routinely on both sides across a year.
--    · atd_deductee_type. 26Q reports a company and a non-company deductee
--      under different codes. TCS has no equivalent.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts.acc_tds_register (
    atd_id                  uuid         NOT NULL DEFAULT uuidv7(),
    atd_company_id          uuid         NOT NULL,
    atd_branch_id           uuid         NOT NULL,
    atd_tenant_id           uuid,
    atd_acc_year            character(9) NOT NULL,
    atd_quarter             character(2) NOT NULL,
    atd_direction           varchar(10)  NOT NULL,
    atd_party_id            uuid         NOT NULL,
    atd_pan                 varchar(10),
    atd_party_name          varchar(150) NOT NULL,
    atd_deductee_type       varchar(20),
    atd_section             varchar(20)  NOT NULL,
    atd_rate                numeric(6,3) NOT NULL,
    atd_rate_source         varchar(20)  NOT NULL,
    atd_base_amount         numeric(18,2) NOT NULL,
    atd_tax_amount          numeric(18,2) NOT NULL,
    atd_voucher_id          uuid,
    atd_voucher_acc_year    character(9),
    atd_doc_refno           varchar(50),
    atd_doc_date            date         NOT NULL,
    atd_bill_id             uuid,
    atd_bill_acc_year       character(9),
    atd_reversal_of_id      uuid,
    atd_challan_no          varchar(30),
    atd_challan_date        date,
    atd_challan_bsr         varchar(7),
    atd_certificate_no      varchar(30),
    atd_certificate_date    date,
    atd_remarks             varchar(250),
    atd_is_active           boolean      NOT NULL DEFAULT true,
    atd_is_deleted          boolean      NOT NULL DEFAULT false,
    atd_created_on          timestamptz(6) NOT NULL DEFAULT now(),
    atd_created_by          varchar(50),
    atd_modified_on         timestamptz(6),
    atd_modified_by         varchar(50),
    CONSTRAINT pk_acc_tds_register PRIMARY KEY (atd_id)
);

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_quarter;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_quarter CHECK (atd_quarter IN ('Q1','Q2','Q3','Q4'));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_direction;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_direction CHECK (atd_direction IN ('DEDUCTED','WITHHELD'));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_deductee_type;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_deductee_type
    CHECK (atd_deductee_type IS NULL OR atd_deductee_type IN ('COMPANY','NON_COMPANY'));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_rate_source;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_rate_source
    CHECK (atd_rate_source IN ('MASTER','CERTIFICATE','NO_PAN','BELOW_THRESHOLD'));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_acc_year;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_acc_year CHECK (atd_acc_year ~ '^[0-9]{4}-[0-9]{4}$');

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_rate;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_rate CHECK (atd_rate >= 0 AND atd_rate <= 100);

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_base;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_base CHECK (atd_base_amount >= 0);

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_voucher;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_voucher
    CHECK ((atd_voucher_id IS NULL) = (atd_voucher_acc_year IS NULL));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_bill;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_bill
    CHECK ((atd_bill_id IS NULL) = (atd_bill_acc_year IS NULL));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_reversal_sign;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_reversal_sign
    CHECK ((atd_reversal_of_id IS NULL AND atd_tax_amount >= 0)
        OR (atd_reversal_of_id IS NOT NULL AND atd_tax_amount <= 0));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS ck_atd_challan;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT ck_atd_challan
    CHECK (num_nonnulls(atd_challan_no, atd_challan_date, atd_challan_bsr) IN (0, 3));

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS fk_atd_party;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT fk_atd_party FOREIGN KEY (atd_party_id)
    REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE accounts.acc_tds_register
    DROP CONSTRAINT IF EXISTS fk_atd_reversal_of;
ALTER TABLE accounts.acc_tds_register
    ADD CONSTRAINT fk_atd_reversal_of FOREIGN KEY (atd_reversal_of_id)
    REFERENCES accounts.acc_tds_register (atd_id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_atd_return
    ON accounts.acc_tds_register
       (atd_company_id, atd_acc_year, atd_quarter, atd_direction, atd_section)
    WHERE atd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_atd_party
    ON accounts.acc_tds_register (atd_party_id, atd_acc_year)
    WHERE atd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_atd_voucher
    ON accounts.acc_tds_register (atd_voucher_id, atd_voucher_acc_year)
    WHERE atd_voucher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_atd_bill
    ON accounts.acc_tds_register (atd_bill_id, atd_bill_acc_year)
    WHERE atd_bill_id IS NOT NULL;
-- Only the DEDUCTED side is ours to remit; on the WITHHELD side the customer
-- pays it over and gives us the certificate.
CREATE INDEX IF NOT EXISTS ix_atd_unremitted
    ON accounts.acc_tds_register (atd_company_id, atd_acc_year, atd_quarter)
    WHERE atd_challan_no IS NULL AND atd_direction = 'DEDUCTED' AND atd_is_deleted = false;

COMMENT ON TABLE accounts.acc_tds_register IS
    '§2.14. Form 26Q projection. Same rules as accounts.acc_tcs_register: written at post, never edited, never re-summed, reversed by a new negative row. atd_direction separates DEDUCTED (this company withheld from a supplier — we file) from WITHHELD (a customer withheld from us — their filing, our credit to claim, recorded at the receipt). One table because both are TDS at the same sections and rates and a party is routinely on both sides across a year.';

COMMENT ON COLUMN accounts.acc_tds_register.atd_certificate_no IS
    'Form 16A. On the WITHHELD side this is the certificate the CUSTOMER gives us, and it is what turns a deduction we absorbed into a credit we can claim — which is why the column is on both directions and not only on DEDUCTED.';
