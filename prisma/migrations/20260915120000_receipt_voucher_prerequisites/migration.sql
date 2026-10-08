-- ═══════════════════════════════════════════════════════════════════════════
--  Receipt voucher — schema prerequisites
--
--  Everything "Receipt voucher — backend plan (NestJS)", revision 3, §2 asks
--  for, MINUS the two trigger pairs. Those are deliberately not here; see
--  §0 below.
--
--  accounts.acc_vouchers holds 0 rows and accounts.acc_voucher_header holds 0
--  rows, so every ALTER in this file is free: no back-fill, no NOT VALID, no
--  lock worth planning around. The receipt is the FIRST writer of voucher
--  legs in this database, which is why the derivations the legs need
--  (header totals) and the column that makes them reportable (av_role) are
--  built here rather than having been built with the tables.
--
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  0 · WHAT IS DELIBERATELY NOT IN THIS FILE
--
--  §2.1 — accounts.fn_abl_recompute, fn_abj_refresh_balance, the
--  tr_abj_refresh_balance trigger and fn_abl_regularise_pdc — is NOT created
--  here. It lives in TypeScript, as this project asked:
--
--      src/modules/accountsModule/billBalance/bill-balance-recompute.service.ts
--          recomputeBills()      = fn_abl_recompute, for a set of bills
--          regularisePostDated() = fn_abl_regularise_pdc
--
--  It is called explicitly, inside the posting transaction, by
--  receipt-posting.service.ts and receipt-cancel.service.ts.
--
--  The consequence, stated plainly because it is the cost of the choice: a row
--  written into accounts.acc_bill_adjustment by hand, by psql, or by a future
--  module that forgets to call the recompute leaves abl_alloc_amount stale. A
--  trigger could not be forgotten. A service can. Every writer must call it.
--
--  §2.4 IS here, as a trigger — see section 11. It was TypeScript in the first
--  draft of this file and that was wrong: avh_total_debit / avh_total_credit
--  are what ck_avh_balanced compares, so they have to be right for EVERY
--  writer of accounts.acc_vouchers and not only for the ones that remember to
--  call a helper. This module is the first such writer; it will not be the
--  last.
--
--  Withdrawn from §2 on 2026-09-15, and deliberately absent:
--    · §2.10 public.user_menus.um_can_approve — there is no approval step.
--      DRAFT -> POSTED -> CANCELLED, and /post runs from a DRAFT.
--    · §2.11 sales.customers.cus_ledger_id — there is no bridge to build.
--      cus_id IS led_id and sup_id IS led_id; a customer, a supplier and a
--      ledger are one identity, so a receipt takes ONE partyId and resolves
--      nothing.
--
--  Everything else §2 asks for IS here, §2.9's menu rows included.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · §2.2 — the receipt voucher type
--
--  'Rct', nature RECEIPT, affects accounts. vchr_type_id is a serial and the
--  value it lands on is not hard-coded anywhere: the service resolves the type
--  by CODE (receipt.constants.ts RECEIPT_VOUCHER_TYPE_CODE = 'Rct'), because an
--  id assigned by a sequence differs between the dev box and the live one and
--  a hard-coded 7 would post receipts as somebody else's document type there.
--
--  vchr_no_prefix 'rct' + vchr_no_width 5 gives rct00001, matching 'bil' on the
--  sale bill. Numbers are drawn through accounts.acc_voucher_seq by
--  allocateVoucherNumber(), so the prefix and width here are the FORMAT
--  SNAPSHOT that the first allocation copies onto the sequence row.
--
--  vchr_is_cash_voucher / vchr_is_bank_voucher both stay false: a receipt in
--  this module is not one or the other. One receipt splits across cash, card,
--  UPI and cheque in the same document, which is the whole point of the tender
--  band, and chk_acc_voucher_types_cash_bank_exclusive refuses both anyway.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_voucher_types
       (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category,
        vchr_nature, vchr_numbering_mode, vchr_no_prefix, vchr_no_width,
        vchr_reset_freq, vchr_allow_manual_no, vchr_affects_accounts,
        vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
        vchr_print_title, vchr_sort_order, vchr_is_active,
        vchr_tally_export_enabled, vchr_tally_voucher_type_name,
        vchr_tally_base_voucher_type, vchr_created_by)
SELECT 'Rct', 'Receipt', 'Rct', 'ACCOUNTING',
       'RECEIPT', 'AUTO', 'rct', 5,
       'YEARLY', false, true,
       false, false, false,
       'RECEIPT', 200, true,
       true, 'Receipt',
       'Receipt', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types
                    WHERE vchr_type_code = 'Rct');


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · §2.3 / R1 — ONE cheque table
--
--  accounts.acc_bill_adjustment.abj_cheque_id pointed at
--  accounts.acc_voucher_cheques while every cheque this module writes goes to
--  accounts.acc_pdc_register. Two cheque tables means two answers to "is this
--  cheque still held?", and ck_abj_cheque_mode — which forces a CHEQUE-mode
--  adjustment to name a cheque — would have forced the receipt to write a row
--  into the table it does not use.
--
--  acc_voucher_cheques keeps its rows and its table. It simply stops receiving
--  new ones. Dropping it is a separate decision with its own migration.
--
--  Both tables are LIST-partitioned on their accounting year, and PostgreSQL
--  supports a partitioned table on either side of a foreign key, so this is an
--  ordinary repoint — it just clones itself onto every partition, the way
--  fk_abj_bill already has.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_bill_adjustment
    DROP CONSTRAINT IF EXISTS fk_abj_cheque;

ALTER TABLE accounts.acc_bill_adjustment
    ADD CONSTRAINT fk_abj_cheque
        FOREIGN KEY (abj_cheque_id, abj_cheque_acc_year)
        REFERENCES accounts.acc_pdc_register (apd_id, apd_acc_year)
        ON UPDATE CASCADE ON DELETE RESTRICT;

