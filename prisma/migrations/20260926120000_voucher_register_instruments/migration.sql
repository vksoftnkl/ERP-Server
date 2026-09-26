-- ════════════════════════════════════════════════════════════════════════════
-- 20260926120000_voucher_register_instruments — notes (54): the Receipt Voucher takes cheques
--
-- A cheque is received before anyone knows which bank it will go into. The
-- register refused Cheques In Hand (S16), so a salesman's collection run could
-- not take cheques. Now, on a type with vchr_instruments, each typed customer
-- line carries its INSTRUMENT (a tender: cash, cheque, UPI …); the server
-- generates the Dr legs from the tenders' ledgers, a cheque becomes a HELD row
-- in acc_pdc_register (menu 51), and a post-dated cheque gets a voucher of its
-- own on its date — the Receipt's way. The operator still never types Cheques
-- In Hand.
--
-- The Receipt Voucher therefore becomes a MANY-party type: its typed lines ARE
-- the customer lines (several customers on one collection run), each settled
-- bill by bill (DEMAND) against its own party's bills. The money side is no
-- longer typed, so its Dr group list is cleared.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE accounts.acc_voucher_types
  ADD COLUMN IF NOT EXISTS vchr_instruments boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN accounts.acc_voucher_types.vchr_instruments IS
  'notes (54): typed lines carry instruments (tenders); the money legs are generated from the tenders'' ledgers';

UPDATE accounts.acc_voucher_types
   SET vchr_instruments = true,
       vchr_party_mode  = 'MANY',
       vchr_party_side  = 'ANY',
       vchr_dr_groups   = '{}',
       vchr_updated_on  = now(),
       vchr_updated_by  = '20260926120000_voucher_register_instruments'
 WHERE vchr_type_code = 'RcpV';

COMMIT;
