-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 80 — what public.txn_status_log records                 2026-10-02
--
--  The Qt History dialog (grid 126 "POPUP - TXN HISTORY", read by document id)
--  is only as good as the trail. Two of notes 80's three gaps need data here;
--  the third (B, the device on accounts documents) is code only — the device a
--  past receipt was taken on was never recorded anywhere, so it cannot be
--  backfilled.
--
--  A. The CREATED step of a sale bill or quotation (and a quotation's
--     CONVERTED) was handed the client's login NAME as its actor —
--     sb_created_by / sq_created_by are text — which appendTxnStatusLog files
--     as DEFAULT_ACTOR in tsl_changed_by, keeping the name in tsl_created_by.
--     The code now passes the request's user id (statusActorOf). Here the
--     253 rows already written get the user back, wherever tsl_created_by
--     names exactly ONE user_master login (deleted users counted, so a reused
--     name is ambiguous and left alone). tsl_created_by keeps the name.
--
--  C. Opening and physical-stock vouchers filed as STOCK_ADJUSTMENT, so a
--     report filtering the trail by doc type could not tell an opening from an
--     adjustment. ck_tsl_src_doc_type gains OPENING_STOCK and PHYSICAL_STOCK
--     (TxnStatusDocType, the two screens' rules.statusDocType), and the rows
--     of every voucher still in stock.stock_voucher are re-filed — the readers
--     (the stock list, get, the already-cancelled 409) look a trail up by the
--     screen's type, and nextSeqNo numbers by (type, id, year), so a voucher
--     whose old rows stayed behind would lose its history and restart at 1.
--     Rows whose voucher no longer exists (hard-deleted test vouchers) stay
--     STOCK_ADJUSTMENT: nothing reads them by type, and their kind is no
--     longer knowable.
--
--  Idempotent: the backfill only touches DEFAULT_ACTOR rows, the re-file only
--  STOCK_ADJUSTMENT rows of OPENING / PHYSICAL vouchers.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A. the actor of the CREATED / CONVERTED steps ──────────────────────────
UPDATE public.txn_status_log l
   SET tsl_changed_by = u.usr_id
  FROM public.user_master u
 WHERE l.tsl_changed_by = '00000000-0000-0000-0000-000000000000'::uuid
   AND l.tsl_created_by IS NOT NULL
   AND u.usr_login_name = l.tsl_created_by
   AND (SELECT count(*) FROM public.user_master x
         WHERE x.usr_login_name = l.tsl_created_by) = 1;

-- ── C. OPENING_STOCK / PHYSICAL_STOCK ──────────────────────────────────────
ALTER TABLE public.txn_status_log DROP CONSTRAINT IF EXISTS ck_tsl_src_doc_type;
ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type::text = ANY (ARRAY[
    'QUOTATION'::text, 'SALES_ORDER'::text, 'DELIVERY_CHALLAN'::text, 'DC_RETURN'::text, 'SALE_BILL'::text,
    'SALE_RETURN'::text, 'PURCHASE_ORDER'::text, 'PURCHASE_BILL'::text, 'PURCHASE_RETURN'::text,
    'STOCK_TRANSFER'::text, 'STOCK_ADJUSTMENT'::text, 'OPENING_STOCK'::text, 'PHYSICAL_STOCK'::text,
    'RECEIPT'::text, 'PAYMENT'::text, 'JOURNAL'::text,
    'CHEQUE_RECEIVED'::text, 'CHEQUE_ISSUED'::text, 'OTHER'::text]));

UPDATE public.txn_status_log l
   SET tsl_src_doc_type = CASE v.svh_voucher_type
                               WHEN 'OPENING' THEN 'OPENING_STOCK'
                               ELSE 'PHYSICAL_STOCK' END
  FROM stock.stock_voucher v
 WHERE l.tsl_src_doc_type = 'STOCK_ADJUSTMENT'
   AND v.svh_id = l.tsl_src_doc_id
   AND v.svh_acc_year = l.tsl_acc_year
   AND v.svh_voucher_type IN ('OPENING', 'PHYSICAL');
