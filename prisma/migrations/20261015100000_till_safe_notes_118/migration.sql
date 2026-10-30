-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 118 — the safe: its balance, its count, and remittance to the bank
--  (TILL_DESIGN §13 phase 5, S9). The tables are 47's (till_safe, till_count
--  kind SAFE, till_cash_movement kinds REMIT / SAFE_TRANSFER, the CRem voucher
--  type, the SAFE_CASH / CASH_IN_TRANSIT roles, the SAFE_VARIANCE / REMITTANCE
--  rules, tbd_safe_* / tbd_remitted). What the routes still need:
--
--    1. a SAFE count names the business day it counts for (tct_day_id); a
--       remittance's own denomination count is kind REMIT
--    2. a safe gap is a till_variance row with no session: stage SAFE (a safe
--       count, tvr_count_id) or REMIT (a bank credit short of what was sent,
--       tvr_movement_id), both naming the safe (tvr_safe_id)
--    3. the remittance on its movement row: how it went (BANK_DEPOSIT / CIT),
--       where it stands (DEPOSITED / IN_TRANSIT / CONFIRMED) and the bank's
--       confirmation of a CIT one (date, ref, amount, by, on, its Contra)
--    4. till events SAFE_COUNT and REMIT_CONFIRMED
--    5. menu 287 "Cash Office" under Till (271): VIEW the balance · CREATE a
--       count / a remittance · OVERRIDE decide a safe gap. A NEW id: 286 (the
--       notes-113 Cash Office) stays retired, its grants soft-deleted.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · counts ─────────────────────────────────────────────────────────────
ALTER TABLE accounts.till_count ADD COLUMN IF NOT EXISTS tct_day_id uuid;

ALTER TABLE accounts.till_count DROP CONSTRAINT IF EXISTS ck_tct_kind;
ALTER TABLE accounts.till_count
    ADD CONSTRAINT ck_tct_kind CHECK (tct_kind::text = ANY (ARRAY[
        'OPEN','CLOSE','RECOUNT','HANDOVER','SURPRISE','FLOAT_ISSUE','PICKUP','DROP_VERIFY','SAFE',
        'REMIT']));   -- notes 118: the cash a remittance took out of the safe

--  A safe count belongs to the safe and a business day, never to a session.
ALTER TABLE accounts.till_count DROP CONSTRAINT IF EXISTS ck_tct_safe;
ALTER TABLE accounts.till_count
    ADD CONSTRAINT ck_tct_safe
        CHECK (tct_kind <> 'SAFE'
               OR (tct_safe_id IS NOT NULL AND tct_day_id IS NOT NULL AND tct_session_id IS NULL));

CREATE INDEX IF NOT EXISTS ix_tct_safe_day
    ON accounts.till_count (tct_day_id, tct_acc_year, tct_safe_id)
    WHERE tct_is_deleted = false AND tct_kind = 'SAFE';

COMMENT ON COLUMN accounts.till_count.tct_day_id IS
    'Notes 118: a SAFE count — the business day (till_business_day.tbd_id, same acc year) it counts for; the day''s last count of a safe is the day''s. FK-less, as tcm_day_id.';


-- ── 2 · a safe gap is a variance with no session ───────────────────────────
ALTER TABLE accounts.till_variance ALTER COLUMN tvr_session_id DROP NOT NULL;
ALTER TABLE accounts.till_variance
    ADD COLUMN IF NOT EXISTS tvr_safe_id  uuid,
    ADD COLUMN IF NOT EXISTS tvr_count_id uuid;

ALTER TABLE accounts.till_variance DROP CONSTRAINT IF EXISTS ck_tvr_stage;
ALTER TABLE accounts.till_variance
    ADD CONSTRAINT ck_tvr_stage
        CHECK (tvr_stage::text = ANY (ARRAY['OPEN','CLOSE','RECEIVE','SAFE','REMIT']));

