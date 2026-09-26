-- ═══════════════════════════════════════════════════════════════════════════
--  TEMP CREDIT — a small loan at the counter to someone who is NOT a credit
--  party.
--
--  Runs AFTER 20260921220000_sales_alters_and_seeds.
--
--  ── WHAT IT IS ──────────────────────────────────────────────────────────
--  A walk-in (or any non-credit) customer takes goods and pays part now, the
--  rest "in a few days". The bill is raised on the party the sales screen
--  chose — the walk-in ledger, usually — and the unpaid part is a TEMP_CR
--  tender row (accounts.acc_tender_types id 8, confirmed present, display
--  "Temporary Credit", ref label "Approved By"). Like CREDIT, that tender
--  writes NO leg and leaves the bill's acc_bill_balance row OPEN for the
--  amount.
--
--  So the OUTSTANDING is already where every receipt looks. What the ledger
--  cannot tell you is WHO: the walk-in ledger has a thousand bills against
--  it. This table is the WHO — name, mobile, place, promised days — one row
--  per temp-credit tender, riding on the bill's balance row.
--
--  ── RULES ───────────────────────────────────────────────────────────────
--   * one row per TEMP_CR tender; atc_abl_id is the bill's balance row
--   * atc_balance_amount is MAINTAINED = the balance row's
--     abl_pending_amount, which is itself a GENERATED column on
--     acc_bill_balance. BillBalanceRecomputeService refreshes this copy
--     whenever the abl row moves — a receipt allocation, a write-off, a
--     credit-note set-off. Nobody writes it by hand.
--   * cancel of the bill -> atc_status CANCELLED. The row is KEPT: a
--     reversal, never a delete, like everything else in this chain.
--   * the receipt finds it by MOBILE / NAME (open-items joins this table for
--     the walk-in ledger), settles the BILL as any bill, and this row follows.
--
--  ── DEVIATIONS FROM THE SOURCE NOTE, AND WHY ────────────────────────────
--
--   1. PARTITIONS. The note ends by CREATE OR REPLACE-ing
--      public.ensure_sales_doc_partitions and adding acc_temp_credit to its
--      list. THAT FUNCTION DOES NOT EXIST — checked before writing this. It
--      was proposed by the sales-documents note, which also left a by-hand
--      instruction to wire it into the real helper; that instruction was not
--      followed, and those six tables went straight into
--      public.ensure_acc_year_partitions instead, which is what the April 1st
--      ritual actually calls.
--
--      Running the note verbatim would therefore have created an ORPHAN
--      function that nothing calls, and acc_temp_credit — a partitioned
--      table — would have ended up with NO partitions at all: the first temp
--      credit taken at a counter would fail with "no partition of relation
--      found", a long way from its cause. So the table goes into
--      ensure_acc_year_partitions with the rest, and existing years are
--      backfilled.
--
--   2. No BEGIN/COMMIT (Prisma wraps the file) and no trailing verify SELECT.
--
--  ── A NOTE ON THE TENDER TYPE ───────────────────────────────────────────
--  The source header says "3.0: tender type 7" in one line and "type 8" in
--  another. In THIS database 8 is TEMP_CR and 7 is RRN; the "7" is a
--  historical reference to the old system and nothing here depends on it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accounts.acc_temp_credit
(
    atc_id                uuid           NOT NULL DEFAULT uuidv7(),
    atc_company_id        uuid           NOT NULL,
    atc_branch_id         uuid           NOT NULL,
    atc_tenant_id         uuid,
    atc_acc_year          character(9)   NOT NULL,

    -- ── The bill, and the party it was raised on ─────────────────────────
    -- The ledger the sales screen chose — the walk-in one, usually, which is
    -- exactly why this table has to exist.
    atc_party_id          uuid           NOT NULL,
    atc_src_doc_type      character varying(30) NOT NULL DEFAULT 'SALE_BILL',
    atc_src_doc_id        uuid           NOT NULL,        -- sales.sale_bill.sb_id
    atc_bill_refno        character varying(100),
    atc_bill_date         date           NOT NULL,
    atc_bill_amount       numeric(15,2)  NOT NULL DEFAULT 0,
    -- The bill's acc_bill_balance row: where the outstanding actually lives.
    atc_abl_id            uuid           NOT NULL,
    atc_abl_acc_year      character(9)   NOT NULL,
    -- The TEMP_CR acc_tender_detail row (tender type 8).
    atc_tender_id         uuid,
    atc_tender_acc_year   character(9),

    -- ── The borrower, typed at the counter (copied from BILL-TO by default) ─
    atc_name              character varying(200) NOT NULL,
    atc_mobile            character varying(20)  NOT NULL,
    atc_place             character varying(100),
    atc_addr              character varying(250),
    atc_id_ref            character varying(50),          -- any id shown, optional
    -- ── The promise ──────────────────────────────────────────────────────
    atc_days              integer        NOT NULL DEFAULT 0,
    atc_due_date          date           NOT NULL,
    atc_credit_amount     numeric(15,2)  NOT NULL,        -- what was lent
    -- = abl_pending_amount, maintained by BillBalanceRecomputeService.
    atc_balance_amount    numeric(15,2)  NOT NULL,
    -- OPEN | PARTIAL | SETTLED | WRITTEN_OFF | CANCELLED
    atc_status            character varying(20) NOT NULL DEFAULT 'OPEN',
    atc_settled_on        date,
    atc_last_receipt_id   uuid,
    atc_promise_date      date,                           -- re-promised on follow-up
    atc_followup_on       timestamptz,
    atc_followup_by       uuid,
    atc_reminder_sent_on  timestamptz,
    atc_remarks           character varying(500),

    -- ── Who / where ──────────────────────────────────────────────────────
    atc_user_id           uuid,
    atc_counter_id        uuid,
    atc_session_id        uuid,

    atc_is_deleted        boolean NOT NULL DEFAULT false,
    atc_sync_date         timestamptz,
    atc_created_on        timestamptz NOT NULL DEFAULT now(),
    atc_created_by        character varying(50),
    atc_modified_on       timestamptz,
    atc_modified_by       character varying(50),

    CONSTRAINT pk_acc_temp_credit PRIMARY KEY (atc_id, atc_acc_year),

    CONSTRAINT fk_atc_party FOREIGN KEY (atc_party_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- atc_acc_year doubles as the BILL's year: a temp credit belongs to the
    -- year of the bill that created it, so the two cannot diverge.
    CONSTRAINT fk_atc_bill FOREIGN KEY (atc_src_doc_id, atc_acc_year)
        REFERENCES sales.sale_bill (sb_id, sb_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_atc_abl FOREIGN KEY (atc_abl_id, atc_abl_acc_year)
        REFERENCES accounts.acc_bill_balance (abl_id, abl_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_atc_tender FOREIGN KEY (atc_tender_id, atc_tender_acc_year)
        REFERENCES accounts.acc_tender_detail (td_id, td_acc_year) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_atc_status CHECK (atc_status::text = ANY (ARRAY[
        'OPEN'::text, 'PARTIAL'::text, 'SETTLED'::text, 'WRITTEN_OFF'::text, 'CANCELLED'::text])),
    -- The credit amount is set once, when the tender is taken, and is guarded.
    -- The BALANCE follows abl_pending_amount, which a receipt raised on
    -- another device may have moved before this row syncs, so it is RECORDED
    -- rather than refused — ix_atc_overdrawn finds one that went wrong.
    CONSTRAINT ck_atc_amounts CHECK (atc_credit_amount > 0),
    CONSTRAINT ck_atc_due CHECK (atc_due_date >= atc_bill_date AND atc_days >= 0),
    CONSTRAINT ck_atc_mobile CHECK (atc_mobile ~ '^[0-9+ ]{10,20}$'),
    CONSTRAINT ck_atc_tender_pair CHECK ((atc_tender_id IS NULL) = (atc_tender_acc_year IS NULL))
) PARTITION BY LIST (atc_acc_year);

ALTER TABLE IF EXISTS accounts.acc_temp_credit OWNER to postgres;

-- The follow-up worklist: who owes, and by when.
CREATE INDEX IF NOT EXISTS ix_atc_open
    ON accounts.acc_temp_credit USING btree (atc_company_id, atc_branch_id, atc_status, atc_due_date)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE atc_is_deleted = false AND atc_status IN ('OPEN','PARTIAL');
-- THE COUNTER LOOKUP: a receipt finds the borrower by the number they give.
CREATE INDEX IF NOT EXISTS ix_atc_mobile
    ON accounts.acc_temp_credit USING btree (atc_company_id, atc_mobile)
    WITH (fillfactor=100, deduplicate_items=True) WHERE atc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_atc_abl
    ON accounts.acc_temp_credit USING btree (atc_abl_id, atc_abl_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE atc_is_deleted = false;
-- Reconciliation: a balance that went below zero, or above the credit taken.
-- What the dropped clauses of ck_atc_amounts became.
CREATE INDEX IF NOT EXISTS ix_atc_overdrawn
    ON accounts.acc_temp_credit USING btree (atc_company_id, atc_branch_id)
    WHERE atc_is_deleted = false
      AND (atc_balance_amount < 0 OR atc_balance_amount > atc_credit_amount + 0.01);
-- One temp-credit row per TEMP_CR tender. atc_acc_year is in the key because a
-- unique index on a partitioned table must carry the partition key.
CREATE UNIQUE INDEX IF NOT EXISTS ux_atc_tender
    ON accounts.acc_temp_credit USING btree (atc_tender_id, atc_tender_acc_year, atc_acc_year)
    WHERE atc_is_deleted = false AND atc_tender_id IS NOT NULL;
-- FK-covering, the house rule: fk_atc_party and fk_atc_bill would otherwise
-- seq-scan this table when a ledger or a bill is re-keyed.
--
-- NOT named ix_atc_party / ix_atc_bill, though that is what the prefix would
-- suggest. accounts.acc_tcs_register ALSO uses the atc_ prefix and already
-- owns both of those index names, and INDEX names are scoped to the SCHEMA
-- rather than the table — so `CREATE INDEX IF NOT EXISTS ix_atc_party` finds
-- the TCS register's index, decides there is nothing to do, and skips SILENTLY.
-- The migration then succeeds with the two indexes absent, which is exactly
-- what happened on the first run of this file.
--
-- Constraint names are safe (they are per-table), so fk_atc_* and ck_atc_*
-- below need no such care. Only indexes collide.
CREATE INDEX IF NOT EXISTS ix_atc_ledger
    ON accounts.acc_temp_credit USING btree (atc_party_id)
    WITH (fillfactor=100, deduplicate_items=True) WHERE atc_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_atc_src_bill
    ON accounts.acc_temp_credit USING btree (atc_src_doc_id, atc_acc_year)
    WITH (fillfactor=100, deduplicate_items=True) WHERE atc_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  Comments
-- ═══════════════════════════════════════════════════════════════════════════
COMMENT ON TABLE accounts.acc_temp_credit IS
    'WHO took a small counter loan. The OUTSTANDING already lives on the bill''s acc_bill_balance row — a TEMP_CR tender (type 8) writes no leg and leaves it open — but that row hangs off the walk-in ledger, which has a thousand bills against it. This table is the name, the mobile and the promise, one row per TEMP_CR tender.';
COMMENT ON COLUMN accounts.acc_temp_credit.atc_balance_amount IS
    'A MAINTAINED copy of acc_bill_balance.abl_pending_amount (itself a generated column), refreshed by BillBalanceRecomputeService whenever the balance row moves. Never written by hand. It may legitimately disagree for a moment under offline sync, which is what ix_atc_overdrawn is for.';
COMMENT ON COLUMN accounts.acc_temp_credit.atc_status IS
    'OPEN | PARTIAL | SETTLED | WRITTEN_OFF | CANCELLED. A cancelled bill sets CANCELLED and KEEPS the row — a reversal, never a delete.';
COMMENT ON COLUMN accounts.acc_temp_credit.atc_mobile IS
    'How the counter finds the borrower again (ix_atc_mobile). NOT NULL and shape-checked: a loan to somebody you cannot ring is not a loan.';


-- ═══════════════════════════════════════════════════════════════════════════
--  Settings
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT v.asd_key, v.asd_module, v.asd_group, v.asd_data_type, v.asd_default_value, v.asd_allowed_values::jsonb,
       v.asd_max_scope, v.asd_label, v.asd_description, v.asd_sort_order, 'system' FROM (VALUES
 ('sales.temp_credit_max_amount', 'SALES', 'Settlement', 'DECIMAL', '0', NULL, 'BRANCH',
  'Temp credit — maximum per bill', '0 = no cap. Above it the tender WARNs; um_can_override passes.', 200),
 ('sales.temp_credit_max_days',   'SALES', 'Settlement', 'INT',     '30', NULL, 'BRANCH',
  'Temp credit — maximum days', 'Pay-in days typed at the counter may not exceed this (REFUSE).', 201),
 ('sales.temp_credit_block_open', 'SALES', 'Settlement', 'BOOL',    'false', NULL, 'BRANCH',
  'Temp credit — refuse when the mobile already has one open', 'false = WARN with the open balance shown; true = REFUSE until it is settled.', 202)
) AS v(asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order)
ON CONFLICT (asd_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
--  Partitions — into the helper that is actually called.
--
--  See deviation 1 in the header: the source note extends a function that does
--  not exist. Restated in full, as every earlier migration has done; the body
--  is 20260921200000's plus one EXECUTE for acc_temp_credit.
-- ═══════════════════════════════════════════════════════════════════════════
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
    --  Temp credit. Written the moment a counter takes a TEMP_CR tender, so a
    --  missing partition refuses the sale.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_temp_credit FOR VALUES IN (%L)',
        'acc_temp_credit_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

-- Catch the new table up with the years that already have partitions, read off
-- sale_bill's own — fk_atc_bill ties a temp credit to its bill's year.
DO $backfill$
DECLARE v_year text;
BEGIN
    FOR v_year IN
        SELECT DISTINCT replace(substring(c.relname from '([0-9]{4}_[0-9]{4})$'), '_', '-')
          FROM pg_class c
          JOIN pg_inherits i ON i.inhrelid  = c.oid
          JOIN pg_class    p ON p.oid       = i.inhparent
         WHERE p.relname = 'sale_bill'
           AND c.relname ~ '[0-9]{4}_[0-9]{4}$'
         ORDER BY 1
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_temp_credit FOR VALUES IN (%L)',
            'acc_temp_credit_' || replace(v_year, '-', '_'), v_year);
        RAISE NOTICE 'acc_temp_credit partition ensured for %', v_year;
    END LOOP;
END
$backfill$;
