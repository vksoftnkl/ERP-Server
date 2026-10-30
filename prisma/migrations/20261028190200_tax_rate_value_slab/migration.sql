-- ═══════════════════════════════════════════════════════════════════════════
--  P15 / ENT-09 — value-based GST slab on the rate master (GST 2.0, 22-Sep-2025: apparel ≤ ₹2,500
--  per piece 5 %, above 18 %). A rate row may name the rate that applies ABOVE a value per piece;
--  the purchase line's taxable value per piece after discount decides (plan addendum 2 R25).
--  E.g. on "GST 5 % apparel": tax_value_threshold = 2500, tax_above_tax_id = the 18 % row.
--  Code: src/modules/purchase/common/purchase-value-slab.ts (does nothing until these columns exist).
--  NOT APPLIED — the apply step was refused by the permission check on 2026-10-28.
--  To apply: copy to prisma/migrations/20261028190200_tax_rate_value_slab/migration.sql, add the two
--  fields to the TaxRateMaster model, then npx prisma db execute --file … &&
--  npx prisma migrate resolve --applied 20261028190200_tax_rate_value_slab
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory.tax_rate_master
    ADD COLUMN IF NOT EXISTS tax_value_threshold numeric(14, 2) NULL,
    ADD COLUMN IF NOT EXISTS tax_above_tax_id    uuid           NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tax_value_slab') THEN
    ALTER TABLE inventory.tax_rate_master
      ADD CONSTRAINT ck_tax_value_slab CHECK ((tax_value_threshold IS NULL) = (tax_above_tax_id IS NULL)
                                             AND (tax_value_threshold IS NULL OR tax_value_threshold > 0)
                                             AND (tax_above_tax_id IS NULL OR tax_above_tax_id <> tax_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tax_above_tax') THEN
    ALTER TABLE inventory.tax_rate_master
      ADD CONSTRAINT fk_tax_above_tax FOREIGN KEY (tax_above_tax_id) REFERENCES inventory.tax_rate_master (tax_id);
  END IF;
END $$;
