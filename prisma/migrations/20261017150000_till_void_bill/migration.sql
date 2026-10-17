-- ═══════════════════════════════════════════════════════════════════════════
--  Void bill and void line (design REV 2, approved 2026-10-17)
--
--  A void is a cancel that is recorded and shown: the same unwind runs
--  (reversal, stock, tenders, loyalty, register; status CANCELLED), and on top
--  of it one row of evidence is stamped once — was the bill PRINTED before it
--  was voided, how many minutes after the post, the n-th void of the session —
--  and a BILL_VOID till event is journalled. No supervisor is asked by
--  default (REV 2): the VOID_BILL rule ships NEVER; a company that wants a
--  PIN switches it on in Approval Rules (276) and the gate's 428 applies.
--
--    1 · accounts.till_void — one row per voided SALE_BILL, year-partitioned
--    2 · ensure_acc_year_partitions(): + till_void, + print_log
--    3 · print_log_2027_2028 (the evidence had nowhere to go from 1-04-2027),
--        and print_log's CHECKs aligned with the TS constants (REPRINT, copy 10)
--    4 · the shipped VOID_BILL rule → NEVER
--    5 · six shipped VOID_BILL reasons
--
--  The error wording (SALES_USE_VOID, TILL_VOID_*) is in prisma/seed/
--  Error_Messages.json (version 2026-10-17.1), loaded by the seed runner.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · accounts.till_void ─────────────────────────────────────────────────
--  Written ONCE by /bills/void inside the cancel's own transaction; never
--  recomputed. tvd_was_printed is the control: a public.print_log row for
--  the bill with plg_status SUCCESS and plg_output_mode PRINT (or REPRINT) of
--  a customer-facing purpose (SALE_INVOICE / SALE_RECEIPT), as it stood at
--  the moment of the void.
CREATE TABLE IF NOT EXISTS accounts.till_void
(
    tvd_id                    uuid          NOT NULL DEFAULT uuidv7(),
    tvd_company_id            uuid          NOT NULL,
    tvd_branch_id             uuid          NOT NULL,
    tvd_tenant_id             uuid,
    tvd_acc_year              character(9)  NOT NULL,
    tvd_src_doc_type          character varying(30) NOT NULL DEFAULT 'SALE_BILL',
    tvd_src_doc_id            uuid          NOT NULL,
    tvd_src_doc_refno         character varying(100),
    tvd_session_id            uuid          NOT NULL,               -- the bill's live session
    tvd_device_id             uuid,                                 -- the device the void was keyed on (login token)
    tvd_cashier_id            uuid          NOT NULL,               -- the session's operator
    tvd_voided_by             uuid          NOT NULL,
    tvd_voided_on             timestamptz   NOT NULL DEFAULT now(),
    tvd_amount                numeric(15,2) NOT NULL DEFAULT 0,     -- sb_bill_amt
    tvd_cash_amount           numeric(15,2) NOT NULL DEFAULT 0,     -- the cash part of its tenders
    tvd_reason_id             uuid          NOT NULL,
    tvd_note                  character varying(250),
    tvd_posted_on             timestamptz,                          -- the POSTED step, else sb_bill_datetime
    tvd_minutes_after_post    integer       NOT NULL DEFAULT 0,
    tvd_was_printed           boolean       NOT NULL DEFAULT false, -- THE control
    tvd_print_count           integer       NOT NULL DEFAULT 0,
    tvd_last_printed_on       timestamptz,
    tvd_print_failed          boolean       NOT NULL DEFAULT false, -- a FAILED print: "printer didn't work" was true
    tvd_session_void_no       integer       NOT NULL DEFAULT 1,     -- the n-th void of the session
    tvd_approval_id           uuid,                                 -- only when a company switched the rule on
    tvd_reversal_voucher_id   uuid,
    tvd_reversal_acc_year     character(9),
    tvd_sync_date             timestamptz,
    tvd_created_on            timestamptz   NOT NULL DEFAULT now(),
    tvd_created_by            character varying(50),
    CONSTRAINT pk_till_void PRIMARY KEY (tvd_id, tvd_acc_year),
    CONSTRAINT ck_tvd_doc_type CHECK (tvd_src_doc_type::text = 'SALE_BILL'),
    CONSTRAINT ck_tvd_minutes CHECK (tvd_minutes_after_post >= 0),
    CONSTRAINT ck_tvd_amount CHECK (tvd_amount >= 0),
    CONSTRAINT ck_tvd_print_count CHECK (tvd_print_count >= 0 AND (tvd_was_printed = (tvd_print_count > 0))),
    CONSTRAINT ck_tvd_void_no CHECK (tvd_session_void_no >= 1),
    CONSTRAINT ck_tvd_reversal_pair CHECK ((tvd_reversal_voucher_id IS NULL) = (tvd_reversal_acc_year IS NULL)),
    CONSTRAINT ck_tvd_acc_year_shape CHECK (tvd_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND right(tvd_acc_year, 4)::integer = left(tvd_acc_year, 4)::integer + 1)
) PARTITION BY LIST (tvd_acc_year);

--  One live row per bill. The partition key must be in a partitioned table's
--  unique index (cf. ux_tcm_doc_no); a bill lives in one year, so it still
--  means one row per bill.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tvd_doc
    ON accounts.till_void (tvd_src_doc_type, tvd_src_doc_id, tvd_acc_year);
CREATE INDEX IF NOT EXISTS ix_tvd_session
    ON accounts.till_void (tvd_session_id, tvd_acc_year, tvd_voided_on);
CREATE INDEX IF NOT EXISTS ix_tvd_branch_on
    ON accounts.till_void (tvd_company_id, tvd_branch_id, tvd_voided_on);
