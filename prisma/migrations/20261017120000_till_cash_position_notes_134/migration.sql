-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 134 — Cash Position (S11): menu 289 and the HO_REVIEW event  2026-10-17
--
--  The Qt Cash Position screen reads registered grids (170-174) and, per live
--  drawer, /till/sessions/expected. Head office adds a review of a day or a
--  session through POST /till/reviews/create (TillReviewController), which
--  writes accounts.till_session_review (47 §9; no change to the table) and
--  journals HO_REVIEW.
--
--    289  Cash Position   under 271 Till, at 2.60 — just after 288 Till
--                         Reports. VIEW · CREATE (add an HO review) · EXPORT.
--
--  Visible exactly when Till Sessions (273) is, like 287 / 288. No user is
--  granted it here; rights are given in User Administration.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · till events (restates notes 118's list + HO_REVIEW) ─────────────────
ALTER TABLE accounts.till_event DROP CONSTRAINT IF EXISTS ck_tev_code;
ALTER TABLE accounts.till_event
    ADD CONSTRAINT ck_tev_code CHECK (tev_event_code::text = ANY (ARRAY[
        'DAY_OPEN','DAY_CLOSING','DAY_CLOSE','DAY_REOPEN',
        'SESSION_OPEN','SESSION_SUSPEND','SESSION_RESUME','SESSION_END_BILLING','SESSION_COUNT',
        'SESSION_RECOUNT','SESSION_CLOSE','SESSION_FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID','SESSION_IDLE_LOCK',
        'SESSION_DEVICE_MOVE','COUNTER_RELINK',   -- plan-till-counter-claim.md §3.3/§3.4
        'DRAWER_OPEN_SALE','NO_SALE','DRAWER_LEFT_OPEN','X_REPORT','Z_REPORT','REPRINT',
        'CASH_ALERT','CASH_BLOCK','CASH_UNBLOCK',
        'MOVEMENT_POSTED','MOVEMENT_VOIDED','VARIANCE_DECIDED',
        'RECEIPT_POSTED','PAYMENT_POSTED','EXPENSE_POSTED','MONEY_DOC_CANCELLED',
        'APPROVAL_REQUESTED','APPROVAL_DECIDED','APPROVAL_EXPIRED',
        'PRICE_OVERRIDE','LINE_VOID','BILL_VOID','RETENDER','REFUND_CASH',
        'OFFLINE_START','OFFLINE_END','LOGIN','LOGOUT','PIN_FAIL',
        'SYNC_PENDING_AT_CLOSE','LATE_ARRIVAL','SESSION_DAY_ENDED',
        'DUPLICATE_REF_BLOCKED','SLIP_CHECK','SETTLEMENT_IMPORTED','SETTLEMENT_POSTED','NONCASH_WRITTEN_OFF',
        'CASH_RECEIVED',                          -- notes 113
        'SAFE_COUNT','REMIT_CONFIRMED',           -- notes 118
        'HO_REVIEW']));                           -- notes 134


-- ── 2 · menu 289 "Cash Position" ───────────────────────────────────────────
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql (the
--  client resolves screens by id, user_menus stores rights by id); on a fresh
--  database the tree is a seed that runs after migrations, so nothing is
--  inserted here while 271 is absent. 289 taken by another menu stops this.
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 289
       AND m.menu_name <> 'Cash Position';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Cash Position menu: id already taken by another menu: %. Pick a free id here, in Menu_Master.sql and in TILL_MENU (till-enum.ts).', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 289, 271, 'Cash Position',
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 273), false),
       2.60, true, false, '{VIEW,CREATE,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 289);

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_verbs FROM fixed.menu_master WHERE menu_id = 289;
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'ck_tev_code' AND conrelid = 'accounts.till_event'::regclass;
