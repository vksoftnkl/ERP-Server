-- Seed: accounts.acc_voucher_types -- the eight Voucher Register types, for a FRESH database.
--
-- Migration 20260925160000_voucher_register inserts these same eight rows on every
-- database that already has a chart of accounts and a menu tree. It resolves the account
-- groups a type may debit / credit BY NAME (vchr_dr_groups / vchr_cr_groups store ids;
-- names are editable) and points vchr_menu_id at the Accounts menus. On a FRESH database
-- the migration finds neither -- migrations run before seeds (db:deploy) -- and skips
-- them with a NOTICE. This file is the other half: it runs after Menu_Master.sql (menus
-- 101-104, 163, 259-262) and Account_Groups.sql (the reserved chart), and inserts
-- whichever of the eight are still missing.
--
-- Same rules as the migration, kept in step by hand. A group name that does not resolve
-- exactly once in the SHARED chart (acc_group_company_id IS NULL, compared case-
-- insensitively as uq_acc_group_name_shared does) FAILS the seed rather than storing an
-- empty array, because an empty array means "any group".
--
-- The cancel reversal 'Rev' is not here: 20260925150000 creates it and 20260925160000
-- sets its rules, and both run on every database, fresh or not.
--
-- Idempotent: returns at once when all eight codes exist (the normal case, once the
-- migration has run); otherwise ON CONFLICT (vchr_type_code) DO NOTHING, so a type
-- already present keeps its locally edited rules.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Acc_Voucher_Types_Register.sql
--      or: npm run seed:run -- --only=Acc_Voucher_Types_Register.sql

BEGIN;

DO $$
DECLARE
  codes     text[] := ARRAY['Jrl','Con','DrN','CrN','PurA','SalA','RcpV','PmtV'];
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
  -- menus: five pinned by Menu_Master.sql, three resolved by name below (259-261 there)
  m_dn int := 101; m_cn int := 102; m_jrl int := 103; m_con int := 104; m_pur int := 163;
  m_sal int; m_rcv int; m_pmv int;
  n text; c int;
