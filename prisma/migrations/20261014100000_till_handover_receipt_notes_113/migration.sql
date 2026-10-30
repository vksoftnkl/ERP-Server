-- ═══════════════════════════════════════════════════════════════════════════
--  Till: a session's cash reaches the safe only when someone receives it
--  — notes 113 (2026-10-14)
--
--  Live, VIJI PC-261014-02: open → end billing → count ₹500 (ACCEPTED) →
--  close, all by the cashier alone, and CLOSE_HANDOVER posted ₹500 INTO THE
--  SAFE. Nobody confirmed receiving it: approval only fires when a count is
--  OUT of tolerance, so a cashier who counts "right" and keeps the cash never
--  meets a supervisor.
--
--  With till.handover_receipt = REQUIRED (BRANCH max scope, default NONE) the
--  close hand-over and a cashier's DROP no longer post into the safe:
--
--    close / drop (cashier)   TDrp  Dr Till cash awaiting receipt / Cr Till cash
--    receive (supervisor)     TRcv  Dr Safe                       / Cr awaiting  (what was counted)
--    received ≠ handed over   TVar  the session's variance, stage RECEIVE, through
--                                   the usual tolerance and decide-variance APPROVE
--
--  The till cash side is unchanged (close still credits till cash, expected()
--  is untouched); only the safe moves later. The safe ledger, so any safe
--  balance, holds received cash only. PICKUP keeps its two signatures (notes
--  110) and goes straight to the safe. Rows posted before this carry no
--  receipt state (NULL) and stay as they are: no back-fill.
--
--  Here:
--    1. ledger role TILL_CASH_AWAITING, catalogued (else fn_seed_ledger_map
--       refuses every boot), mapped by fn_seed_ledger_map
--    2. voucher type TRcv "Till Cash Received" (Contra), its number series
--    3. setting till.handover_receipt
--    4. till_cash_movement: the receipt, as columns on the hand-over / drop row
--       (as the void is): tcm_receipt_status AWAITING | RECEIVED, who, when,
--       how much, the DROP_VERIFY count, the TRcv voucher
--    5. till_variance: stage RECEIVE (tvr_stage widened from 5), naming the
--       bag (tvr_movement_id) — one live row per bag, so ux_tvr_live takes it
--    6. till event CASH_RECEIVED
--    7. menu 286 "Cash Office" under 271: VIEW = the awaiting list, CREATE =
--       receive. Whoever holds Till Sessions (273) OVERRIDE gets it.
--
--  No CHECK keeps the receiver off tcm_done_by: till.single_operator lets the
--  owner-cashier receive their own bag, so that rule is the service's.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · ledger role ────────────────────────────────────────────────────────
INSERT INTO accounts.acc_ledger_role (alr_role, alr_label, alr_group, alr_want_nature, alr_want_type, alr_sort_order)
VALUES ('TILL_CASH_AWAITING', 'Till cash awaiting receipt', 'SHARED', 'Assets', NULL, 615)
ON CONFLICT (alr_role) DO NOTHING;

--  The catalogue, restated — character for character as 20261008130000 left
--  it (the live definition agrees), with the TILL_CASH_AWAITING row appended.
CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
 RETURNS TABLE(role_code text, ledger_name text, ledger_type text, duty_head text, group_name text)
 LANGUAGE sql
 IMMUTABLE
