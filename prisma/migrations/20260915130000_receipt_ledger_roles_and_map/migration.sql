-- ═══════════════════════════════════════════════════════════════════════════
--  The five RECEIPT posting roles, and their ledger map
--
--  receipt/plan-backend-receipt.md §2.7, made runnable.
--
--  ── WHY IT IS URGENT ────────────────────────────────────────────────────
--  The /receipts/* endpoints are LIVE and /receipts/create fails for EVERY
--  receipt — even one with no TDS at all:
--
--      POST /api/v1/receipts/create
--      404  receipt: "TDS_RECEIVABLE" is not a posting role
--
--  The service seeds the other-line roles unconditionally, and
--  accounts.acc_ledger_role never gained them. No receipt can be drafted at
--  all until this runs.
--
--  ── WHY THIS IS A SEPARATE MIGRATION FROM 20260915120000 ────────────────
--  20260915120000_receipt_voucher_prerequisites carries the same section 5.
--  It was APPLIED to this database at 16:43 on 2026-09-15 and the file was
--  then edited at 16:59 to add that section, so Prisma has it recorded as
--  applied and will never run the added text. An applied migration cannot be
--  re-run; the delta has to arrive as a new one. On a FRESH database 120000
--  runs first and does all of this, and every statement below is NOT EXISTS /
--  IF EXISTS guarded, so this file is then a no-op that reports 0 rows.
--
--  Verified against localhost/ERP before writing: acc_ledger_role holds 22
--  rows and none of the five is among them; ck_alr_group does not admit
--  'RECEIPT'; acc_ledger_map holds 22 live rows. The catalogue function
--  already returns 27 rows and all five target ledgers already exist as
--  global rows with the right shape, so §3 has only the map left to write.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · ck_alr_group must admit the band
--
--  The constraint admits six bands and none of them fits five roles that
--  exist because money ARRIVES. 'SHARED' would have done — BANK_CHARGES is
--  equally a payment concern — but the Posting Ledgers screen builds itself
--  from alr_group, and burying these among the round-off and write-off rows
--  would make configuring a receipt a hunt. The payment voucher (next plan)
--  adds 'PAYMENT' the same way.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE accounts.acc_ledger_role
    DROP CONSTRAINT IF EXISTS ck_alr_group;

ALTER TABLE accounts.acc_ledger_role
    ADD CONSTRAINT ck_alr_group
        CHECK (alr_group IN ('REVENUE', 'OUTPUT_TAX', 'PURCHASE', 'INPUT_TAX',
                             'SHARED', 'RECEIPT', 'FUTURE'));


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · The roles
--
--  ── TDS_RECEIVABLE leaves alr_want_type NULL ────────────────────────────
--  Deliberately. led_ledger_type 'TAX' carries a GST duty head in this chart
--  and TDS is not a GST head, so the role constrains the NATURE (Assets) —
--  the part that matters — and lets the chart choose the type. It is the
--  mirror of TDS_PAYABLE, which the payment voucher will use.
--
--  ── SURCHARGE_RECOVERED vs BANK_CHARGES ─────────────────────────────────
--  Two halves of a card transaction and NOT the same number. BANK_CHARGES is
--  the MDR the acquirer keeps (an expense we bear, td_mdr_amt).
--  SURCHARGE_RECOVERED is what the customer was charged for paying by card
--  (income, td_surcharge_amt). A shop may levy one, the other, both or
--  neither.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty,
        alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order,
        alr_is_active, alr_remarks)
SELECT v.role, v.label, 'RECEIPT', v.want_type, NULL,
       v.want_nature, false, false, v.sort_order,
       true, v.remarks
  FROM (VALUES
        ('TDS_RECEIVABLE',      'TDS deducted by customers', NULL::text,  'Assets'::text,   410,
         'Tax a customer withheld from a payment to us. Our asset, recoverable from the department — the mirror of TDS_PAYABLE.'),
        ('BANK_CHARGES',        'Bank charges / MDR',        'EXPENSE',   'Expenses',       420,
         'The acquirer''s cut of a card / UPI collection (acc_tender_detail.td_mdr_amt). An expense we bear, not something the customer paid.'),
        ('SURCHARGE_RECOVERED', 'Card surcharge recovered',  'INCOME',    'Income',         430,
         'What the customer was charged for paying by card (acc_tender_detail.td_surcharge_amt). Income, and NOT the same figure as BANK_CHARGES.'),
        ('CLAIMS_ALLOWED',      'Customer claims allowed',   'EXPENSE',   'Expenses',       440,
         'Damage / shortage / rate claims settled at receipt time rather than by a credit note.'),
        ('INTEREST_INCOME',     'Interest on overdue',       'INCOME',    'Income',         450,
         'Interest charged on an overdue bill and collected with the receipt.')
       ) AS v(role, label, want_type, want_nature, sort_order, remarks)
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_role r
                    WHERE r.alr_role = v.role);


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · The map — through the catalogue, not by hand
--
--  accounts.fn_ledger_map_catalogue() already names all five (20260915120000
--  appended them): TDS Receivable under Current Assets, Bank Charges and
--  Customer Claims Allowed under Indirect Expenses, Card Surcharge Recovered
--  and Interest on Overdue under Indirect Incomes. So the mapping is not
--  restated here — accounts.fn_seed_ledger_map() creates any ledger that is
--  missing, checks every pair against its role's alr_want_*, and writes the
--  map. If the catalogue is somehow the 22-row version, its §2.3 raises
--  rather than leaving a role silently unmapped, which is the whole point.
--
--  p_skip_if_no_chart = true for the same reason 20260915110000 used it: on a
--  fresh database, and on the shadow database `migrate dev` replays into, the
--  chart of accounts is a SEED (prisma/seed/Account_Groups.sql) and has not
--  run yet. prisma/seed/Acc_Ledger_Map.sql then maps it in strict mode at
--  first boot, and re-asserts it on every deploy afterwards.
-- ═══════════════════════════════════════════════════════════════════════════
SELECT accounts.fn_seed_ledger_map(true, 'migration 20260915130000');


-- ═══════════════════════════════════════════════════════════════════════════
--  4 · WHAT THIS DOES NOT DO — still needed before a receipt can POST
--
--  · accounts.acc_voucher_seq has no row for the 'Rct' type. The type exists
--    (20260915120000 §1) but the numbering series does not, so Post has no
--    number to draw. prisma/seed/Acc_Voucher_Seq_Sale_Bill.sql is the shape
--    the Rct counter should copy.
--
--  · The header-totals trigger, receipt plan §2.4: accounts.fn_avh_refresh_
--    totals / fn_avh_recompute_totals / tr_av_refresh_totals are section 11
--    of 20260915120000 and were added to that file AFTER it was applied here,
--    exactly like the roles above — so they do not exist on this database
--    either. Until they do, avh_total_debit / avh_total_credit stay as the
--    service stamped them and ck_avh_balanced cannot catch an unbalanced
--    voucher. They are not folded in here because a trigger on acc_vouchers
--    is a schema change of its own, not part of the ledger map.
--
--  · Bill-balance maintenance (abl_alloc_amount / abl_pending_amount /
--    abl_status) is deliberately service code, not a trigger — see
--    20260915120000 §0 and bill-balance-recompute.service.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Read-back ──────────────────────────────────────────────────────────────
--
-- SELECT r.alr_role, r.alr_label,
--        l.led_name AS posts_to, g.acc_group_name AS under
--   FROM accounts.acc_ledger_role r
--   LEFT JOIN accounts.acc_ledger_map x ON x.alm_role = r.alr_role
--                                      AND NOT x.alm_is_deleted AND x.alm_is_active
--   LEFT JOIN accounts.acc_ledger_master l ON l.led_id = x.alm_ledger_id
--   LEFT JOIN accounts.acc_group_master  g ON g.acc_group_id = l.led_group_id
--  WHERE r.alr_group = 'RECEIPT'
--  ORDER BY r.alr_sort_order;