COMMENT ON COLUMN accounts.acc_bill_adjustment.abj_cheque_id IS
    'accounts.acc_pdc_register.apd_id. Repointed from acc_voucher_cheques by 20260915120000 — the PDC register is the one cheque table.';


-- ───────────────────────────────────────────────────────────────────────────
--  §2.3 — a cheque may be dated BEFORE the day it was handed over
--
--  ck_apd_dates demanded apd_instrument_date >= apd_received_on, which refuses
--  the commonest cheque there is: one written on Monday and collected on
--  Friday. The receipt has to accept it, post it as part of the receipt (not
--  as a post-dated voucher of its own) and settle the bill immediately.
--
--  The replacement is a WINDOW rather than no rule at all. Three months back
--  is the banking validity of a cheque in India — older than that and the
--  instrument is stale, which is a data-entry error worth refusing. Twelve
--  months forward is the outer edge of a post-dated instalment series; beyond
--  it, a typo in the year is far likelier than a genuine 2-year PDC.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_pdc_register
    DROP CONSTRAINT IF EXISTS ck_apd_dates;

ALTER TABLE accounts.acc_pdc_register
    ADD CONSTRAINT ck_apd_dates
        CHECK (apd_instrument_date >= apd_received_on - INTERVAL '3 months'
           AND apd_instrument_date <= apd_received_on + INTERVAL '12 months');


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · §2.5 — two settlement modes the receipt needs
--
--  TDS and a customer claim are FULL-VALUE settlements: the bill is closed for
--  its whole face, and the part the customer withheld is posted to a ledger of
--  its own instead of arriving as money. So abj_adj_type stays 'ALLOCATION'
--  and the amount folds into abl_alloc_amount exactly as cash does — nothing
--  about ck_abj_adj_type changes. What changes is abj_settlement_mode, which
--  says HOW, and had no token for either.
--
--  Without them the only honest choice was 'JOURNAL', and a TDS report would
--  have had no way to find its own rows.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_bill_adjustment
    DROP CONSTRAINT IF EXISTS ck_abj_settlement_mode;

ALTER TABLE accounts.acc_bill_adjustment
    ADD CONSTRAINT ck_abj_settlement_mode
        CHECK (abj_settlement_mode IS NULL OR abj_settlement_mode IN
              ('CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK', 'CREDIT_NOTE',
               'ADVANCE', 'LOYALTY', 'VOUCHER', 'JOURNAL', 'DISCOUNT',
               'WRITEOFF', 'MIXED', 'TDS', 'CLAIM'));


-- ═══════════════════════════════════════════════════════════════════════════
--  4 · §2.6 — av_role, the column that makes every future report a WHERE
--
--  A voucher leg records a ledger and an amount. It does not record WHY the
--  leg is there, and the only way to ask "how much TDS did customers deduct
--  this quarter" without this column is to look up which ledger TDS_RECEIVABLE
--  currently maps to and sum that ledger — which silently answers the wrong
--  question the day somebody remaps the role, and cannot answer it at all for
--  the period before the remap.
--
--  NULL on party and instrument legs: those are not roles, they are the
--  party and the money. The role goes on every OTHER-ledger leg.
--
--  ON DELETE RESTRICT on the role: a role with legs behind it may not be
--  deleted out from under them.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_vouchers
    ADD COLUMN IF NOT EXISTS av_role varchar(30);

ALTER TABLE accounts.acc_vouchers
    DROP CONSTRAINT IF EXISTS fk_av_role;

ALTER TABLE accounts.acc_vouchers
    ADD CONSTRAINT fk_av_role
        FOREIGN KEY (av_role)
        REFERENCES accounts.acc_ledger_role (alr_role)
        ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ix_av_role
    ON accounts.acc_vouchers (av_company_id, av_role, av_voucher_date)
 WHERE av_role IS NOT NULL AND av_is_deleted = false;

COMMENT ON COLUMN accounts.acc_vouchers.av_role IS
    'accounts.acc_ledger_role.alr_role — WHY this leg exists. NULL on party and instrument legs; set on every other-ledger leg. TDS deducted this quarter = SUM(av_amount) WHERE av_role = ''TDS_RECEIVABLE''.';


-- ───────────────────────────────────────────────────────────────────────────
--  §2.6 — avh_draft_lines, the one column a DRAFT needs
--
--  R10: a draft writes nothing to the bill tables and nothing to acc_vouchers.
--  But a draft receipt DOES carry other-ledger lines — the TDS the operator
--  keyed, the claim they allowed — and those have no home until they become
--  legs at post. Without this column, re-opening a draft would lose them.
--
--  jsonb and not a child table, because the shape is the request's own
--  otherLines[] and it is written once, read once, and cleared at post.
--  Nothing queries INTO it, so it needs no index and no constraint; a table
--  would need a primary key, a partition, four audit columns and a delete path
--  to hold data with a lifetime measured in minutes.
--
--  Set to NULL at post. Only /receipts/get on a DRAFT or APPROVED receipt
--  reads it.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_voucher_header
    ADD COLUMN IF NOT EXISTS avh_draft_lines jsonb;

COMMENT ON COLUMN accounts.acc_voucher_header.avh_draft_lines IS
    'Other-ledger lines of a DRAFT / APPROVED receipt, awaiting posting as acc_vouchers legs. Cleared to NULL at post. Nothing reads it but /receipts/get.';


