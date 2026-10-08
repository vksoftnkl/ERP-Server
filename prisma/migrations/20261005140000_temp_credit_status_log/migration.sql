-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 90 (2026-10-05) A — a temporary credit's own life in txn_status_log.
--
--  acc_temp_credit.atc_id was never a key in the status trail: the bill's
--  steps file under the BILL id, the follow-ups go to audit_log and the money
--  to acc_bill_adjustment, so Ctrl+H on Temp Credits (menu 257) found nothing.
--  Every writer of atc_status now appends a TEMP_CREDIT step keyed by atc_id
--  (src/common/txn-status-log/temp-credit-status.ts). The CHECK is widened for
--  it the way notes 80 C did for the stock vouchers (20261002160000).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.txn_status_log DROP CONSTRAINT IF EXISTS ck_tsl_src_doc_type;
ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type::text = ANY (ARRAY[
    'QUOTATION'::text, 'SALES_ORDER'::text, 'DELIVERY_CHALLAN'::text, 'DC_RETURN'::text, 'SALE_BILL'::text,
    'SALE_RETURN'::text, 'PURCHASE_ORDER'::text, 'PURCHASE_BILL'::text, 'PURCHASE_RETURN'::text,
    'STOCK_TRANSFER'::text, 'STOCK_ADJUSTMENT'::text, 'OPENING_STOCK'::text, 'PHYSICAL_STOCK'::text,
    'RECEIPT'::text, 'PAYMENT'::text, 'JOURNAL'::text,
    'CHEQUE_RECEIVED'::text, 'CHEQUE_ISSUED'::text, 'TEMP_CREDIT'::text, 'OTHER'::text]));
