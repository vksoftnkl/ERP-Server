-- sales.sale_bill, sales.sale_bill_item (20260731070026_add_sale_bill_tables)
-- and accounts.acc_tender_detail (20260731090000_add_acc_tender_detail) are
-- declaratively partitioned by LIST (acc_year). Those migrations create only
-- the parent shells and note that partitions "must be created separately, per
-- accounting year, before rows can be inserted" -- nothing ever did, so every
-- bill save failed at the DB with
--
--   no partition of relation "sale_bill" found for row
--   (Partition key of the failing row contains (sb_acc_year) = (2026-2027).)
--
-- This is the bootstrap the two migrations were waiting on: a helper that
-- creates all three partitions for one accounting year, plus a run of it over
-- every year already in public.fiscal_years. Call it again -- it is idempotent
-- -- whenever a new fiscal year is opened:
--
--   SELECT public.ensure_acc_year_partitions('2027-2028');
--
-- Indexes and constraints declared on the parents are inherited by partitions
-- created with PARTITION OF, so nothing else has to be replayed here.

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
END;
$$;

COMMENT ON FUNCTION public.ensure_acc_year_partitions(character(9)) IS
    'Idempotently creates the sale_bill / sale_bill_item / acc_tender_detail LIST partitions for one accounting year (YYYY-YYYY). Run it whenever a fiscal year is opened.';

-- Bootstrap every accounting year on record. fiscal_years is the authority on
-- which years exist; deleted rows are skipped.
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
