-- ════════════════════════════════════════════════════════════════════════════
-- 20260929120000_pdc_amended_into_revision — notes (63): an amended payment
-- could no longer be cancelled or amended again
--
-- Since notes (62) C1, /payments/amend CANCELs the leaves of the old post
-- instead of soft-deleting them: the leaf stays on the book, used. But
-- assertIssuedChequesStillHeld refuses a cancel or an amend while any live
-- register row of the payment is past HELD, and it read the row the amend had
-- just cancelled as a cheque somebody acted on. pmt00398 (cheque → cash) was
-- stuck POSTED: "Cheque 94314094 is CANCELLED … unwind it on the Issued Cheques
-- screen (menu 52) first", with nothing on menu 52 to unwind.
--
--   1. acc_pdc_register.apd_amended_into_revision — the revision an amend
--      moved the document to when it cancelled this leaf; NULL for every
--      other row. The guard leaves these rows out: they are history of an
--      earlier revision, not an act on the cheque. A Stop or Void on menu 52
--      still sets CANCELLED with the column NULL, and still refuses.
--   2. the leaves already cancelled by an amend, backfilled from the reason
--      it wrote ("Amended into revision N") — the column is what is read from
--      here on, not the sentence
--   3. ck_apd_amended — only a CANCELLED row carries it, and N is a real
--      revision (an amend moves 0 → 1 at the least)
--
-- Re-runnable: every step is guarded.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · the column ──────────────────────────────────────────────────────────
ALTER TABLE accounts.acc_pdc_register
  ADD COLUMN IF NOT EXISTS apd_amended_into_revision integer;

COMMENT ON COLUMN accounts.acc_pdc_register.apd_amended_into_revision IS
  'Set by /payments/amend when it CANCELs a leaf of the old post: the revision the payment moved to. '
  'The unwind guards skip such rows. NULL for a leaf stopped, voided or cancelled any other way.';

-- ── 2 · the leaves an amend has already cancelled ───────────────────────────
-- Only the amend writes this reason, and only on a HELD issued leaf it moves to
-- CANCELLED; a Stop / Void on menu 52 writes "STOPPED: …" / "VOIDED: …" and
-- files a reversal voucher, which the amend never does.
UPDATE accounts.acc_pdc_register
   SET apd_amended_into_revision =
         substring(apd_cancel_reason FROM '^Amended into revision ([0-9]+)$')::integer
 WHERE apd_amended_into_revision IS NULL
   AND apd_tra_type = 'P'
   AND apd_status = 'CANCELLED'
   AND apd_bounce_voucher_id IS NULL
   AND apd_cancel_reason ~ '^Amended into revision [0-9]+$';

-- ── 3 · ck_apd_amended ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ck_apd_amended'
       AND conrelid = 'accounts.acc_pdc_register'::regclass
  ) THEN
    ALTER TABLE accounts.acc_pdc_register
      ADD CONSTRAINT ck_apd_amended CHECK (
        apd_amended_into_revision IS NULL
        OR (apd_status::text = 'CANCELLED' AND apd_amended_into_revision > 0));
  END IF;
END $$;

COMMIT;
