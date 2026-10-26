-- ═══════════════════════════════════════════════════════════════════════════
--  Godown Transfer: loading / unloading crew, rates and charges — notes 153
--  (2026-10-26)
--
--  3.0's Stock Transfer had a Loading box and an Unloading box (crew, vehicle,
--  a per-unit "cooly" rate on each line, the charge = Σ qty × rate). The
--  charges were only recorded there. Here they POST: on despatch of a
--  same-branch transfer, one voucher DR LOADING_CHARGES / CR LOADING_PAYABLE
--  for loading + unloading, whatever accounts.cogs_mode says. The crew is
--  paid later by an ordinary Payment against the payable.
--
--  Here:
--    1. stock_voucher: crew and vehicle ON THE DOCUMENT (the sales documents'
--       rule — sb_driver_id, sb_loadman_id uuid[]), and the two charges,
--       computed by the API from the lines and never taken from a body
--    2. stock_voucher_item: the per-unit rates, stored so a later change to
--       the unit's rate cannot change an old transfer's charge. The amount is
--       not stored: it is qty × rate.
--    3. ledger roles LOADING_CHARGES / LOADING_PAYABLE, catalogued (else
--       fn_seed_ledger_map refuses every boot), mapped by fn_seed_ledger_map
--    4. voucher type TRF "Stock Transfer" (menu 41), not a register type:
--       it is raised by the stock document, never keyed by hand (as StkAdj)
--
--  Every new column is TRANSFER_OUT / TRANSFER_IN only; the API refuses them
--  on every other stock voucher type, so the defaults hold there.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · the document: crew, vehicle, charges ──────────────────────────────
-- On the partitioned parent, so every year has them. No FK on the two crew
-- arrays: a uuid[] cannot carry one (as sb_loadman_id); the API checks each id
-- against employee_master and the document's company.
ALTER TABLE stock.stock_voucher
    ADD COLUMN IF NOT EXISTS svh_load_enabled         boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS svh_load_datetime        timestamptz(6),
    ADD COLUMN IF NOT EXISTS svh_loadman_id           uuid[],
    ADD COLUMN IF NOT EXISTS svh_driver_id            uuid,
    ADD COLUMN IF NOT EXISTS svh_supervisor_id        uuid,
    ADD COLUMN IF NOT EXISTS svh_vehicle_id           uuid,
    ADD COLUMN IF NOT EXISTS svh_vehicle_no           varchar(30),
    ADD COLUMN IF NOT EXISTS svh_loading_charge       numeric(18,2)  NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS svh_unload_enabled       boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS svh_unload_datetime      timestamptz(6),
    ADD COLUMN IF NOT EXISTS svh_unloadman_id         uuid[],
    ADD COLUMN IF NOT EXISTS svh_unload_supervisor_id uuid,
    ADD COLUMN IF NOT EXISTS svh_unloading_charge     numeric(18,2)  NOT NULL DEFAULT 0;

-- A charge is never negative, and an unticked box charges nothing.
ALTER TABLE stock.stock_voucher DROP CONSTRAINT IF EXISTS ck_svh_loading_charge;
ALTER TABLE stock.stock_voucher
    ADD CONSTRAINT ck_svh_loading_charge
    CHECK (svh_loading_charge >= 0 AND (svh_load_enabled OR svh_loading_charge = 0));
ALTER TABLE stock.stock_voucher DROP CONSTRAINT IF EXISTS ck_svh_unloading_charge;
ALTER TABLE stock.stock_voucher
    ADD CONSTRAINT ck_svh_unloading_charge
    CHECK (svh_unloading_charge >= 0 AND (svh_unload_enabled OR svh_unloading_charge = 0));

ALTER TABLE stock.stock_voucher DROP CONSTRAINT IF EXISTS fk_svh_driver;
ALTER TABLE stock.stock_voucher
    ADD CONSTRAINT fk_svh_driver FOREIGN KEY (svh_driver_id)
    REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE stock.stock_voucher DROP CONSTRAINT IF EXISTS fk_svh_supervisor;
ALTER TABLE stock.stock_voucher
    ADD CONSTRAINT fk_svh_supervisor FOREIGN KEY (svh_supervisor_id)
    REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE stock.stock_voucher DROP CONSTRAINT IF EXISTS fk_svh_unload_supervisor;
