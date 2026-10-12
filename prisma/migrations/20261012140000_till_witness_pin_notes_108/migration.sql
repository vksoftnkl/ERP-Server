-- ═══════════════════════════════════════════════════════════════════════════
--  Till: a pickup / top-up is witnessed by the cashier's PIN — notes 108 (2026-10-12)
--
--  /till/movements/create took a PICKUP or TOP_UP on a supervisor's word: the
--  witness (the session's cashier by default) was named, never proven. It now
--  wants witnessPin, the witness's till PIN (usr_pin_hash, notes 95), checked
--  as /till/sessions/decide-variance checks approverPin.
--
--  One column: when that PIN was checked. NULL is a movement nobody proved a
--  witness for — DROP / PAID_IN / EXCHANGE (the cashier alone), a top-up the
--  session's own cashier brought, and every movement before notes 108.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.till_cash_movement
    ADD COLUMN IF NOT EXISTS tcm_witness_verified_on timestamptz;
ALTER TABLE accounts.till_cash_movement DROP CONSTRAINT IF EXISTS ck_tcm_witness_verified;
ALTER TABLE accounts.till_cash_movement
    ADD CONSTRAINT ck_tcm_witness_verified
    CHECK (tcm_witness_verified_on IS NULL OR tcm_witness_by IS NOT NULL);

COMMENT ON COLUMN accounts.till_cash_movement.tcm_witness_verified_on IS
    'When the witness''s till PIN was checked (notes 108); NULL = no witness proven.';