--  Who a row belongs to, by stage (replaces ck_tvr_receive, which said only
--  RECEIVE ⇔ tvr_movement_id). SAFE / REMIT have the OPEN row's shape (cash,
--  every term 0 but tvr_open_amount = what was expected), so ck_tvr_expected
--  and ck_tvr_open_stage hold as they are.
ALTER TABLE accounts.till_variance DROP CONSTRAINT IF EXISTS ck_tvr_receive;
ALTER TABLE accounts.till_variance DROP CONSTRAINT IF EXISTS ck_tvr_owner;
ALTER TABLE accounts.till_variance
    ADD CONSTRAINT ck_tvr_owner CHECK (CASE tvr_stage
        WHEN 'RECEIVE' THEN tvr_session_id IS NOT NULL AND tvr_movement_id IS NOT NULL
                        AND tvr_safe_id IS NULL AND tvr_count_id IS NULL
        WHEN 'SAFE'    THEN tvr_session_id IS NULL AND tvr_safe_id IS NOT NULL
                        AND tvr_count_id IS NOT NULL AND tvr_movement_id IS NULL
        WHEN 'REMIT'   THEN tvr_session_id IS NULL AND tvr_safe_id IS NOT NULL
                        AND tvr_movement_id IS NOT NULL AND tvr_count_id IS NULL
        ELSE                tvr_session_id IS NOT NULL AND tvr_movement_id IS NULL
                        AND tvr_safe_id IS NULL AND tvr_count_id IS NULL
    END);

--  One live row per session × stage × tender × bag, and per safe count / per
--  remittance (both have no session, so the safe and the count join the key).
DROP INDEX IF EXISTS accounts.ux_tvr_live;
CREATE UNIQUE INDEX ux_tvr_live
    ON accounts.till_variance (tvr_session_id, tvr_stage, tvr_tender_type_id, tvr_tender_id,
                               tvr_movement_id, tvr_safe_id, tvr_count_id, tvr_acc_year)
    NULLS NOT DISTINCT
    WHERE tvr_is_deleted = false AND tvr_status <> 'REVERSED';

CREATE INDEX IF NOT EXISTS ix_tvr_safe
    ON accounts.till_variance (tvr_safe_id, tvr_acc_year)
    WHERE tvr_is_deleted = false AND tvr_safe_id IS NOT NULL;

COMMENT ON COLUMN accounts.till_variance.tvr_safe_id IS
    'Notes 118: stage SAFE / REMIT — the safe (till_safe.tsf_id). FK-less.';
COMMENT ON COLUMN accounts.till_variance.tvr_count_id IS
    'Notes 118: stage SAFE — the safe count (till_count.tct_id, same acc year) that found the gap. FK-less.';


-- ── 3 · the remittance on its movement row ─────────────────────────────────
ALTER TABLE accounts.till_cash_movement
    ADD COLUMN IF NOT EXISTS tcm_remit_mode               character varying(12),
    ADD COLUMN IF NOT EXISTS tcm_remit_status             character varying(10),
    ADD COLUMN IF NOT EXISTS tcm_bank_date                date,
    ADD COLUMN IF NOT EXISTS tcm_bank_ref                 character varying(50),
    ADD COLUMN IF NOT EXISTS tcm_bank_amount              numeric(15,2),
    ADD COLUMN IF NOT EXISTS tcm_confirmed_by             uuid,
    ADD COLUMN IF NOT EXISTS tcm_confirmed_on             timestamptz,
    ADD COLUMN IF NOT EXISTS tcm_confirm_voucher_id       uuid,
    ADD COLUMN IF NOT EXISTS tcm_confirm_voucher_acc_year character(9);

ALTER TABLE accounts.till_cash_movement
    DROP CONSTRAINT IF EXISTS ck_tcm_remit,
    DROP CONSTRAINT IF EXISTS ck_tcm_remit_flow,
    DROP CONSTRAINT IF EXISTS ck_tcm_remit_confirmed,
    DROP CONSTRAINT IF EXISTS ck_tcm_bank_amount,
    DROP CONSTRAINT IF EXISTS ck_tcm_confirm_voucher_pair,
    DROP CONSTRAINT IF EXISTS ck_tcm_confirm_voucher;
