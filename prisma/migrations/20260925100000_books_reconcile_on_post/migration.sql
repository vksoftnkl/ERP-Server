-- ═══════════════════════════════════════════════════════════════════════════
--  notes (47) — the trial-mode books check, on every post
--
--  C1 · a bill-by-bill party's open bills = its ledger balance
--  C2 · a Cheques In Hand ledger          = the cheque register
--
--  ONE definition of each, here, so the per-post guard
--  (src/modules/accountsModule/reconcile/books-reconcile.guard.ts) and the
--  whole-company pass (scripts/reconcile-books.ts, nightly during the trial)
--  cannot disagree about what "balanced" means.
--
--  Read-only functions: STABLE, no locks taken. A check must never contend
--  with the posts it is checking.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── The ledger side, shared by C1 and C2 ───────────────────────────────────
--  opening (this acc_year, DR +, CR −)
--  + Σ av_signed_amount of live legs whose header is NOT DRAFT.
--
--  CANCELLED headers COUNT. A cancel keeps the original voucher's legs live
--  and posts a POSTED mirror reversal; leaving the CANCELLED original out
--  would make every cancelled document a false mismatch.
CREATE OR REPLACE FUNCTION accounts.fn_ledger_book_balance(
  p_company_id uuid,
  p_ledger_id  uuid,
  p_acc_year   char(9)
) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT SUM(CASE WHEN o.op_dr_cr = 'DR' THEN o.op_amount ELSE -o.op_amount END)
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


-- ── C1 · party ─────────────────────────────────────────────────────────────
--  BILLS = Σ abl_pending_amount (DR +, CR −), live rows, ALL years — a bill
--  raised last year and still open is part of this year's balance through
--  the opening.
--  Company-wide, not per branch: the ledger balance is not branch-scoped.
CREATE OR REPLACE FUNCTION accounts.fn_party_bill_reconcile(
  p_company_id uuid,
  p_ledger_id  uuid,
  p_acc_year   char(9)
) RETURNS TABLE (ledger_bal numeric, bills_bal numeric, diff numeric)
LANGUAGE sql STABLE AS $$
  WITH l AS (SELECT accounts.fn_ledger_book_balance(p_company_id, p_ledger_id, p_acc_year) AS bal),
       b AS (SELECT COALESCE(SUM(CASE WHEN a.abl_dr_cr = 'DR' THEN a.abl_pending_amount
                                      ELSE -a.abl_pending_amount END), 0) AS bal
               FROM accounts.acc_bill_balance a
              WHERE a.abl_company_id = p_company_id
                AND a.abl_party_id   = p_ledger_id
                AND a.abl_is_deleted = false)
  SELECT l.bal, b.bal, l.bal - b.bal FROM l, b;
$$;


-- ── C2 · Cheques In Hand ───────────────────────────────────────────────────
--  REGISTER = Σ apd_amount of ON_RECEIPT rows still HELD or DEPOSITED.
--    · DEPOSITED counts: a deposit posts no voucher, the money is still in
--      Cheques In Hand until the clearing contra moves it to the bank.
--    · ON_CLEARING rows are out: nothing was debited when they arrived.
--  A row belongs to this ledger when its tender row was posted to it, or —
--  for a replacement cheque, which carries no tender row — when its own
--  voucher has a leg on it.
CREATE OR REPLACE FUNCTION accounts.fn_cheques_in_hand_reconcile(
  p_company_id uuid,
  p_ledger_id  uuid,
  p_acc_year   char(9)
) RETURNS TABLE (ledger_bal numeric, register_bal numeric, diff numeric)
LANGUAGE sql STABLE AS $$
  WITH l AS (SELECT accounts.fn_ledger_book_balance(p_company_id, p_ledger_id, p_acc_year) AS bal),
       r AS (SELECT COALESCE(SUM(p.apd_amount), 0) AS bal
               FROM accounts.acc_pdc_register p
               LEFT JOIN accounts.acc_tender_detail t ON t.td_id = p.apd_tender_id
              WHERE p.apd_company_id = p_company_id
                AND p.apd_is_deleted = false
                AND p.apd_status IN ('HELD', 'DEPOSITED')
                AND p.apd_posting_mode = 'ON_RECEIPT'
                AND (t.td_tender_ledger_id = p_ledger_id
                     OR (p.apd_tender_id IS NULL
                         AND EXISTS (SELECT 1 FROM accounts.acc_vouchers v
                                      WHERE v.av_voucher_id = p.apd_voucher_id
                                        AND v.av_acc_year   = p.apd_voucher_acc_year
                                        AND v.av_ledger_id  = p_ledger_id
                                        AND v.av_is_deleted = false))))
  SELECT l.bal, r.bal, l.bal - r.bal FROM l, r;
