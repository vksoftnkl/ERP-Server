-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 122 — the full till retest's server findings (2026-10-15).
--
--    1. setting till.cash_out_over_expected (§5): REFUSE = a payment, expense
--       or cash refund pays out of a drawer no more cash than it is expected
--       to hold (TILL_CASH_SHORT_IN_DRAWER); ALLOW = the drawer may run
--       negative. Shipped REFUSE; DEVICE max scope, so one till (or a
--       test's own device) can be let run negative.
--    2. dropdown 68 TILL APPROVER USERS (§8): an empty full / display name is
--       not NULL, so COALESCE picked '' and the Cash Office witness and the
--       safe Decide second person listed blank. Row 68 was made on the
--       dropdown screen and is in no seed file, so the UPDATE is guarded on
--       its name and old text and does nothing where the row is not there.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · setting ────────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES ('till.cash_out_over_expected', 'TILL', 'Session', 'TEXT', 'REFUSE', '["REFUSE","ALLOW"]'::jsonb, 'DEVICE',
        'Cash paid out may exceed what the drawer holds',
        'REFUSE = a payment, expense voucher or cash refund on a till pays out no more cash than the drawer is expected to hold (TILL_CASH_SHORT_IN_DRAWER). ALLOW = the drawer''s expected cash may go below zero.',
        32, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 2 · dropdown 68: blank names ───────────────────────────────────────────
UPDATE fixed.dropdown_details
   SET dropdown_sql = replace(
         dropdown_sql,
         'COALESCE(u.usr_full_name, u.usr_display_name, u.usr_login_name)',
         'COALESCE(NULLIF(u.usr_full_name, ''''), NULLIF(u.usr_display_name, ''''), u.usr_login_name)'),
       dropdown_modified_by = 'system',
       dropdown_modified_on = now()
 WHERE dropdown_id = 68
   AND dropdown_name = 'TILL APPROVER USERS'
   AND position('COALESCE(u.usr_full_name, u.usr_display_name, u.usr_login_name)' IN dropdown_sql) > 0;
