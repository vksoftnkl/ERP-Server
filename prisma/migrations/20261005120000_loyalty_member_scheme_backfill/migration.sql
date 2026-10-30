-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 91 (2026-10-05) N3 — a wallet names the scheme it first earned on.
--
--  lmb_lsc_id was NULL on every live member: the earn path never stamped it.
--  LoyaltyLedgerService.earn() now sets it on a wallet's first EARN; this is
--  the one-off backfill for the wallets written before that, from the scheme
--  of each wallet's most recent movement that named one. Data only — no DDL.
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE sales.loyalty_member m
   SET lmb_lsc_id = l.lld_lsc_id
  FROM (
        SELECT DISTINCT ON (lld_member_id) lld_member_id, lld_lsc_id
          FROM sales.loyalty_ledger
         WHERE lld_is_deleted = false
           AND lld_lsc_id IS NOT NULL
         ORDER BY lld_member_id, lld_txn_date DESC, lld_id DESC
       ) l
 WHERE l.lld_member_id = m.lmb_id
   AND m.lmb_lsc_id IS NULL;