BEGIN
  -- the normal case: the migration already put them here
  IF (SELECT count(*) FROM accounts.acc_voucher_types WHERE vchr_type_code = ANY (codes)) = cardinality(codes) THEN
    RETURN;
  END IF;

  -- the shared chart, keyed by lower-cased name
  CREATE TEMP TABLE _grp ON COMMIT DROP AS
    SELECT lower(acc_group_name) AS key, acc_group_name AS name, acc_group_id AS id
      FROM accounts.acc_group_master
     WHERE acc_group_company_id IS NULL
       AND acc_group_is_deleted = false;

  -- every name used below must exist exactly once
  FOREACH n IN ARRAY l_money || l_cash || l_income || l_cn_dr || l_pur_dr || l_pur_cr || l_debtors LOOP
    SELECT count(*) INTO c FROM _grp WHERE key = lower(n);
    IF c <> 1 THEN
      RAISE EXCEPTION 'Acc_Voucher_Types_Register.sql: account group "%" found % time(s) in the shared chart — expected exactly 1 (run Account_Groups.sql first)', n, c;
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
  IF m_sal IS NULL OR m_rcv IS NULL OR m_pmv IS NULL
     OR (SELECT count(*) FROM fixed.menu_master WHERE menu_id IN (m_dn, m_cn, m_jrl, m_con, m_pur)) <> 5 THEN
    RAISE EXCEPTION 'Acc_Voucher_Types_Register.sql: an Accounts menu the register types point at is missing (101-104, 163, 259-261) — run Menu_Master.sql first';
  END IF;

  INSERT INTO accounts.acc_voucher_types
        (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature,
         vchr_numbering_mode, vchr_no_prefix, vchr_no_width, vchr_reset_freq,
         vchr_affects_accounts, vchr_affects_inventory, vchr_print_title, vchr_sort_order,
         vchr_party_mode, vchr_party_side, vchr_billwise_mode, vchr_raise_bill_type,
         vchr_dr_groups, vchr_cr_groups, vchr_gst_register, vchr_gst_side, vchr_tds_mode,
         vchr_menu_id, vchr_in_register, vchr_created_by)
  VALUES
   ('Jrl',  'Journal',               'Jrl',  'ACCOUNTING', 'JOURNAL',     'AUTO', 'jrl', 5, 'YEARLY', true, false, 'Journal Voucher', 30,
            'MANY', 'ANY', 'OPTIONAL', 'JOURNAL',  '{}',      '{}',      NULL,       NULL,     'OFF',    m_jrl, true,  'system'),
   ('Con',  'Contra',                'Con',  'ACCOUNTING', 'CONTRA',      'AUTO', 'con', 5, 'YEARLY', true, false, 'Contra Voucher',  31,
            'NONE', 'ANY', 'OFF',      NULL,       g_money,   g_money,   NULL,       NULL,     'OFF',    m_con, true,  'system'),
   ('DrN',  'Debit Note',            'DrN',  'ACCOUNTING', 'DEBIT_NOTE',  'AUTO', 'drn', 5, 'YEARLY', true, false, 'Debit Note',      32,
            'ONE',  'DR',  'RAISE',    'JOURNAL',  '{}',      g_income,  'GSTR1_9B', 'OUTPUT', 'OFF',    m_dn,  true,  'system'),
   ('CrN',  'Credit Note',           'CrN',  'ACCOUNTING', 'CREDIT_NOTE', 'AUTO', 'crn', 5, 'YEARLY', true, false, 'Credit Note',     33,
            'ONE',  'CR',  'RAISE',    'JOURNAL',  g_cn_dr,   '{}',      'GSTR1_9B', 'OUTPUT', 'OFF',    m_cn,  true,  'system'),
   ('PurA', 'Purchase (Accounting)', 'PurA', 'ACCOUNTING', 'PURCHASE',    'AUTO', 'pua', 5, 'YEARLY', true, false, 'Purchase Voucher',34,
            'ONE',  'CR',  'RAISE',    'PURCHASE', g_pur_dr,  g_pur_cr,  'GSTR2',    'INPUT',  'DEDUCT', m_pur, true,  'system'),
   ('SalA', 'Sales (Accounting)',    'SalA', 'ACCOUNTING', 'SALES',       'AUTO', 'saa', 5, 'YEARLY', true, false, 'Sales Voucher',   35,
            'ONE',  'DR',  'RAISE',    'SALES',    g_debtors, g_income,  'GSTR1',    'OUTPUT', 'OFF',    m_sal, true,  'system'),
   ('RcpV', 'Receipt Voucher',       'RcpV', 'ACCOUNTING', 'RECEIPT',     'AUTO', 'rcv', 5, 'YEARLY', true, false, 'Receipt Voucher', 36,
            'ONE',  'CR',  'DEMAND',   NULL,       g_cash,    '{}',      NULL,       NULL,     'OFF',    m_rcv, true,  'system'),
   ('PmtV', 'Payment Voucher',       'PmtV', 'ACCOUNTING', 'PAYMENT',     'AUTO', 'pmv', 5, 'YEARLY', true, false, 'Payment Voucher', 37,
            'ONE',  'DR',  'DEMAND',   NULL,       '{}',      g_cash,    NULL,       NULL,     'DEDUCT', m_pmv, true,  'system')
  ON CONFLICT (vchr_type_code) DO NOTHING;
END $$;

-- Keep the identity sequence ahead of every id, as Acc_Voucher_Types.sql does.
SELECT setval(
    pg_get_serial_sequence('accounts.acc_voucher_types', 'vchr_type_id'),
    (SELECT GREATEST(COALESCE(MAX(vchr_type_id), 0), 1) FROM accounts.acc_voucher_types),
    true
);

COMMIT;
