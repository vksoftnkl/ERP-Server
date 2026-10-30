-- ═══════════════════════════════════════════════════════════════════════════
--  sales line items -> inventory.tax_rate_master
--
--  Every sale line carries the tax it was charged (sbi_tax_perc, sbi_tax_amt)
--  but not the tax ROW those numbers came from. This adds that reference to
--  the bill, order and quotation lines.
--
--  All three tables are partitioned by acc_year, which is what shapes the
--  script: a column added to the parent cascades to the partitions for free,
--  but an FK validated up front would scan each of them, so every constraint
--  goes on NOT VALID and is validated straight after, while the column is
--  still all-NULL. (NOT VALID on a partitioned parent needs PG 18, which this
--  database already requires for native uuidv7().)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
--  1 · BASE COLUMNS — the ones that get expensive after go-live
--
--  All nullable, no defaults, so every ALTER is a catalogue-only change: no
--  table rewrite, no lock beyond a brief ACCESS EXCLUSIVE. Adding a column to
--  a partitioned parent cascades to its partitions automatically.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1.1 · Which tax row did this line actually use? ──────────────────────
--
--  The line stores its percentages but not their SOURCE, so posting would have
--  to re-read item_master.item_default_tax_id — today's value, not the bill's.
--  Two ways that breaks:
--
--    · item_tax_history exists precisely because rates change. A repost, or a
--      post deferred past a rate change, resolves a different ledger than the
--      original posting. A voucher stops being reproducible.
--
--    · Falling back to "match on the percentage" cannot work here: this
--      database has TWO rows at 18% ('GST 18%', 'GST @ 18%') and two at 5%.
--      A percentage cannot tell them apart, so the join picks whichever row
--      the planner happened to return.
--
--  Nullable because historical rows have no answer — and NULL is honest. The
--  posting routine treats NULL as "fall through to acc_ledger_map", which is
--  exactly what those rows do today.
ALTER TABLE sales.sale_bill_item
    ADD COLUMN IF NOT EXISTS sbi_tax_id uuid;
ALTER TABLE sales.sale_order_item
    ADD COLUMN IF NOT EXISTS soi_tax_id uuid;
ALTER TABLE sales.sale_quotation_item
    ADD COLUMN IF NOT EXISTS sqi_tax_id uuid;

-- NOT VALID: existing rows are legitimately NULL and an FK ignores NULLs, but
-- NOT VALID keeps the ALTER from scanning three partitions each. VALIDATE
-- immediately after — it is cheap on an all-NULL column.
-- ADD CONSTRAINT has no IF NOT EXISTS, so each one is guarded — this file has
-- to survive being run twice.
DO $do$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('sales.sale_bill_item',      'fk_sbi_tax', 'sbi_tax_id'),
        ('sales.sale_order_item',     'fk_soi_tax', 'soi_tax_id'),
        ('sales.sale_quotation_item', 'fk_sqi_tax', 'sqi_tax_id')
    ) AS t(tbl, con, col)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
                        WHERE conname = r.con AND conrelid = r.tbl::regclass) THEN
            EXECUTE format(
                'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I)
                 REFERENCES inventory.tax_rate_master (tax_id)
                 ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID',
                r.tbl, r.con, r.col);
        END IF;
    END LOOP;
END $do$;

ALTER TABLE sales.sale_bill_item      VALIDATE CONSTRAINT fk_sbi_tax;
ALTER TABLE sales.sale_order_item     VALIDATE CONSTRAINT fk_soi_tax;
ALTER TABLE sales.sale_quotation_item VALIDATE CONSTRAINT fk_sqi_tax;

-- Posting joins line -> tax -> its ledger columns. Partial, because the column is
-- NULL on every historical row and those never take this path.
CREATE INDEX IF NOT EXISTS ix_sbi_tax ON sales.sale_bill_item      (sbi_tax_id) WHERE sbi_tax_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_soi_tax ON sales.sale_order_item     (soi_tax_id) WHERE soi_tax_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_sqi_tax ON sales.sale_quotation_item (sqi_tax_id) WHERE sqi_tax_id IS NOT NULL;

COMMENT ON COLUMN sales.sale_bill_item.sbi_tax_id IS
    'The tax_rate_master row this line was taxed under, snapshotted at save. Never re-read from item_master at posting time: the item default is mutable and two tax rows can share a percentage.';

-- ── 1.2 · The same question, for a charge ────────────────────────────────
--
--  cd_tax_code already exists on txn_charge_detail. It has no FK and is NULL
--  on every one of the 33 live rows. Same reasoning as 1.1, plus: GSTR-1
--  reports by HSN/SAC, and a freight charge carries its own SAC.
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_cd_tax'
                      AND conrelid = 'public.txn_charge_detail'::regclass) THEN
        ALTER TABLE public.txn_charge_detail
            ADD CONSTRAINT fk_cd_tax FOREIGN KEY (cd_tax_code)
            REFERENCES inventory.tax_rate_master (tax_id)
            ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
    END IF;
END $do$;
ALTER TABLE public.txn_charge_detail VALIDATE CONSTRAINT fk_cd_tax;

CREATE INDEX IF NOT EXISTS ix_cd_tax ON public.txn_charge_detail (cd_tax_code) WHERE cd_tax_code IS NOT NULL;

COMMENT ON COLUMN public.txn_charge_detail.cd_tax_code IS
    'tax_rate_master row for this charge''s own GST. Only meaningful when cd_tax_apl and NOT cd_before_tax — a before-tax charge is taxed at the item rate and its GST already sits in the item lines.';
