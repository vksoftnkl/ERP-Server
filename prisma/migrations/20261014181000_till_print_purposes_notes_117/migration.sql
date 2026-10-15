-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 117 §7 — the till's print documents, laid out in the Print Designer
--  (menu 62) and assigned in Printing Assignments (menu 248):
--
--    TILL_SESSION_Z   a closed session's Z (cashier, totals, tenders, movements)
--    TILL_SESSION_X   a live session's X read (sessions/x-report), same shape
--    TILL_DAY_Z       the business day: the day X while open, the store Z once
--                     closed (REOPENED ×n when it was reopened)
--
--  Their data comes from the till.session.* / till.day.* providers
--  (src/modules/settings/print-render/data/providers/till-*.provider.ts;
--  docId = tss_id / tbd_id, accYear = the document's own year).
--  ppo_src_module ACCOUNTS: the till's tables live in the accounts schema and
--  ck_ppo_src_module / ck_plg_src_module have no TILL. The doc types differ so
--  print_log counts never mix an X with a Z; a PRINT of a TILL_SESSION_Z /
--  TILL_DAY_Z bumps tss_print_count / tbd_print_count (PrintLogService).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT v.code, v.name, 'ACCOUNTS', v.code, 1, 'NA', true, v.sort, v.notes, true, false
  FROM (VALUES
    ('TILL_SESSION_Z', 'Till Session Z', 110,
     'A closed till session''s Z. Datasets: till.session.header (one), till.session.tenders, till.session.movements (many); docId = tss_id, accYear = tss_acc_year.'),
    ('TILL_SESSION_X', 'Till Session X Read', 111,
     'A live session''s X read (POST /till/sessions/x-report, which numbers it). Same datasets as TILL_SESSION_Z; x_no is the latest server X read.'),
    ('TILL_DAY_Z', 'Till Day Z (Store Z)', 112,
     'The business day: the day X while open, the store Z once closed. Datasets: till.day.header (one), till.day.sessions, till.day.tenders (many); docId = tbd_id, accYear = tbd_acc_year.')
  ) AS v(code, name, sort, notes)
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p
                    WHERE p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = lower(v.code)
                      AND p.ppo_is_deleted = false);


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT ppo_code, ppo_name, ppo_src_module, ppo_doc_type FROM public.print_purpose WHERE ppo_code LIKE 'TILL_%';
