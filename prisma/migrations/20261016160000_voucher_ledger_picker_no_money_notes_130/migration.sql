-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 130 — grid 119 POPUP - VOUCHER LEDGERS offers no cash / bank ledger.
--
--  Since notes 126 §6 the server refuses a typed cash / bank line on every
--  register type: Jrl / DrN / CrN / PurA / SalA → VCH_MONEY_LEDGER_NOT_ALLOWED,
--  RcpV / PmtV → VCH_MONEY_LINE_NO_TENDER (the money side is the instrument),
--  Con → each line names its tenderId (Qt picks from the tender list, not this
--  grid). The picker still offered Cash In Hand, the banks and the safes, and
--  the user learnt it at save. Now: no ledger with led_ledger_type CASH / BANK
--  or under Cash-in-Hand / Bank Accounts / Bank OD A/c (the server's own
--  isMoneyLedger), and nothing on the money side of a Receipt (Dr) / Payment
--  (Cr) — the old last clause offered ONLY cash / bank there. GET
--  /vouchers/ledger-pick follows the same rule. Guarded on the old text, so it
--  does nothing where the grid was already changed.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql, $mig$   AND (NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                     WHERE t.vchr_type_code = 'itype_code' AND t.vchr_nature IN ('RECEIPT', 'PAYMENT'))
        OR EXISTS (
                WITH RECURSIVE up AS (
                    SELECT x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_parent_id, lower(p.acc_group_name), up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
                     WHERE up.d < 24)
                SELECT 1 FROM up WHERE up.n IN ('cash-in-hand', 'bank accounts', 'bank od a/c'))
           = EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                      WHERE t.vchr_type_code = 'itype_code'
                        AND ((t.vchr_nature = 'RECEIPT' AND 'iside' = 'DR')
                          OR (t.vchr_nature = 'PAYMENT' AND 'iside' = 'CR'))))
$mig$, $mig$   -- notes 130: the money side is a tender (the instrument / a Contra line's
   -- tender list), never a typed cash / bank ledger -- the server refuses one
   -- (VCH_MONEY_LEDGER_NOT_ALLOWED / VCH_MONEY_LINE_NO_TENDER), on every type
   AND COALESCE(l.led_ledger_type, '') NOT IN ('CASH', 'BANK')
   AND NOT EXISTS (
        WITH RECURSIVE up AS (
            SELECT x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
              FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
            UNION ALL
            SELECT p.acc_group_parent_id, lower(p.acc_group_name), up.d + 1
              FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
             WHERE up.d < 24)
        SELECT 1 FROM up WHERE up.n IN ('cash-in-hand', 'bank accounts', 'bank od a/c'))
   -- ...and the money side of a Receipt (Dr) / Payment (Cr) lists nothing at all
   AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                    WHERE t.vchr_type_code = 'itype_code'
                      AND ((t.vchr_nature = 'RECEIPT' AND 'iside' = 'DR')
                        OR (t.vchr_nature = 'PAYMENT' AND 'iside' = 'CR')))
$mig$),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 119
   AND grid_name = 'POPUP - VOUCHER LEDGERS'
   AND position($mig$   AND (NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                     WHERE t.vchr_type_code = 'itype_code' AND t.vchr_nature IN ('RECEIPT', 'PAYMENT'))
        OR EXISTS (
                WITH RECURSIVE up AS (
                    SELECT x.acc_group_parent_id, lower(x.acc_group_name) AS n, 0 AS d
                      FROM accounts.acc_group_master x WHERE x.acc_group_id = l.led_group_id
                    UNION ALL
                    SELECT p.acc_group_parent_id, lower(p.acc_group_name), up.d + 1
                      FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
                     WHERE up.d < 24)
                SELECT 1 FROM up WHERE up.n IN ('cash-in-hand', 'bank accounts', 'bank od a/c'))
           = EXISTS (SELECT 1 FROM accounts.acc_voucher_types t
                      WHERE t.vchr_type_code = 'itype_code'
                        AND ((t.vchr_nature = 'RECEIPT' AND 'iside' = 'DR')
                          OR (t.vchr_nature = 'PAYMENT' AND 'iside' = 'CR'))))
$mig$ IN grid_sql) > 0;
