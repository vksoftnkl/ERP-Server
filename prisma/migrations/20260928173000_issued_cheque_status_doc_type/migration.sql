-- ═══════════════════════════════════════════════════════════════════════════
--  Issued cheques file their status steps as CHEQUE_ISSUED. DATA ONLY. 2026-09-28.
--
--  20260928100000 §6 relabelled every cheque step in txn_status_log from OTHER
--  to CHEQUE_RECEIVED by "the doc id is in acc_pdc_register" — but that register
--  holds BOTH directions (apd_tra_type R received / P issued), so an issued
--  cheque's steps were labelled as received, and the shared writer
--  (cheques.utils.ts logChequeStatus) kept filing new issued steps the same way
--  while /issued-cheques/history still read OTHER and found nothing.
--
--  The writer now files by apd_tra_type (chequeDocTypeOf); this moves the rows
--  it already mislabelled. Nothing else changes.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.txn_status_log tsl
   SET tsl_src_doc_type = 'CHEQUE_ISSUED'
 WHERE tsl.tsl_src_doc_type IN ('CHEQUE_RECEIVED', 'OTHER')
   AND tsl.tsl_src_module   = 'ACCOUNTS'
   AND EXISTS (SELECT 1 FROM accounts.acc_pdc_register p
                WHERE p.apd_id = tsl.tsl_src_doc_id AND p.apd_tra_type = 'P');
