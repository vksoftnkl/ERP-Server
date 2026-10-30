-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase B0 — platform prerequisites (plan-purchase-backend.md §1 B0,
--  notes-162 P5 P6 P7 P8 P12 P14). Additive only: new roles + their ledgers,
--  new voucher types, wider CHECK lists, one FK, three new columns.
--  NOT here (asked separately): P1 voucher slno, P2 ck_abl_settled.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ledger roles (P8) ──────────────────────────────────────────────────
INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty, alr_want_nature,
        alr_by_supply, alr_by_rate, alr_sort_order, alr_remarks)
VALUES ('GRNI', 'Goods received not invoiced', 'PURCHASE', NULL, NULL, 'Liabilities', false, false, 700,
        'GRN posts Dr INVENTORY / Cr GRNI at the provisional rate; the purchase bill clears it.'),
       ('SHORTAGE_RECEIVABLE', 'Shortage receivable', 'PURCHASE', NULL, NULL, 'Assets', false, false, 701,
        'Value of qty billed but not received; cleared by a Shortage Receipt, a supplier credit note, a claim or a write-off.'),
       ('CLAIM_RECEIVABLE', 'Claims receivable', 'PURCHASE', NULL, NULL, 'Assets', false, false, 702,
        'Purchase claims (goods sent back / destroyed here) awaiting the supplier''s, transporter''s or insurer''s credit.'),
       ('INPUT_TAX_PENDING', 'Input GST pending (short qty)', 'PURCHASE', NULL, NULL, 'Assets', false, false, 703,
        'GST on billed-but-short qty: not input credit until the goods arrive (sec 16(2)(b)). Moved to INPUT_* by the Shortage Receipt.'),
       ('ITC_REVERSAL', 'Input credit reversed', 'PURCHASE', 'EXPENSE', NULL, 'Expenses', false, false, 704,
        'GST written off when goods are destroyed / written off (sec 17(5)(h)).'),
       ('PURCHASE_PRICE_VARIANCE', 'Purchase price variance', 'PURCHASE', 'EXPENSE', NULL, 'Expenses', false, false, 705,
        'GRN-vs-bill rate difference on qty no longer on hand, and return value vs lot cost.'),
       ('RCM_CESS_PAYABLE', 'RCM cess payable', 'PURCHASE', 'TAX', 'Cess', 'Liabilities', false, true, 706,
        'Cess payable under reverse charge (the CGST / SGST / IGST ones exist).'),
       ('TCS_RECEIVABLE', 'TCS receivable', 'PURCHASE', NULL, NULL, 'Assets', false, false, 707,
        'TCS charged by a supplier on its bill (scrap / minerals / vehicles), credit against our tax.')
ON CONFLICT (alr_role) DO NOTHING;

--  The catalogue, restated exactly as live (pg_get_functiondef, 27-Oct) with
--  the eight purchase rows appended.
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
        ('LOADING_PAYABLE',    'Loading Charges Payable',       'GENERAL',  NULL,             'Current Liabilities'),
        -- ── PURCHASE — 20261028100000 (plan-purchase-backend B0, notes-162 P8) ─
        --  GRNI: goods received, bill not yet entered. The three receivables
        --  hold what the supplier / transporter still owes us. INPUT_TAX_PENDING
        --  is GST on short qty — not input credit until the goods arrive, so an
        --  asset and NOT a TAX ledger the returns read (as GST_ON_CHARGES_PENDING).
        ('GRNI',                    'Goods Received Not Invoiced',  'GENERAL',  NULL,          'Current Liabilities'),
        ('SHORTAGE_RECEIVABLE',     'Shortage Receivable',          'GENERAL',  NULL,          'Current Assets'),
        ('CLAIM_RECEIVABLE',        'Claims Receivable',            'GENERAL',  NULL,          'Current Assets'),
        ('INPUT_TAX_PENDING',       'Input GST Pending (short qty)','GENERAL',  NULL,          'Current Assets'),
        ('ITC_REVERSAL',            'Input Credit Reversed',        'EXPENSE',  NULL,          'Indirect Expenses'),
        ('PURCHASE_PRICE_VARIANCE', 'Purchase Price Variance',      'EXPENSE',  NULL,          'Direct Expenses'),
        ('RCM_CESS_PAYABLE',        'RCM Cess Payable',             'TAX',      'Cess',        'Duties & Taxes'),
        ('TCS_RECEIVABLE',          'TCS Receivable',               'GENERAL',  NULL,          'Current Assets')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

SELECT accounts.fn_seed_ledger_map(true, 'migration 20261028100000');

-- ── 2 · voucher types (P7) ─────────────────────────────────────────────────
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type,
     vchr_menu_id, vchr_created_by)
