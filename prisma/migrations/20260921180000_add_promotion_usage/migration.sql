-- ═══════════════════════════════════════════════════════════════════════════
--  Promotion usage — what a campaign actually gave away
--      sales.promotion_usage  (pru_)
--
--  One row per (document, scheme, direction). The promotion SCHEME masters
--  (sales.promotion_scheme and its slab / item / party / branch children)
--  already exist and say what a campaign PROMISES; nothing until now recorded
--  what it DELIVERED. Without that, two questions have no answer:
--
--      the CAP     "has this customer already used this campaign twice?"
--      the BUDGET  "what has this campaign given away in total, everywhere?"
--
--  Both are asked at the till, in the moment, before the benefit is applied —
--  which is why they get their own indexes rather than a scan of the bill
--  lines.
--
--  ── The shape ────────────────────────────────────────────────────────────
--  LIST-partitioned by pru_acc_year, the year of the EVENT, like
--  loyalty_ledger and loyalty_coupon_txn. A December bill's usage lands in
--  that year and stays there. Composite PK (pru_id, pru_acc_year).
--
--  Scheme identity is SNAPSHOTTED (pru_scheme_code / _name / _benefit) so a
--  campaign report does not change meaning when the scheme is renamed or
--  retyped next season. The widths match sales.promotion_scheme exactly:
--  prm_code is varchar(30) and prm_name varchar(150).
--
--  A reversal is a row of the same shape with NEGATIVE amounts and
--  pru_is_reversal = true, naming the row it undoes — the acc_bill_adjustment
--  and loyalty_ledger discipline. That is what makes every running total a
--  plain SUM with no CASE in it.
--
--  ── Deviations from the source design note, and why ──────────────────────
--   1. ck_pru_benefit GAINS 'DISC_PER_ITEM'. pru_benefit is a snapshot of
--      sales.promotion_scheme.prm_benefit, and that column carries FIVE
--      values in this database — DISC_AMT, DISC_PERC, DISC_PER_ITEM,
--      FIXED_PRICE, FREE_ITEM. The note's CHECK listed four and omitted
--      DISC_PER_ITEM, so a per-item-discount campaign could never have
--      written a usage row: the insert would fail at the till with a check
--      violation, and the cap and budget for that campaign would simply never
--      accumulate. A snapshot's vocabulary must cover its source's.
--
--      NOTE for later: prm_benefit itself carries NO CHECK constraint, so a
--      sixth value can appear there without anything here noticing. If that
--      vocabulary is ever pinned down on promotion_scheme, pin this one to
--      match in the same migration.
--
--   2. PARTITIONS. The note is a fragment and creates none at all — the table
--      would be created and the very next insert would fail with "no
--      partition of relation found". promotion_usage goes into
--      public.ensure_acc_year_partitions, the function the April 1st ritual
--      actually calls, and existing years are backfilled by reading them off
--      txn_status_log rather than hard-coding a list.
--
--   3. The comment on ux_pru_doc_scheme is rewritten. The note's version
--      claimed "NULLS NOT DISTINCT so the reversal-of column being NULL still
--      participates" — but the index has no NULLS NOT DISTINCT clause, names
--      no reversal-of column, and every one of its four key columns is NOT
--      NULL. The index itself is right; only its explanation was.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sales.promotion_usage
(
    pru_id                uuid           NOT NULL DEFAULT uuidv7(),
    pru_acc_year          character(9)   NOT NULL,   -- FY of the EVENT
    pru_comp_id           uuid           NOT NULL,
    pru_branch_id         uuid,
    pru_prm_id            uuid           NOT NULL,
    pru_cust_id           uuid,                      -- NULL = walk-in / cash sale

    -- Snapshot of the campaign as it stood, so a report does not change
    -- meaning when the scheme is renamed or retyped next season. Widths match
    -- promotion_scheme.prm_code (30) and prm_name (150).
    pru_scheme_code       character varying(30),
    pru_scheme_name       character varying(150),
    pru_benefit           character varying(20),

    -- ── Source document ──────────────────────────────────────────────────
    -- The same four-part polymorphic identifier acc_tender_detail,
    -- acc_bill_balance, txn_status_log and loyalty_ledger use.
    pru_src_module        character varying(20)  NOT NULL DEFAULT 'SALES',
    pru_src_doc_type      character varying(30)  NOT NULL DEFAULT 'SALE_BILL',
    pru_src_doc_id        uuid           NOT NULL,   -- no FK: polymorphic by design
    pru_src_acc_year      character(9),              -- the SOURCE's FY, not this row's
    pru_src_doc_refno     character varying(100),    -- snapshot, avoids a cross-year join
    pru_doc_date          date           NOT NULL,

    -- ── What it gave ─────────────────────────────────────────────────────
    pru_base_amount       numeric(18,2)  NOT NULL DEFAULT 0,   -- value the benefit came off
    pru_base_qty          numeric(18,3)  NOT NULL DEFAULT 0,
    pru_benefit_amt       numeric(18,2)  NOT NULL DEFAULT 0,   -- rupees given away
    pru_free_qty          numeric(18,3)  NOT NULL DEFAULT 0,   -- units given away
    pru_line_count        integer        NOT NULL DEFAULT 0,   -- lines the scheme touched

    -- The coupon code presented, when the campaign was coupon-gated.
    pru_coupon_id         uuid,

    -- ── Reversal ─────────────────────────────────────────────────────────
    -- Carries a real FK because this table has the year to complete the
    -- composite key with.
    pru_is_reversal       boolean        NOT NULL DEFAULT false,
    pru_reversal_of_id    uuid,
    pru_reversal_of_acc_year character(9),
    pru_reversal_reason   character varying(250),

    pru_user_id           uuid,
    pru_device_id         uuid,
    pru_remarks           text,

    pru_is_active         boolean NOT NULL DEFAULT true,
    pru_is_deleted        boolean NOT NULL DEFAULT false,
    pru_sync_date         timestamp with time zone,
    pru_created_on        timestamp with time zone NOT NULL DEFAULT now(),
    pru_created_by        character varying(50),
    pru_modified_on       timestamp with time zone,
    pru_modified_by       character varying(50),

    CONSTRAINT pk_promotion_usage PRIMARY KEY (pru_id, pru_acc_year),

    CONSTRAINT fk_pru_company FOREIGN KEY (pru_comp_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pru_branch FOREIGN KEY (pru_branch_id)
        REFERENCES public.branch_master (br_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- RESTRICT, not CASCADE: a campaign that has already given something away
    -- must not be deletable. Close it instead.
    CONSTRAINT fk_pru_scheme FOREIGN KEY (pru_prm_id)
        REFERENCES sales.promotion_scheme (prm_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pru_cust FOREIGN KEY (pru_cust_id)
        REFERENCES sales.customers (cus_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pru_coupon FOREIGN KEY (pru_coupon_id)
        REFERENCES sales.loyalty_coupon (lcp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pru_device FOREIGN KEY (pru_device_id)
        REFERENCES fixed.device_master (dev_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pru_user FOREIGN KEY (pru_user_id)
        REFERENCES public.user_master (usr_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pru_reversal FOREIGN KEY (pru_reversal_of_id, pru_reversal_of_acc_year)
        REFERENCES sales.promotion_usage (pru_id, pru_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_pru_acc_year CHECK (
        pru_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(pru_acc_year, 4)::int = LEFT(pru_acc_year, 4)::int + 1),
    CONSTRAINT ck_pru_src_acc_year CHECK (
        pru_src_acc_year IS NULL OR pru_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'),
    CONSTRAINT ck_pru_src_module CHECK (
        pru_src_module::text = ANY (ARRAY[
            'SALES'::text, 'POS'::text, 'ACCOUNTS'::text, 'OTHER'::text])),
    -- 'OTHER' is a member on purpose: a new document type should cost one
    -- CHECK value, and usually none.
    CONSTRAINT ck_pru_src_doc_type CHECK (
        pru_src_doc_type::text = ANY (ARRAY[
            'SALE_BILL'::text, 'SALE_RETURN'::text, 'SALES_ORDER'::text,
            'SALE_QUOTATION'::text, 'OTHER'::text])),
    -- Snapshot of promotion_scheme.prm_benefit, and it must cover EVERY value
    -- that column can hold. DISC_PER_ITEM is in this list and not in the
    -- design note's: without it a per-item-discount campaign cannot write a
    -- usage row at all, so its cap and its budget never accumulate.
    CONSTRAINT ck_pru_benefit CHECK (
        pru_benefit IS NULL OR pru_benefit::text = ANY (ARRAY[
            'FREE_ITEM'::text, 'DISC_PERC'::text, 'DISC_AMT'::text,
            'DISC_PER_ITEM'::text, 'FIXED_PRICE'::text])),
    -- A usage row that gave nothing is not an event.
    CONSTRAINT ck_pru_gave_something CHECK (
        pru_benefit_amt <> 0 OR pru_free_qty <> 0),
    -- A normal row is positive, a reversal negative. Same rule as
    -- loyalty_ledger.ck_lld_sign, and what makes the running total a plain
    -- SUM with no CASE in it.
    CONSTRAINT ck_pru_sign CHECK (
        (pru_is_reversal = false AND pru_benefit_amt >= 0 AND pru_free_qty >= 0)
        OR (pru_is_reversal = true AND pru_benefit_amt <= 0 AND pru_free_qty <= 0)),
    CONSTRAINT ck_pru_reversal_pair CHECK (
        (pru_reversal_of_id IS NULL) = (pru_reversal_of_acc_year IS NULL)
        AND (pru_is_reversal = true OR pru_reversal_of_id IS NULL)),
    CONSTRAINT ck_pru_line_count CHECK (pru_line_count >= 0),
    CONSTRAINT ck_pru_base CHECK (pru_base_amount >= 0 AND pru_base_qty >= 0)
) PARTITION BY LIST (pru_acc_year);

ALTER TABLE IF EXISTS sales.promotion_usage OWNER to postgres;

-- One usage row per document per scheme per DIRECTION. pru_is_reversal is a
-- key column, so a bill may carry the original and its reversal and no more:
-- two originals for one scheme on one bill collide, and a replayed offline
-- push therefore cannot double-count a campaign's spend.
--
-- All four key columns are NOT NULL, so there is nothing here for
-- NULLS NOT DISTINCT to do.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pru_doc_scheme
    ON sales.promotion_usage USING btree
    (pru_src_doc_id, pru_prm_id, pru_is_reversal, pru_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_is_deleted = false;

-- The cap check: "how many times has THIS customer used THIS campaign?"
CREATE INDEX IF NOT EXISTS ix_pru_cust_scheme
    ON sales.promotion_usage USING btree (pru_prm_id, pru_cust_id, pru_doc_date)
    INCLUDE (pru_benefit_amt, pru_free_qty, pru_is_reversal)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pru_is_deleted = false AND pru_cust_id IS NOT NULL;

-- The budget check and the campaign report: "what has this campaign given
-- away in total, across every branch?"
CREATE INDEX IF NOT EXISTS ix_pru_scheme_total
    ON sales.promotion_usage USING btree (pru_prm_id, pru_doc_date)
    INCLUDE (pru_branch_id, pru_benefit_amt, pru_free_qty, pru_is_reversal)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_is_deleted = false;

-- Branch performance, and the FK-covering index for branch_master.
CREATE INDEX IF NOT EXISTS ix_pru_branch
    ON sales.promotion_usage USING btree (pru_branch_id, pru_doc_date)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_is_deleted = false;

-- Remaining FK-covering indexes.
CREATE INDEX IF NOT EXISTS ix_pru_company  ON sales.promotion_usage USING btree (pru_comp_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pru_scheme   ON sales.promotion_usage USING btree (pru_prm_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pru_cust     ON sales.promotion_usage USING btree (pru_cust_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_cust_id   IS NOT NULL AND pru_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pru_coupon   ON sales.promotion_usage USING btree (pru_coupon_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_coupon_id IS NOT NULL AND pru_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pru_device   ON sales.promotion_usage USING btree (pru_device_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_device_id IS NOT NULL AND pru_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pru_user     ON sales.promotion_usage USING btree (pru_user_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_user_id   IS NOT NULL AND pru_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pru_reversal ON sales.promotion_usage USING btree
    (pru_reversal_of_id, pru_reversal_of_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_reversal_of_id IS NOT NULL;
-- Reconciliation back to the document.
CREATE INDEX IF NOT EXISTS ix_pru_src_doc  ON sales.promotion_usage USING btree
    (pru_src_doc_id, pru_src_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE pru_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  Comments
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE sales.promotion_usage IS
    'What a promotion campaign actually GAVE AWAY, one row per document per scheme per direction. The scheme masters say what a campaign promises; this says what it delivered, and it is the only source for the per-customer cap and the campaign budget. Partitioned by the year of the event.';
COMMENT ON COLUMN sales.promotion_usage.pru_scheme_code IS
    'Snapshot of promotion_scheme.prm_code at the moment of use, so a campaign report does not change meaning when the scheme is renamed next season.';
COMMENT ON COLUMN sales.promotion_usage.pru_benefit IS
    'Snapshot of promotion_scheme.prm_benefit. ck_pru_benefit must cover every value that column can hold; prm_benefit itself carries no CHECK, so a new value added there needs one added here in the same migration.';
COMMENT ON COLUMN sales.promotion_usage.pru_benefit_amt IS
    'Rupees given away. POSITIVE on a normal row, NEGATIVE on a reversal (ck_pru_sign) — which is what makes the campaign total a plain SUM with no CASE in it.';
COMMENT ON COLUMN sales.promotion_usage.pru_src_doc_id IS
    'The document the benefit was applied to. No FK: polymorphic, the target table varies by pru_src_module / pru_src_doc_type.';


-- ───────────────────────────────────────────────────────────────────────────
--  Partitions.
--
--  The design note is a fragment and creates none, which would leave a
--  partitioned table with no partitions and turn the very next insert into a
--  "no partition of relation found" error a long way from its cause.
--
--  public.ensure_acc_year_partitions is the one place that knows which tables
--  are partitioned by acc_year; it carries an explicit list rather than
--  scanning the catalogue, so a table absent from it is silently skipped when
--  a fiscal year is opened. Re-stated in full (CREATE OR REPLACE) because
--  that is how every earlier migration has extended it; the body below is
--  20260921160000's, plus one EXECUTE for promotion_usage.
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
    --  Header BEFORE lines: acc_vouchers carries fk_av_header into it.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_header FOR VALUES IN (%L)',
        'acc_voucher_header_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_vouchers FOR VALUES IN (%L)',
        'acc_vouchers_' || v_suffix, v_year);

    -- ── Added by 20260921120000 ──────────────────────────────────────────
    --  The GSP call log.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.gst_api_log FOR VALUES IN (%L)',
        'gst_api_log_' || v_suffix, v_year);

    -- ── Added by 20260921140000 ──────────────────────────────────────────
    --  The loyalty POINTS engine's three. Header before detail: fk_lgd_header.
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
    --  Coupon movements.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.loyalty_coupon_txn FOR VALUES IN (%L)',
        'loyalty_coupon_txn_' || v_suffix, v_year);

    -- ── Added by 20260921180000 ──────────────────────────────────────────
    --  Promotion usage. Written on every bill a campaign touches, so a
    --  missing partition stops discounted billing outright.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.promotion_usage FOR VALUES IN (%L)',
        'promotion_usage_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

-- Catch the new table up with the years that already have partitions, rather
-- than naming a hard-coded list that may not be the one this database uses.
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
            'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.promotion_usage FOR VALUES IN (%L)',
            'promotion_usage_' || replace(v_year, '-', '_'), v_year);
        RAISE NOTICE 'promotion_usage partition ensured for %', v_year;
    END LOOP;
END
$backfill$;
