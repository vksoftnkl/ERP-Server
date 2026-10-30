-- ═══════════════════════════════════════════════════════════════════════════
--  accounts.acc_ledger_role  —  the posting-role catalogue
--
--  Runs FIRST. The tax rate master's guard and acc_ledger_map's guard both
--  reference it, and the validator that reads it ships in the migration that
--  follows this one (20260911071000_add_fn_check_role_ledger).
--
--  ── Why this exists ──────────────────────────────────────────────────────
--  "SALES needs an INCOME ledger under an Income group" was written three
--  times in this schema: once in acc_ledger_map's guard, once in the tax
--  master's guard, and once as a CHECK listing role names. Three copies of one
--  fact drift. This is the single copy.
--
--  It also turns two CHECK constraints into foreign keys, so adding a role —
--  TCS, composition, an RCM variant — is ONE insert here instead of an ALTER
--  on every table that lists roles.
--
--  The UI reads it too: the Posting Ledgers screen builds its own layout from
--  alr_group / alr_sort_order rather than hard-coding twenty labels.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accounts.acc_ledger_role
(
    alr_role        varchar(30)  NOT NULL,
    alr_label       varchar(60)  NOT NULL,   -- what the screen shows
    alr_group       varchar(20)  NOT NULL,   -- how the screen groups it

    -- ── What kind of ledger this role may take ───────────────────────────
    -- NULL means "not checked on this axis".
    alr_want_type   varchar(20),             -- led_ledger_type
    alr_want_duty   varchar(20),             -- led_gst_duty_head
    alr_want_nature varchar(20),             -- acc_group_nature

    -- ── Which dimensions this role may be varied along ───────────────────
    -- by_supply: may carry INTRA / INTER. Only the revenue and purchase roles
    --   can — CGST and SGST exist only on an intra-state sale and IGST only on
    --   an inter-state one, so a tax role already says the nature by which one
    --   is used, and a row narrowing it further could never be the best match.
    -- by_rate:   may be overridden per GST rate in inventory.tax_rate_ledger.
    --   Round-off, discount, write-off and advances cannot — they have nothing
    --   to do with a rate, so acc_ledger_map is their only home.
    alr_by_supply   boolean      NOT NULL DEFAULT false,
    alr_by_rate     boolean      NOT NULL DEFAULT false,

    alr_sort_order  smallint     NOT NULL DEFAULT 0,
    alr_is_active   boolean      NOT NULL DEFAULT true,
    alr_remarks     varchar(250),

    CONSTRAINT pk_acc_ledger_role PRIMARY KEY (alr_role),
    CONSTRAINT ck_alr_group CHECK (alr_group IN
        ('REVENUE','OUTPUT_TAX','PURCHASE','INPUT_TAX','SHARED','FUTURE')),
    CONSTRAINT ck_alr_duty CHECK (
        alr_want_duty IS NULL OR alr_want_duty IN
        ('Central Tax','State Tax','Integrated Tax','Cess','State Cess')),
    CONSTRAINT ck_alr_nature CHECK (
        alr_want_nature IS NULL OR alr_want_nature IN
        ('Assets','Liabilities','Income','Expenses'))
);

ALTER TABLE IF EXISTS accounts.acc_ledger_role OWNER to postgres;

COMMENT ON TABLE accounts.acc_ledger_role IS
    'Every posting role, what kind of ledger it may take, and which dimensions it may be varied along. The single definition that acc_ledger_map and inventory.tax_rate_ledger both validate against.';

INSERT INTO accounts.acc_ledger_role
    (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty, alr_want_nature,
     alr_by_supply, alr_by_rate, alr_sort_order)
VALUES
  -- ── Revenue: varies by rate AND by supply nature ──────────────────────
  ('SALES',           'Sales',            'REVENUE','INCOME', NULL,            'Income',   true,  true,  10),
  ('SALES_RETURN',    'Sales return',     'REVENUE','INCOME', NULL,            'Income',   true,  true,  20),

  -- ── Output tax: varies by rate only ───────────────────────────────────
  ('OUTPUT_CGST',     'Output CGST',      'OUTPUT_TAX','TAX','Central Tax',    NULL,       false, true,  30),
  ('OUTPUT_SGST',     'Output SGST',      'OUTPUT_TAX','TAX','State Tax',      NULL,       false, true,  40),
  ('OUTPUT_IGST',     'Output IGST',      'OUTPUT_TAX','TAX','Integrated Tax', NULL,       false, true,  50),
  ('OUTPUT_CESS',     'Output Cess',      'OUTPUT_TAX','TAX','Cess',           NULL,       false, true,  60),
  ('OUTPUT_ACESS',    'Output State Cess','OUTPUT_TAX','TAX','State Cess',     NULL,       false, true,  70),

  ('PURCHASE',        'Purchase',         'PURCHASE','EXPENSE',NULL,           'Expenses', true,  true, 110),
  ('PURCHASE_RETURN', 'Purchase return',  'PURCHASE','EXPENSE',NULL,           'Expenses', true,  true, 120),

  ('INPUT_CGST',      'Input CGST',       'INPUT_TAX','TAX','Central Tax',     NULL,       false, true, 130),
  ('INPUT_SGST',      'Input SGST',       'INPUT_TAX','TAX','State Tax',       NULL,       false, true, 140),
  ('INPUT_IGST',      'Input IGST',       'INPUT_TAX','TAX','Integrated Tax',  NULL,       false, true, 150),
  ('INPUT_CESS',      'Input Cess',       'INPUT_TAX','TAX','Cess',            NULL,       false, true, 160),
  ('INPUT_ACESS',     'Input State Cess', 'INPUT_TAX','TAX','State Cess',      NULL,       false, true, 170),

  -- ── Shared: one answer for the business, never per rate ───────────────
  ('ROUND_OFF',       'Round off',        'SHARED','ROUNDOFF',NULL,            NULL,       false, false, 210),
  ('DISCOUNT_ALLOWED','Discount allowed', 'SHARED','DISCOUNT',NULL,            NULL,       false, false, 220),
  ('WRITE_OFF',       'Write off',        'SHARED','EXPENSE', NULL,            'Expenses', false, false, 230),
  ('ADVANCE_RECEIVED','Advance received', 'SHARED', NULL,     NULL,            'Liabilities', false, false, 240),

  -- ── Allowed, but nothing posts to them yet ────────────────────────────
  ('TCS_PAYABLE',     'TCS payable',      'FUTURE','TAX',     NULL,            NULL,       false, false, 310),
  ('TDS_PAYABLE',     'TDS payable',      'FUTURE','TAX',     NULL,            NULL,       false, false, 320)
ON CONFLICT (alr_role) DO NOTHING;
