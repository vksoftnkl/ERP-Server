-- Ledger Statement (reports/ledger-statement) — the two things the report
-- needs from the schema. It writes nothing and adds no function (plan §13).
--
-- 1 · L7 — the REVERSAL row kind is "a POSTED header that another header names
--     in avh_reversal_voucher_id". Nothing indexed that column, so the lookup
--     scanned every header of the year. (The mirror's own avh_against_voucher_id
--     is indexed, but it is also how a PDC voucher names its receipt, so it
--     cannot answer the question on its own.)
CREATE INDEX IF NOT EXISTS ix_avh_reversal
    ON accounts.acc_voucher_header (avh_reversal_voucher_id, avh_reversal_acc_year)
 WHERE avh_reversal_voucher_id IS NOT NULL;

-- 2 · §10 — the new "Ledger Statement" menu (258, seeded by
--     prisma/seed/Menu_Master.sql) sits under 137 "Financial Statements",
--     which has been hidden. Shown ONCE, here, rather than by the seed: the
--     seed runs on every deploy and a site that hides the branch again must
--     keep its answer. 6 "Reports" is already visible; the guard makes this a
--     no-op on a site that has changed it. On a fresh database 137 does not
--     exist yet (menus are seeded after migrations) and the seed row itself
--     now carries visible = true.
UPDATE fixed.menu_master
   SET menu_visiblity = true
 WHERE menu_id IN (6, 137)
   AND menu_visiblity = false;
