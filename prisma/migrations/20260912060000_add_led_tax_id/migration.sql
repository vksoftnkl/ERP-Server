-- ═══════════════════════════════════════════════════════════════════════════
--  accounts.acc_ledger_master -> inventory.tax_rate_master
--
--  A service ledger (freight, packing, labour) can appear as a taxable line on
--  a bill, and when it does it needs a tax ROW, not a bare percentage: cess,
--  taxability and the CGST/SGST/IGST ledgers all live on tax_rate_master.
--  Companion to 20260912050000_add_line_tax_id, which did the same for the
--  sales lines and for txn_charge_detail.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The ledger's own rate ────────────────────────────────────────────────
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'accounts' AND table_name = 'acc_ledger_master'
                      AND column_name  = 'led_tax_id') THEN
        ALTER TABLE accounts.acc_ledger_master ADD COLUMN led_tax_id uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_led_tax'
                      AND conrelid = 'accounts.acc_ledger_master'::regclass) THEN
        ALTER TABLE accounts.acc_ledger_master
            ADD CONSTRAINT fk_led_tax FOREIGN KEY (led_tax_id)
            REFERENCES inventory.tax_rate_master (tax_id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $do$;

CREATE INDEX IF NOT EXISTS ix_led_tax ON accounts.acc_ledger_master (led_tax_id) WHERE led_tax_id IS NOT NULL;

COMMENT ON COLUMN accounts.acc_ledger_master.led_tax_id IS
    'The GST rate this ledger carries when it appears as a taxable line — a service ledger such as freight or packing. Deliberately unconstrained by ledger type: a party or bank ledger simply leaves it NULL. Replaces led_gst_rate and led_tax_rate, which held a bare percentage and could not express cess or taxability.';
