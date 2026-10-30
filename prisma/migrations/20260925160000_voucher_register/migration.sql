-- ════════════════════════════════════════════════════════════════════════════
-- 20260925160000_voucher_register — the Voucher Register (one register, one posting routine)
--
-- Spec:   share/accounts/voucher_register.md  §5  (screen: voucher_register_ui_mockup_rev2.png)
-- Source: handed over as 39_voucher_register.sql, written 2026-09-25 against the live
--         schema on 192.168.0.106. Every table, column, enum value, check constraint
--         and seeded row it names was verified against that database before this file
--         was written; it was then run through `prisma migrate deploy` on a copy of it
--         (erp_dry: schema + menu / group / type / role rows) and on a schema-only copy
--         (erp_fresh) to prove the fresh-database path.
-- Runs:   once, in one transaction. Re-runnable: every step checks before it changes.
--
-- What it does, in order:
--   1. acc_voucher_header.avh_party_id  → nullable               (decision A)
--   2. rule columns + checks on acc_voucher_types                (the TYPE carries the rules)
--   3. menus: 101-104 visible, 163 renamed, 4 new menus 259-262  (decisions D + E)
--   4. five new posting roles                                     (interest, rate diff, RCM)
--   5. vtx_itc_eligibility on acc_voucher_doc_detail              (GSTR-3B table 4)
--   6. the existing 'Rev' type (20260925150000, notes 49 D3) gets its rule columns; then
--      the eight register types, group ids resolved by name (fails if a name is missing)
--
-- Where this departs from the handed-over file, and why:
--   · the four new menus carry PINNED ids 259-262. The client opens a screen by menu id,
--     and prisma/seed/Menu_Master.sql pins every id for that reason; the sequence sits
--     at 258. A name that already exists under Accounts is left alone.
--   · group names are resolved among the SHARED chart only (acc_group_company_id IS NULL,
--     compared case-insensitively — the shape of uq_acc_group_name_shared). A company may
--     lawfully own a second "Sundry Debtors" (uq_acc_group_name_company); that must not
--     make the name ambiguous here.
--   · a FRESH database has no chart and no menu tree while migrations run (db:deploy =
--     migrate deploy, THEN seeds). There, the menu inserts and step 6's eight types are
--     skipped with a NOTICE and arrive from prisma/seed/Menu_Master.sql and
--     prisma/seed/Acc_Voucher_Types_Register.sql, which run after Account_Groups.sql.
--     On a database that has a chart, a missing name still FAILS the migration.
--   · fk_vchr_menu is ON UPDATE CASCADE ON DELETE RESTRICT, like every other FK in accounts.
--
-- What it does NOT do (on purpose):
--   · no acc_voucher_seq rows — allocateVoucherNumber() (src/common/Sequence/
--     voucher-sequence.helper.ts) creates them on first use
--   · no user_menus grants — rights are granted per user from the screen
--     (and user_menus save is a FULL REPLACE — send the user's whole list)
--   · no functions, triggers or views — "no logic in the database" (notes 42);
--     the posting routine is NestJS
--   · accounts.tds_rates — specified in share/payment/plan-backend-payment.md §2.9;
--     ship it with whichever of Payment / Register goes first
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. A voucher may carry no party (Contra) or several (multi-party Journal) ──
-- avh_party_id is NOT NULL today, on the parent and all four acc_year partitions;
-- the ALTER on the parent cascades. ix_avh_party is partial and unaffected; in
-- ux_avh_doc_refno NULLs are distinct, which is right (a Contra has no supplier);
-- fk_avh_party ignores NULL.
ALTER TABLE accounts.acc_voucher_header ALTER COLUMN avh_party_id DROP NOT NULL;


-- ── 2. Rule columns on the voucher type ─────────────────────────────────────
ALTER TABLE accounts.acc_voucher_types
  ADD COLUMN IF NOT EXISTS vchr_party_mode      varchar(4)  NOT NULL DEFAULT 'NONE',  -- NONE | ONE | MANY
  ADD COLUMN IF NOT EXISTS vchr_party_side      varchar(3)  NOT NULL DEFAULT 'ANY',   -- DR | CR | ANY
  ADD COLUMN IF NOT EXISTS vchr_billwise_mode   varchar(8)  NOT NULL DEFAULT 'OFF',   -- OFF | DEMAND | RAISE | OPTIONAL
  ADD COLUMN IF NOT EXISTS vchr_raise_bill_type varchar(20),                         -- abl_bill_type a RAISE / OPTIONAL writes
  ADD COLUMN IF NOT EXISTS vchr_dr_groups       uuid[]      NOT NULL DEFAULT '{}',    -- empty = any; a SUB-group of a listed group counts
  ADD COLUMN IF NOT EXISTS vchr_cr_groups       uuid[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vchr_gst_register    varchar(10),                         -- NULL | GSTR1 | GSTR1_9B | GSTR2 | GSTR2_NOTE
  ADD COLUMN IF NOT EXISTS vchr_gst_side        varchar(6),                          -- INPUT | OUTPUT — which tax roles the band generates
  ADD COLUMN IF NOT EXISTS vchr_tds_mode        varchar(8)  NOT NULL DEFAULT 'OFF',   -- OFF | DEDUCT
  ADD COLUMN IF NOT EXISTS vchr_menu_id         integer,                             -- rights are checked on THIS menu (decision E)
  ADD COLUMN IF NOT EXISTS vchr_in_register     boolean     NOT NULL DEFAULT false;   -- offered on the register's type band

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_vchr_party_mode') THEN
    ALTER TABLE accounts.acc_voucher_types
      ADD CONSTRAINT ck_vchr_party_mode    CHECK (vchr_party_mode IN ('NONE','ONE','MANY')),
      ADD CONSTRAINT ck_vchr_party_side    CHECK (vchr_party_side IN ('DR','CR','ANY')),
      ADD CONSTRAINT ck_vchr_billwise_mode CHECK (vchr_billwise_mode IN ('OFF','DEMAND','RAISE','OPTIONAL')),
      -- RAISE must name the bill it raises; OPTIONAL may (Journal: only for a bill-by-bill party);
      -- OFF / DEMAND raise nothing
      ADD CONSTRAINT ck_vchr_raise_type    CHECK (CASE vchr_billwise_mode
                                                    WHEN 'RAISE'    THEN vchr_raise_bill_type IS NOT NULL
                                                    WHEN 'OPTIONAL' THEN true
                                                    ELSE                 vchr_raise_bill_type IS NULL END),
      -- the subset of ck_abl_bill_type a voucher can raise
      ADD CONSTRAINT ck_vchr_raise_bill    CHECK (vchr_raise_bill_type IS NULL
                                                  OR vchr_raise_bill_type IN ('SALES','PURCHASE','JOURNAL','INTEREST')),
      ADD CONSTRAINT ck_vchr_gst_register  CHECK (vchr_gst_register IS NULL
                                                  OR vchr_gst_register IN ('GSTR1','GSTR1_9B','GSTR2','GSTR2_NOTE')),
      ADD CONSTRAINT ck_vchr_gst_side      CHECK ((vchr_gst_register IS NULL) = (vchr_gst_side IS NULL)
                                                  AND (vchr_gst_side IS NULL OR vchr_gst_side IN ('INPUT','OUTPUT'))),
      ADD CONSTRAINT ck_vchr_tds_mode      CHECK (vchr_tds_mode IN ('OFF','DEDUCT')),
      ADD CONSTRAINT ck_vchr_party_billwise CHECK (vchr_party_mode <> 'NONE' OR vchr_billwise_mode = 'OFF'),
      ADD CONSTRAINT fk_vchr_menu          FOREIGN KEY (vchr_menu_id) REFERENCES fixed.menu_master(menu_id)
                                             ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;


-- ── 3. Menus: one per voucher type, plus the register ───────────────────────
-- Verbs: no AMEND (a posted voucher is corrected by cancel + re-enter);
-- OVERRIDE stays (a validate WARN is overridden, as on every posting screen).
-- On a fresh database none of these rows exist yet: the UPDATEs touch nothing,
-- the INSERT is skipped, and Menu_Master.sql carries the same answers.
UPDATE fixed.menu_master
   SET menu_visiblity   = true,
       menu_verbs       = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,OVERRIDE}',
       menu_modified_on = now()
 WHERE menu_id IN (101, 102, 103, 104);

UPDATE fixed.menu_master
   SET menu_name        = CASE WHEN menu_name = 'GST Expenses' THEN 'Purchase (Accounting)' ELSE menu_name END,
       menu_visiblity   = true,
       menu_verbs       = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,OVERRIDE}',
       menu_modified_on = now()
 WHERE menu_id = 163;                               -- was "GST Expenses": this IS that form

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator, menu_verbs)
SELECT v.id, 5, v.name, true, v.pos, true, false,
       '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT,POST,CANCEL,OVERRIDE}'::text[]
  FROM (VALUES (259, 'Sales (Accounting)', 11.10),
               (260, 'Receipt Voucher',    11.20),  -- the accountant's free-leg receipt; menu 99 "Receipt" stays the bill-wise screen
               (261, 'Payment Voucher',    11.30),
               (262, 'Voucher Register',   11.40)) AS v(id, name, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = 5)                    -- no tree yet = fresh database
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_parent = 5 AND m.menu_name = v.name)
ON CONFLICT (menu_id) DO NOTHING;
-- "Voucher Register" grants nothing by itself: opening it needs its VIEW; every
-- action is judged on the voucher TYPE's menu (vchr_menu_id).