ALTER TABLE accounts.till_cash_movement
    -- every REMIT says how it went and where it stands; nothing else does
    ADD CONSTRAINT ck_tcm_remit
        CHECK ((tcm_kind = 'REMIT') = (tcm_remit_mode IS NOT NULL AND tcm_remit_status IS NOT NULL)),
    -- staff at the bank: in the bank at once · a CIT agency: in transit until the bank shows it
    ADD CONSTRAINT ck_tcm_remit_flow
        CHECK (tcm_remit_mode IS NULL
               OR (tcm_remit_mode = 'BANK_DEPOSIT' AND tcm_remit_status = 'DEPOSITED')
               OR (tcm_remit_mode = 'CIT' AND tcm_remit_status::text = ANY (ARRAY['IN_TRANSIT','CONFIRMED']))),
    ADD CONSTRAINT ck_tcm_remit_confirmed
        CHECK ((COALESCE(tcm_remit_status, '') = 'CONFIRMED') =
               (tcm_bank_date IS NOT NULL AND tcm_bank_amount IS NOT NULL
                AND tcm_confirmed_by IS NOT NULL AND tcm_confirmed_on IS NOT NULL)),
    ADD CONSTRAINT ck_tcm_bank_amount
        CHECK (tcm_bank_amount IS NULL OR tcm_bank_amount >= 0),
    ADD CONSTRAINT ck_tcm_confirm_voucher_pair
        CHECK ((tcm_confirm_voucher_id IS NULL) = (tcm_confirm_voucher_acc_year IS NULL)),
    -- a bank credit of 0 has no Contra; anything credited has one
    ADD CONSTRAINT ck_tcm_confirm_voucher
        CHECK (tcm_confirm_voucher_id IS NULL OR tcm_remit_status = 'CONFIRMED');

CREATE INDEX IF NOT EXISTS ix_tcm_in_transit
    ON accounts.till_cash_movement (tcm_company_id, tcm_branch_id, tcm_safe_id)
    WHERE tcm_is_deleted = false AND tcm_status = 'POSTED' AND tcm_remit_status = 'IN_TRANSIT';

--  The safe's balance counts back-office cash (48 §2.3: a receipt / payment /
--  expense on a device with no session posts its CASH rows to the default
--  safe's ledger): found by the tender row's ledger.
CREATE INDEX IF NOT EXISTS ix_td_cash_tender_ledger
    ON accounts.acc_tender_detail (td_tender_ledger_id)
    WHERE td_tender_type_id = 1;

COMMENT ON COLUMN accounts.till_cash_movement.tcm_remit_mode IS
    'Notes 118, REMIT only: BANK_DEPOSIT (staff paid it in: CRem Dr Bank / Cr Safe) or CIT (a cash-in-transit agency took it: CRem Dr Cash in transit / Cr Safe, then a Contra on confirmation).';
COMMENT ON COLUMN accounts.till_cash_movement.tcm_remit_status IS
    'Notes 118, REMIT only: DEPOSITED (BANK_DEPOSIT) · IN_TRANSIT → CONFIRMED (CIT, once the bank statement shows it). VOIDED is tcm_status.';
COMMENT ON COLUMN accounts.till_cash_movement.tcm_bank_amount IS
    'Notes 118: what the bank credited for a CIT remittance; short of tcm_amount = a REMIT-stage variance against Cash in transit.';


-- ── 4 · till events (restates notes 113's list + SAFE_COUNT, REMIT_CONFIRMED) ─
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
        'SAFE_COUNT','REMIT_CONFIRMED']));        -- notes 118


-- ── 5 · menu 287 "Cash Office" ─────────────────────────────────────────────
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql (the
--  client resolves screens by id, user_menus stores rights by id); on a fresh
--  database the tree is a seed that runs after migrations, so nothing is
--  inserted here while 271 is absent. 287 taken by another menu stops this.
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 287
       AND m.menu_name <> 'Cash Office';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Cash Office menu: id already taken by another menu: %. Pick a free id here, in Menu_Master.sql and in TILL_MENU (till-enum.ts).', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 287, 271, 'Cash Office',
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 273), false),
       3.60, true, false, '{VIEW,CREATE,PRINT,EXPORT,OVERRIDE}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 287);

--  Till Sessions (273) OVERRIDE is the supervisor's right: its holders get the
--  whole screen. A safe gap is still decided only under a Till Approval
--  Authority (285) grant for SAFE_VARIANCE. A user with a row on 287 keeps it.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, n.menu_id, true, true, false, false,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       u.um_sort_order, false, u.um_created_by, false, false,
       false, true, false
  FROM public.user_menus u
  JOIN fixed.menu_master n ON n.menu_id = 287
 WHERE u.um_menu_id = 273
   AND u.um_can_override
   AND u.um_is_deleted = false
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT menu_id, menu_parent, menu_name, menu_is_active, menu_verbs FROM fixed.menu_master WHERE menu_id IN (286, 287);
-- SELECT um_user_id, um_can_view, um_can_create, um_can_override FROM public.user_menus WHERE um_menu_id = 287 AND NOT um_is_deleted;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname IN ('ck_tvr_owner','ck_tct_safe','ck_tcm_remit_flow');
