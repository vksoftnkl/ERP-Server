-- notes (53): a Receipt Voucher and a Payment Voucher take MANY parties.
--
-- A salesman's collections from several customers are keyed as ONE Receipt
-- Voucher, and a payment run to several suppliers as ONE Payment Voucher, so
-- both types name their parties on the lines, like the Journal.
--
-- vchr_party_side stays (RcpV CR, PmtV DR): it still says which side the
-- party lines sit on, and the Payment's TDS gross-up reads it.
-- vchr_billwise_mode stays DEMAND: every party line is allocated in full.
UPDATE accounts.acc_voucher_types
   SET vchr_party_mode = 'MANY'
 WHERE vchr_type_code IN ('RcpV', 'PmtV')
   AND vchr_party_mode <> 'MANY';