-- ═══════════════════════════════════════════════════════════════════════════
--  5 · §2.7 — the five roles the receipt posts to, and their ledgers
--
--  ── Why the catalogue is edited and not INSERTed around ──────────────────
--  prisma/seed/Acc_Ledger_Map.sql calls accounts.fn_seed_ledger_map() in
--  STRICT mode on every boot, and that function's §2.3 aborts when an active
--  role is not in accounts.fn_ledger_map_catalogue(). So adding five roles
--  without adding five catalogue rows would not merely leave them unmapped —
--  it would break every deploy from the next boot onwards. The catalogue is
--  where a role's ledger is configured; this extends it.
--
--  ── Why TDS_RECEIVABLE and not TDS_PAYABLE ──────────────────────────────
--  TDS_PAYABLE already exists and is the mirror: tax THIS company withholds
--  when it pays a supplier. TDS_RECEIVABLE is tax a CUSTOMER withheld from a
--  payment to us — our asset, recoverable from the department. Opposite
--  direction, opposite side of the balance sheet, and the payment voucher
--  (menu 100, next plan) will use the payable one.
--
--  ── SURCHARGE_RECOVERED vs BANK_CHARGES ─────────────────────────────────
--  Two halves of a card transaction and NOT the same number. BANK_CHARGES is
--  the MDR the acquirer keeps (an expense we bear, td_mdr_amt).
--  SURCHARGE_RECOVERED is what the customer was charged for paying by card
--  (income, td_surcharge_amt). A shop may levy one, the other, both or
--  neither.
-- ═══════════════════════════════════════════════════════════════════════════

--  ck_alr_group admits six bands and none of them fits five roles that exist
--  because money ARRIVES. 'SHARED' would have done — BANK_CHARGES is equally a
--  payment concern — but the Posting Ledgers screen builds itself from
--  alr_group, and burying these among the round-off and write-off rows would
--  make configuring a receipt a hunt. The payment voucher (next plan) adds
--  'PAYMENT' the same way.
ALTER TABLE accounts.acc_ledger_role
    DROP CONSTRAINT IF EXISTS ck_alr_group;

ALTER TABLE accounts.acc_ledger_role
    ADD CONSTRAINT ck_alr_group
        CHECK (alr_group IN ('REVENUE', 'OUTPUT_TAX', 'PURCHASE', 'INPUT_TAX',
                             'SHARED', 'RECEIPT', 'FUTURE'));

INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty,
        alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order,
        alr_is_active, alr_remarks)
SELECT v.role, v.label, 'RECEIPT', v.want_type, NULL,
       v.want_nature, false, false, v.sort_order,
       true, v.remarks
  FROM (VALUES
        ('TDS_RECEIVABLE',      'TDS deducted by customers', NULL::text,  'Assets'::text,   410,
         'Tax a customer withheld from a payment to us. Our asset, recoverable from the department — the mirror of TDS_PAYABLE.'),
        ('BANK_CHARGES',        'Bank charges / MDR',        'EXPENSE',   'Expenses',       420,
         'The acquirer''s cut of a card / UPI collection (acc_tender_detail.td_mdr_amt). An expense we bear, not something the customer paid.'),
        ('SURCHARGE_RECOVERED', 'Card surcharge recovered',  'INCOME',    'Income',         430,
         'What the customer was charged for paying by card (acc_tender_detail.td_surcharge_amt). Income, and NOT the same figure as BANK_CHARGES.'),
        ('CLAIMS_ALLOWED',      'Customer claims allowed',   'EXPENSE',   'Expenses',       440,
         'Damage / shortage / rate claims settled at receipt time rather than by a credit note.'),
        ('INTEREST_INCOME',     'Interest on overdue',       'INCOME',    'Income',         450,
         'Interest charged on an overdue bill and collected with the receipt.')
       ) AS v(role, label, want_type, want_nature, sort_order, remarks)
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_role r
                    WHERE r.alr_role = v.role);


-- ───────────────────────────────────────────────────────────────────────────
--  The catalogue, re-declared with the five new rows appended.
--
--  Everything above 'RECEIPT' is character-for-character what 20260915110000
--  shipped. CREATE OR REPLACE on a SQL function cannot append, so the whole
--  body is restated; diff this against that migration before editing.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
RETURNS TABLE (
    role_code   text,   -- accounts.acc_ledger_role.alr_role
    ledger_name text,   -- accounts.acc_ledger_master.led_name, global
    ledger_type text,   -- led_ledger_type      (chk_led_ledger_type)
    duty_head   text,   -- led_gst_duty_head    (chk_led_gst_duty_head)
    group_name  text    -- acc_group_master.acc_group_name, global
)
LANGUAGE sql
IMMUTABLE
AS $cat$
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
        --  TDS Receivable is GENERAL and not TAX: TAX carries a duty head in
        --  this chart and this is not a GST head. The role leaves
        --  alr_want_type NULL for exactly that reason and constrains the
        --  NATURE (Assets) instead, which is the part that matters.
        ('TDS_RECEIVABLE',      'TDS Receivable',              'GENERAL', NULL, 'Current Assets'),
        ('BANK_CHARGES',        'Bank Charges',                'EXPENSE', NULL, 'Indirect Expenses'),
        ('SURCHARGE_RECOVERED', 'Card Surcharge Recovered',    'INCOME',  NULL, 'Indirect Incomes'),
        ('CLAIMS_ALLOWED',      'Customer Claims Allowed',     'EXPENSE', NULL, 'Indirect Expenses'),
        ('INTEREST_INCOME',     'Interest on Overdue',         'INCOME',  NULL, 'Indirect Incomes')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$cat$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

--  Apply it here for an existing database, in the same "skip if the chart is
--  not there yet" mode 20260915110000 used. A fresh database is mapped by
--  prisma/seed/Acc_Ledger_Map.sql, after Account_Groups.sql has run.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20260915120000');