AS $$
    SELECT *
      FROM (VALUES
        -- role                 ledger name                       type        duty head         group
        -- ── REVENUE ────────────────────────────────────────────────────────
        ('SALES',              'Sales Account',                  'INCOME',   NULL,             'Sales Accounts'),
        ('SALES_RETURN',       'Sales Return',                   'INCOME',   NULL,             'Sales Accounts'),
        -- ── OUTPUT_TAX ─────────────────────────────────────────────────────
        ('OUTPUT_CGST',        'Output CGST',                    'TAX',      'Central Tax',    'Duties & Taxes'),
        ('OUTPUT_SGST',        'Output SGST',                    'TAX',      'State Tax',      'Duties & Taxes'),
        ('OUTPUT_IGST',        'Output IGST',                    'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('OUTPUT_CESS',        'Output Cess',                    'TAX',      'Cess',           'Duties & Taxes'),
        ('OUTPUT_ACESS',       'Output State Cess',              'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── PURCHASE ───────────────────────────────────────────────────────
        ('PURCHASE',           'Purchase Account',               'EXPENSE',  NULL,             'Purchase Accounts'),
        ('PURCHASE_RETURN',    'Purchase Return',                'EXPENSE',  NULL,             'Purchase Accounts'),
        -- ── INPUT_TAX ──────────────────────────────────────────────────────
        ('INPUT_CGST',         'Input CGST',                     'TAX',      'Central Tax',    'Duties & Taxes'),
        ('INPUT_SGST',         'Input SGST',                     'TAX',      'State Tax',      'Duties & Taxes'),
        ('INPUT_IGST',         'Input IGST',                     'TAX',      'Integrated Tax', 'Duties & Taxes'),
        ('INPUT_CESS',         'Input Cess',                     'TAX',      'Cess',           'Duties & Taxes'),
        ('INPUT_ACESS',        'Input State Cess',               'TAX',      'State Cess',     'Duties & Taxes'),
        -- ── SHARED ─────────────────────────────────────────────────────────
        ('ROUND_OFF',          'Round Off',                      'ROUNDOFF', NULL,             'Indirect Expenses'),
        ('DISCOUNT_ALLOWED',   'Discount Allowed',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('WRITE_OFF',          'Bad Debts Written Off',          'EXPENSE',  NULL,             'Indirect Expenses'),
        ('ADVANCE_RECEIVED',   'Customer Advances Received',     'GENERAL',  NULL,             'Current Liabilities'),
        ('OPENING_DIFFERENCE', 'Difference in Opening Balances', 'GENERAL',  NULL,             'Suspense A/c'),
        ('RETAINED_EARNINGS',  'Retained Earnings',              'GENERAL',  NULL,             'Reserves & Surplus'),
        -- ── FUTURE — nothing posts to these yet ────────────────────────────
        ('TCS_PAYABLE',        'TCS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        ('TDS_PAYABLE',        'TDS Payable',                    'TAX',      NULL,             'Duties & Taxes'),
        -- ── RECEIPT — 20260915120000 ───────────────────────────────────────
        ('TDS_RECEIVABLE',      'TDS Receivable',              'GENERAL', NULL, 'Current Assets'),
        ('BANK_CHARGES',        'Bank Charges',                'EXPENSE', NULL, 'Indirect Expenses'),
        ('SURCHARGE_RECOVERED', 'Card Surcharge Recovered',    'INCOME',  NULL, 'Indirect Incomes'),
        ('CLAIMS_ALLOWED',      'Customer Claims Allowed',     'EXPENSE', NULL, 'Indirect Expenses'),
        ('INTEREST_INCOME',     'Interest on Overdue',         'INCOME',  NULL, 'Indirect Incomes'),
        -- ── RECEIVED CHEQUES — 20260916120000 ──────────────────────────────
        ('BOUNCE_CHARGES_RECOVERED', 'Cheque Bounce Charges Recovered', 'INCOME', NULL, 'Indirect Incomes'),
        -- ── SALES DOCUMENTS — 20260921220000 §8, catalogued here ───────────
        ('COGS',               'Cost of Goods Sold',            'EXPENSE', NULL, 'Direct Expenses'),
        ('INVENTORY',          'Stock in Hand',                  NULL,     NULL, 'Stock-in-Hand'),
        ('LOYALTY_REDEMPTION', 'Loyalty Points Redeemed',       'EXPENSE', NULL, 'Indirect Expenses'),
        ('SCHEME_DISCOUNT',    'Scheme Discount Allowed',       'EXPENSE', NULL, 'Indirect Expenses'),
        -- ── VOUCHER REGISTER — 20260925160000 §4, catalogued here ──────────
        ('INTEREST_PAID',      'Interest Paid',                 'EXPENSE',  NULL,             'Indirect Expenses'),
        ('RATE_DIFFERENCE',    'Rate Difference',               'DISCOUNT', NULL,             'Indirect Expenses'),
        ('RCM_CGST_PAYABLE',   'RCM CGST Payable',              'TAX',      'Central Tax',    'Duties & Taxes'),
        ('RCM_SGST_PAYABLE',   'RCM SGST Payable',              'TAX',      'State Tax',      'Duties & Taxes'),
        ('RCM_IGST_PAYABLE',   'RCM IGST Payable',              'TAX',      'Integrated Tax', 'Duties & Taxes'),
        -- ── STOCK → ACCOUNTS — 20260928100000 §1.9 ─────────────────────────
        ('STOCK_SHORTAGE',     'Stock Shortage',                'EXPENSE',  NULL,             'Indirect Expenses'),
        ('STOCK_EXCESS',       'Stock Excess',                  'INCOME',   NULL,             'Indirect Incomes'),
        -- ── PAYMENT — 20260929090000 ───────────────────────────────────────
        --  The payment's three, the mirrors of ADVANCE_RECEIVED, DISCOUNT_ALLOWED
        --  and WRITE_OFF. ADVANCE_PAID is GENERAL for the reason ADVANCE_RECEIVED
        --  is: it constrains the NATURE (Assets) and lets the chart choose.
        ('ADVANCE_PAID',          'Advances to Suppliers',        'GENERAL',  NULL,             'Loans & Advances (Asset)'),
        ('DISCOUNT_RECEIVED',     'Discount Received',            'INCOME',   NULL,             'Indirect Incomes'),
        ('BALANCES_WRITTEN_BACK', 'Balances Written Back',        'INCOME',   NULL,             'Indirect Incomes'),
        -- ── TILL — 20261008100000 (share file 47 §10.1) ────────────────────
        --  The safe and cash-in-transit are cash: both under Cash-in-Hand, so
        --  TFlt / TDrp / CRem stay valid Tally Contras. TENDER_SUSPENSE wants
        --  Assets, and 'Suspense A/c' is a Liabilities group here — so it
        --  sits under Current Assets.
        ('SAFE_CASH',          'Store Safe Cash',               'CASH',     NULL,             'Cash-in-Hand'),
        ('CASH_IN_TRANSIT',    'Cash in Transit',               'CASH',     NULL,             'Cash-in-Hand'),
        ('CASH_SHORT_EXCESS',  'Cash Short & Excess',           'EXPENSE',  NULL,             'Indirect Expenses'),
        ('TENDER_SUSPENSE',    'Till Variance Suspense',        'GENERAL',  NULL,             'Current Assets'),
        -- ── NON-CASH TENDER CONTROL — 20261008130000 (share file 49 §8) ────
        --  Tax on the acquirer's fee that is NOT input credit until its tax
        --  invoice is entered: an asset, and not a TAX ledger the returns read.
        --  'Duties & Taxes' is a Liabilities group here, so Current Assets.
        ('GST_ON_CHARGES_PENDING', 'GST on Payment Charges (Pending)', 'GENERAL', NULL,         'Current Assets'),
        -- ── CASH AWAITING RECEIPT — 20261014100000 (notes 113) ─────────────
        --  Cash the cashier handed over that no supervisor has received yet. It
        --  is cash, so Cash-in-Hand like the safe: TDrp / TRcv stay valid Tally
        --  Contras. Not CASH_IN_TRANSIT, which is the bank / CIT remittance leg.
        ('TILL_CASH_AWAITING', 'Till Cash Awaiting Receipt',    'CASH',     NULL,             'Cash-in-Hand')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;
COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

-- p_skip_if_no_chart = true: on a fresh database the chart is a seed that has
-- not run yet; Acc_Ledger_Map.sql maps it at first boot.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20261014100000');


-- ── 2 · voucher type TRcv ──────────────────────────────────────────────────
--  Its own type rather than a second TDrp: one bag would otherwise show two
--  "cash drops", and the drop register would count it twice.
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT 'TRcv', 'Till Cash Received', 'TRcv', 'ACCOUNTING'::accounts."VoucherCategory", 'CONTRA'::accounts."VoucherNature",
       'AUTO'::accounts."VoucherNumberingMode", 'trc', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
       true, false, true, false, 'CASH RECEIVED INTO SAFE', 346, true, true, 'Contra', 'Contra', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types WHERE vchr_type_code = 'TRcv');

SELECT setval(pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
              (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types), true)
 WHERE pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id') IS NOT NULL;

-- number series: one per TDrp series (where a till already posts); anywhere
-- else findOrCreateSequence makes it on first use
INSERT INTO accounts.acc_voucher_seq
    (seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year, seq_device_id, seq_device_code, seq_period_key,
     seq_last_no, seq_voucher_prefix, seq_company_code, seq_branch_code, seq_voucher_suffix, seq_no_width)
SELECT t.vchr_type_id, s.seq_company_id, s.seq_branch_id, s.seq_acc_year, s.seq_device_id, s.seq_device_code, s.seq_period_key,
       0, t.vchr_no_prefix, s.seq_company_code, s.seq_branch_code, t.vchr_no_suffix, t.vchr_no_width
FROM accounts.acc_voucher_seq s
JOIN accounts.acc_voucher_types d ON d.vchr_type_id = s.seq_vchr_type_id AND d.vchr_type_code = 'TDrp'
CROSS JOIN accounts.acc_voucher_types t
WHERE t.vchr_type_code = 'TRcv'
  AND s.seq_is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq x
                  WHERE x.seq_vchr_type_id = t.vchr_type_id AND x.seq_company_id = s.seq_company_id
                    AND x.seq_branch_id = s.seq_branch_id AND x.seq_acc_year = s.seq_acc_year
                    AND x.seq_device_code = s.seq_device_code AND x.seq_period_key = s.seq_period_key);


-- ── 3 · setting ────────────────────────────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES ('till.handover_receipt', 'TILL', 'Close', 'TEXT', 'NONE', '["NONE","REQUIRED"]'::jsonb, 'BRANCH',
        'Cash reaches the safe when a supervisor receives it',
        'REQUIRED = the close hand-over and a cashier''s drop post to "Till cash awaiting receipt"; a supervisor receives each bag (Cash Office, blind count + PIN) to move it into the safe, and a difference becomes the session''s variance. NONE = straight into the safe.',
        27, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 4 · the receipt, on the hand-over / drop row ───────────────────────────
ALTER TABLE accounts.till_cash_movement
    ADD COLUMN IF NOT EXISTS tcm_receipt_status           character varying(10),
    ADD COLUMN IF NOT EXISTS tcm_received_by              uuid,
    ADD COLUMN IF NOT EXISTS tcm_received_on              timestamptz,
    ADD COLUMN IF NOT EXISTS tcm_received_amount          numeric(15,2),
    ADD COLUMN IF NOT EXISTS tcm_receive_count_id         uuid,
    ADD COLUMN IF NOT EXISTS tcm_receive_voucher_id       uuid,
    ADD COLUMN IF NOT EXISTS tcm_receive_voucher_acc_year character(9);

ALTER TABLE accounts.till_cash_movement
    DROP CONSTRAINT IF EXISTS ck_tcm_receipt_status,
    DROP CONSTRAINT IF EXISTS ck_tcm_receipt_kind,
    DROP CONSTRAINT IF EXISTS ck_tcm_received,
    DROP CONSTRAINT IF EXISTS ck_tcm_received_amount,
    DROP CONSTRAINT IF EXISTS ck_tcm_receive_voucher_pair,
    DROP CONSTRAINT IF EXISTS ck_tcm_receive_voucher;
ALTER TABLE accounts.till_cash_movement
    ADD CONSTRAINT ck_tcm_receipt_status
        CHECK (tcm_receipt_status IS NULL OR tcm_receipt_status::text = ANY (ARRAY['AWAITING','RECEIVED'])),
    -- only a bag the cashier parts with alone waits to be received
    ADD CONSTRAINT ck_tcm_receipt_kind
        CHECK (tcm_receipt_status IS NULL OR tcm_kind::text = ANY (ARRAY['CLOSE_HANDOVER','DROP'])),
    ADD CONSTRAINT ck_tcm_received
        CHECK ((COALESCE(tcm_receipt_status, '') = 'RECEIVED') =
               (tcm_received_by IS NOT NULL AND tcm_received_on IS NOT NULL
                AND tcm_received_amount IS NOT NULL AND tcm_receive_count_id IS NOT NULL)),
    ADD CONSTRAINT ck_tcm_received_amount
        CHECK (tcm_received_amount IS NULL OR tcm_received_amount >= 0),
    ADD CONSTRAINT ck_tcm_receive_voucher_pair
        CHECK ((tcm_receive_voucher_id IS NULL) = (tcm_receive_voucher_acc_year IS NULL)),
    -- an empty bag (received 0) has no TRcv; anything received has one
    ADD CONSTRAINT ck_tcm_receive_voucher
        CHECK (tcm_receive_voucher_id IS NULL OR tcm_receipt_status = 'RECEIVED');

CREATE INDEX IF NOT EXISTS ix_tcm_awaiting
    ON accounts.till_cash_movement (tcm_company_id, tcm_branch_id, tcm_doc_date)
    WHERE tcm_is_deleted = false AND tcm_status = 'POSTED' AND tcm_receipt_status = 'AWAITING';

COMMENT ON COLUMN accounts.till_cash_movement.tcm_receipt_status IS
    'Notes 113: NULL = straight into the safe (till.handover_receipt NONE, a pickup, every row before 20261014100000); AWAITING = posted to Till cash awaiting receipt; RECEIVED = a supervisor counted it into the safe.';
COMMENT ON COLUMN accounts.till_cash_movement.tcm_received_amount IS
    'What the receiver counted (blind); a difference from tcm_amount is the session''s RECEIVE-stage variance.';


-- ── 5 · a receive difference is the session's variance ─────────────────────
--  tvr_stage was varchar(5) for OPEN / CLOSE. A RECEIVE row has the OPEN
--  row's shape (cash only, every term 0 but tvr_open_amount = what was handed
--  over, so ck_tvr_expected holds) and names its bag.
ALTER TABLE accounts.till_variance ALTER COLUMN tvr_stage TYPE character varying(8);
ALTER TABLE accounts.till_variance ADD COLUMN IF NOT EXISTS tvr_movement_id uuid;

ALTER TABLE accounts.till_variance DROP CONSTRAINT IF EXISTS ck_tvr_stage;
ALTER TABLE accounts.till_variance
    ADD CONSTRAINT ck_tvr_stage CHECK (tvr_stage::text = ANY (ARRAY['OPEN','CLOSE','RECEIVE']));
ALTER TABLE accounts.till_variance DROP CONSTRAINT IF EXISTS ck_tvr_receive;
ALTER TABLE accounts.till_variance
    ADD CONSTRAINT ck_tvr_receive CHECK ((tvr_stage = 'RECEIVE') = (tvr_movement_id IS NOT NULL));

--  One live row per session × stage × tender × bag: a session may hand over
--  one bag at close and drop several before it.
DROP INDEX IF EXISTS accounts.ux_tvr_live;
CREATE UNIQUE INDEX ux_tvr_live
    ON accounts.till_variance (tvr_session_id, tvr_stage, tvr_tender_type_id, tvr_tender_id, tvr_movement_id, tvr_acc_year)
    NULLS NOT DISTINCT
    WHERE tvr_is_deleted = false AND tvr_status <> 'REVERSED';

COMMENT ON COLUMN accounts.till_variance.tvr_movement_id IS
    'Stage RECEIVE (notes 113): the hand-over / drop received (till_cash_movement.tcm_id, same acc year). FK-less.';


-- ── 6 · till events (restates 49's list + CASH_RECEIVED) ───────────────────
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
        'CASH_RECEIVED']));   -- notes 113


-- ── 7 · menu 286 "Cash Office" ─────────────────────────────────────────────
--  The id is PINNED and the same row is in prisma/seed/Menu_Master.sql (the
--  client resolves screens by id, user_menus stores rights by id); on a fresh
--  database the tree is a seed that runs after migrations, so nothing is
--  inserted here while 271 is absent. 286 taken by another menu stops this.
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('%s (%s)', m.menu_id, m.menu_name)
      INTO v_clash
      FROM fixed.menu_master m
     WHERE m.menu_id = 286
       AND m.menu_name <> 'Cash Office';
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Cash Office menu: id already taken by another menu: %. Pick a free id here, in Menu_Master.sql and in TILL_MENU (till-enum.ts).', v_clash;
    END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active,
        menu_separator, menu_verbs, menu_created_on, menu_modified_on)
