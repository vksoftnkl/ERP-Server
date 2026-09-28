-- ═══════════════════════════════════════════════════════════════════════════
--  Stock engine, phase 1 (plan-nestjs-stock-engine §1) — data and declarative
--  DDL only. NO function, NO trigger: every behaviour lives in TypeScript
--  (stock-voucher-posting.helper.ts). 2026-09-28.
--
--  1. stock_transit.stt_cost_rate_wot          §1.1  the without-tax cost travels
--  2. sbl_reserved_qty / sbl_transit_in_qty     §1.3  one-time recompute
--  3. STOCK_SHORTAGE / STOCK_EXCESS roles        §1.9  + the ledger-map catalogue
--  4. vchr_affects_accounts on OPENING / Phy    §1.9
--  5. TRANSIT_LOSS stock reason                 §1.1  settle-short's default
--  6. txn_status_log doc types + relabel        §1.10 DC_RETURN / CHEQUE_*
--  7. ix_tsl_latest_per_doc                     §1.10 the latest-per-doc scan
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. the without-tax cost travels with the stock ─────────────────────────
-- Receive used to read `sml_cost_rate` off the transit row and
-- `sml_cost_rate_wot` off the lot's frozen first-arrival figure, so the two
-- rates on one IN row described two different moments (20_stock_transfer_flow
-- B6a, REVIEW open item 3). Both are stamped at despatch now.
ALTER TABLE stock.stock_transit
    ADD COLUMN IF NOT EXISTS stt_cost_rate_wot numeric(18, 6) NOT NULL DEFAULT 0;

COMMENT ON COLUMN stock.stock_transit.stt_cost_rate_wot IS
    'Without-tax cost the OUT row was stamped at, beside stt_cost_rate. Written by the engine at despatch; the receipt values its IN rows from both.';

-- ── 2. reserved and in-transit quantities, recomputed from their sources ───
-- Nothing ever wrote sbl_reserved_qty (28 OPEN reservations live, column 0
-- everywhere); the engine's refreshReserved / refreshTransitIn own the two
-- columns from here on. A balance row is ensured for every holding that has
-- a reservation or a transit row, as fn_sbl_ensure_row used to.
INSERT INTO stock.stock_balance (
    sbl_company_id, sbl_branch_id, sbl_tenant_id, sbl_godown_id, sbl_item_id,
    sbl_lot_id, sbl_base_uom_id, sbl_bucket,
    sbl_batch_no, sbl_mrp, sbl_sale_price, sbl_expiry_date, sbl_supplier_id, sbl_created_by)
SELECT h.company_id, h.branch_id, h.tenant_id, h.godown_id, h.item_id,
       h.lot_id, h.base_uom_id, h.bucket,
       slt.slt_batch_no, slt.slt_mrp, slt.slt_sale_price, slt.slt_expiry_date, slt.slt_supplier_id,
       'migration:20260928100000'
  FROM (
        SELECT DISTINCT r.srv_company_id, r.srv_branch_id, r.srv_tenant_id, r.srv_godown_id,
               r.srv_item_id, r.srv_lot_id, r.srv_base_uom_id, r.srv_bucket
          FROM stock.stock_reservation r
         WHERE r.srv_is_deleted = false AND r.srv_status IN ('OPEN', 'PARTIAL')
        UNION
        SELECT DISTINCT t.stt_company_id, t.stt_to_branch_id, t.stt_tenant_id, t.stt_to_godown_id,
               t.stt_item_id, t.stt_lot_id, t.stt_base_uom_id, t.stt_bucket
          FROM stock.stock_transit t
         WHERE t.stt_is_deleted = false AND t.stt_status IN ('IN_TRANSIT', 'PARTIAL')
       ) h(company_id, branch_id, tenant_id, godown_id, item_id, lot_id, base_uom_id, bucket)
  JOIN stock.stock_lot slt ON slt.slt_id = h.lot_id
ON CONFLICT (sbl_company_id, sbl_branch_id, sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket)
WHERE sbl_is_deleted = false
DO NOTHING;

UPDATE stock.stock_balance b
   SET sbl_reserved_qty = COALESCE(r.qty, 0),
       sbl_row_version  = b.sbl_row_version + 1,
       sbl_modified_on  = now(),
       sbl_modified_by  = 'migration:20260928100000'
  FROM (SELECT b2.sbl_id,
               (SELECT SUM(x.srv_open_qty) FROM stock.stock_reservation x
                 WHERE x.srv_company_id = b2.sbl_company_id AND x.srv_branch_id = b2.sbl_branch_id
                   AND x.srv_godown_id  = b2.sbl_godown_id  AND x.srv_item_id   = b2.sbl_item_id
                   AND x.srv_lot_id     = b2.sbl_lot_id     AND x.srv_bucket    = b2.sbl_bucket
                   AND x.srv_is_deleted = false AND x.srv_status IN ('OPEN', 'PARTIAL')) AS qty
          FROM stock.stock_balance b2
         WHERE b2.sbl_is_deleted = false) r
 WHERE b.sbl_id = r.sbl_id
   AND b.sbl_reserved_qty IS DISTINCT FROM COALESCE(r.qty, 0);

