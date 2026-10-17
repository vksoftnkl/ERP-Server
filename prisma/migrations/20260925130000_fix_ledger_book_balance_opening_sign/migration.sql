-- Ledger Statement plan §3.1 — fn_ledger_book_balance read every Dr opening
-- as Cr.
--
-- acc_opening_balance.op_dr_cr is char(1), ck_op_dr_cr = ('D','C'). The
-- function (20260925100000_books_reconcile_on_post) tested for 'DR', which never
-- matches, so every opening fell into the ELSE branch as a credit: a ledger whose
-- only row is 89.00 D came back -89.00. Every bill-by-bill party with a Dr
-- opening then showed a false mismatch of twice its opening in
-- fn_party_bill_reconcile / fn_books_reconcile, and with
-- accounts.reconcile_on_post on, its next post was refused (notes 47's D2).
--
-- Same body otherwise. (acc_vouchers / acc_bill_balance use 'DR'/'CR'; only the
-- opening table uses the one-letter form.)
CREATE OR REPLACE FUNCTION accounts.fn_ledger_book_balance(
  p_company_id uuid,
  p_ledger_id  uuid,
  p_acc_year   char(9)
) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT SUM(CASE WHEN o.op_dr_cr = 'D' THEN o.op_amount ELSE -o.op_amount END)
                     FROM accounts.acc_opening_balance o
                    WHERE o.op_company_id = p_company_id
                      AND o.op_ledger_id  = p_ledger_id
                      AND o.op_acc_year   = p_acc_year
                      AND o.op_is_deleted = false), 0)
       + COALESCE((SELECT SUM(v.av_signed_amount)
                     FROM accounts.acc_vouchers v
                     JOIN accounts.acc_voucher_header h
                       ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
                    WHERE v.av_company_id = p_company_id
                      AND v.av_ledger_id  = p_ledger_id
                      AND v.av_acc_year   = p_acc_year
                      AND v.av_is_deleted = false
                      AND h.avh_is_deleted = false
                      AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')), 0);
$$;
