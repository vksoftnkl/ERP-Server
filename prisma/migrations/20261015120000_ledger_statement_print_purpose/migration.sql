-- ═══════════════════════════════════════════════════════════════════════════
--  Ledger Statement (menu 258) — its print purpose                2026-10-15
--
--  The screen's Print / PDF buttons look a design up by purpose CODE. Like
--  the other purposes this ships no template: the A5 design is installed from
--  docs/print-templates/ledger-statement-a5/ (or drawn in the Print Designer,
--  menu 62) and assigned in Printing Assignments (menu 248).
--
--  docId = the LEDGER (accounts.acc_ledger_master.led_id), accYear = the
--  statement's year. The period and the screen's switches travel as the
--  revision's prompts: from_date, to_date (DATE, required), stmt_branch_id
--  (UUID, blank = all branches), include_cancelled, with_bill_refs,
--  show_narration, show_legs (BOOLEAN).
--  ppo_src_module REPORT: a statement is a reading of the books, not a
--  document of any one module (ck_ppo_src_module / ck_plg_src_module allow it).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT 'LEDGER_STATEMENT', 'Ledger Statement', 'REPORT', 'LEDGER_STATEMENT', 1,
       'NA', true, 130,
       'One ledger for one period, as the Ledger Statement screen (menu 258) shows it: opening, one row per voucher with its running balance, totals and closing. docId = led_id, accYear = the statement''s year; prompts from_date, to_date (required), stmt_branch_id (blank = all branches), include_cancelled, with_bill_refs, show_narration, show_legs.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose
                    WHERE ppo_company_id IS NULL AND lower(ppo_code::text) = 'ledger_statement'
                      AND ppo_is_deleted = false);


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT ppo_code, ppo_src_module, ppo_doc_type FROM public.print_purpose WHERE ppo_code = 'LEDGER_STATEMENT';