-- ═══════════════════════════════════════════════════════════════════════════
--  6 · §2.8 — the settings
--
--  asd_max_scope BRANCH throughout: every one of these is a branch-level
--  operating decision (one branch takes post-dated cheques, another does not;
--  one insists a collection names its salesman). The resolver's precedence is
--  GLOBAL < COMPANY < BRANCH, so a BRANCH ceiling still allows a company-wide
--  or global answer — it caps how NARROW an override may be, not how wide.
--
--  accounts.pdc_posting_mode defaults to ON_RECEIPT and the posting service
--  REFUSES ON_CLEARING with a message. That is not an oversight: ON_CLEARING
--  moves allocation out of the receipt and into the Received Cheques screen,
--  which is the next plan. The setting exists now so the value is stored in
--  the right place from the start, rather than being retrofitted over
--  receipts that were posted while it did not exist.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
        asd_label, asd_description, asd_sort_order, asd_is_active,
        asd_needs_relogin, asd_created_by)
SELECT v.key, 'ACCOUNTS', v.grp, v.data_type, v.default_value,
       v.allowed::jsonb, v.min_value, v.max_value, 'BRANCH',
       v.label, v.description, v.sort_order, true,
       false, 'system'
  FROM (VALUES
        ('accounts.pdc_posting_mode', 'Receipt', 'TEXT', 'ON_RECEIPT',
         '["ON_RECEIPT", "ON_CLEARING"]', NULL::numeric, NULL::numeric, 10,
         'Post-dated cheque posting',
         'ON_RECEIPT: the cheque posts with the receipt, on its own voucher dated the cheque, and the bill settles on maturity. ON_CLEARING moves the posting to the Received Cheques screen and is NOT yet implemented — the receipt refuses to post under it.'),

        ('accounts.receipt_bill_sort', 'Receipt', 'TEXT', 'DUE_DATE',
         '["DUE_DATE", "BILL_DATE"]', NULL, NULL, 20,
         'Open bill order',
         'The order /receipts/open-items lists a party''s bills in, and therefore the order money fills them in. DUE_DATE settles what is most overdue first; BILL_DATE is plain FIFO.'),

        ('accounts.receipt_salesman_mandatory', 'Receipt', 'BOOL', 'false',
         NULL, NULL, NULL, 30,
         'Collected-by is mandatory',
         'Refuses a post whose receipt names no employee. For a business whose collections go out with a beat salesman and must be attributable.'),

        ('accounts.writeoff_approval_above', 'Receipt', 'DECIMAL', '0',
         NULL, 0, NULL, 40,
         'Write-off needs approval above',
         'A write-off strictly greater than this needs writeoffApprovedBy. The default 0 means EVERY write-off needs an approver, which is the safe end: raise it deliberately.'),

        ('accounts.tcs_basis', 'Receipt', 'TEXT', 'RECEIPT',
         '["RECEIPT", "SALES"]', NULL, NULL, 60,
         'TCS collected on',
         'RECEIPT: 206C(1H) collected when the money arrives, so the receipt seeds a TCS_PAYABLE line for a TCS-applicable party. SALES: collected on the invoice, so the receipt seeds nothing.'),

        ('accounts.ppd_slabs', 'Receipt', 'JSON', '[]',
         NULL, NULL, NULL, 70,
         'Prompt-payment discount slabs',
         'JSON array of {"days": n, "perc": p}, e.g. [{"days":7,"perc":2},{"days":15,"perc":1}] — 2% if paid within 7 days of the bill date, 1% within 15. SUGGESTS a discount on /receipts/open-items; the operator decides, and the server never re-seeds it at post.')
       ) AS v(key, grp, data_type, default_value, allowed, min_value, max_value,
              sort_order, label, description)
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d
                    WHERE d.asd_key = v.key);


-- ═══════════════════════════════════════════════════════════════════════════
--  7 · §2.9 — the menus
--
--  99 "Receipt" becomes visible: it is the screen this module serves, and it
--  has been hidden since the menu tree was seeded because nothing stood behind
--  it.
--
--  48 "Bill wise Receipt" is DEACTIVATED, not deleted. There is one receipt
--  screen and the bill-wise panel is always on it, so a second entry point
--  offering "the same thing, but with the panel" is a menu that lies. It stays
--  as a row because public.user_menus carries per-user rights keyed on
--  um_menu_id with a foreign key to this table, and deleting the menu would
--  either cascade those rights away or fail.
--
--  51 / 100 / 187 / 188 (Received Cheques, Payment, Collection Entry,
--  Collection Approval) stay hidden. They are the next plans; see §10 of this
--  one.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE fixed.menu_master
   SET menu_visiblity = true,
       menu_is_active = true
 WHERE menu_id = 99
   AND menu_name = 'Receipt';

UPDATE fixed.menu_master
   SET menu_visiblity = false,
       menu_is_active = false
 WHERE menu_id = 48
   AND menu_name = 'Bill wise Receipt';


