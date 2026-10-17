-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 135 — the till's last two print documents (TILL_DESIGN §9), laid out
--  in the Print Designer (menu 62) and assigned in Printing Assignments (248),
--  beside notes 117's TILL_SESSION_Z / TILL_SESSION_X / TILL_DAY_Z:
--
--    TILL_MOVEMENT   the slip of one cash movement (float issue, top-up, pickup,
--                    drop, hand-over, paid in, change, safe transfer)
--    TILL_REMIT      the memo that goes with a remittance's cash to the bank or
--                    the cash collection agency — two copies
--
--  Their data comes from the till.movement.* / till.remit.* providers
--  (src/modules/settings/print-render/data/providers/till.providers.ts;
--  docId = tcm_id, accYear = tcm_acc_year), under movements/get's rights. A
--  PRINT of either bumps tcm_print_count (PrintLogService), so a second print
--  can say REPRINT. ppo_src_module ACCOUNTS, as notes 117 (ck_ppo_src_module
--  has no TILL).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose
       (ppo_code, ppo_name, ppo_src_module, ppo_doc_type, ppo_copy_count,
        ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
        ppo_is_active, ppo_is_deleted)
SELECT v.code, v.name, 'ACCOUNTS', v.code, v.copies, v.labels, true, v.sort, v.notes, true, false
  FROM (VALUES
    ('TILL_MOVEMENT', 'Till Movement Slip', 1, 'NA', 113,
     'The slip of one cash movement (every kind but a REMIT). Datasets: till.movement.header (one), till.movement.lines (many); docId = tcm_id, accYear = tcm_acc_year.'),
    ('TILL_REMIT', 'Till Remittance Memo', 2, 'Bank / Agency Copy,Store Copy', 114,
     'The memo of one remittance (a REMIT movement), with the bank''s figures once confirmed. Datasets: till.remit.header (one), till.remit.lines (many); docId = tcm_id, accYear = tcm_acc_year.')
  ) AS v(code, name, copies, labels, sort, notes)
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p
                    WHERE p.ppo_company_id IS NULL AND lower(p.ppo_code::text) = lower(v.code)
                      AND p.ppo_is_deleted = false);


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT ppo_code, ppo_name, ppo_copy_count, ppo_copy_labels FROM public.print_purpose WHERE ppo_code LIKE 'TILL_%';
