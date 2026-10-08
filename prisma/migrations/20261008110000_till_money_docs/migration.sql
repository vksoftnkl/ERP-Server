-- ═══════════════════════════════════════════════════════════════════════════
--  48 · TILL — bill-wise receipt & payment join the session; EXPENSE BY TENDER
--                                                                  2026-10-08
--
--  The 48_till_money_docs.sql file of the share, made a migration the way
--  20261008100000 shipped 47 — deploy.sh runs migrations and never seeds.
--
--  Plan: till/plan-till-receipt-payment-expense.md (user ask 2026-10-07:
--  "bill wise payment and receipt also will include in till session and one
--  more form we need to add thats expense by tender way").
--  Runs AFTER 20261008100000_till_management. Changes only 47's own objects
--  plus seeds, and two CHECK / index additions on the tender and leg tables.
--
--  WHAT CHANGES
--   1. PAID_OUT leaves till_cash_movement. An expense is now an EXPENSE
--      VOUCHER (ExpV, tenders like a payment); a supplier paid from the drawer
--      is a bill-wise PAYMENT (menu 100) in the session. One path per fact —
--      two ways to book the same cash out would split every report.
--   2. till_variance gains payments + expenses in its expectation split.
--   3. Receipts, payments and expenses are counted on the session.
--   4. Approval events: PAID_OUT → EXPENSE (rows renamed), + CASH_PAYMENT.
--   5. Reasons: category PAID_OUT → EXPENSE; supplier / staff-advance reasons
--      retired (they are payments to a party now).
--   6. Event codes for the money documents posted in a session.
--   7. Voucher type ExpV (+ number series from Bil).
--   8. Settings; 40A(3) cash-payment limit in statutory_limits.
--   8b. acc_tender_detail accepts td_src_doc_type 'EXPENSE'.
--   9. Indexes the expected-cash query needs.
--
--  NO new table: an expense voucher is acc_voucher_header + acc_vouchers legs
--  + acc_tender_detail (td_src_doc_type 'EXPENSE') + the GST register rows a
--  PurA already writes when a GST bill is entered. No function, no trigger.
--
--  DIFFERENCES FROM THE SHARE FILE
--   1. No BEGIN / COMMIT: Prisma runs the migration in its own transaction.
--   2. §7 — the voucher-type serial is kept ahead of any pinned id a seed may
--      carry, as 20261008100000 §10.2 does.
--  Checked against the live database before writing: ck_td_src_doc_type held
--  exactly the six values §8b restates, and none of the columns §7–§9 name is
--  missing. The new columns land physically LAST on their tables (ALTER TABLE
--  ADD COLUMN); the Prisma fragments list them last for the same reason.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · till_cash_movement: PAID_OUT retired ──────────────────────────────
--  Safe only while no PAID_OUT row exists (none can: no service writes the
--  table yet). If one does, this DO block stops the file with the count
--  rather than failing on the constraint with no explanation.
DO $$
DECLARE n bigint;
BEGIN
    SELECT count(*) INTO n FROM accounts.till_cash_movement WHERE tcm_kind = 'PAID_OUT';
    IF n > 0 THEN
        RAISE EXCEPTION '48: % PAID_OUT movement(s) exist — convert them to ExpV before running', n;
    END IF;
END $$;

ALTER TABLE accounts.till_cash_movement
    DROP CONSTRAINT IF EXISTS ck_tcm_kind,
    DROP CONSTRAINT IF EXISTS ck_tcm_safe,
    DROP CONSTRAINT IF EXISTS ck_tcm_ledger,
    DROP CONSTRAINT IF EXISTS ck_tcm_reason;
ALTER TABLE accounts.till_cash_movement
    ADD CONSTRAINT ck_tcm_kind CHECK (tcm_kind::text = ANY (ARRAY[
        'FLOAT_ISSUE','TOP_UP','PICKUP','DROP','CLOSE_HANDOVER','PAID_IN',
        'REMIT','SAFE_TRANSFER','EXCHANGE'])),
    ADD CONSTRAINT ck_tcm_safe   CHECK (tcm_kind = 'PAID_IN' OR tcm_safe_id IS NOT NULL),
    ADD CONSTRAINT ck_tcm_ledger CHECK (tcm_kind NOT IN ('PAID_IN','REMIT') OR tcm_ledger_id IS NOT NULL),
    ADD CONSTRAINT ck_tcm_reason CHECK (tcm_kind NOT IN ('PAID_IN','PICKUP') OR tcm_reason_id IS NOT NULL);

-- ── 2 · till_variance: payments and expenses in the split ─────────────────
ALTER TABLE accounts.till_variance
    ADD COLUMN IF NOT EXISTS tvr_payment_amount numeric(15,2) NOT NULL DEFAULT 0,   -- bill-wise payments out of this tender
    ADD COLUMN IF NOT EXISTS tvr_expense_amount numeric(15,2) NOT NULL DEFAULT 0;   -- expense vouchers out of this tender
ALTER TABLE accounts.till_variance
    DROP CONSTRAINT IF EXISTS ck_tvr_expected,
    DROP CONSTRAINT IF EXISTS ck_tvr_open_stage,
    DROP CONSTRAINT IF EXISTS ck_tvr_split;
ALTER TABLE accounts.till_variance
    ADD CONSTRAINT ck_tvr_expected CHECK (tvr_expected = tvr_open_amount + tvr_sales_amount - tvr_refund_amount
        + tvr_receipt_amount - tvr_payment_amount - tvr_expense_amount + tvr_moved_in - tvr_moved_out),
    ADD CONSTRAINT ck_tvr_open_stage CHECK (tvr_stage = 'CLOSE' OR (tvr_tender_type_id = 1
        AND tvr_sales_amount = 0 AND tvr_refund_amount = 0 AND tvr_receipt_amount = 0
        AND tvr_payment_amount = 0 AND tvr_expense_amount = 0
        AND tvr_moved_in = 0 AND tvr_moved_out = 0)),
    ADD CONSTRAINT ck_tvr_split CHECK (tvr_payment_amount >= 0 AND tvr_expense_amount >= 0);

-- ── 3 · till_session: counts of the money documents ───────────────────────
ALTER TABLE accounts.till_session
    ADD COLUMN IF NOT EXISTS tss_payment_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tss_expense_count integer NOT NULL DEFAULT 0;
ALTER TABLE accounts.till_session DROP CONSTRAINT IF EXISTS ck_tss_doc_counts;
ALTER TABLE accounts.till_session
    ADD CONSTRAINT ck_tss_doc_counts CHECK (tss_payment_count >= 0 AND tss_expense_count >= 0 AND tss_receipt_count >= 0);

-- ── 4 · approval events: PAID_OUT → EXPENSE, + CASH_PAYMENT ───────────────
ALTER TABLE accounts.till_approval_rule DROP CONSTRAINT IF EXISTS ck_tar_event;
UPDATE accounts.till_approval_rule      SET tar_event_code = 'EXPENSE', tar_modified_on = now(), tar_modified_by = '48'
 WHERE tar_event_code = 'PAID_OUT';
UPDATE accounts.till_approval_authority SET taa_event_code = 'EXPENSE', taa_modified_on = now(), taa_modified_by = '48'
 WHERE taa_event_code = 'PAID_OUT';
-- the request table carries the same list (ck_tap_event, 47): drop it around the rename
ALTER TABLE accounts.till_approval DROP CONSTRAINT IF EXISTS ck_tap_event;
UPDATE accounts.till_approval           SET tap_event_code = 'EXPENSE' WHERE tap_event_code = 'PAID_OUT';
ALTER TABLE accounts.till_approval
    ADD CONSTRAINT ck_tap_event CHECK (tap_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','EXPENSE','CASH_PAYMENT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK']));
ALTER TABLE accounts.till_approval_rule
    ADD CONSTRAINT ck_tar_event CHECK (tar_event_code::text = ANY (ARRAY[
        'FLOAT_MISMATCH','CASH_VARIANCE','NONCASH_VARIANCE','EXPENSE','CASH_PAYMENT','PAID_IN','PICKUP','TOP_UP',
        'NO_SALE','CASH_LIMIT_OVERRIDE','SUSPEND_LONG','FORCE_CLOSE','SESSION_REOPEN','SESSION_VOID',
        'MOVEMENT_VOID','RECOUNT','DAY_CLOSE_EXCEPTION','DAY_REOPEN','SAFE_VARIANCE','REMITTANCE',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','DISCOUNT_OVER','RETURN_NO_RECEIPT','REFUND_CASH',
        'REPRINT','RETENDER','COUNTER_RELINK']));

INSERT INTO accounts.till_approval_rule
    (tar_company_id, tar_branch_id, tar_event_code, tar_mode, tar_threshold_amount, tar_threshold_count,
     tar_channel, tar_min_role, tar_two_person, tar_allow_self, tar_blocks_till, tar_remarks, tar_created_by)
SELECT NULL, NULL, 'CASH_PAYMENT', 'OVER_AMOUNT', 1000, 0, 'COUNTER', 'SUPERVISOR', false, false, true,
       'bill-wise payment paid in CASH out of a till drawer (cash part only)', 'system'
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_approval_rule x
                  WHERE x.tar_company_id IS NULL AND x.tar_branch_id IS NULL AND x.tar_event_code = 'CASH_PAYMENT' AND x.tar_is_deleted = false);
UPDATE accounts.till_approval_rule
   SET tar_remarks = 'expense voucher total (all tenders) — cash from the drawer or not'
 WHERE tar_company_id IS NULL AND tar_branch_id IS NULL AND tar_event_code = 'EXPENSE' AND coalesce(tar_remarks,'') = '';

-- ── 5 · reasons: PAID_OUT → EXPENSE ───────────────────────────────────────
ALTER TABLE accounts.till_reason DROP CONSTRAINT IF EXISTS ck_trs_category;
UPDATE accounts.till_reason SET trs_category = 'EXPENSE', trs_modified_on = now(), trs_modified_by = '48'
 WHERE trs_category = 'PAID_OUT';
-- a supplier or a staff member is a PARTY: bill-wise Payment, not an expense
UPDATE accounts.till_reason SET trs_is_active = false, trs_modified_on = now(), trs_modified_by = '48',
       trs_name = trs_name || ' (use Payment)'
 WHERE trs_company_id IS NULL AND trs_category = 'EXPENSE' AND trs_code IN ('SUPPLIER','STAFF_ADVANCE')
   AND trs_is_active;
ALTER TABLE accounts.till_reason
    ADD CONSTRAINT ck_trs_category CHECK (trs_category::text = ANY (ARRAY[
        'VARIANCE','FLOAT_MISMATCH','EXPENSE','PAID_IN','PICKUP','NO_SALE','SUSPEND',
        'FORCE_CLOSE','REOPEN','SESSION_VOID','MOVEMENT_VOID','DAY_REOPEN','REPRINT',
        'VOID_BILL','VOID_LINE','PRICE_OVERRIDE','REFUND']));
INSERT INTO accounts.till_reason (trs_company_id, trs_category, trs_code, trs_name, trs_needs_note, trs_needs_ref, trs_sort_order, trs_created_by)
SELECT NULL, 'EXPENSE', v.k, v.n, v.note, v.ref, v.s, 'system' FROM (VALUES
 ('TEA','Tea & refreshments',false,false,15), ('COURIER','Courier / postage',false,true,25),
 ('STATIONERY','Stationery & printing',false,true,35), ('REPAIRS','Repairs & maintenance',false,true,45),
 ('CLEANING','Cleaning & housekeeping',false,false,55), ('TRAVEL','Local travel / conveyance',true,false,65)
) AS v(k, n, note, ref, s)
WHERE NOT EXISTS (SELECT 1 FROM accounts.till_reason r
                  WHERE r.trs_company_id IS NULL AND r.trs_category = 'EXPENSE' AND upper(r.trs_code) = v.k AND r.trs_is_deleted = false);

-- ── 6 · event codes for the money documents of a session ──────────────────
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
        'SYNC_PENDING_AT_CLOSE','LATE_ARRIVAL','SESSION_DAY_ENDED']));

