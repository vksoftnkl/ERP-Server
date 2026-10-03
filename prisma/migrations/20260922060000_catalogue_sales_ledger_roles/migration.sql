-- ═══════════════════════════════════════════════════════════════════════════
--  The four sales roles join the ledger-map catalogue
--
--  20260921220000_sales_alters_and_seeds §8 added COGS, INVENTORY,
--  LOYALTY_REDEMPTION and SCHEME_DISCOUNT to accounts.acc_ledger_role, created
--  their four global ledgers and mapped them itself -- but never added them to
--  accounts.fn_ledger_map_catalogue().
--
--  fn_seed_ledger_map() §2.3 refuses when an ACTIVE role is absent from the
--  catalogue, on the reasoning that a role with no home becomes a silent null
--  at posting time. So prisma/seed/Acc_Ledger_Map.sql -- which runs on every
--  boot -- has aborted since that migration landed:
--
--    These active roles are not in accounts.fn_ledger_map_catalogue():
--    COGS, INVENTORY, LOYALTY_REDEMPTION, SCHEME_DISCOUNT. Add them there.
--
--  The four mappings themselves survive (20260921220000 wrote them directly),
--  so nothing posts wrong today. What is lost is the re-assertion: the seed
--  stops before mapping ANY role, so a role that loses its ledger is no longer
--  repaired at boot, and a FRESH database -- where the migration's own inserts
--  find no chart of accounts to hang ledgers on -- comes up with acc_ledger_map
--  empty and every posting route 404ing.
--
--  ── The five values, taken from what 20260921220000 actually created ──────
--  Checked against the live rows rather than the plan: the ledgers exist once
--  each, globally, and already FIT their roles' alr_want_* (§2.5).
--
--    COGS               Cost of Goods Sold       EXPENSE  Direct Expenses
--    INVENTORY          Stock in Hand            (none)   Stock-in-Hand
--    LOYALTY_REDEMPTION Loyalty Points Redeemed  EXPENSE  Indirect Expenses
--    SCHEME_DISCOUNT    Scheme Discount Allowed  EXPENSE  Indirect Expenses
--
--  INVENTORY's ledger_type is NULL because the live 'Stock in Hand' ledger has
--  led_ledger_type NULL and the role leaves alr_want_type NULL to match -- it
--  constrains the NATURE (Assets) instead, the same reasoning TDS_RECEIVABLE
--  carries in 20260915120000. Writing 'GENERAL' here would not change that
--  ledger (§2.2 only fills in ledgers that do not exist yet) but would make the
--  catalogue disagree with the row on a fresh database.
--
--  The group is 'Stock-in-Hand' WITH the hyphens: §2.1 matches group names with
--  `=`, not lower(), and the global row is spelled that way.
-- ═══════════════════════════════════════════════════════════════════════════

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
        --  TDS Receivable is GENERAL and not TAX: TAX carries a duty head in
        --  this chart and this is not a GST head. The role leaves
        --  alr_want_type NULL for exactly that reason and constrains the
        --  NATURE (Assets) instead, which is the part that matters.
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
        ('SCHEME_DISCOUNT',    'Scheme Discount Allowed',       'EXPENSE', NULL, 'Indirect Expenses')
      ) AS v(role_code, ledger_name, ledger_type, duty_head, group_name);
$$;

COMMENT ON FUNCTION accounts.fn_ledger_map_catalogue() IS
    'Role -> ledger, one row per accounts.acc_ledger_role, with the shape each ledger must have if it does not exist yet. The configuration accounts.fn_seed_ledger_map() applies; edit it with CREATE OR REPLACE in a new migration.';
