-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 129 §4 — the RRN tender (type 7) moves no money: no ledger.
--
--  RRN is a sale-only credit shape: the bill is settled against a sale return's
--  credit note, which already sits on the customer's account. Like CREDIT /
--  TEMP_CR / LOYALTY it posts no tender leg (the customer stays debited and the
--  bill-wise allocation knocks it off against the return note), so its master
--  names no ledger — a tender row of it names the party ledger
--  (TenderDetailService). The user's call, 2026-10-16.
--
--  The dev box's RRN master pointed at SALES FREIGHT COLLECTION (an EXPENSE
--  ledger): a bill paid by RRN would have posted Dr that expense / Cr the
--  customer. No RRN tender row was ever written, so nothing is reposted.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_tender_master DROP CONSTRAINT IF EXISTS ck_tnd_ledger_required;

UPDATE accounts.acc_tender_master
   SET tnd_ledger_id = NULL,
       tnd_modified_on = now(),
       tnd_modified_by = 'notes-129'
 WHERE tnd_type_id = 7
   AND tnd_ledger_id IS NOT NULL;

ALTER TABLE accounts.acc_tender_master
  ADD CONSTRAINT ck_tnd_ledger_required
  CHECK (tnd_ledger_id IS NOT NULL OR tnd_type_id IN (7, 8, 9, 10));