-- ── 7 · ExpV — Expense voucher ────────────────────────────────────────────
--  PAYMENT nature; tenders decide cash vs bank per row (so both flags false,
--  like TndC/CRem). GSTR2 / INPUT like PurA so an expense entered WITH a GST
--  bill claims input tax through the register PurA already feeds. Party is
--  optional (most petty expenses have none).
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT 'ExpV', 'Expense Voucher', 'ExpV', 'ACCOUNTING'::accounts."VoucherCategory", 'PAYMENT'::accounts."VoucherNature",
       'AUTO'::accounts."VoucherNumberingMode", 'exp', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
       true, false, false, false, 'EXPENSE VOUCHER', 346, true, true, 'Payment', 'Payment', 'system'
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types WHERE vchr_type_code = 'ExpV');
UPDATE accounts.acc_voucher_types
   SET vchr_gst_register = 'GSTR2', vchr_gst_side = 'INPUT', vchr_party_mode = 'NONE',
       vchr_billwise_mode = 'OFF', vchr_instruments = true, vchr_in_register = false
 WHERE vchr_type_code = 'ExpV';

-- The serial stays ahead of any pinned id a seed may carry.
SELECT setval(pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
              (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types), true)
 WHERE pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id') IS NOT NULL;

INSERT INTO accounts.acc_voucher_seq
    (seq_vchr_type_id, seq_company_id, seq_branch_id, seq_acc_year, seq_device_id, seq_device_code, seq_period_key,
     seq_last_no, seq_voucher_prefix, seq_company_code, seq_branch_code, seq_voucher_suffix, seq_no_width)