CREATE INDEX IF NOT EXISTS ix_tvd_cashier
    ON accounts.till_void (tvd_cashier_id, tvd_acc_year, tvd_voided_on);

--  The years the other till tables carry today.
CREATE TABLE IF NOT EXISTS accounts.till_void_2024_2025 PARTITION OF accounts.till_void FOR VALUES IN ('2024-2025');
CREATE TABLE IF NOT EXISTS accounts.till_void_2025_2026 PARTITION OF accounts.till_void FOR VALUES IN ('2025-2026');
CREATE TABLE IF NOT EXISTS accounts.till_void_2026_2027 PARTITION OF accounts.till_void FOR VALUES IN ('2026-2027');
CREATE TABLE IF NOT EXISTS accounts.till_void_2027_2028 PARTITION OF accounts.till_void FOR VALUES IN ('2027-2028');


-- ── 2 · the year roll: + till_void, + print_log ────────────────────────────
--  The whole function restated (its body as live on 2026-10-17 plus the two
--  new EXECUTEs), as every migration before it did.
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

    -- The stock engine's four, added by 20260907090000. This is the part the
    -- catalogue-driven helper does not reach.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$function$;


-- ── 3 · print_log: the 2027-28 partition, and the CHECKs the TS constants assume
--  print-render.constants.ts allows REPRINT as an output mode and up to 10
--  copies (MAX_COPIES); the live CHECKs refused both, so a server-side reprint's
--  log row was swallowed (print-log.service catches the insert) and the print
--  count under-counted. Aligned here, the evidence reads REPRINT too.
CREATE TABLE IF NOT EXISTS public.print_log_2027_2028 PARTITION OF public.print_log FOR VALUES IN ('2027-2028');

ALTER TABLE public.print_log DROP CONSTRAINT IF EXISTS ck_plg_output_mode;
ALTER TABLE public.print_log
    ADD CONSTRAINT ck_plg_output_mode CHECK (plg_output_mode::text = ANY (ARRAY['PRINT','REPRINT','PREVIEW','EMAIL','FILE']));
ALTER TABLE public.print_log DROP CONSTRAINT IF EXISTS ck_plg_copy_no;
ALTER TABLE public.print_log
    ADD CONSTRAINT ck_plg_copy_no CHECK (plg_copy_no >= 1 AND plg_copy_no <= 10);


-- ── 4 · the shipped VOID_BILL rule → NEVER (REV 2 §3.3) ─────────────────────
--  "No approval, only seen." The rule row stays so a company can switch it on
--  (ALWAYS / OVER_AMOUNT / OVER_COUNT) in Approval Rules (276); the gate is in
--  the route. Only the shipped row (company NULL, branch NULL, still as 124
--  shipped it) is touched: a company's own row is theirs. VOID_LINE stays as
--  shipped and is never asked — a line void is a journal, not a form.
UPDATE accounts.till_approval_rule
   SET tar_mode = 'NEVER',
       tar_remarks = 'a whole bill voided at the counter — recorded and shown, nobody asked (REV 2); set ALWAYS / OVER_AMOUNT / OVER_COUNT to ask a supervisor',
       tar_modified_on = now(),
       tar_modified_by = 'system'
 WHERE tar_event_code = 'VOID_BILL'
   AND tar_company_id IS NULL AND tar_branch_id IS NULL
   AND tar_is_deleted = false
   AND tar_mode = 'ALWAYS'
   AND tar_created_by = 'system';

--  A fresh database that somehow has no shipped row gets the NEVER one.
INSERT INTO accounts.till_approval_rule
    (tar_event_code, tar_mode, tar_channel, tar_min_role, tar_blocks_till, tar_remarks, tar_created_by)
SELECT 'VOID_BILL', 'NEVER', 'COUNTER', 'SUPERVISOR', true,
       'a whole bill voided at the counter — recorded and shown, nobody asked (REV 2); set ALWAYS / OVER_AMOUNT / OVER_COUNT to ask a supervisor',
       'system'
 WHERE NOT EXISTS (
         SELECT 1 FROM accounts.till_approval_rule r
          WHERE r.tar_event_code = 'VOID_BILL' AND r.tar_company_id IS NULL
            AND r.tar_branch_id IS NULL AND r.tar_is_deleted = false);


-- ── 5 · shipped VOID_BILL reasons (company NULL = shared) ──────────────────
INSERT INTO accounts.till_reason (trs_company_id, trs_category, trs_code, trs_name, trs_needs_note, trs_needs_ref, trs_sort_order, trs_created_by)
SELECT NULL, 'VOID_BILL', v.k, v.n, v.note, false, v.s, 'system'
  FROM (VALUES
        ('CUST_LEFT',     'Customer left',      false, 10),
        ('WRONG_ITEM',    'Wrong item billed',  false, 20),
        ('PRICE_DISPUTE', 'Price dispute',      true,  30),
        ('PRINTER_FAIL',  'Printer failure',    true,  40),
        ('OPERATOR_ERR',  'Operator error',     false, 50),
        ('SYSTEM_ERR',    'System error',       true,  60)) AS v(k, n, note, s)
 WHERE NOT EXISTS (
         SELECT 1 FROM accounts.till_reason r
          WHERE r.trs_company_id IS NULL AND r.trs_category = 'VOID_BILL'
            AND upper(r.trs_code) = v.k AND r.trs_is_deleted = false);


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent WHERE p.relname IN ('till_void', 'print_log') ORDER BY 1;
-- SELECT tar_event_code, tar_mode FROM accounts.till_approval_rule WHERE tar_event_code IN ('VOID_BILL', 'VOID_LINE') AND tar_company_id IS NULL;
-- SELECT trs_code, trs_name, trs_needs_note FROM accounts.till_reason WHERE trs_category = 'VOID_BILL' ORDER BY trs_sort_order;
