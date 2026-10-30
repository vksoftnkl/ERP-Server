-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 114 — the supervisor approves a closed session's cash on Till
--  Sessions (273): POST /till/sessions/approve-cash, one approval per session
--  for every hand-over / drop still awaiting receipt, no denomination count.
--
--    1. ck_tcm_received: a RECEIVED row names who, when and how much; the
--       DROP_VERIFY count (tcm_receive_count_id) only when there was one —
--       movements/receive counts, approve-cash does not
--    2. menu 286 "Cash Office" retired (menu_is_active = false) and its grants
--       soft-deleted: /user-administration refuses an inactive menu id, so a
--       live grant would make every rights save of its holders fail. The two
--       notes-113 routes stay, judged on Till Sessions (273) now.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · a receipt without a count ──────────────────────────────────────────
ALTER TABLE accounts.till_cash_movement
    DROP CONSTRAINT IF EXISTS ck_tcm_received;
ALTER TABLE accounts.till_cash_movement
    ADD CONSTRAINT ck_tcm_received
        CHECK ((COALESCE(tcm_receipt_status, '') = 'RECEIVED') =
               (tcm_received_by IS NOT NULL AND tcm_received_on IS NOT NULL
                AND tcm_received_amount IS NOT NULL));
COMMENT ON COLUMN accounts.till_cash_movement.tcm_received_amount IS
    'What the supervisor received: counted blind (movements/receive, notes 113) or confirmed on the session (sessions/approve-cash, notes 114). A difference from tcm_amount is the session''s RECEIVE-stage variance.';
COMMENT ON COLUMN accounts.till_cash_movement.tcm_receive_count_id IS
    'The DROP_VERIFY count of a movements/receive (notes 113); NULL when the cash was approved on the session without a count (notes 114).';


-- ── 2 · Cash Office (286) retired ──────────────────────────────────────────
UPDATE fixed.menu_master
   SET menu_is_active = false,
       menu_modified_on = now()
 WHERE menu_id = 286
   AND menu_name = 'Cash Office'
   AND menu_is_active;

UPDATE public.user_menus
   SET um_is_deleted = true,
       um_modified_on = now()
 WHERE um_menu_id = 286
   AND um_is_deleted = false;


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_is_active FROM fixed.menu_master WHERE menu_id = 286;
-- SELECT count(*) FROM public.user_menus WHERE um_menu_id = 286 AND NOT um_is_deleted;
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'ck_tcm_received';