-- Keep the serial ahead of the pinned ids. Menu_Master.sql does the same at its
-- end, but the seeds never run on live.
DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('fixed.menu_master', 'menu_id'),
                 (SELECT GREATEST(COALESCE(MAX(menu_id), 0), 1) FROM fixed.menu_master), true);
END $$;


-- ── 4. Posting roles the register's common legs need ────────────────────────
-- Already live: INTEREST_INCOME, BANK_CHARGES, DISCOUNT_ALLOWED, WRITE_OFF, ROUND_OFF,
-- TDS_PAYABLE, INPUT_* / OUTPUT_*. Each company maps these in the ledger-map screen (menu 250).
-- Values sit inside ck_alr_group / ck_alr_duty / ck_alr_nature.
INSERT INTO accounts.acc_ledger_role
       (alr_role, alr_label, alr_group, alr_want_type, alr_want_duty, alr_want_nature, alr_by_supply, alr_by_rate, alr_sort_order)
VALUES ('INTEREST_PAID',    'Interest paid',     'SHARED',   'EXPENSE',  NULL,             'Expenses',    false, false, 470),
       ('RATE_DIFFERENCE',  'Rate difference',   'SHARED',   'DISCOUNT', NULL,             'Expenses',    false, false, 480),
       ('RCM_CGST_PAYABLE', 'RCM CGST payable',  'PURCHASE', 'TAX',      'Central Tax',    'Liabilities', false, true,  160),
       ('RCM_SGST_PAYABLE', 'RCM SGST payable',  'PURCHASE', 'TAX',      'State Tax',      'Liabilities', false, true,  161),
       ('RCM_IGST_PAYABLE', 'RCM IGST payable',  'PURCHASE', 'TAX',      'Integrated Tax', 'Liabilities', false, true,  162)
