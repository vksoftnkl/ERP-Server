-- ═══════════════════════════════════════════════════════════════════════════
--  Till REV 2 §2.13 — "hidden-expected count", not "blind close"     2026-10-08
--
--  till/plan-till-review-rev2.md §2.13: D365 Commerce uses "blind close" for
--  parking a shift UNCOUNTED and counting it later elsewhere; our
--  till.blind_close means "the cashier counts without seeing what the system
--  expects". The KEY stays (code and overrides read it); the label and the
--  description say what it does. Parking a drawer to be counted later is
--  till.count_place = CASH_OFFICE here.
--
--  Only the shipped wording is replaced: a site that relabelled the setting
--  keeps its label.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.app_setting_def
   SET asd_label       = 'Hidden-expected count',
       asd_description = 'The cashier counts without seeing what the system expects (other POS products call this a blind count; their "blind close" — park the shift, count it later — is till.count_place = CASH_OFFICE here).',
       asd_modified_on = now(),
       asd_modified_by = '20261008150000_till_rev2_wording'
 WHERE asd_key = 'till.blind_close'
   AND asd_label = 'Blind close';
