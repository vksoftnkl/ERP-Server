-- ═══════════════════════════════════════════════════════════════════════════
--  Re-derive avh_total_debit / avh_total_credit on every POSTED voucher
--
--  ── What this repairs ───────────────────────────────────────────────────
--  20260917170000 installed tr_av_refresh_totals and back-filled every header
--  that existed AT THAT MOMENT. On a box where the trigger was put on by hand
--  ahead of that migration, or where vouchers were posted in the window
--  between the two, the back-fill and the trigger do not meet: a voucher
--  posted before the trigger and after the back-fill keeps whatever its writer
--  stamped, and nothing ever looks at it again.
--
--  Measured on 192.168.0.106 on 2026-09-18: three POSTED receipts carry header
--  totals that disagree with their own legs — rct00049 (header 500, legs
--  1500), rct00050 (1200 / 1700) and rct00052 (600 / 1200). They are not a
--  defect in any writer; they are rows that predate the fix.
--
--  ── Why it is safe ──────────────────────────────────────────────────────
--  fn_avh_recompute_totals only ever replaces the two columns with the sum of
--  the voucher's own live legs, and skips the write entirely when they already
--  agree. So this is a no-op on every voucher that is already correct — which,
--  on a database where 20260917170000 did its job, is all of them.
--
--  ck_avh_balanced (status <> 'POSTED' OR debit = credit) is the one thing
--  that could refuse a row. It cannot refuse one here: for a POSTED voucher
--  the new values are Σ DR and Σ CR over the same leg set, so a voucher whose
--  legs balance lands balanced. A voucher whose legs do NOT balance is a real
--  defect that ck_avh_balanced has been unable to see, and this is what makes
--  it visible — the migration fails, loudly, naming the constraint, which is
--  the correct outcome for an unbalanced posted voucher.
--
--  ── Why a migration rather than a script ────────────────────────────────
--  Because every environment needs it exactly once and none of them should
--  need somebody to remember. It is idempotent, so replaying it costs a scan.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_repaired integer;
BEGIN
    IF to_regprocedure('accounts.fn_avh_recompute_totals(uuid, char)') IS NULL THEN
        RAISE EXCEPTION
            'accounts.fn_avh_recompute_totals is missing — migration 20260917170000 has not been applied';
    END IF;

    --  Count first, so the log says what actually moved rather than how many
    --  rows were looked at. Same distinction R-B1 draws on the PDC sweep.
    SELECT count(*)
      INTO v_repaired
      FROM accounts.acc_voucher_header h
     WHERE h.avh_voucher_status = 'POSTED'
       AND (h.avh_total_debit, h.avh_total_credit) IS DISTINCT FROM (
             SELECT (COALESCE(SUM(v.av_amount) FILTER (WHERE v.av_dr_cr = 'DR'), 0),
                     COALESCE(SUM(v.av_amount) FILTER (WHERE v.av_dr_cr = 'CR'), 0))
               FROM accounts.acc_vouchers v
              WHERE v.av_voucher_id = h.avh_voucher_id
                AND v.av_acc_year   = h.avh_acc_year
                AND NOT v.av_is_deleted);

    PERFORM accounts.fn_avh_recompute_totals(h.avh_voucher_id, h.avh_acc_year)
       FROM accounts.acc_voucher_header h
      WHERE h.avh_voucher_status = 'POSTED';

    RAISE NOTICE 'Re-derived voucher totals: % POSTED voucher(s) repaired', v_repaired;
END
$$;