-- ═══════════════════════════════════════════════════════════════════════════
--  8 · §2.12 / R17 — the "CUSTOMERS BY AREA" dropdown
--
--  Dropdown 39 (CUSTOMERS) is left exactly as it is: other screens use it and
--  narrowing it would narrow them. This is a new dropdown with ONE optional
--  parameter, so the receipt's party picker follows the Beat (dropdown 13,
--  AREA LIST, also unchanged) when one is chosen and lists everybody when it
--  is not.
--
--  `iarea_id` is a bare i-prefixed token, the way every dropdown in this
--  database takes a parameter, and the NULLIF guard is what makes it optional:
--  an unsubstituted empty string matches nothing, so the term has to
--  short-circuit rather than compare.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT (SELECT COALESCE(MAX(dropdown_id), 0) + 1 FROM fixed.dropdown_details),
       'CUSTOMERS BY AREA',
       'Customers, narrowed to one area / beat when iarea_id is supplied. Dropdown 39 unchanged.',
       'SELECT' || E'\n' ||
       '    cus_id,' || E'\n' ||
       '    cus_name' || E'\n' ||
       '  FROM sales.customers' || E'\n' ||
       ' WHERE cus_is_active = true' || E'\n' ||
       '   AND cus_is_deleted = false' || E'\n' ||
       '   AND (NULLIF(''iarea_id'', '''') IS NULL OR cus_area_id = NULLIF(''iarea_id'', '''')::uuid)' || E'\n' ||
       ' ORDER BY cus_name;',
       'Ascending', 'cus_name', true,
       15, true, 320,
       'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details
                    WHERE dropdown_name = 'CUSTOMERS BY AREA');

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              (SELECT MAX(dropdown_id) FROM fixed.dropdown_details))
 WHERE pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id') IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  9 · §4.6 — the receipt list grid
--
--  TxnMainView reads it through /configured-grid-sql. The four key columns are
--  present and HIDDEN, because the view needs them to open a row and the
--  operator must never see them.
--
--  PDC vouchers do NOT list separately: the WHERE clause admits only headers
--  with no avh_against_voucher_id, so a post-dated cheque's own voucher shows
--  under its receipt rather than as a second line the operator did not create.
--
--  A CANCELLED receipt still lists (§7 rule), with its reversal's refno beside
--  it — a row that vanishes when cancelled is a row nobody can audit.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_device_type,
        grid_sort_column, grid_sort_order, grid_sql, grid_status,
        grid_is_deleted, grid_created_by)