SELECT v.code, v.name, v.code, v.cat::accounts."VoucherCategory", v.nature::accounts."VoucherNature",
       'AUTO'::accounts."VoucherNumberingMode", v.code, '', 5, 'YEARLY'::accounts."VoucherResetFreq", false,
       true, v.inv, false, false, v.title, v.sort, true,
       true, v.tally, v.tally,
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = v.menu), 'system'
  FROM (VALUES
        ('GRN', 'Goods Received Note',     'BOTH',       'JOURNAL',     true,  'GOODS RECEIVED NOTE', 370, 'Journal',    NULL::int),
        ('PUR', 'Purchase',                'BOTH',       'PURCHASE',    true,  'PURCHASE',            371, 'Purchase',   24),
        ('PRN', 'Purchase Return',         'BOTH',       'DEBIT_NOTE',  true,  'DEBIT NOTE',          372, 'Debit Note', 25),
        ('SHR', 'Shortage Receipt',        'BOTH',       'JOURNAL',     true,  'SHORTAGE RECEIPT',    373, 'Journal',    195),
        ('PCL', 'Purchase Claim Settlement','ACCOUNTING','JOURNAL',     false, 'CLAIM SETTLEMENT',    374, 'Journal',    NULL::int)
       ) AS v(code, name, cat, nature, inv, title, sort, tally, menu)
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.code);

-- ── 3 · price log source (P5) ──────────────────────────────────────────────
ALTER TABLE inventory.item_price_change_log DROP CONSTRAINT IF EXISTS ipcl_source_check;
ALTER TABLE inventory.item_price_change_log DROP CONSTRAINT IF EXISTS ck_ipcl_source;
ALTER TABLE inventory.item_price_change_log ADD CONSTRAINT ck_ipcl_source
  CHECK (ipcl_source IN ('ITEM_CARD','CHANGE_SELLING_PRICE','QTY_PRICE','BUCKET_REKEY','IMPORT','PURCHASE'));

-- ── 4 · document types (P6) ────────────────────────────────────────────────
ALTER TABLE public.txn_status_log DROP CONSTRAINT ck_tsl_src_doc_type;
ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type IN (
  'QUOTATION','SALES_ORDER','DELIVERY_CHALLAN','DC_RETURN','SALE_BILL','SALE_RETURN',
  'PURCHASE_ORDER','PURCHASE_BILL','PURCHASE_RETURN','GRN','SHORTAGE_RECEIPT','CLAIM_SETTLEMENT',
  'STOCK_TRANSFER','STOCK_ADJUSTMENT','OPENING_STOCK','PHYSICAL_STOCK',
  'RECEIPT','PAYMENT','JOURNAL','EXPENSE','CHEQUE_RECEIVED','CHEQUE_ISSUED','TEMP_CREDIT','OTHER'));

ALTER TABLE public.txn_hold DROP CONSTRAINT ck_txh_doc_type;
ALTER TABLE public.txn_hold ADD CONSTRAINT ck_txh_doc_type CHECK (txh_doc_type IN (
  'QUOTATION','SALES_ORDER','DELIVERY_CHALLAN','DC_RETURN','SALE_BILL','SALE_RETURN',
  'PURCHASE_ORDER','PURCHASE_BILL','PURCHASE_RETURN','GRN','SHORTAGE_RECEIPT',
  'STOCK_TRANSFER','STOCK_ADJUSTMENT','RECEIPT','PAYMENT','JOURNAL','OTHER'));

ALTER TABLE public.txn_transport_detail DROP CONSTRAINT ck_ttd_doc_type;
ALTER TABLE public.txn_transport_detail ADD CONSTRAINT ck_ttd_doc_type CHECK (ttd_doc_type IN (
  'SALE_BILL','DELIVERY_CHALLAN','SALE_RETURN','DC_RETURN','STOCK_TRANSFER',
  'PURCHASE_ORDER','GRN','PURCHASE_BILL','PURCHASE_RETURN','SHORTAGE_RECEIPT'));

-- ── 5 · preferred supplier FK (P12) — 24 rows set, 0 orphans on 27-Oct ─────
ALTER TABLE inventory.item_master
  ADD CONSTRAINT fk_item_supplier FOREIGN KEY (item_supplier_id)
  REFERENCES purchase.suppliers (sup_id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE inventory.item_master VALIDATE CONSTRAINT fk_item_supplier;

-- ── 6 · charges: on the supplier's bill or ours; who is owed (P14) ─────────
ALTER TABLE public.charge_master ADD COLUMN IF NOT EXISTS chg_on_bill boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.charge_master.chg_on_bill IS
  'Purchase only. true = part of the supplier''s bill and payable. false = our own cost (coolie, own freight): always landing cost, no GST in phase 1, credited to the party on the document row (cd_party_id) or to chg_ledger_code.';
ALTER TABLE public.txn_charge_detail ADD COLUMN IF NOT EXISTS cd_on_bill boolean NOT NULL DEFAULT true;
ALTER TABLE public.txn_charge_detail ADD COLUMN IF NOT EXISTS cd_party_id uuid;
COMMENT ON COLUMN public.txn_charge_detail.cd_party_id IS
  'The payee ledger of this charge row (Party Mandatory). One row per payee — coolie split loadman-wise gives one row per loadman.';
ALTER TABLE public.txn_charge_detail
  ADD CONSTRAINT fk_cd_party FOREIGN KEY (cd_party_id)
  REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT;  -- partitioned: no NOT VALID; the column is new, so empty
CREATE INDEX IF NOT EXISTS ix_cd_party ON public.txn_charge_detail (cd_party_id) WHERE cd_party_id IS NOT NULL;
