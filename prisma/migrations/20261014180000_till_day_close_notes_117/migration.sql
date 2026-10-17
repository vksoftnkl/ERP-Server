-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 117 — day close and the session exceptions (TILL_DESIGN §13 phase 4).
--  The tables are 47's (till_business_day CLOSED / tbd_z_no / frozen totals,
--  tss_force_closed / tss_reopen_count); the rules and event codes are seeded.
--  What the routes still need:
--
--    1. reason category DAY_CLOSE (the day-close exception's reason), with
--       its shipped reasons; FORCE_CLOSE gains "Shift over time" and
--       "Day close" (a live session force-closed by the day close)
--    2. Business Day (274) gains EDIT = close / reopen the day; whoever may
--       open the day (CREATE) may close it
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · reasons ────────────────────────────────────────────────────────────
ALTER TABLE accounts.till_reason DROP CONSTRAINT IF EXISTS ck_trs_category;
ALTER TABLE accounts.till_reason ADD CONSTRAINT ck_trs_category
    CHECK (trs_category::text = ANY (ARRAY[
        'VARIANCE', 'FLOAT_MISMATCH', 'EXPENSE', 'PAID_IN', 'PICKUP', 'NO_SALE', 'SUSPEND',
        'FORCE_CLOSE', 'REOPEN', 'SESSION_VOID', 'MOVEMENT_VOID', 'DAY_REOPEN', 'REPRINT',
        'VOID_BILL', 'VOID_LINE', 'PRICE_OVERRIDE', 'REFUND', 'NONCASH', 'DAY_CLOSE']));

INSERT INTO accounts.till_reason
       (trs_company_id, trs_category, trs_code, trs_name, trs_needs_note, trs_needs_ref, trs_sort_order, trs_created_by)
SELECT NULL, v.c, v.k, v.n, v.note, false, v.s, 'system' FROM (VALUES
 ('FORCE_CLOSE', 'SHIFT_OVER',   'Shift over time',                              false, 30),
 ('FORCE_CLOSE', 'DAY_CLOSE',    'Day close',                                    false, 40),
 ('DAY_CLOSE',   'CASHIER_GONE', 'Cashier gone: drawer counted by the supervisor', false, 10),
 ('DAY_CLOSE',   'SAFE_LATER',   'Safe counted next morning',                    true,  20),
 ('DAY_CLOSE',   'OTHER',        'Other',                                        true,  99)
) AS v(c, k, n, note, s)
ON CONFLICT DO NOTHING;


-- ── 2 · Business Day (274) EDIT = close / reopen the day ───────────────────
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT}'::text[],
       menu_modified_on = now()
 WHERE menu_id = 274
   AND menu_verbs = '{VIEW,CREATE}'::text[];

UPDATE public.user_menus
   SET um_can_edit = true,
       um_modified_on = now()
 WHERE um_menu_id = 274
   AND um_can_create
   AND NOT um_can_edit
   AND um_is_deleted = false;


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT trs_category, trs_code, trs_name FROM accounts.till_reason WHERE trs_category IN ('FORCE_CLOSE','DAY_CLOSE');
-- SELECT menu_verbs FROM fixed.menu_master WHERE menu_id = 274;
-- SELECT um_user_id, um_can_create, um_can_edit FROM public.user_menus WHERE um_menu_id = 274 AND NOT um_is_deleted;
