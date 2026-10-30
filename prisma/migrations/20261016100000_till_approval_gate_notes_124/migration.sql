-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 124 §5 — the approval gate (notes 105 Part B), 2026-10-16.
--
--    1. setting till.approval_gate: WARN = an event its approval rule asks
--       for goes through, and a PENDING till_approval request is filed for
--       the approvers' inbox; REFUSE = an event whose rule blocks the till
--       (tar_blocks_till) is refused (428 TILL_APPROVAL_REQUIRED) until an
--       approved request is brought. Shipped WARN — the user's rule
--       (2026-10-15): the counter is never blocked while a customer waits,
--       a rule warns first and refuses only where a company turns it on.
--       DEVICE max scope, so a company / branch sets it and a test device can
--       be REFUSE alone (as till.cash_out_over_expected).
--    2. shipped rules for VOID_BILL and VOID_LINE (in ck_tar_event since 47,
--       never seeded): ALWAYS, SUPERVISOR, at the COUNTER — what a client
--       asks for through /till/approvals/request before a void. The server
--       does not see a line void, so nothing on it enforces them.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · setting ────────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES ('till.approval_gate', 'TILL', 'Session', 'TEXT', 'WARN', '["WARN","REFUSE"]'::jsonb, 'DEVICE',
        'Approval rules refuse until approved',
        'WARN = an expense, cash payment or opening float difference that its approval rule asks for goes through, and a request waits in the approvers'' inbox. REFUSE = it is refused until an approver has approved the request (only on a rule that blocks the till).',
        33, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 2 · VOID_BILL / VOID_LINE rules ────────────────────────────────────────
INSERT INTO accounts.till_approval_rule
    (tar_event_code, tar_mode, tar_channel, tar_min_role, tar_blocks_till, tar_remarks, tar_created_by)
SELECT v.event, 'ALWAYS', 'COUNTER', 'SUPERVISOR', true, v.remarks, 'system'
  FROM (VALUES ('VOID_BILL', 'a whole bill voided at the counter'),
               ('VOID_LINE', 'a line voided on a bill being made')) AS v(event, remarks)
 WHERE NOT EXISTS (
         SELECT 1 FROM accounts.till_approval_rule r
          WHERE r.tar_event_code = v.event AND r.tar_company_id IS NULL
            AND r.tar_branch_id IS NULL AND r.tar_is_deleted = false);
