-- ═══════════════════════════════════════════════════════════════════════════
--  TPOut ("Till Paid Out") retired                                 2026-10-08
--
--  20261008100000 (share file 47) created TPOut for the PAID_OUT cash
--  movement. 20261008110000 (file 48) took PAID_OUT out of
--  till_cash_movement: an expense is now an ExpV and a supplier paid from the
--  drawer is a bill-wise Payment. Nothing can post a TPOut any more, so the
--  type is switched off (user, 2026-10-08) rather than left in pick lists.
--
--  Deactivated, not deleted: vchr_type_id stays put and a re-run of 47 still
--  finds the code and inserts nothing. Its one acc_voucher_seq row (never
--  used, last no 0) is left as it is — harmless while the type is inactive.
--  When this was written no acc_voucher_header named the type.
--
--  Idempotent; a fresh database reaches it after 47 has inserted the row.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE accounts.acc_voucher_types
   SET vchr_is_active  = false,
       vchr_updated_on = now(),
       vchr_updated_by = '20261008120000_till_retire_tpout'
 WHERE vchr_type_code = 'TPOut'
   AND vchr_is_active;
