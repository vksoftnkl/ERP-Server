-- ─────────────────────────────────────────────────────────────────────────────
-- Drop inventory.tax_rate_master
--
-- Reverses 20260911060000_add_tax_rate_master in full: the table (and with it
-- its indexes, checks and FKs), the BEFORE INSERT/UPDATE guard on it, and the
-- guard's function, which has no other caller.
--
-- Nothing was ever migrated onto this table — inventory.item_tax_master stayed
-- the live GST rate master throughout — so there is no data to move back.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tr_tax_ledgers_global ON inventory.tax_rate_master;

DROP TABLE IF EXISTS inventory.tax_rate_master;

DROP FUNCTION IF EXISTS inventory.fn_tax_ledgers_global();