ON CONFLICT (alr_role) DO NOTHING;


-- ── 5. ITC eligibility per GST line (GSTR-3B table 4) ────────────────────────
-- Defaults (in the service) from the expense ledger's led_itc_eligibility — whose
-- vocabulary is the ledger's (ELIGIBLE, INELIGIBLE_17_5, INELIGIBLE_OTHER,
-- CAPITAL_GOODS, INPUT_SERVICES), so the service maps it onto table 4's —
-- changeable per line. On the partitioned parent, so every acc_year partition gets it.
ALTER TABLE accounts.acc_voucher_doc_detail
  ADD COLUMN IF NOT EXISTS vtx_itc_eligibility varchar(16);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_vtx_itc') THEN
    ALTER TABLE accounts.acc_voucher_doc_detail
      ADD CONSTRAINT ck_vtx_itc CHECK (vtx_itc_eligibility IS NULL
             OR vtx_itc_eligibility IN ('INPUTS','INPUT_SERVICES','CAPITAL_GOODS','INELIGIBLE'));
  END IF;
END $$;


-- ── 6. Rev, then the eight register types ────────────────────────────────────
-- Groups are stored as ids (names are editable) and resolved here by name.
-- A name that does not resolve must FAIL the migration — an empty array would
-- silently mean "any group".
-- The same block, minus Rev and the fresh-database exit, is
-- prisma/seed/Acc_Voucher_Types_Register.sql; keep the two in step by hand.
DO $$
DECLARE
  -- the account groups each type may debit / credit, by name
  l_money   text[] := ARRAY['Cash-in-Hand','Bank Accounts','Bank OD A/c'];
  l_cash    text[] := ARRAY['Cash-in-Hand','Bank Accounts'];
  l_income  text[] := ARRAY['Direct Incomes','Indirect Incomes','Sales Accounts','Duties & Taxes'];
  l_cn_dr   text[] := ARRAY['Direct Incomes','Indirect Incomes','Sales Accounts',
                            'Direct Expenses','Indirect Expenses','Duties & Taxes'];
  l_pur_dr  text[] := ARRAY['Direct Expenses','Indirect Expenses','Purchase Accounts','Fixed Assets','Duties & Taxes'];
  l_pur_cr  text[] := ARRAY['Sundry Creditors','Duties & Taxes'];
  l_debtors text[] := ARRAY['Sundry Debtors'];
  g_money uuid[]; g_cash uuid[]; g_income uuid[]; g_cn_dr uuid[]; g_pur_dr uuid[]; g_pur_cr uuid[]; g_debtors uuid[];
  -- menus: five pinned by Menu_Master.sql, three added in step 3 (resolved by name below)
  m_dn int := 101; m_cn int := 102; m_jrl int := 103; m_con int := 104; m_pur int := 163;
  m_sal int; m_rcv int; m_pmv int;
  n text; c int;
