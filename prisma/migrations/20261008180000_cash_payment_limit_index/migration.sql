-- ═══════════════════════════════════════════════════════════════════════════
--  40A(3) — cash paid to one payee in a day                    2026-10-08
--
--  till/plan-till-receipt-payment-expense.md §3.4: the cash tenders of
--  payments and expense vouchers to the same payee on the same date are
--  summed (src/modules/accountsModule/payment/cash-payment-limit.ts, called by
--  /payments/post, /expenses/validate · post and the voucher register's
--  payment types). The statutory row CASH_PAYMENT_LIMIT_40A3 is 48's
--  (20261008110000_till_money_docs); this is only the index the sum reads —
--  CASH rows of one company, by payee and day. 269ST on receipts, when it is
--  switched on, reads the same rows.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS ix_td_cash_party_day
    ON accounts.acc_tender_detail (td_company_id, td_party_ledger_id, td_doc_date)
    WHERE td_tender_type_id = 1 AND td_is_deleted = false AND td_is_voided = false;
