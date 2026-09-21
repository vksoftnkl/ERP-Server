-- ═══════════════════════════════════════════════════════════════════════════
--  Two independent changes, applied together:
--
--   §A  public.txn_transport_detail — ONE transport band for every document
--       that moves goods.
--   §B  RE-TENDER — change how a bill was paid, without touching the bill.
--
--  Runs AFTER 20260921200000 (transporter_master, vehicle_master) and
--  20260921220000.
--
--  §A also gives back the home that 20260922020000 took away: that migration
--  dropped the register's 18 ship / dispatch columns on the grounds that these
--  addresses live here, and flagged that "here" did not yet exist. It does now.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  §A  THE TRANSPORT BAND
--
--  The band was 22 columns repeated on sale_bill, sale_dc, sale_return and
--  sale_dc_return: 88 definitions of the same 22 facts. They had ALREADY
--  drifted before anyone noticed — vehicle_id was missing from the DC return
--  and supervisor_id existed only on the bill. Every future e-way field would
--  have been four ALTERs, and the fourth is the one that gets forgotten.
--
--  NOT for storage. That argument was measured and does not hold: 22 NULL
--  columns cost about 8 bytes a row, because PostgreSQL keeps NULLs as one bit
--  each in a row bitmap. Half a million POS bills a year would have cost ~4 MB.
--  One definition instead of four is the whole reason.
--
--  Same shape as public.txn_charge_detail and public.txn_status_log — a
--  polymorphic child keyed by (doc_type, doc_id, acc_year). The price is the
--  same one those already pay: a child cannot carry a foreign key to four
--  different partitioned parents, so the SERVICE is what keeps a row from
--  outliving its document.
--
--  ── FROM and TO are POSITIONAL; ttd_direction says what they mean ────────
--
--    OUTWARD (sale bill, delivery challan)
--        FROM = our godown / branch      TO = the customer's address
--    INWARD  (sale return, DC return)
--        FROM = the customer's address   TO = our godown / branch
--
--    acc_voucher_doc_register then maps straight across, no special case:
--        gdr_dispatch_*  <-  ttd_from_*
--        gdr_ship_*      <-  ttd_to_*
--
--  Whichever side is OURS fills the godown / branch columns; whichever side is
--  the party's fills the address block. Both sides carry both, so a
--  branch-to-branch move needs no third shape.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.txn_transport_detail
(
    ttd_id                uuid           NOT NULL DEFAULT uuidv7(),
    ttd_company_id        uuid           NOT NULL,
    ttd_branch_id         uuid           NOT NULL,
    ttd_tenant_id         uuid,
    ttd_acc_year          character(9)   NOT NULL,

    -- ── Which document ───────────────────────────────────────────────────
    ttd_doc_type          character varying(30) NOT NULL,
    ttd_doc_id            uuid           NOT NULL,
    ttd_doc_refno         character varying(100),   -- snapshot, so a row reads alone

    -- ── Which way the goods went ─────────────────────────────────────────
    ttd_direction         character varying(10) NOT NULL,

    -- ── FROM ─────────────────────────────────────────────────────────────
    ttd_from_godown_id    uuid,                     -- set when the FROM side is ours
    ttd_from_branch_id    uuid,
    ttd_from_addr_id      uuid,                     -- accounts.acc_ship_addrs, when it is a listed one
    ttd_from_name         character varying(200),
    ttd_from_addr         character varying(500),
    ttd_from_place        character varying(100),
    ttd_from_pin          character varying(10),
    ttd_from_phone        character varying(20),
    ttd_from_stcd         character(2),
    ttd_from_gstin        character varying(15),

    -- ── TO ───────────────────────────────────────────────────────────────
    ttd_to_godown_id      uuid,                     -- set when the TO side is ours
    ttd_to_branch_id      uuid,
    ttd_to_addr_id        uuid,
    ttd_to_name           character varying(200),
    ttd_to_addr           character varying(500),
    ttd_to_place          character varying(100),
    ttd_to_pin            character varying(10),
    ttd_to_phone          character varying(20),
    ttd_to_stcd           character(2),
    ttd_to_gstin          character varying(15),

    -- ── Carriage ─────────────────────────────────────────────────────────
    ttd_transport_mode    character varying(10),    -- ROAD | RAIL | AIR | SHIP
    ttd_transporter_id    uuid,
    ttd_transporter_name  character varying(200),
    ttd_transporter_gstin character varying(15),    -- the portal's transporterId
    ttd_lr_no             character varying(50),    -- e-way Part-B transDocNo
    ttd_lr_date           date,                     -- e-way Part-B transDocDate
    ttd_distance_km       integer,

    -- NO vehicle and NO crew here, deliberately. driver / supervisor /
    -- loadman / vehicle_id / vehicle_no stay on the DOCUMENT, because they are
    -- "who of OURS did it" and they exist whenever goods move — a POS home
    -- delivery has a driver and a van and no consignment at all: no
    -- transporter, no LR, no distance, no e-way bill. Keeping them here would
    -- force a row on this table just to record who drove, which is the common
    -- case for most companies.
    --
    -- And they are NOT copied. One home per fact: the e-way builder reads the
    -- vehicle off the document (which it has loaded anyway) and everything
    -- else from here. Two copies of a vehicle number is the one arrangement
    -- worse than either, because they diverge and no report knows which to
    -- trust.

    ttd_remarks           character varying(250),

    -- ── Audit ────────────────────────────────────────────────────────────
    ttd_is_deleted        boolean NOT NULL DEFAULT false,
    ttd_sync_date         timestamp(6) with time zone,
    ttd_created_on        timestamp(6) with time zone NOT NULL DEFAULT now(),
    ttd_created_by        character varying(50) NOT NULL,
    ttd_modified_on       timestamp(6) with time zone,
    ttd_modified_by       character varying(50),

    CONSTRAINT pk_txn_transport_detail PRIMARY KEY (ttd_id, ttd_acc_year),

    -- WIDEN THIS PER MODULE. The band is the ONE home for transport on any
    -- document that moves goods, not a sales table — which is why
    -- acc_voucher_doc_register no longer keeps ship / dispatch address
    -- blocks: the payload builder reads them from here for every module.
    --
    -- STOCK_TRANSFER is admitted NOW, and it closes a gap that exists today:
    -- stock.stock_voucher carries a from-godown and a to-godown and NOTHING
    -- ELSE — no vehicle, no transporter, no LR, no distance — so an
    -- inter-branch transfer that needs an e-way bill has nowhere to put them.
    -- Direction OUTWARD, and BOTH ends are ours: from godown -> to godown.
    --
    -- PURCHASE_BILL and PURCHASE_RETURN join the list when those modules are
    -- built. A purchase models fine — supplier address is the FROM, our godown
    -- the TO, direction INWARD — even where the supplier raises the e-way bill
    -- and we only record its number.
    CONSTRAINT ck_ttd_doc_type CHECK (ttd_doc_type::text = ANY (ARRAY[
        'SALE_BILL'::text, 'DELIVERY_CHALLAN'::text,
        'SALE_RETURN'::text, 'DC_RETURN'::text,
        'STOCK_TRANSFER'::text])),
    CONSTRAINT ck_ttd_direction CHECK (ttd_direction::text = ANY (ARRAY[
        'OUTWARD'::text, 'INWARD'::text])),
    CONSTRAINT ck_ttd_transport_mode CHECK (ttd_transport_mode IS NULL OR ttd_transport_mode::text = ANY (ARRAY[
        'ROAD'::text, 'RAIL'::text, 'AIR'::text, 'SHIP'::text])),
    -- A row that names neither end is a row that says nothing.
    CONSTRAINT ck_ttd_has_an_end CHECK (
        ttd_from_godown_id IS NOT NULL OR ttd_to_godown_id IS NOT NULL
        OR ttd_from_name IS NOT NULL OR ttd_to_name IS NOT NULL),

    CONSTRAINT fk_ttd_transporter FOREIGN KEY (ttd_transporter_id)
        REFERENCES public.transporter_master (trn_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ttd_from_godown FOREIGN KEY (ttd_from_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ttd_to_godown FOREIGN KEY (ttd_to_godown_id)
        REFERENCES inventory.godown_locations (gdl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT
) PARTITION BY LIST (ttd_acc_year);

ALTER TABLE IF EXISTS public.txn_transport_detail OWNER to postgres;

-- 1:1 with its document. This is the index the entry screen, the print
-- template and the e-way builder all read by.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ttd_doc
    ON public.txn_transport_detail USING btree (ttd_doc_type, ttd_doc_id, ttd_acc_year)
    WHERE ttd_is_deleted = false;

-- "What did this transporter carry" — leads on the company, so it is a report
-- index and NOT a cover for fk_ttd_transporter. The three below are.
CREATE INDEX IF NOT EXISTS ix_ttd_transporter
    ON public.txn_transport_detail USING btree (ttd_company_id, ttd_transporter_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ttd_is_deleted = false AND ttd_transporter_id IS NOT NULL;

-- FK-covering, the house rule. ix_ttd_transporter above leads on the COMPANY,
-- so it does not cover fk_ttd_transporter — the same shape that left
-- fk_ptc_party uncovered two migrations ago.
CREATE INDEX IF NOT EXISTS ix_ttd_transporter_fk
    ON public.txn_transport_detail USING btree (ttd_transporter_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ttd_transporter_id IS NOT NULL AND ttd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_ttd_from_godown
    ON public.txn_transport_detail USING btree (ttd_from_godown_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ttd_from_godown_id IS NOT NULL AND ttd_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_ttd_to_godown
    ON public.txn_transport_detail USING btree (ttd_to_godown_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ttd_to_godown_id IS NOT NULL AND ttd_is_deleted = false;

COMMENT ON TABLE public.txn_transport_detail IS
    'One transport band for every goods-moving document. FROM and TO are positional and ttd_direction says which end is ours; gdr_dispatch_* reads ttd_from_*, gdr_ship_* reads ttd_to_*, with no per-document branch. 1:1 with its document via ux_ttd_doc. The vehicle and the crew stay on the DOCUMENT — they exist even when there is no consignment at all.';
COMMENT ON COLUMN public.txn_transport_detail.ttd_direction IS
    'OUTWARD: FROM is our godown, TO is the party. INWARD (both returns): FROM is the party''s pickup, TO is our godown.';
COMMENT ON COLUMN public.txn_transport_detail.ttd_doc_id IS
    'Polymorphic: no FK, because a child cannot key four different partitioned parents. The service is what stops a band outliving its document — the same price txn_charge_detail and txn_status_log already pay.';
COMMENT ON COLUMN public.txn_transport_detail.ttd_transporter_gstin IS
    'The portal''s transporterId: a 15-character GSTIN or enrolment id, NOT the transporter_master uuid in ttd_transporter_id.';


-- ═══════════════════════════════════════════════════════════════════════════
--  §B  RE-TENDER — change how a bill was paid, without touching the bill.
--
--  ── The counter problem ─────────────────────────────────────────────────
--  A supermarket till. The bill is rung up, the customer says UPI, the
--  operator marks UPI and moves on. The UPI then fails and the customer pays
--  cash. This happens many times a day, and today there is no way to record it
--  except editing or cancelling a POSTED bill — both wrong: the SALE was
--  correct, only the PAYMENT changed.
--
--  ── Why it does not collide with the IRN / e-way lock ───────────────────
--  The tender is NOT part of the GST document. It is not on the e-invoice, not
--  in GSTR-1, not on the e-way bill. Changing it declares nothing new, so the
--  "once declared it is not ours to edit" rule does not apply — that rule is
--  about the DOCUMENT. Re-tendering is allowed on a POSTED bill that already
--  carries an IRN.
--
--  ── Why the old row is VOIDED, not deleted and not overwritten ──────────
--  The failed UPI really happened at the counter, and a supervisor reviewing a
--  till needs to see it. td_is_deleted would say "keyed wrong" when the truth
--  is "payment failed" — a different fact, and the difference is exactly what
--  is worth reviewing. A negative counter-row is not available either:
--  ck_td_amounts already enforces td_amount >= 0, and that CHECK is correct —
--  it guards one row's own arithmetic, not a contended resource.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_tender_detail
    ADD COLUMN IF NOT EXISTS td_is_voided   boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS td_void_reason character varying(30),
    ADD COLUMN IF NOT EXISTS td_voided_on   timestamp(6) with time zone,
    ADD COLUMN IF NOT EXISTS td_voided_by   uuid,
    ADD COLUMN IF NOT EXISTS td_replaces_id uuid;

ALTER TABLE accounts.acc_tender_detail
    DROP CONSTRAINT IF EXISTS ck_td_void_reason;
ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT ck_td_void_reason CHECK (
        td_void_reason IS NULL OR td_void_reason::text = ANY (ARRAY[
            'UPI_FAILED'::text, 'CARD_DECLINED'::text, 'CHEQUE_REFUSED'::text,
            'KEYED_WRONG'::text, 'CUSTOMER_CHANGED'::text, 'OTHER'::text]));

-- A voided row must say WHEN and WHY; a live row must say neither.
ALTER TABLE accounts.acc_tender_detail
    DROP CONSTRAINT IF EXISTS ck_td_void_pair;
ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT ck_td_void_pair CHECK (
        (td_is_voided = false AND td_void_reason IS NULL AND td_voided_on IS NULL)
     OR (td_is_voided = true  AND td_void_reason IS NOT NULL AND td_voided_on IS NOT NULL));

COMMENT ON COLUMN accounts.acc_tender_detail.td_is_voided IS
    'This tender did not happen — the UPI failed, the card was declined. The row STAYS so a till review can see it. Every till and day-book report filters NOT td_is_voided; audit reads both halves.';
COMMENT ON COLUMN accounts.acc_tender_detail.td_replaces_id IS
    'On the REPLACEMENT row: the td_id it stands in for. Gives the pair without a join through the voucher.';

CREATE INDEX IF NOT EXISTS ix_td_voided
    ON accounts.acc_tender_detail (td_company_id, td_branch_id, td_doc_date)
    WHERE td_is_voided = true AND td_is_deleted = false;


-- ── The contra voucher type ──────────────────────────────────────────────
--
-- CONTRA, like ChqClr, because that is exactly what this is: value moves
-- between two tender ledgers and the PARTY BALANCE NEVER MOVES.
--
--     DR  Cash            (the tender that really happened)
--         CR  UPI clearing (the one that did not)
--
-- Reversing the original posting and re-posting would briefly UNSETTLE the
-- bill, and a failure between the two steps would leave it that way. A contra
-- cannot: the bill stays settled throughout, and it reads to an accountant the
-- way it reads to the cashier.
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT * FROM (VALUES
 ('TndC', 'Tender Change', 'TndC', 'ACCOUNTING'::accounts."VoucherCategory", 'CONTRA'::accounts."VoucherNature",
          'AUTO'::accounts."VoucherNumberingMode",
          -- cash and bank are EXCLUSIVE (chk_acc_voucher_types_cash_bank_exclusive)
          -- and neither fits: a tender change can go cash->bank or bank->cash,
          -- and which it is depends on the ROW, not the type. Both false, like
          -- Bil and Rct. ChqClr can say bank=true only because it is always one.
          'tnc', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false, true, false, false, false,
          'TENDER CHANGE', 330, true, true, 'Contra', 'Contra', 'system')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.column1);

INSERT INTO accounts.acc_voucher_seq
    (seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year, seq_device_id, seq_device_code, seq_period_key,
     seq_last_no, seq_voucher_prefix, seq_company_code, seq_branch_code, seq_voucher_suffix, seq_no_width)
SELECT t.vchr_type_id, s.seq_company_id, s.seq_branch_id, s.seq_acc_year, s.seq_device_id, s.seq_device_code, s.seq_period_key,
       0, t.vchr_no_prefix, s.seq_company_code, s.seq_branch_code, t.vchr_no_suffix, t.vchr_no_width
FROM accounts.acc_voucher_seq s
JOIN accounts.acc_voucher_types b ON b.vchr_type_id = s.seq_vchr_type_id AND b.vchr_type_code = 'Bil'
CROSS JOIN accounts.acc_voucher_types t
WHERE t.vchr_type_code = 'TndC'
  AND s.seq_is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq x
                   WHERE x.seq_vchr_type_id = t.vchr_type_id
                     AND x.seq_company_id = s.seq_company_id
                     AND x.seq_branch_id  = s.seq_branch_id
                     AND x.seq_acc_year   = s.seq_acc_year
                     AND x.seq_device_id IS NOT DISTINCT FROM s.seq_device_id);


-- ── The right ────────────────────────────────────────────────────────────
-- Its own flag, not `amend`. A till operator must be able to fix their own
-- counter in the next thirty seconds, but this moves money between ledgers —
-- so it is grantable separately from posting.
ALTER TABLE public.user_menus
    ADD COLUMN IF NOT EXISTS um_can_retender boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_menus.um_can_retender IS
    'May change how a posted bill was paid (POST /bills/retender). Separate from um_can_amend: the sale is not being edited, only the tender. Granting a menu is a FULL REPLACE — send every flag or the others are silently revoked.';


-- ═══════════════════════════════════════════════════════════════════════════
--  Partitions for §A — and a CORRECTION to what four earlier migrations said.
--
--  Those headers state that public.fn_create_year_partitions "does not exist".
--  THAT IS WRONG, and this is the correction. It does exist, it is
--  catalogue-driven (it scans pg_partitioned_table for LIST-partitioned,
--  single-key tables in public / sales / accounts and makes a partition for
--  each), and it would indeed pick this table up with no change. The earlier
--  check looked only for its definition in the migration FILES, where it is
--  absent — it lives in the database without ever having been in the
--  migration history — and concluded too much from that.
--
--  The adaptation those migrations made was still the right one, for a reason
--  that survives the correction:
--
--    * public.ensure_acc_year_partitions is the helper the APPLICATION calls.
--      receipt.guards.ts tells an operator to run it by name, and six module
--      READMEs document it. Nothing in src/ calls fn_create_year_partitions.
--    * ensure_acc_year_partitions also covers the FOUR stock.* partitioned
--      tables, via stock.fn_create_stock_partitions. The catalogue-driven one
--      scans only public / sales / accounts and MISSES all four.
--
--  So the explicit list is the one that must know about this table. It is
--  added there. The catalogue-driven helper will find it too, which is
--  harmless: both use CREATE TABLE IF NOT EXISTS.
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
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_temp_credit FOR VALUES IN (%L)',
        'acc_temp_credit_' || v_suffix, v_year);

    -- ── Added by 20260922040000 ──────────────────────────────────────────
    --  The transport band. Written for every goods-moving document that has a
    --  consignment, so a missing partition stops a dispatch.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_transport_detail FOR VALUES IN (%L)',
        'txn_transport_detail_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

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
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_transport_detail FOR VALUES IN (%L)',
            'txn_transport_detail_' || replace(v_year, '-', '_'), v_year);
        RAISE NOTICE 'txn_transport_detail partition ensured for %', v_year;
    END LOOP;
END
$backfill$;
