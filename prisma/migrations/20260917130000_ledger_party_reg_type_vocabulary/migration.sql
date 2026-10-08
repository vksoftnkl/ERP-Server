-- ═══════════════════════════════════════════════════════════════════════════
--  §4 — one vocabulary for led_gst_party_reg_type, and the SEZ contradiction
--
--  ── WHAT THIS IS ────────────────────────────────────────────────────────
--  23_ledger_party_fields.sql is not in this repository, so this file is the
--  part of it that still stands, rewritten from the review's own description:
--  one vocabulary, a CHECK behind it like every other combo-backed column on
--  this table already has, and the SEZ three-way contradiction tied together
--  NOT VALID. THE SEZ PREDICATE IS RECONSTRUCTED — check it against the
--  original before this reaches a box that matters.
--
--  What is deliberately NOT here is that file's §1 premise. The claim was that
--  none of the stored values match the combo's items, so the field renders
--  blank and saving writes the blank back. It has not been true since
--  1 June 2026: NexComboBox::selectByText lowercases and trims both sides, so
--  'REGULAR' selects Regular. Nothing renders blank and nothing is blanked.
--
--  ── THE VOCABULARY ──────────────────────────────────────────────────────
--  REGULAR / COMPOSITION / UNREGISTERED — the LedGstPartyRegType enum the DTO
--  already validates against. The CHECK just stops non-Nest writers (seeds,
--  Tally imports, psql) from inventing a fourth spelling.
--
--  Row counts re-checked on localhost/ERP, NOT taken from the original file
--  (which said 8 REGULAR / 3 UNREGISTERED): among LIVE rows it is 3 and 3,
--  with 55 NULL. Across all rows including deleted: 9, 9 and 58. Every stored
--  value is already in the vocabulary, so the normalisation below is a no-op
--  on today's data and is here for the boxes where it is not.
--
--  ── THE SEZ CONTRADICTION ───────────────────────────────────────────────
--  Three columns disagree. An SEZ unit is a registered person by definition —
--  it cannot be UNREGISTERED or COMPOSITION, and it cannot be without a GSTIN.
--  Today 3 rows carry led_is_sez, all soft-deleted, and 2 of them have no
--  GSTIN at all. NOT VALID is therefore not caution, it is necessary: the
--  constraint governs new and updated rows and leaves the three alone.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · Normalise whatever a non-Nest writer left behind, before the CHECK lands.
UPDATE accounts.acc_ledger_master
   SET led_gst_party_reg_type = upper(btrim(led_gst_party_reg_type))
 WHERE led_gst_party_reg_type IS NOT NULL
   AND led_gst_party_reg_type <> upper(btrim(led_gst_party_reg_type));

UPDATE accounts.acc_ledger_master
   SET led_gst_party_reg_type = NULL
 WHERE led_gst_party_reg_type = '';

-- 2 · The vocabulary. Validated immediately: every stored value already fits.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_led_gst_party_reg_type'
                    AND conrelid = 'accounts.acc_ledger_master'::regclass) THEN
    ALTER TABLE accounts.acc_ledger_master
      ADD CONSTRAINT chk_led_gst_party_reg_type CHECK (
        led_gst_party_reg_type IS NULL
        OR led_gst_party_reg_type IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED'));
  END IF;
END $$;

-- 3 · SEZ ties three columns together. NOT VALID: the 3 legacy rows stay.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_led_sez_consistency'
                    AND conrelid = 'accounts.acc_ledger_master'::regclass) THEN
    ALTER TABLE accounts.acc_ledger_master
      ADD CONSTRAINT chk_led_sez_consistency CHECK (
        led_is_sez = false
        OR (led_gst_party_reg_type = 'REGULAR'
            AND led_gstin_no IS NOT NULL
            AND btrim(led_gstin_no) <> ''))
      NOT VALID;
  END IF;
END $$;