BEGIN
  -- The cancel reversal 'Rev' ALREADY EXISTS: migration 20260925150000_reversal_voucher_type
  -- (notes 49, D3) — every reversal gets its own series rev00001… instead of burning a
  -- number in the original's. The register reuses it; here it only gains its rule
  -- columns. Rights on a cancel stay the ORIGINAL type's menu, so vchr_menu_id stays
  -- NULL, and it is never offered on the band. Being a migration's row, it is present
  -- on a fresh database too, so this runs before the fresh-database exit.
  IF NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Rev') THEN
    RAISE EXCEPTION '20260925160000_voucher_register: voucher type Rev is missing — apply prisma migration 20260925150000_reversal_voucher_type first';
  END IF;
  UPDATE accounts.acc_voucher_types
     SET vchr_party_mode = 'MANY', vchr_party_side = 'ANY', vchr_billwise_mode = 'OFF',
         vchr_raise_bill_type = NULL, vchr_in_register = false, vchr_menu_id = NULL,
         vchr_updated_on = now(), vchr_updated_by = '20260925160000_voucher_register'
   WHERE vchr_type_code = 'Rev';

  -- A fresh database: migrations run before seeds, so there is no chart and no menu
  -- tree yet. Acc_Voucher_Types_Register.sql inserts the eight types once there is.
  IF NOT EXISTS (SELECT 1 FROM accounts.acc_group_master
                  WHERE acc_group_company_id IS NULL AND acc_group_is_deleted = false)
     OR NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 5) THEN
    RAISE NOTICE '20260925160000_voucher_register: no chart of accounts / menu tree yet (fresh database) — the eight register types will come from prisma/seed/Acc_Voucher_Types_Register.sql';
    RETURN;
  END IF;

  -- the shared chart, keyed by lower-cased name (the shape of uq_acc_group_name_shared);
  -- a company's own group of the same name (uq_acc_group_name_company) is not this
  CREATE TEMP TABLE _grp ON COMMIT DROP AS
    SELECT lower(acc_group_name) AS key, acc_group_name AS name, acc_group_id AS id
      FROM accounts.acc_group_master
     WHERE acc_group_company_id IS NULL
       AND acc_group_is_deleted = false;

  -- every name used below must exist exactly once
  FOREACH n IN ARRAY l_money || l_cash || l_income || l_cn_dr || l_pur_dr || l_pur_cr || l_debtors LOOP
    SELECT count(*) INTO c FROM _grp WHERE key = lower(n);
    IF c <> 1 THEN
      RAISE EXCEPTION '20260925160000_voucher_register: account group "%" found % time(s) in the shared chart — expected exactly 1', n, c;
    END IF;
  END LOOP;

  SELECT array_agg(g.id ORDER BY g.name) INTO g_money   FROM _grp g JOIN unnest(l_money)   w(name) ON g.key = lower(w.name);
  SELECT array_agg(g.id ORDER BY g.name) INTO g_cash    FROM _grp g JOIN unnest(l_cash)    w(name) ON g.key = lower(w.name);
  SELECT array_agg(g.id ORDER BY g.name) INTO g_income  FROM _grp g JOIN unnest(l_income)  w(name) ON g.key = lower(w.name);
  SELECT array_agg(g.id ORDER BY g.name) INTO g_cn_dr   FROM _grp g JOIN unnest(l_cn_dr)   w(name) ON g.key = lower(w.name);
  SELECT array_agg(g.id ORDER BY g.name) INTO g_pur_dr  FROM _grp g JOIN unnest(l_pur_dr)  w(name) ON g.key = lower(w.name);
  SELECT array_agg(g.id ORDER BY g.name) INTO g_pur_cr  FROM _grp g JOIN unnest(l_pur_cr)  w(name) ON g.key = lower(w.name);
  SELECT array_agg(g.id ORDER BY g.name) INTO g_debtors FROM _grp g JOIN unnest(l_debtors) w(name) ON g.key = lower(w.name);

  -- menus: the three new ones by name under Accounts (5), the five old ones by id
  SELECT menu_id INTO m_sal FROM fixed.menu_master WHERE menu_parent = 5 AND menu_name = 'Sales (Accounting)';
  SELECT menu_id INTO m_rcv FROM fixed.menu_master WHERE menu_parent = 5 AND menu_name = 'Receipt Voucher';
  SELECT menu_id INTO m_pmv FROM fixed.menu_master WHERE menu_parent = 5 AND menu_name = 'Payment Voucher';
  IF m_sal IS NULL OR m_rcv IS NULL OR m_pmv IS NULL THEN
    RAISE EXCEPTION '20260925160000_voucher_register: a new Accounts menu (Sales (Accounting) / Receipt Voucher / Payment Voucher, ids 259-261) is missing — is one of those ids already taken?';
  END IF;
  IF (SELECT count(*) FROM fixed.menu_master WHERE menu_id IN (m_dn, m_cn, m_jrl, m_con, m_pur)) <> 5 THEN
    RAISE EXCEPTION '20260925160000_voucher_register: one of menus 101-104 / 163 is missing — run prisma/seed/Menu_Master.sql first';
  END IF;

  -- keep the serial ahead of any pinned id (the seeds do this too, but never run on live)
  PERFORM setval(pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
                 (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types), true);

  INSERT INTO accounts.acc_voucher_types
        (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature,
         vchr_numbering_mode, vchr_no_prefix, vchr_no_width, vchr_reset_freq,
         vchr_affects_accounts, vchr_affects_inventory, vchr_print_title, vchr_sort_order,
         vchr_party_mode, vchr_party_side, vchr_billwise_mode, vchr_raise_bill_type,
         vchr_dr_groups, vchr_cr_groups, vchr_gst_register, vchr_gst_side, vchr_tds_mode,
         vchr_menu_id, vchr_in_register, vchr_created_by)
  VALUES
   ('Jrl',  'Journal',               'Jrl',  'ACCOUNTING', 'JOURNAL',     'AUTO', 'jrl', 5, 'YEARLY', true, false, 'Journal Voucher', 30,
            'MANY', 'ANY', 'OPTIONAL', 'JOURNAL',  '{}',      '{}',      NULL,       NULL,     'OFF',    m_jrl, true,  '20260925160000_voucher_register'),
   ('Con',  'Contra',                'Con',  'ACCOUNTING', 'CONTRA',      'AUTO', 'con', 5, 'YEARLY', true, false, 'Contra Voucher',  31,
            'NONE', 'ANY', 'OFF',      NULL,       g_money,   g_money,   NULL,       NULL,     'OFF',    m_con, true,  '20260925160000_voucher_register'),
   ('DrN',  'Debit Note',            'DrN',  'ACCOUNTING', 'DEBIT_NOTE',  'AUTO', 'drn', 5, 'YEARLY', true, false, 'Debit Note',      32,
            'ONE',  'DR',  'RAISE',    'JOURNAL',  '{}',      g_income,  'GSTR1_9B', 'OUTPUT', 'OFF',    m_dn,  true,  '20260925160000_voucher_register'),
   ('CrN',  'Credit Note',           'CrN',  'ACCOUNTING', 'CREDIT_NOTE', 'AUTO', 'crn', 5, 'YEARLY', true, false, 'Credit Note',     33,
            'ONE',  'CR',  'RAISE',    'JOURNAL',  g_cn_dr,   '{}',      'GSTR1_9B', 'OUTPUT', 'OFF',    m_cn,  true,  '20260925160000_voucher_register'),
   ('PurA', 'Purchase (Accounting)', 'PurA', 'ACCOUNTING', 'PURCHASE',    'AUTO', 'pua', 5, 'YEARLY', true, false, 'Purchase Voucher',34,
            'ONE',  'CR',  'RAISE',    'PURCHASE', g_pur_dr,  g_pur_cr,  'GSTR2',    'INPUT',  'DEDUCT', m_pur, true,  '20260925160000_voucher_register'),
   ('SalA', 'Sales (Accounting)',    'SalA', 'ACCOUNTING', 'SALES',       'AUTO', 'saa', 5, 'YEARLY', true, false, 'Sales Voucher',   35,
            'ONE',  'DR',  'RAISE',    'SALES',    g_debtors, g_income,  'GSTR1',    'OUTPUT', 'OFF',    m_sal, true,  '20260925160000_voucher_register'),
   ('RcpV', 'Receipt Voucher',       'RcpV', 'ACCOUNTING', 'RECEIPT',     'AUTO', 'rcv', 5, 'YEARLY', true, false, 'Receipt Voucher', 36,
            'ONE',  'CR',  'DEMAND',   NULL,       g_cash,    '{}',      NULL,       NULL,     'OFF',    m_rcv, true,  '20260925160000_voucher_register'),
   ('PmtV', 'Payment Voucher',       'PmtV', 'ACCOUNTING', 'PAYMENT',     'AUTO', 'pmv', 5, 'YEARLY', true, false, 'Payment Voucher', 37,
            'ONE',  'DR',  'DEMAND',   NULL,       '{}',      g_cash,    NULL,       NULL,     'DEDUCT', m_pmv, true,  '20260925160000_voucher_register')
  ON CONFLICT (vchr_type_code) DO NOTHING;
END $$;

COMMIT;

-- ── After running: a quick look ──────────────────────────────────────────────
-- SELECT vchr_type_id, vchr_type_code, vchr_party_mode, vchr_party_side, vchr_billwise_mode, vchr_raise_bill_type,
--        cardinality(vchr_dr_groups) dr, cardinality(vchr_cr_groups) cr, vchr_gst_register, vchr_gst_side, vchr_tds_mode,
--        vchr_menu_id, vchr_in_register
--   FROM accounts.acc_voucher_types WHERE vchr_in_register OR vchr_type_code = 'Rev' ORDER BY vchr_sort_order;
-- SELECT menu_id, menu_name, menu_visiblity, menu_verbs FROM fixed.menu_master WHERE menu_parent = 5 ORDER BY menu_position, menu_id;