SELECT (SELECT COALESCE(MAX(grid_id), 0) + 1 FROM fixed.grid_details),
       'MAIN LIST - RECEIPTS',
       'Receipt vouchers for a company / branch / year. PDC vouchers are excluded — they show under their receipt.',
       'Desktop',
       'Date', 'Descending',
       'SELECT h.avh_voucher_id,' || E'\n' ||
       '       h.avh_company_id,' || E'\n' ||
       '       h.avh_branch_id,' || E'\n' ||
       '       h.avh_acc_year,' || E'\n' ||
       '       h.avh_voucher_refno,' || E'\n' ||
       '       h.avh_voucher_date,' || E'\n' ||
       '       p.led_name                       AS party_name,' || E'\n' ||
       '       h.avh_doc_amount,' || E'\n' ||
       '       h.avh_adjust_amount,' || E'\n' ||
       '       (h.avh_doc_amount - h.avh_adjust_amount) AS on_account_amount,' || E'\n' ||
       '       (SELECT string_agg(DISTINCT t.ttm_display_name, '', '' ORDER BY t.ttm_display_name)' || E'\n' ||
       '          FROM accounts.acc_tender_detail d' || E'\n' ||
       '          JOIN accounts.acc_tender_types  t ON t.ttm_type_id = d.td_tender_type_id' || E'\n' ||
       '         WHERE d.td_src_doc_id = h.avh_voucher_id' || E'\n' ||
       '           AND d.td_acc_year   = h.avh_acc_year' || E'\n' ||
       '           AND d.td_is_deleted = false)  AS instruments,' || E'\n' ||
       '       (SELECT count(*)' || E'\n' ||
       '          FROM accounts.acc_pdc_register r' || E'\n' ||
       '         WHERE r.apd_voucher_acc_year = h.avh_acc_year' || E'\n' ||
       '           AND r.apd_is_deleted = false' || E'\n' ||
       '           AND r.apd_voucher_id IN (' || E'\n' ||
       '                 SELECT c.avh_voucher_id FROM accounts.acc_voucher_header c' || E'\n' ||
       '                  WHERE c.avh_acc_year = h.avh_acc_year' || E'\n' ||
       '                    AND (c.avh_voucher_id = h.avh_voucher_id' || E'\n' ||
       '                     OR  c.avh_against_voucher_id = h.avh_voucher_id))) AS pdc_count,' || E'\n' ||
       '       h.avh_voucher_status,' || E'\n' ||
       '       h.avh_usr_refno,' || E'\n' ||
       '       h.avh_remarks,' || E'\n' ||
       '       rv.avh_voucher_refno             AS reversal_refno,' || E'\n' ||
       '       h.avh_created_by,' || E'\n' ||
       '       h.avh_created_on' || E'\n' ||
       '  FROM accounts.acc_voucher_header h' || E'\n' ||
       '  JOIN accounts.acc_voucher_types  vt ON vt.vchr_type_id = h.avh_voucher_type_id' || E'\n' ||
       '  JOIN accounts.acc_ledger_master  p  ON p.led_id = h.avh_party_id' || E'\n' ||
       '  LEFT JOIN accounts.acc_voucher_header rv' || E'\n' ||
       '         ON rv.avh_voucher_id = h.avh_reversal_voucher_id' || E'\n' ||
       '        AND rv.avh_acc_year   = h.avh_reversal_acc_year' || E'\n' ||
       ' WHERE h.avh_company_id = iavh_company_id::uuid' || E'\n' ||
       '   AND h.avh_branch_id  = iavh_branch_id::uuid' || E'\n' ||
       '   AND h.avh_acc_year   = iavh_acc_year::bpchar' || E'\n' ||
       '   AND vt.vchr_type_code = ''Rct''' || E'\n' ||
       '   AND h.avh_is_deleted = false' || E'\n' ||
       -- A PDC voucher points back at its receipt. Only the receipts list.
       '   AND h.avh_against_voucher_id IS NULL' || E'\n' ||
       '   AND (NULLIF(iavh_status, '''') IS NULL OR h.avh_voucher_status = iavh_status)' || E'\n' ||
       '   AND (NULLIF(ifrom_date, '''') IS NULL OR h.avh_voucher_date >= NULLIF(ifrom_date, '''')::date)' || E'\n' ||
       '   AND (NULLIF(ito_date,   '''') IS NULL OR h.avh_voucher_date <= NULLIF(ito_date,   '''')::date)' || E'\n' ||
       ' ORDER BY h.avh_voucher_date DESC, h.avh_voucher_slno DESC',
       true, false, 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.grid_details
                    WHERE grid_name = 'MAIN LIST - RECEIPTS');

INSERT INTO fixed.grid_columns
       (grid_id, grid_column_number, grid_column_name, grid_column_width,
        grid_column_alignment, grid_column_visibility, grid_column_filter,
        grid_column_group, grid_column_total, grid_column_data_type,
        grid_column_is_deleted, grid_column_position, grid_column_sql_field_name,
        grid_column_created_by)
SELECT g.grid_id, v.col_no, v.col_name, v.width,
       v.align, v.visible, v.filterable,
       false, v.total, v.data_type,
       false, v.col_no, v.field,
       'system'
  FROM fixed.grid_details g
 CROSS JOIN (VALUES
        -- The four key columns: needed to open the row, never shown.
        ( 1, '#',            8.00,  'Left',   false, false, false, 'Text',     'avh_voucher_id'),
        ( 2, 'Company',      8.00,  'Left',   false, false, false, 'Text',     'avh_company_id'),
        ( 3, 'Branch',       8.00,  'Left',   false, false, false, 'Text',     'avh_branch_id'),
        ( 4, 'Year',         5.00,  'Center', false, false, false, 'Text',     'avh_acc_year'),
        ( 5, 'Receipt No',  12.00,  'Left',   true,  true,  false, 'Text',     'avh_voucher_refno'),
        ( 6, 'Date',         9.00,  'Center', true,  true,  false, 'Date',     'avh_voucher_date'),
        ( 7, 'Party',       22.00,  'Left',   true,  true,  false, 'Text',     'party_name'),
        ( 8, 'Received',    11.00,  'Right',  true,  false, true,  'Currency', 'avh_doc_amount'),
        ( 9, 'Adjusted',    11.00,  'Right',  true,  false, true,  'Currency', 'avh_adjust_amount'),
        (10, 'On Account',  11.00,  'Right',  true,  false, true,  'Currency', 'on_account_amount'),
        (11, 'Instruments', 14.00,  'Left',   true,  true,  false, 'Text',     'instruments'),
        (12, 'PDC',          5.00,  'Right',  true,  false, false, 'Number',   'pdc_count'),
        -- APPROVED is the approver's queue, which is why the column filters.
        (13, 'Status',       9.00,  'Center', true,  true,  false, 'Text',     'avh_voucher_status'),
        (14, 'Your Ref',    10.00,  'Left',   false, false, false, 'Text',     'avh_usr_refno'),
        (15, 'Remarks',     14.00,  'Left',   false, false, false, 'Text',     'avh_remarks'),
        (16, 'Reversal',    12.00,  'Left',   false, false, false, 'Text',     'reversal_refno'),
        (17, 'Created By',  10.00,  'Left',   false, false, false, 'Text',     'avh_created_by'),
        (18, 'Created On',  10.00,  'Center', false, false, false, 'Date',     'avh_created_on')
       ) AS v(col_no, col_name, width, align, visible, filterable, total, data_type, field)
 WHERE g.grid_name = 'MAIN LIST - RECEIPTS'
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns c
                    WHERE c.grid_id = g.grid_id);

SELECT setval(pg_get_serial_sequence('fixed.grid_details', 'grid_id'),
              (SELECT MAX(grid_id) FROM fixed.grid_details))
 WHERE pg_get_serial_sequence('fixed.grid_details', 'grid_id') IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  10 · The partition gap the receipt is the first document to hit
--
--  accounts.acc_voucher_header and accounts.acc_vouchers are LIST-partitioned
--  on their accounting year, and public.ensure_acc_year_partitions() — the
--  function every other partitioned table in this database is created by —
--  did not know about either of them. Only the 2026-2027 partition existed,
--  made by hand, and nothing noticed because acc_vouchers held zero rows.
--
--  Two things break without this:
--
--    · a post-dated cheque dated on or after 1 April posts a voucher of its
--      own in the NEXT year (R2), and fails with "no partition of relation
--      acc_voucher_header found for row" — at the moment an operator is
--      taking the cheques;
--
--    · every receipt keyed after the next year-end fails the same way, until
--      somebody works out that the function has to be extended.
--
--  So the function is restated with the two tables appended (the rest of its
--  body is character-for-character what was there), and the years the OTHER
--  partitioned tables already have are back-filled below.
--
--  receipt.guards.ts checks for the partition before a post writes into
--  another year, so a database that has not had this migration applied is
--  refused with a message naming this function rather than a 500.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ensure_acc_year_partitions(p_acc_year character)
RETURNS void
LANGUAGE plpgsql
AS $ensure$

DECLARE
    v_year   text := btrim(p_acc_year);
    v_suffix text;
BEGIN
    IF v_year !~ '^[0-9]{4}-[0-9]{4}$' THEN
        RAISE EXCEPTION 'Invalid accounting year %, expected YYYY-YYYY', p_acc_year;
    END IF;

    v_suffix := replace(v_year, '-', '_');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill FOR VALUES IN (%L)',
        'sale_bill_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_bill_item FOR VALUES IN (%L)',
        'sale_bill_item_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_tender_detail FOR VALUES IN (%L)',
        'acc_tender_detail_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_status_log FOR VALUES IN (%L)',
        'txn_status_log_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_charge_detail FOR VALUES IN (%L)',
        'txn_charge_detail_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.txn_hold FOR VALUES IN (%L)',
        'txn_hold_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order FOR VALUES IN (%L)',
        'sale_order_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_order_item FOR VALUES IN (%L)',
        'sale_order_item_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation FOR VALUES IN (%L)',
        'sale_quotation_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS sales.%I PARTITION OF sales.sale_quotation_item FOR VALUES IN (%L)',
        'sale_quotation_item_' || v_suffix, v_year);

    -- The bill is partitioned again as of 20260811090000: on the FY it was
    -- RAISED in, which it keeps for life.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_balance FOR VALUES IN (%L)',
        'acc_bill_balance_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_bill_adjustment FOR VALUES IN (%L)',
        'acc_bill_adjustment_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_opening_balance FOR VALUES IN (%L)',
        'acc_opening_balance_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_pdc_register FOR VALUES IN (%L)',
        'acc_pdc_register_' || v_suffix, v_year);

    -- ── Added by 20260915120000 ──────────────────────────────────────────
    --  The two VOUCHER tables. They were partitioned when they were created
    --  and this function never knew about them, so only the partition that
    --  happened to be made by hand existed — which nothing noticed while
    --  accounts.acc_vouchers held zero rows.
    --
    --  The receipt is the first writer of voucher legs, and it is also the
    --  first document that routinely writes into a year that is not the
    --  current one: a post-dated cheque dated 2027-04-02 posts a voucher of
    --  its own in 2027-2028. Without these two lines that is a raw
    --  "no partition of relation acc_voucher_header found for row" at the
    --  moment an operator is taking 50,000 in cheques.
    --
    --  Header BEFORE lines: acc_vouchers carries fk_av_header into it.
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_voucher_header FOR VALUES IN (%L)',
        'acc_voucher_header_' || v_suffix, v_year);

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS accounts.%I PARTITION OF accounts.acc_vouchers FOR VALUES IN (%L)',
        'acc_vouchers_' || v_suffix, v_year);

    -- The stock engine's four, added by 20260907090000.
    PERFORM stock.fn_create_stock_partitions(v_year::character(9));
END;
$ensure$;

COMMENT ON FUNCTION public.ensure_acc_year_partitions(character) IS
    'Creates every LIST partition one accounting year needs, across sales, accounts, stock and the shared public tables. Idempotent. Extended by 20260915120000 with acc_voucher_header and acc_vouchers.';

--  Back-fill: give the two voucher tables the same years every other
--  partitioned table already has, so a receipt can be keyed into any year the
--  rest of the system already accepts.
SELECT public.ensure_acc_year_partitions(y.acc_year::character(9))
  FROM (SELECT DISTINCT right(c.relname, 9) AS suffix
          FROM pg_inherits i
          JOIN pg_class parent ON parent.oid = i.inhparent
          JOIN pg_class c      ON c.oid = i.inhrelid
          JOIN pg_namespace n  ON n.oid = parent.relnamespace
         WHERE n.nspname = 'accounts'
           AND parent.relname = 'acc_bill_balance') p
 CROSS JOIN LATERAL (SELECT replace(p.suffix, '_', '-') AS acc_year) y
 WHERE y.acc_year ~ '^[0-9]{4}-[0-9]{4}$';


-- ═══════════════════════════════════════════════════════════════════════════
--  11 · §2.4 — the header totals become DERIVED
--
--  ── The bug this closes ─────────────────────────────────────────────────
--  ck_avh_balanced is
--
--      CHECK (avh_voucher_status <> 'POSTED' OR avh_total_debit = avh_total_credit)
--
--  and avh_total_debit / avh_total_credit are STAMPED by whoever writes the
--  header. So the constraint compares two numbers the writer chose, against
--  each other. A writer that stamps 25,200 and 25,200 passes it while having
--  written legs that come to 25,200 and 24,200 — the voucher is unbalanced and
--  the database says it is fine. Worse, a writer that sets POSTED before the
--  legs exist passes it comparing 0 with 0, which is note (4)'s vacuous pass.
--
--  Neither is a hypothetical: accounts.acc_vouchers held zero rows until this
--  module, so the check has never once been evaluated against a real voucher.
--
--  ── Why a TRIGGER and not the helper this file first shipped ────────────
--  Because the constraint has to hold for EVERY writer of acc_vouchers, and
--  the receipt is only the first of them — the payment voucher, the journal,
--  the contra and every accounts screen after this one land on the same two
--  columns. A TypeScript helper protects the callers that remember to call it.
--  A trigger protects the table.
--
--  The receipt still calls deriveVoucherTotals() before it flips a header to
--  POSTED, but that is now a READ: it re-derives the totals from the legs and
--  refuses with a message naming the voucher and the difference, so the
--  operator sees something better than a 23514. The trigger is what makes the
--  figures true; the read is what makes the failure legible.
--
--  ── The UPDATE branch, which the plan's draft did not have ──────────────
--  A leg MOVED from one voucher to another leaves the old voucher's totals
--  wrong. The plan's §2.4 body only refreshed NEW; this refreshes OLD as well
--  when the pair changed, exactly as its own §2.1 does for bills. Nothing in
--  this module moves a leg — but the trigger is not for this module.
--
--  ── A consequence worth knowing before you meet it ──────────────────────
--  Once a voucher is POSTED, soft-deleting one of its legs now FAILS: the
--  trigger re-derives the totals, the header no longer balances, and
--  ck_avh_balanced refuses the write. That is correct and it is the point —
--  a posted voucher cannot be quietly unbalanced. It is also why cancelling
--  writes a REVERSAL voucher with mirrored legs (§5.3) instead of deleting
--  the originals, and why any future module that wants to "fix" a posted
--  voucher has to reverse it too.
--
--  ── Cost ────────────────────────────────────────────────────────────────
--  One UPDATE of one header row per leg written. A receipt writes about eight
--  legs, so eight updates of a row the transaction already holds a lock on.
--  A statement-level trigger would be cheaper and could not see which vouchers
--  were touched without a transition table; at this volume the row trigger is
--  the simpler thing that is obviously correct.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION accounts.fn_avh_refresh_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_id   uuid;
    v_year char(9);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id := OLD.av_voucher_id;
        v_year := OLD.av_acc_year;
    ELSE
        v_id := NEW.av_voucher_id;
        v_year := NEW.av_acc_year;
    END IF;

    PERFORM accounts.fn_avh_recompute_totals(v_id, v_year);

    --  A leg that changed voucher leaves the one it LEFT overstated.
    IF TG_OP = 'UPDATE'
       AND (NEW.av_voucher_id, NEW.av_acc_year)
           IS DISTINCT FROM (OLD.av_voucher_id, OLD.av_acc_year) THEN
        PERFORM accounts.fn_avh_recompute_totals(OLD.av_voucher_id, OLD.av_acc_year);
    END IF;

    --  AFTER trigger: the return value is discarded.
    RETURN NULL;
END
$fn$;

--  The arithmetic on its own, so it can be called for a repair or a back-fill
--  without pretending to be a trigger:
--      SELECT accounts.fn_avh_recompute_totals(avh_voucher_id, avh_acc_year)
--        FROM accounts.acc_voucher_header;
CREATE OR REPLACE FUNCTION accounts.fn_avh_recompute_totals(
    p_voucher_id uuid,
    p_acc_year   char(9))
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF p_voucher_id IS NULL OR p_acc_year IS NULL THEN
        RETURN;
    END IF;

    UPDATE accounts.acc_voucher_header h
       SET avh_total_debit  = s.dr,
           avh_total_credit = s.cr
      FROM (SELECT COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'DR'), 0) AS dr,
                   COALESCE(SUM(av_amount) FILTER (WHERE av_dr_cr = 'CR'), 0) AS cr
              FROM accounts.acc_vouchers
             WHERE av_voucher_id = p_voucher_id
               AND av_acc_year   = p_acc_year
               AND NOT av_is_deleted) s
     WHERE h.avh_voucher_id = p_voucher_id
       AND h.avh_acc_year   = p_acc_year
       --  Skip the write when nothing moved, so a no-op UPDATE does not churn
       --  the row or wake anything watching it.
       AND (h.avh_total_debit, h.avh_total_credit) IS DISTINCT FROM (s.dr, s.cr);
END
$fn$;

COMMENT ON FUNCTION accounts.fn_avh_recompute_totals(uuid, char) IS
    'Re-derives acc_voucher_header.avh_total_debit / _credit from that voucher''s live legs. Called by tr_av_refresh_totals; safe to call by hand for a repair.';

DROP TRIGGER IF EXISTS tr_av_refresh_totals ON accounts.acc_vouchers;

CREATE TRIGGER tr_av_refresh_totals
    AFTER INSERT OR UPDATE OR DELETE ON accounts.acc_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION accounts.fn_avh_refresh_totals();

--  Back-fill every header that already exists, so the columns are true from
--  the moment this migration lands rather than from the next leg written.
--  (There are no legs today; this costs nothing and means the file is still
--  correct the day it is replayed onto a database that has some.)
SELECT accounts.fn_avh_recompute_totals(h.avh_voucher_id, h.avh_acc_year)
  FROM accounts.acc_voucher_header h;

COMMENT ON COLUMN accounts.acc_voucher_header.avh_total_debit IS
    'DERIVED by tr_av_refresh_totals from accounts.acc_vouchers. Never write it: ck_avh_balanced compares it with avh_total_credit, and a stamped value makes that check compare a writer''s claim with itself.';

COMMENT ON COLUMN accounts.acc_voucher_header.avh_total_credit IS
    'DERIVED by tr_av_refresh_totals from accounts.acc_vouchers. Never write it.';


-- ═══════════════════════════════════════════════════════════════════════════
--  Read-back: paste this after running
--
--  SELECT vchr_type_id, vchr_type_code, vchr_no_prefix
--    FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Rct';
--
--  SELECT r.alr_role, l.led_name
--    FROM accounts.acc_ledger_role r
--    JOIN accounts.acc_ledger_map  m ON m.alm_role = r.alr_role AND NOT m.alm_is_deleted
--    JOIN accounts.acc_ledger_master l ON l.led_id = m.alm_ledger_id
--   WHERE r.alr_group = 'RECEIPT' ORDER BY r.alr_sort_order;
--
--  SELECT asd_key, asd_default_value FROM public.app_setting_def
--   WHERE asd_key LIKE 'accounts.%' ORDER BY asd_sort_order;
--
--  SELECT tgname FROM pg_trigger WHERE tgrelid = 'accounts.acc_vouchers'::regclass
--     AND NOT tgisinternal;
--
--  SELECT parent.relname, count(*) FROM pg_inherits i
--    JOIN pg_class parent ON parent.oid = i.inhparent
--    JOIN pg_namespace n ON n.oid = parent.relnamespace
--   WHERE n.nspname = 'accounts' AND parent.relname LIKE 'acc_voucher%'
--   GROUP BY 1;
--
--  SELECT grid_id FROM fixed.grid_details    WHERE grid_name = 'MAIN LIST - RECEIPTS';
--  SELECT dropdown_id FROM fixed.dropdown_details WHERE dropdown_name = 'CUSTOMERS BY AREA';
-- ═══════════════════════════════════════════════════════════════════════════
