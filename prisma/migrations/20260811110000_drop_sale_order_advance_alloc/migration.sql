-- ───────────────────────────────────────────────────────────────────────────
--  Drop sales.sale_order_advance_alloc
--
--  The table was added by 20260808132323 to record where an advance taken up
--  front actually went (ADJUSTED / REFUNDED / FORFEITED / TRANSFERRED), one row
--  per application. It is being removed: the money coming IN is already
--  accounts.acc_tender_detail's fact, the accounting effect is already the
--  advance receipt raised in accounts.acc_voucher_header / acc_vouchers, and the
--  four roll-up columns on sales.sale_order (so_advance_recd_amt,
--  so_advance_adjusted_amt, so_advance_refund_amt, so_advance_forfeit_amt) are
--  what every reader actually used. Those columns STAY — they are now stated by
--  the caller and still guarded by ck_so_advance_balance — so nothing that reads
--  an order's advance position changes shape.
--
--  DROP TABLE on the LIST-partitioned parent takes its partitions
--  (sale_order_advance_alloc_YYYY_YYYY), its four partial indexes (ix_soa_order,
--  ix_soa_bill, ix_soa_tender, ix_soa_type_date), its six CHECK constraints
--  (ck_soa_alloc_type, ck_soa_amount, ck_soa_refund_mode, ck_soa_target,
--  ck_soa_no_self_transfer, ck_soa_tender_pair) and its five FKs (fk_soa_order,
--  fk_soa_target_order, fk_soa_bill, fk_soa_tender, fk_soa_ledger) with it. No
--  other table has an FK pointing AT it, so no CASCADE is needed and none is
--  used — if anything unexpectedly depends on it, this migration should fail
--  loudly rather than drop that too.
-- ───────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS sales.sale_order_advance_alloc;


-- ───────────────────────────────────────────────────────────────────────────
--  Teach public.ensure_acc_year_partitions to stop provisioning it
--
--  Same helper as 20260804112944 (extended by 20260808132323, 20260810130000,
--  20260810140000, 20260810160000, 20260811060000, 20260811080000 and
--  20260811090000). Only the sale_order_advance_alloc block is gone; every
--  other table is unchanged and in the same order. Without this, opening the
--  next fiscal year would fail on a PARTITION OF against a table that no longer
--  exists — the whole call, so no year would be openable at all.
--
--  Idempotent, as before:
--
--      SELECT public.ensure_acc_year_partitions('2027-2028');
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
END;
$$;

COMMENT ON FUNCTION public.ensure_acc_year_partitions(character(9)) IS
    'Idempotently creates the sale_bill / sale_bill_item / acc_tender_detail / txn_status_log / txn_charge_detail / txn_hold / sale_order / sale_order_item / sale_quotation / sale_quotation_item / acc_bill_balance / acc_bill_adjustment / acc_opening_balance / acc_pdc_register LIST partitions for one accounting year (YYYY-YYYY). Run it whenever a fiscal year is opened.';


-- ───────────────────────────────────────────────────────────────────────────
--  Restate the roll-up comment on sale_order
--
--  20260808132323 documented so_advance_adjusted_amt / _refund_amt /
--  _forfeit_amt as caches of the table this migration drops. They are still
--  the same columns holding the same money; only their source changed.
-- ───────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN sales.sale_order.so_advance_adjusted_amt IS
    'Advance set against invoices. Stated by the caller; part of ck_so_advance_balance.';

COMMENT ON COLUMN sales.sale_order.so_advance_refund_amt IS
    'Advance paid back to the customer. Stated by the caller; part of ck_so_advance_balance.';

COMMENT ON COLUMN sales.sale_order.so_advance_forfeit_amt IS
    'Advance kept when the order was cancelled. Stated by the caller; part of ck_so_advance_balance.';
