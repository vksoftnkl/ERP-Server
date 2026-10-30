-- ═══════════════════════════════════════════════════════════════════════════
--  public.charge_master -> inventory.tax_rate_master
--
--  A charge posts through a revenue ledger, and that ledger now carries its own
--  rate (20260912060000_add_led_tax_id). This is the per-charge override for
--  the case where two charges share one ledger but not one rate.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The charge's override ────────────────────────────────────────────────
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'charge_master'
                      AND column_name  = 'chg_tax_id') THEN
        ALTER TABLE public.charge_master ADD COLUMN chg_tax_id uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_chg_tax'
                      AND conrelid = 'public.charge_master'::regclass) THEN
        ALTER TABLE public.charge_master
            ADD CONSTRAINT fk_chg_tax FOREIGN KEY (chg_tax_id)
            REFERENCES inventory.tax_rate_master (tax_id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;

    --  A charge that carries no GST of its own must not name a rate: a
    --  before-tax charge is taxed at the ITEM's rate inside the item line, and
    --  a non-taxable charge is never taxed. Either way a rate here would be one
    --  nothing reads. Single-table, so a CHECK is enough; the other half of the
    --  rule — that a taxable charge must RESOLVE to a rate — spans the ledger
    --  and lives in the trigger below.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'ck_chg_tax_id'
                      AND conrelid = 'public.charge_master'::regclass) THEN
        ALTER TABLE public.charge_master
            ADD CONSTRAINT ck_chg_tax_id CHECK (
                (chg_tax_apl AND NOT chg_before_tax) OR chg_tax_id IS NULL);
    END IF;
END $do$;

CREATE INDEX IF NOT EXISTS ix_chg_tax ON public.charge_master (chg_tax_id) WHERE chg_tax_id IS NOT NULL;

COMMENT ON COLUMN public.charge_master.chg_tax_id IS
    'Overrides the posting ledger''s led_tax_id for this charge. NULL — the normal case — inherits it, so several charges may share one revenue ledger and still differ on rate. Must be NULL unless chg_tax_apl and NOT chg_before_tax.';
