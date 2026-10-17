-- ═══════════════════════════════════════════════════════════════════════════
--  Party-wise Outstanding (menu 279) — its print purpose          2026-10-15
--
--  The screen's Print / PDF buttons look a design up by purpose CODE. Like
--  the other purposes this ships no template: the A5 design is installed from
--  docs/print-templates/party-outstanding-a5/ (or drawn in the Print Designer,
--  menu 62) and assigned in Printing Assignments (menu 248).
--
--  The rows come from the providers reports.party_outstanding.head / .parties,
--  which call the report's own /export (shape PARTIES) — so a design for this
--  purpose binds no SQL. docId names nothing (the screen sends the company);
--  the filters travel as the revision's prompts: as_on (DATE) and side (TEXT)
--  required, then filter_branch_id, group_id, area_id, salesman_id,
--  collection_day, party_id, age_by, buckets, only_overdue, include_on_account,
--  deduct_pdc, hide_zero, min_due_days, max_due_days, sort, dir.
--  ppo_src_module REPORT: a reading of the books, not one module's document.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT 'PARTY_OUTSTANDING', 'Party-wise Outstanding', 'REPORT', 'PARTY_OUTSTANDING', 1,
       'NA', true, 131,
       'The Party-wise tab of Party-wise Outstanding (menu 279): one row per party with pending, on-account, net, overdue and ageing, then the totals and tiles. Datasets from the providers reports.party_outstanding.head (one) and .parties (many); docId = the company; prompts as_on, side (required) and the screen''s filters.',
       true, false
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose
                    WHERE ppo_company_id IS NULL AND lower(ppo_code::text) = 'party_outstanding'
                      AND ppo_is_deleted = false);


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT ppo_code, ppo_src_module, ppo_doc_type FROM public.print_purpose WHERE ppo_code = 'PARTY_OUTSTANDING';