SELECT 286, 271, 'Cash Office',
       COALESCE((SELECT x.menu_visiblity FROM fixed.menu_master x WHERE x.menu_id = 273), false),
       3.50, true, false, '{VIEW,CREATE,PRINT,EXPORT}'::text[], now(), now()
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 271)
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 286);

--  Till Sessions (273) OVERRIDE was the supervisor's right; its holders can
--  receive at once (VIEW + CREATE). A user with a row on 286 keeps it.
INSERT INTO public.user_menus
       (um_user_id, um_menu_id, um_can_view, um_can_create, um_can_edit, um_can_delete,
        um_can_print, um_can_export, um_visibility, um_is_favourite, um_is_pinned,
        um_sort_order, um_is_deleted, um_created_by, um_can_post, um_can_cancel,
        um_can_amend, um_can_override, um_can_retender)
SELECT u.um_user_id, n.menu_id, true, true, false, false,
       u.um_can_print, u.um_can_export, u.um_visibility, false, false,
       u.um_sort_order, false, u.um_created_by, false, false,
       false, false, false
  FROM public.user_menus u
  JOIN fixed.menu_master n ON n.menu_id = 286
 WHERE u.um_menu_id = 273
   AND u.um_can_override
   AND u.um_is_deleted = false
ON CONFLICT (um_user_id, um_menu_id) DO NOTHING;

SELECT setval('fixed.menu_master_menu_id_seq',
              GREATEST((SELECT COALESCE(max(menu_id), 0) FROM fixed.menu_master),
                       (SELECT last_value FROM fixed.menu_master_menu_id_seq)));


-- ── Read-back ──────────────────────────────────────────────────────────────
-- SELECT * FROM accounts.fn_ledger_map_catalogue() WHERE role_code = 'TILL_CASH_AWAITING';
-- SELECT alm_role, alm_ledger_id FROM accounts.acc_ledger_map WHERE alm_role = 'TILL_CASH_AWAITING';
-- SELECT tcm_kind, tcm_receipt_status, count(*) FROM accounts.till_cash_movement GROUP BY 1, 2;