ALTER TABLE stock.stock_voucher
    ADD CONSTRAINT fk_svh_unload_supervisor FOREIGN KEY (svh_unload_supervisor_id)
    REFERENCES public.employee_master (emp_id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE stock.stock_voucher DROP CONSTRAINT IF EXISTS fk_svh_vehicle;
ALTER TABLE stock.stock_voucher
    ADD CONSTRAINT fk_svh_vehicle FOREIGN KEY (svh_vehicle_id)
    REFERENCES public.vehicle_master (veh_id) ON UPDATE CASCADE ON DELETE RESTRICT;

COMMENT ON COLUMN stock.stock_voucher.svh_load_enabled IS
    'TRANSFER_OUT / TRANSFER_IN: the Loading tick. svh_loading_charge is 0 unless it is set.';
COMMENT ON COLUMN stock.stock_voucher.svh_loadman_id IS
    'The loading crew, employee_master ids. uuid[] so no FK; the API checks each against the company.';
COMMENT ON COLUMN stock.stock_voucher.svh_vehicle_no IS
    'Typed, as on the bill (sb_vehicle_no) — svh_vehicle_id is optional.';
COMMENT ON COLUMN stock.stock_voucher.svh_loading_charge IS
    'COMPUTED by the API on every save: round(Σ svi_qty × svi_load_rate, 2) when svh_load_enabled, else 0. Never taken from a body. Posts DR LOADING_CHARGES / CR LOADING_PAYABLE at despatch.';
COMMENT ON COLUMN stock.stock_voucher.svh_unloading_charge IS
    'COMPUTED as svh_loading_charge, from svi_unload_rate and svh_unload_enabled.';


-- ── 2 · the lines: the per-unit rates ──────────────────────────────────────
ALTER TABLE stock.stock_voucher_item
    ADD COLUMN IF NOT EXISTS svi_load_rate   numeric(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS svi_unload_rate numeric(18,4) NOT NULL DEFAULT 0;

ALTER TABLE stock.stock_voucher_item DROP CONSTRAINT IF EXISTS ck_svi_load_rates;
ALTER TABLE stock.stock_voucher_item
    ADD CONSTRAINT ck_svi_load_rates CHECK (svi_load_rate >= 0 AND svi_unload_rate >= 0);

COMMENT ON COLUMN stock.stock_voucher_item.svi_load_rate IS
    'Loading charge per unit of the LINE''s unit (svi_uom_id). Defaults on the screen from item_unit_master.unit_loading when item_allow_loading; stored so a later rate change cannot move an old transfer''s charge.';
COMMENT ON COLUMN stock.stock_voucher_item.svi_unload_rate IS
    'As svi_load_rate, from unit_unloading.';


-- ── 3 · ledger roles ───────────────────────────────────────────────────────
INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty, alr_want_nature,
        alr_by_supply, alr_by_rate, alr_sort_order, alr_remarks)
VALUES ('LOADING_CHARGES', 'Loading & unloading charges', 'SHARED', 'EXPENSE', NULL, 'Expenses',
        false, false, 660,
        'A transfer''s loading + unloading labour (svh_loading_charge + svh_unloading_charge). A direct expense.'),
       ('LOADING_PAYABLE', 'Loading charges payable', 'SHARED', NULL, NULL, 'Liabilities',
        false, false, 661,
        'What the loading crew is owed until a Payment (menu 100) against this ledger settles it.')
ON CONFLICT (alr_role) DO NOTHING;

--  The catalogue, restated — character for character as 20261014100000 left
--  it (the live definition agrees), with the two rows appended.
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
        ('TILL_CASH_AWAITING', 'Till Cash Awaiting Receipt',    'CASH',     NULL,             'Cash-in-Hand'),
        -- ── TRANSFER LOADING / UNLOADING — 20261026100000 (notes 153) ─────
        --  The labour of moving stock between godowns: a direct expense, owed
        --  to the crew until a Payment (menu 100) settles the payable.
        ('LOADING_CHARGES',    'Loading & Unloading Charges',   'EXPENSE',  NULL,             'Direct Expenses'),
        ('LOADING_PAYABLE',    'Loading Charges Payable',       'GENERAL',  NULL,             'Current Liabilities')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

-- p_skip_if_no_chart = true: on a fresh database the chart is a seed that has
-- not run yet; Acc_Ledger_Map.sql maps it at first boot.
SELECT accounts.fn_seed_ledger_map(true, 'migration 20261026100000');


-- ── 4 · voucher type TRF ───────────────────────────────────────────────────
-- Numbered TRF00001, yearly; a transfer whose refno fits avh_voucher_refno
-- prints its own number on the voucher (as StkAdj). Not in the voucher
-- register. menu 41 only where the menu tree exists already — on a fresh
-- database Acc_Voucher_Types_Register.sql links it once Menu_Master.sql ran.
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type,
     vchr_menu_id, vchr_created_by)
SELECT 'TRF', 'Stock Transfer', 'TRF', 'BOTH'::accounts."VoucherCategory", 'JOURNAL'::accounts."VoucherNature",
       'AUTO'::accounts."VoucherNumberingMode",
       'TRF', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
       true, true, false, false,
       'STOCK TRANSFER', 360, true,
       true, 'Journal', 'Journal',
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = 41), 'system'
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = 'TRF');
