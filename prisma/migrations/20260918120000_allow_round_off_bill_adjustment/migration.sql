-- ═══════════════════════════════════════════════════════════════════════════
--  A receipt may round a bill off
--
--  ── What was broken ─────────────────────────────────────────────────────
--  "received 10, disc 1, r.off 1 but i cant post". Both doors were shut:
--
--    · PostReceiptAllocationDto carried `amount`, `discount` and `writeoff`
--      and nothing else, so a client had to fold the round-off into `amount`
--      — which the server reads as MONEY. The receipt then claimed to allocate
--      11 against 10 received and §5.2 step 4 refused it, correctly, as
--      "Out by -1.00".
--
--    · ROUND_OFF was not a role /receipts/post would accept on an other-line
--      either, so there was no second way in.
--
--  Rounding a 4,999.60 bill off to 5,000 is ordinary counter behaviour, and
--  accounts.acc_ledger_map has mapped ROUND_OFF to a real "Round Off" ledger
--  all along. Only the receipt route did not know about it.
--
--  ── Why a NEW adj type rather than reusing DISCOUNT ─────────────────────
--  Because the LEG and the ADJUSTMENT ROW have to agree about what happened.
--  The round-off leg is debited to the Round Off ledger, not to Discount
--  Allowed; a row saying DISCOUNT beside a leg saying Round Off would leave
--  anybody reconciling the two with an unexplained gap, and would quietly
--  inflate every discount report built on abj_adj_type.
--
--  A round-off is also not a discount in kind. A discount is a commercial
--  concession somebody decided to give; a round-off is arithmetic.
--
--  ── Why no new column on acc_bill_balance ───────────────────────────────
--  `abl_pending_amount` and `abl_status` are GENERATED from
--  (bill - alloc - disc - writeoff). A fourth bucket would mean dropping and
--  recreating both expressions on a LIST-partitioned table — a rewrite of
--  every partition — to split a cache that nothing reads as "discounts":
--  every consumer of abl_disc_amount in this codebase adds it to
--  abl_writeoff_amount and asks "how much of this bill is already accounted
--  for". A round-off is, so BillBalanceRecomputeService folds ROUND_OFF into
--  abl_disc_amount and the authoritative split stays on the rows, where
--  abj_adj_type answers it exactly.
--
--  ── Why this is safe ────────────────────────────────────────────────────
--  Both statements only WIDEN a CHECK. No existing row can fail a constraint
--  that admits strictly more values, and nothing is rewritten: Postgres
--  revalidates the table against the new predicate, which every current row
--  already satisfies.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_bill_adjustment
    DROP CONSTRAINT IF EXISTS ck_abj_adj_type;

ALTER TABLE accounts.acc_bill_adjustment
    ADD CONSTRAINT ck_abj_adj_type CHECK (
        abj_adj_type IN ('ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST',
                         'DISCOUNT', 'WRITEOFF', 'ROUND_OFF', 'TRANSFER'));

ALTER TABLE accounts.acc_bill_adjustment
    DROP CONSTRAINT IF EXISTS ck_abj_settlement_mode;

ALTER TABLE accounts.acc_bill_adjustment
    ADD CONSTRAINT ck_abj_settlement_mode CHECK (
        abj_settlement_mode IS NULL
        OR abj_settlement_mode IN ('CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK',
                                   'CREDIT_NOTE', 'ADVANCE', 'LOYALTY', 'VOUCHER',
                                   'JOURNAL', 'DISCOUNT', 'WRITEOFF', 'ROUND_OFF',
                                   'MIXED', 'TDS', 'CLAIM'));

--  ck_abj_against enumerates every adj type on BOTH sides — the three that
--  must name an opposite bill, and the three that must not — so a new type is
--  refused by it outright rather than falling through to a default. ROUND_OFF
--  belongs with DISCOUNT and WRITEOFF: it reduces the bill it is on and has no
--  opposite bill to point at.
--
--  Found the honest way: the first run of the acceptance test came back 23514
--  naming this constraint.

ALTER TABLE accounts.acc_bill_adjustment
    DROP CONSTRAINT IF EXISTS ck_abj_against;

ALTER TABLE accounts.acc_bill_adjustment
    ADD CONSTRAINT ck_abj_against CHECK (
        (abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER')
         AND abj_against_bill_id IS NOT NULL)
        OR
        (abj_adj_type IN ('ALLOCATION', 'DISCOUNT', 'WRITEOFF', 'ROUND_OFF')
         AND abj_against_bill_id IS NULL));

COMMENT ON COLUMN accounts.acc_bill_adjustment.abj_adj_type IS
    'ALLOCATION / ADVANCE_ADJUST / NOTE_ADJUST / TRANSFER fold into abl_alloc_amount; DISCOUNT and ROUND_OFF fold into abl_disc_amount; WRITEOFF into abl_writeoff_amount. ROUND_OFF is kept distinct from DISCOUNT because its leg is debited to the Round Off ledger and not to Discount Allowed — the row and the leg must agree.';
