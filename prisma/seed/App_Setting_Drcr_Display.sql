-- App_Setting_Drcr_Display.sql — 2026-09-26
--
-- ONE app setting: how the Voucher Register (and later every accounts entry
-- screen) LABELS a leg's side. Display only: the API, the payload and every
-- table keep DR / CR exactly as they are.
--
--   DR_CR  (default)  the line reads "Dr" / "Cr"
--   TO_BY             Tally's convention: "By" = Dr, "To" = Cr
--
-- Read by the Qt client as accounts.drcr_display (AppSession::drCrDisplay());
-- until this row exists the client uses the default DR_CR, so nothing breaks
-- before it is run. Idempotent: re-running changes nothing.
--
-- Scope COMPANY: a company's accountants read one convention; a per-user
-- toggle would make two people read the same voucher differently.

INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_allowed_values, asd_max_scope, asd_label, asd_description,
        asd_sort_order, asd_is_active, asd_needs_relogin, asd_created_by)
SELECT 'accounts.drcr_display', 'ACCOUNTS', 'Voucher Register', 'TEXT', 'DR_CR',
       '["DR_CR", "TO_BY"]'::jsonb, 'COMPANY',
       'Show Dr/Cr or By/To',
       'How a voucher line''s side is LABELLED on the accounts entry screens. DR_CR: Dr / Cr. '
       'TO_BY: Tally''s convention, By for a debit line and To for a credit line. Display only: '
       'the stored side is always DR / CR.',
       10, true, true, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def WHERE asd_key = 'accounts.drcr_display');