$$;


-- ── Which ledgers are Cheques In Hand ──────────────────────────────────────
--  The ledger a CHEQUE tender (ttm_type_id 5) posts to: the tender master's,
--  or one a cheque tender row actually carried.
CREATE OR REPLACE FUNCTION accounts.fn_is_cheques_in_hand_ledger(p_ledger_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM accounts.acc_tender_master m
                  WHERE m.tnd_type_id = 5 AND m.tnd_ledger_id = p_ledger_id
                    AND m.tnd_is_deleted = false)
      OR EXISTS (SELECT 1 FROM accounts.acc_tender_detail t
                  WHERE t.td_tender_type_id = 5 AND t.td_tender_ledger_id = p_ledger_id);
$$;


-- ── The whole-company pass ─────────────────────────────────────────────────
--  Every bill-by-bill ledger (C1) and every Cheques In Hand ledger (C2) the
--  company has touched, with both sides and the difference. Catches drift
--  from paths the per-post guard does not cover.
CREATE OR REPLACE FUNCTION accounts.fn_books_reconcile(
  p_company_id uuid,
  p_acc_year   char(9)
) RETURNS TABLE (check_kind text, ledger_id uuid, ledger_name text,
                 ledger_bal numeric, other_bal numeric, diff numeric)
LANGUAGE sql STABLE AS $$
  WITH parties AS (
    SELECT l.led_id, l.led_name FROM accounts.acc_ledger_master l
     WHERE l.led_is_bill_by_bill = true AND l.led_is_deleted = false
       AND (EXISTS (SELECT 1 FROM accounts.acc_bill_balance a
                     WHERE a.abl_company_id = p_company_id AND a.abl_party_id = l.led_id)
            OR EXISTS (SELECT 1 FROM accounts.acc_vouchers v
                        WHERE v.av_company_id = p_company_id AND v.av_ledger_id = l.led_id
                          AND v.av_acc_year = p_acc_year)
            OR EXISTS (SELECT 1 FROM accounts.acc_opening_balance o
                        WHERE o.op_company_id = p_company_id AND o.op_ledger_id = l.led_id
                          AND o.op_acc_year = p_acc_year))
  ), in_hand AS (
    SELECT l.led_id, l.led_name FROM accounts.acc_ledger_master l
     WHERE l.led_is_deleted = false AND accounts.fn_is_cheques_in_hand_ledger(l.led_id)
  )
  SELECT 'PARTY', p.led_id, p.led_name::text, r.ledger_bal, r.bills_bal, r.diff
    FROM parties p, LATERAL accounts.fn_party_bill_reconcile(p_company_id, p.led_id, p_acc_year) r
  UNION ALL
  SELECT 'CHEQUES_IN_HAND', c.led_id, c.led_name::text, r.ledger_bal, r.register_bal, r.diff
    FROM in_hand c, LATERAL accounts.fn_cheques_in_hand_reconcile(p_company_id, c.led_id, p_acc_year) r;
$$;


-- ── The switch ─────────────────────────────────────────────────────────────
--  ON during the trial, OFF after go-live: offline sync can make the two
--  sides lag briefly in production, and a post must not be refused for it.
--  COMPANY is the narrowest scope — the check is company-wide.
INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
        asd_label, asd_description, asd_sort_order, asd_is_active,
        asd_needs_relogin, asd_created_by)
SELECT 'accounts.reconcile_on_post', 'ACCOUNTS', 'Trial checks', 'BOOL', 'true',
       NULL::jsonb, NULL, NULL, 'COMPANY',
       'Reconcile the books on every post',
       'Trial mode. Every post that touches a bill-by-bill party refuses (422 ACC_PARTY_OUT_OF_BALANCE) unless the party''s open bills add up to its ledger balance, and every post that moves a cheque refuses (422 ACC_CHEQUES_OUT_OF_BALANCE) unless Cheques In Hand equals the HELD + DEPOSITED cheques in the register. Turn OFF at go-live: offline sync can make the two sides lag briefly.',
       10, true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d
                    WHERE d.asd_key = 'accounts.reconcile_on_post');
