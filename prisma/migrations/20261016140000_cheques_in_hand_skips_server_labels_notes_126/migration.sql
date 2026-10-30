-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 126 §1 — "is this ledger Cheques In Hand?" ignores the server's labels.
--
--  Since notes 126 every cash / bank leg carries a tender row; where nothing
--  else covers a bank line of a cheque voucher (a received cheque's clearing,
--  DR bank; an issued cheque's stop / return, DR bank) the server labels it
--  with the CHEQUE tender (td_src_doc_type 'VOUCHER'). The function's second
--  branch — "a ledger that ever received a cheque" (a DR CHEQUE row) — then
--  called the BANK Cheques In Hand, so the books check reconciled the bank
--  against the cheque register and refused every such post
--  (ACC_CHEQUES_OUT_OF_BALANCE). A server label is not a cheque received at a
--  counter: only the documents' own rows count.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION accounts.fn_is_cheques_in_hand_ledger(p_ledger_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT EXISTS (SELECT 1 FROM accounts.acc_tender_master m
                  WHERE m.tnd_type_id = 5 AND m.tnd_ledger_id = p_ledger_id
                    AND m.tnd_is_deleted = false)
      OR EXISTS (SELECT 1 FROM accounts.acc_tender_detail t
                  WHERE t.td_tender_type_id = 5 AND t.td_tender_ledger_id = p_ledger_id
                    AND t.td_dr_cr = 'DR'
                    AND t.td_src_doc_type <> 'VOUCHER');
$function$;
