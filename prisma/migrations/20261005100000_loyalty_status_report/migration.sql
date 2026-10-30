-- ═══════════════════════════════════════════════════════════════════════════
--  Loyalty Status — the report screen on menu 79 (plan 2026-10-05).
--
--  Three changes, and nothing else: the plan's rule is that every definition
--  and every query of this report is NestJS (src/modules/reports/loyalty-status)
--  — no function, trigger or view is added for it.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · Menu 79 "Loyalty Status" (under 75 "Loyalty Schemes") was seeded
--     hidden. It is the CUSTOMER loyalty report; 206 under 202 "Agents" is
--     3.0's agent loyalty and stays as it is (plan §2, D7). Rights are per
--     user and are granted through the user-rights screen, not here.
UPDATE fixed.menu_master
   SET menu_visiblity = true
 WHERE menu_id = 79;

-- 2 · The scheme summary (plan §5.6) groups the ledger by scheme over a date
--     range. ix_lld_scheme covers the FK only — no date, no INCLUDE — so the
--     tab would read the heap for every row of the company. Partial on the
--     live rows like the rest of the set (ix_lld_open_lots, ix_lld_branch_period).
CREATE INDEX IF NOT EXISTS ix_lld_scheme_period
    ON sales.loyalty_ledger USING btree
    (lld_comp_id, lld_lsc_id, lld_txn_date)
    INCLUDE (lld_txn_type, lld_points, lld_branch_id, lld_src_doc_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE lld_is_deleted = false;

-- 3 · A NEGATIVE adjustment (plan §7.2, "Adjust points" on the screen) draws
--     on lots FIFO through LoyaltyLedgerService.consume(), one ADJUST row per
--     lot, exactly like a redeem — because a lot-less negative row would lower
--     the wallet and leave every lot spendable, i.e. redeemable() > balance().
--     ck_lld_lot_required let only REDEEM / GIFT / EXPIRE (and TRANSFER) name
--     a lot; ADJUST now may. A POSITIVE adjustment still carries no lot: it IS
--     one (lld_lot_balance is generated for every positive row), and since D2
--     lots(), redeemable(), the member recompute and the expiry sweep all read
--     EARN / OPENING / ADJUST / TRANSFER lots alike.
ALTER TABLE sales.loyalty_ledger DROP CONSTRAINT IF EXISTS ck_lld_lot_required;
ALTER TABLE sales.loyalty_ledger ADD CONSTRAINT ck_lld_lot_required CHECK (
    CASE WHEN lld_txn_type::text = ANY (ARRAY['REDEEM'::text, 'GIFT'::text, 'EXPIRE'::text])
         THEN lld_lot_id IS NOT NULL OR lld_reversal_of_id IS NOT NULL
         WHEN lld_txn_type::text = ANY (ARRAY['TRANSFER'::text, 'ADJUST'::text])
         THEN true
         ELSE lld_lot_id IS NULL END);
