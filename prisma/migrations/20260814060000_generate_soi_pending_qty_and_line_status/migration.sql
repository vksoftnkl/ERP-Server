DO $$
DECLARE
    bad bigint;
BEGIN
    IF to_regclass('sales.sale_order_item') IS NULL THEN
        RETURN;
    END IF;

    SELECT count(*) INTO bad
    FROM   sales.sale_order_item
    WHERE  soi_is_deleted = false
      AND  round(soi_delivered_qty + soi_cancelled_qty, 3) > round(soi_net_qty, 3);

    IF bad > 0 THEN
        RAISE EXCEPTION
            'sale_order_item: % row(s) have delivered+cancelled greater than '
            'soi_net_qty. Fix those lines before running migration 06m — a '
            'generated soi_pending_qty would be negative and ck_soi_qty_signs '
            'would refuse the table.', bad;
    END IF;
END
$$;


DO $$
DECLARE
    repaired bigint;
BEGIN
    IF to_regclass('sales.sale_order_item') IS NULL THEN
        RAISE NOTICE 'sale_order_item does not exist — skipping migration 06m.';
        RETURN;
    END IF;

    -- Already generated? Nothing to do.
    IF EXISTS (SELECT 1
               FROM   pg_attribute
               WHERE  attrelid = 'sales.sale_order_item'::regclass
                 AND  attname  = 'soi_pending_qty'
                 AND  attgenerated <> '') THEN
        RAISE NOTICE 'migration 06m already applied — skipping.';
        RETURN;
    END IF;

    -- ── Drop what depends on the two columns ───────────────────────────────
    -- The partial index reads soi_pending_qty; the three CHECKs read one or
    -- both. Dropped explicitly rather than by CASCADE so nothing else can go
    -- with them unnoticed.
    DROP INDEX IF EXISTS sales.ix_soi_pending_item;

    ALTER TABLE sales.sale_order_item
        DROP CONSTRAINT IF EXISTS ck_soi_qty_signs,
        DROP CONSTRAINT IF EXISTS ck_soi_qty_balance,
        DROP CONSTRAINT IF EXISTS ck_soi_line_status;

    ALTER TABLE sales.sale_order_item
        DROP COLUMN IF EXISTS soi_pending_qty,
        DROP COLUMN IF EXISTS soi_line_status;

    -- ── Repair the rows the guard above cannot see ─────────────────────────
    -- ck_soi_qty_signs is checked on EVERY row; the guard deliberately is not.
    -- A soft-deleted line therefore cannot be waved through — a negative
    -- generated soi_pending_qty on it refuses the whole table just the same.
    --
    -- Here, not before the guard: the old ck_soi_qty_balance pinned
    -- order = delivered + cancelled + pending, so zeroing the settled columns
    -- while the stale soi_pending_qty still existed would have violated it.
    -- Both are gone by this point, so the two caches are writable on their own.
    --
    -- Only one shape is repaired, and only because the settled quantities on it
    -- are provably fiction: the line is deleted, its order is deleted, and no
    -- sale_bill_item anywhere claims to have billed it. Delivered means "a bill
    -- line exists"; with no bill line the cache is a leftover from the cancel
    -- that zeroed soi_net_qty, not a record of anything shipped.
    --
    -- Deliberately narrow. Anything ELSE out of balance — a live line, or a
    -- deleted one a bill really does point at — is untouched and will stop the
    -- migration at ck_soi_qty_signs below. That is the correct outcome: a real
    -- inconsistency needs a person, not an UPDATE buried in a migration.
    UPDATE sales.sale_order_item i
       SET soi_delivered_qty = 0,
           soi_cancelled_qty = 0
     WHERE i.soi_is_deleted = true
       AND round(i.soi_net_qty - i.soi_delivered_qty
                               - i.soi_cancelled_qty, 3) < 0
       AND EXISTS (SELECT 1
                   FROM   sales.sale_order o
                   WHERE  o.so_id         = i.soi_order_id
                     AND  o.so_acc_year   = i.soi_acc_year
                     AND  o.so_is_deleted = true)
       AND NOT EXISTS (SELECT 1
                       FROM   sales.sale_bill_item b
                       WHERE  b.sbi_src_doc_id      = i.soi_order_id
                         AND  b.sbi_src_doc_year    = i.soi_acc_year
                         AND  b.sbi_src_doc_line_no = i.soi_line_no);

    GET DIAGNOSTICS repaired = ROW_COUNT;

    IF repaired > 0 THEN
        RAISE NOTICE 'migration 06m: cleared stale fulfilment caches on % '
                     'soft-deleted line(s) of deleted orders with no bill.',
                     repaired;
    END IF;

    -- ── Re-add them as derivations ─────────────────────────────────────────
    -- STORED, not virtual: ix_soi_pending_item indexes soi_pending_qty and the
    -- pending-orders worklist is the query this table exists to answer.
    ALTER TABLE sales.sale_order_item
        ADD COLUMN soi_pending_qty numeric(15,3) NOT NULL
            GENERATED ALWAYS AS (
                round(soi_net_qty - soi_delivered_qty - soi_cancelled_qty, 3)
            ) STORED;

    -- Branch order is the whole definition:
    --   nothing billable ........... PENDING   (a zero line is not cancelled)
    --   nothing left, none billed .. CANCELLED (the line was withdrawn whole)
    --   nothing left ............... DELIVERED
    --   something settled .......... PARTIAL
    --   otherwise .................. PENDING
    ALTER TABLE sales.sale_order_item
        ADD COLUMN soi_line_status character varying(20) NOT NULL
            GENERATED ALWAYS AS (
                CASE
                    WHEN round(soi_net_qty, 3) <= 0                       THEN 'PENDING'
                    WHEN round(soi_net_qty - soi_delivered_qty
                                           - soi_cancelled_qty, 3) <= 0
                         AND round(soi_delivered_qty, 3) <= 0             THEN 'CANCELLED'
                    WHEN round(soi_net_qty - soi_delivered_qty
                                           - soi_cancelled_qty, 3) <= 0   THEN 'DELIVERED'
                    WHEN round(soi_delivered_qty + soi_cancelled_qty, 3) > 0
                                                                          THEN 'PARTIAL'
                    ELSE 'PENDING'
                END::character varying(20)
            ) STORED;

    -- ── Put the guards back ────────────────────────────────────────────────
    -- soi_pending_qty >= 0 is now the WHOLE fulfilment invariant. The identity
    -- net = delivered + cancelled + pending can no longer be violated — it is
    -- how the column is computed — so all that is left to enforce is that the
    -- two settled quantities never outrun the billable one, which is exactly
    -- what a non-negative pending says. ck_soi_qty_balance is not re-added for
    -- that reason: it had become a tautology over a generated column.
    ALTER TABLE sales.sale_order_item
        ADD CONSTRAINT ck_soi_qty_signs CHECK (
            soi_order_qty >= 0 AND soi_net_qty >= 0 AND soi_delivered_qty >= 0 AND
            soi_cancelled_qty >= 0 AND soi_pending_qty >= 0);

    -- Redundant while the CASE above is right, and the thing that catches it
    -- when an edit makes it wrong. A fifth status must fail here, loudly,
    -- rather than spread through the worklist.
    ALTER TABLE sales.sale_order_item
        ADD CONSTRAINT ck_soi_line_status CHECK (soi_line_status::text = ANY (ARRAY[
            'PENDING'::text, 'PARTIAL'::text, 'DELIVERED'::text, 'CANCELLED'::text]));

    RAISE NOTICE 'migration 06m applied: soi_pending_qty and soi_line_status are now GENERATED.';
END
$$;

-- Recreated verbatim — what is on back-order for an item, per branch. Outside
-- the DO block so it is re-established even on a re-run that skipped the body.
CREATE INDEX IF NOT EXISTS ix_soi_pending_item
    ON sales.sale_order_item USING btree
    (soi_item_id, soi_company_id, soi_branch_id, soi_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE soi_is_deleted = false AND soi_pending_qty > 0;