SELECT t.vchr_type_id, s.seq_company_id, s.seq_branch_id, s.seq_acc_year, s.seq_device_id, s.seq_device_code, s.seq_period_key,
       0, t.vchr_no_prefix, s.seq_company_code, s.seq_branch_code, t.vchr_no_suffix, t.vchr_no_width
FROM accounts.acc_voucher_seq s
JOIN accounts.acc_voucher_types b ON b.vchr_type_id = s.seq_vchr_type_id AND b.vchr_type_code = 'Bil'
CROSS JOIN accounts.acc_voucher_types t
WHERE t.vchr_type_code = 'ExpV' AND s.seq_is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_seq x
                  WHERE x.seq_vchr_type_id = t.vchr_type_id AND x.seq_company_id = s.seq_company_id
                    AND x.seq_branch_id = s.seq_branch_id AND x.seq_acc_year = s.seq_acc_year
                    AND x.seq_device_code = s.seq_device_code AND x.seq_period_key = s.seq_period_key);

-- ── 8 · settings + the 40A(3) limit ───────────────────────────────────────
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT v.asd_key, v.asd_module, v.asd_group, v.asd_data_type, v.asd_default_value, v.asd_allowed_values::jsonb,
       v.asd_max_scope, v.asd_label, v.asd_description, v.asd_sort_order, 'system' FROM (VALUES
 ('till.money_docs_in_session', 'TILL', 'Session', 'BOOL', 'true', NULL, 'DEVICE',
  'Receipts, payments and expenses join the till session',
  'On a till device every receipt, payment and expense voucher carries the live session; CASH comes out of / goes into the drawer.', 30),
 ('till.backoffice_cash_from',  'TILL', 'Session', 'TEXT', 'SAFE', '["SAFE","REFUSE"]', 'BRANCH',
  'Cash tender on a back-office (no session) device',
  'SAFE = paid from / into the branch default safe (shows in the safe book); REFUSE = cash only from a till.', 31),
 ('accounts.expense_gst_bill_above', 'ACCOUNTS', 'Expense', 'DECIMAL', '0', NULL, 'COMPANY',
  'Ask for the GST bill above', '0 = optional always. Above it the expense voucher WARNs when no supplier GSTIN / invoice is entered.', 40)
) AS v(asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_max_scope, asd_label, asd_description, asd_sort_order)
ON CONFLICT (asd_key) DO NOTHING;

