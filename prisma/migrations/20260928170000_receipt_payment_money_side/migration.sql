-- ═══════════════════════════════════════════════════════════════════════════
--  notes (56): Receipt / Payment — the cash/bank side. DATA ONLY. 2026-09-28.
--
--  The rule itself is TypeScript (`sideVerdict` in voucher-derive.ts, keyed on
--  vchr_nature: RECEIPT → DR takes cash/bank only and CR never; PAYMENT the
--  mirror), applied by /vouchers/validate, /vouchers/post and /ledger-pick.
--  These two rows only make the table READ the way the rule behaves:
--
--    PmtV  vchr_cr_groups  + Bank OD A/c     a payment from an overdraft account
--                                            was refused while a receipt into one
--                                            was accepted; the three money groups
--                                            are treated alike on both types
--    RcpV  vchr_dr_groups  = the three       symmetry with PmtV (its empty list
--                                            stopped mattering once the rule was in)
--
--  Already-posted vouchers are left as they are: the rule is for new validates
--  and posts only.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  g_money uuid[];
BEGIN
  SELECT COALESCE(array_agg(acc_group_id ORDER BY acc_group_name), '{}')
    INTO g_money
    FROM accounts.acc_group_master
   WHERE acc_group_company_id IS NULL
     AND acc_group_is_deleted = false
     AND lower(acc_group_name) IN ('cash-in-hand', 'bank accounts', 'bank od a/c');

  IF cardinality(g_money) <> 3 THEN
    RAISE NOTICE 'notes (56): expected the three money groups, found % — side lists left alone', cardinality(g_money);
    RETURN;
  END IF;

  UPDATE accounts.acc_voucher_types
     SET vchr_cr_groups = g_money,
         vchr_updated_on = now(),
         vchr_updated_by = '20260928170000_receipt_payment_money_side'
   WHERE vchr_type_code = 'PmtV'
     AND NOT (vchr_cr_groups @> g_money AND g_money @> vchr_cr_groups);

  UPDATE accounts.acc_voucher_types
     SET vchr_dr_groups = g_money,
         vchr_updated_on = now(),
         vchr_updated_by = '20260928170000_receipt_payment_money_side'
   WHERE vchr_type_code = 'RcpV'
     AND NOT (vchr_dr_groups @> g_money AND g_money @> vchr_dr_groups);
END $$;