UPDATE stock.stock_balance b
   SET sbl_transit_in_qty = COALESCE(t.qty, 0),
       sbl_row_version    = b.sbl_row_version + 1,
       sbl_modified_on    = now(),
       sbl_modified_by    = 'migration:20260928100000'
  FROM (SELECT b2.sbl_id,
               (SELECT SUM(x.stt_sent_qty - x.stt_received_qty - x.stt_damage_qty) FROM stock.stock_transit x
                 WHERE x.stt_company_id   = b2.sbl_company_id AND x.stt_to_branch_id = b2.sbl_branch_id
                   AND x.stt_to_godown_id = b2.sbl_godown_id  AND x.stt_item_id      = b2.sbl_item_id
                   AND x.stt_lot_id       = b2.sbl_lot_id     AND x.stt_bucket       = b2.sbl_bucket
                   AND x.stt_is_deleted   = false AND x.stt_status IN ('IN_TRANSIT', 'PARTIAL')) AS qty
          FROM stock.stock_balance b2
         WHERE b2.sbl_is_deleted = false) t
 WHERE b.sbl_id = t.sbl_id
   AND b.sbl_transit_in_qty IS DISTINCT FROM COALESCE(t.qty, 0);

-- ── 3. the two ledger roles a PHYSICAL count posts to ──────────────────────
-- The line's / header's reason ledger (srm_gl_ledger_id) wins when set; these
-- are the defaults. Catalogued in the same migration, because
-- fn_seed_ledger_map() refuses an ACTIVE role that is absent from
-- fn_ledger_map_catalogue() and the boot seed then aborts (20260926163000).
INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty, alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order)
VALUES ('STOCK_SHORTAGE', 'Stock shortage', 'SHARED', 'EXPENSE', NULL, 'Expenses', false, false, 490),
       ('STOCK_EXCESS',   'Stock excess',   'SHARED', 'INCOME',  NULL, 'Income',   false, false, 491)
ON CONFLICT (alr_role) DO NOTHING;

CREATE OR REPLACE FUNCTION accounts.fn_ledger_map_catalogue()
RETURNS TABLE (
    role_code   text,
    ledger_name text,
    ledger_type text,
    duty_head   text,
    group_name  text
)
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
        ('STOCK_EXCESS',       'Stock Excess',                  'INCOME',   NULL,             'Indirect Incomes')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';

-- ── 4. OPENING and PHYSICAL now reach the books (PERPETUAL) ────────────────
-- They keep their own numbering; the accounts voucher prints the same refno.
UPDATE accounts.acc_voucher_types
   SET vchr_affects_accounts = true
 WHERE vchr_type_code IN ('OPENING', 'Phy')
   AND vchr_affects_accounts = false;

-- ── 5. the reason a transit short is written off under ─────────────────────
INSERT INTO stock.stock_reason_master
    (srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types,
     srm_require_remarks, srm_sort_order, srm_remarks)
SELECT NULL, 'TRANSIT_LOSS', 'Lost in transit', 'OUT', ARRAY['TRANSFER_OUT']::text[], false, 115,
       'Despatched and never arrived. Cited by a transfer short-settlement; its GL ledger (or the STOCK_SHORTAGE role) takes short x cost.'
 WHERE NOT EXISTS (
        SELECT 1 FROM stock.stock_reason_master e
         WHERE e.srm_company_id IS NULL AND e.srm_code = 'TRANSIT_LOSS' AND e.srm_is_deleted = false);

-- ── 6. txn_status_log: the doc types that used to file as OTHER ────────────
ALTER TABLE public.txn_status_log DROP CONSTRAINT IF EXISTS ck_tsl_src_doc_type;
ALTER TABLE public.txn_status_log ADD CONSTRAINT ck_tsl_src_doc_type CHECK (tsl_src_doc_type::text = ANY (ARRAY[
    'QUOTATION'::text, 'SALES_ORDER'::text, 'DELIVERY_CHALLAN'::text, 'DC_RETURN'::text, 'SALE_BILL'::text,
    'SALE_RETURN'::text, 'PURCHASE_ORDER'::text, 'PURCHASE_BILL'::text, 'PURCHASE_RETURN'::text,
    'STOCK_TRANSFER'::text, 'STOCK_ADJUSTMENT'::text, 'RECEIPT'::text, 'PAYMENT'::text, 'JOURNAL'::text,
    'CHEQUE_RECEIVED'::text, 'CHEQUE_ISSUED'::text, 'OTHER'::text]));

-- DC returns (sales-stock.service / dc-return.service logged them as OTHER).
UPDATE public.txn_status_log tsl
   SET tsl_src_doc_type = 'DC_RETURN'
 WHERE tsl.tsl_src_doc_type = 'OTHER'
   AND tsl.tsl_src_module   = 'SALES'
   AND EXISTS (SELECT 1 FROM sales.sale_dc_return r WHERE r.sdr_id = tsl.tsl_src_doc_id);

-- Received cheques (cheques.utils.ts logged them as OTHER).
UPDATE public.txn_status_log tsl
   SET tsl_src_doc_type = 'CHEQUE_RECEIVED'
 WHERE tsl.tsl_src_doc_type = 'OTHER'
   AND tsl.tsl_src_module   = 'ACCOUNTS'
   AND EXISTS (SELECT 1 FROM accounts.acc_pdc_register p WHERE p.apd_id = tsl.tsl_src_doc_id);

-- ── 7. the latest-per-document scan ────────────────────────────────────────
-- GET /txn-status/pending takes DISTINCT ON (doc) ORDER BY tsl_seq_no DESC over
-- a company / branch / year; on the partitioned parent so every year has it.
CREATE INDEX IF NOT EXISTS ix_tsl_latest_per_doc
    ON public.txn_status_log
       (tsl_company_id, tsl_branch_id, tsl_acc_year, tsl_src_doc_type, tsl_src_doc_id, tsl_seq_no DESC);
