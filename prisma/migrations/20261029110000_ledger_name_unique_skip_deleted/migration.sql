-- ═══════════════════════════════════════════════════════════════════════════
--  Ledger name and Tally name: a soft-deleted ledger no longer holds its name.
--
--  accounts.acc_ledger_master still carries two plain unique INDEXES from
--  20260223132356_changes (Prisma @@unique in the model; bare indexes, not
--  constraints):
--    acc_ledger_master_led_company_id_led_name_key        (led_company_id, led_name)
--    acc_ledger_master_led_company_id_led_tally_name_key  (led_company_id, led_tally_name)
--  Both count soft-deleted rows, so after a customer / supplier / ledger is
--  deleted, a new one with the same name in the same company fails with P2002
--  (409 CUSTOMER_DUPLICATE), although the service check, tr_led_name_scope and
--  the partial indexes of 20260917110000 all skip deleted ledgers. Both are
--  also inert for shared (NULL company) rows, because NULLs are distinct.
--
--  A. Ledger name. The live-row rule is already held without the old key:
--       uq_led_name_company  UNIQUE (led_company_id, lower(led_name))
--                            WHERE led_company_id IS NOT NULL AND NOT led_is_deleted
--       uq_led_name_shared   UNIQUE (lower(led_name))
--                            WHERE led_company_id IS NULL AND NOT led_is_deleted
--       tr_led_name_scope    company-scoped vs shared clash
--     The old key is dropped.
--
--  B. Tally name. It had no partial replacement, so two are created on the
--     same pattern (case-insensitive, live rows only, rows with a Tally name
--     only), then the old key is dropped. Checked on localhost/ERP before
--     writing: no live duplicates in either scope.
--
--  The Prisma model drops both matching @@unique lines in the same change, or
--  migrate dev would recreate the old indexes. The partial indexes stay
--  DB-only (Prisma cannot express them).
--
--  Idempotent: a second run does nothing.
-- ═══════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS accounts.acc_ledger_master_led_company_id_led_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_led_tally_name_company
    ON accounts.acc_ledger_master (led_company_id, lower(led_tally_name))
 WHERE led_company_id IS NOT NULL AND NOT led_is_deleted AND led_tally_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_led_tally_name_shared
    ON accounts.acc_ledger_master (lower(led_tally_name))
 WHERE led_company_id IS NULL AND NOT led_is_deleted AND led_tally_name IS NOT NULL;

DROP INDEX IF EXISTS accounts.acc_ledger_master_led_company_id_led_tally_name_key;