-- s.40A(3): cash payment to one person in one day above the limit is
-- disallowed as an expense (35,000 for goods-carriage hire — add that as a
-- company override). A disallowance, not an illegality: WARN by default.
INSERT INTO public.statutory_limits
    (stl_company_id, stl_code, stl_law, stl_section, stl_label, stl_value_type, stl_value, stl_applies_to,
     stl_effective_from, stl_enforce, stl_source_ref, stl_remarks, stl_created_by)
SELECT NULL, 'CASH_PAYMENT_LIMIT_40A3', 'IT', '40A(3)',
       'Cash payment to one person in a day (expense disallowed above)', 'AMOUNT', 10000, 'ALL',
       DATE '2017-04-01', 'WARN', 'Finance Act 2017, s.40A(3)',
       'Cash tenders to one payee on one date summed. IT Act 2025 (from 01-04-2026) renumbers 40A(3), limit unchanged: confirm the new section and add an effective-dated row', 'system'
WHERE NOT EXISTS (SELECT 1 FROM public.statutory_limits
                  WHERE stl_code = 'CASH_PAYMENT_LIMIT_40A3' AND stl_company_id IS NULL AND stl_is_deleted = false);

-- ── 8b · acc_tender_detail accepts the expense voucher's tender rows ───────
--  Live ck_td_src_doc_type knew SALES_ORDER … OTHER only; without EXPENSE every
--  ExpV post would fail its tender insert (found by the 2026-10-07 review).
ALTER TABLE accounts.acc_tender_detail DROP CONSTRAINT IF EXISTS ck_td_src_doc_type;
ALTER TABLE accounts.acc_tender_detail
    ADD CONSTRAINT ck_td_src_doc_type CHECK (td_src_doc_type::text = ANY (ARRAY[
        'SALES_ORDER','SALE_BILL','SALE_RETURN','RECEIPT','PAYMENT','OTHER','EXPENSE']));

-- ── 9 · indexes for the expected-cash query (TillLedgerService.expected) ──
CREATE INDEX IF NOT EXISTS ix_td_session
    ON accounts.acc_tender_detail (td_session_id, td_acc_year, td_tender_type_id, td_src_doc_type)
    WHERE td_session_id IS NOT NULL AND td_is_deleted = false AND td_is_voided = false;
CREATE INDEX IF NOT EXISTS ix_av_session_ledger
    ON accounts.acc_vouchers (av_session_id, av_ledger_id)
    WHERE av_session_id IS NOT NULL AND av_is_deleted = false;
