-- Seed: accounts.acc_group_master -- the reserved chart of accounts (30 rows).
--
-- Only rows flagged acc_group_is_reserved are exported: the Tally-style default tree
-- (Capital Account, Current Assets, Sundry Debtors, ...) plus the two groups the
-- application addresses BY A HARDCODED ID:
--
--   Customers  019f081c-6764-73b0-b397-3f30a6efe73e  STATES_ACCOUNT_GROUP_ID
--       (src/modules/sales/state/utils/state.utils.ts, and the same constant copied
--        into city.service.ts and area.service.ts) -- state / city / area each mirror
--        themselves into an account group under it, so creating a state 400s with
--        "Parent account group does not exist" wherever this row is missing.
--   Suppliers  019f081c-98cc-757a-9346-4cfba810c47f  SUPPLIER_LINKED_LEDGER_GROUP_ID
--       (src/modules/purchase/suppliers/suppliers.service.ts) -- every supplier ledger
--       is created under it.
--
-- That is why the ids are written out rather than left to uuidv7(): they are compiled
-- into the server, so the same uuid has to mean the same group in every environment.
-- Groups a site creates for itself are NOT reserved and are not exported.
--
-- acc_group_parent_id is self-referential. The rows go in as ONE statement, so
-- PostgreSQL checks the foreign key once at the end of it and a child may sit beside
-- its parent in the same VALUES list; they are ordered parent-first for readability.
--
-- Columns deliberately not seeded:
--   * acc_group_company_id  -- a foreign key to companys, per-environment;
--   * acc_group_child_ids   -- denormalized LEDGER ids under the group, maintained by
--     AccountsGroupService as ledgers are created, so it starts empty;
--   * acc_group_tally_guid / _master_id / _alter_id -- filled by a Tally sync, and the
--     guid carries a unique index.
--
-- acc_ledger_profile (General / Party / Bank / Cash / Tax / SalesPurchase) and
-- acc_group_nature are what the mirroring services inherit from the parent, so they
-- matter as much as the ids do.
--
-- Idempotent: ON CONFLICT (acc_group_id) DO NOTHING -- a group already present keeps
-- its locally edited name, sort and flags. There is no unique index on the name, so a
-- database where someone hand-built the same tree under different ids would end up
-- with both; check before running it there.
-- Regenerate with: npm run seed:export:masters
-- Run: psql "$DATABASE_URL" -f prisma/seed/Account_Groups.sql
--      or: npm run seed:run -- --only=Account_Groups.sql

BEGIN;

INSERT INTO accounts.acc_group_master
    (acc_group_id, acc_group_name, acc_group_alias, acc_group_short, acc_group_tally_name, acc_group_primary_name, acc_group_nature, acc_group_parent_id, acc_group_sort, acc_group_child_ids, acc_group_type, acc_ledger_profile, acc_group_is_default, acc_group_is_reserved, acc_group_behave_as_subledger, acc_group_net_debit_credit, acc_group_used_for_calculation, acc_group_affects_gross_profit, acc_group_is_active, acc_group_is_deleted, acc_group_created_by, acc_group_modified_by)
VALUES
     ('019eee86-f34b-7adf-8432-7f089663ac61'::uuid, 'Capital Account'::varchar, NULL::varchar, NULL::varchar, 'Capital Account'::varchar, 'Capital Account'::varchar, 'Liabilities'::varchar, NULL::uuid, 10::integer, '{}'::uuid[], 'BALANCESHEET'::varchar, 'General'::varchar, true::boolean, true::boolean, false::boolean, false::boolean, false::boolean, false::boolean, true::boolean, false::boolean, 'system'::varchar, 'system'::varchar)
    ,('019eee86-f34b-7ca1-b026-b18679e20cc7', 'Reserves & Surplus'      , 'Retained Earnings'  , NULL, 'Reserves & Surplus'      , 'Capital Account'       , 'Liabilities', '019eee86-f34b-7adf-8432-7f089663ac61', 11 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d12-8a08-d26d00327afe', 'Loans (Liability)'       , NULL                 , NULL, 'Loans (Liability)'       , 'Loans (Liability)'     , 'Liabilities', NULL, 20 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d50-af11-254d259a8440', 'Bank OD A/c'             , 'Bank OCC A/c'       , NULL, 'Bank OD A/c'             , 'Loans (Liability)'     , 'Liabilities', '019eee86-f34b-7d12-8a08-d26d00327afe', 21 , '{}', 'BALANCESHEET' , 'Bank'         , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d41-95f9-b39af50f2be9', 'Secured Loans'           , NULL                 , NULL, 'Secured Loans'           , 'Loans (Liability)'     , 'Liabilities', '019eee86-f34b-7d12-8a08-d26d00327afe', 22 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d2e-afc1-8549e81af0e2', 'Unsecured Loans'         , NULL                 , NULL, 'Unsecured Loans'         , 'Loans (Liability)'     , 'Liabilities', '019eee86-f34b-7d12-8a08-d26d00327afe', 23 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d61-a4a0-ad226e30557b', 'Current Liabilities'     , NULL                 , NULL, 'Current Liabilities'     , 'Current Liabilities'   , 'Liabilities', NULL, 30 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d92-bd27-71398afb4e7d', 'Duties & Taxes'          , NULL                 , NULL, 'Duties & Taxes'          , 'Current Liabilities'   , 'Liabilities', '019eee86-f34b-7d61-a4a0-ad226e30557b', 31 , '{}', 'BALANCESHEET' , 'Tax'          , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d82-aaf0-74869f0e7ece', 'Provisions'              , NULL                 , NULL, 'Provisions'              , 'Current Liabilities'   , 'Liabilities', '019eee86-f34b-7d61-a4a0-ad226e30557b', 32 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7d73-8a79-f5c6f036439a', 'Sundry Creditors'        , NULL                 , NULL, 'Sundry Creditors'        , 'Current Liabilities'   , 'Liabilities', '019eee86-f34b-7d61-a4a0-ad226e30557b', 33 , '{}', 'BALANCESHEET' , 'Party'        , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019f081c-98cc-757a-9346-4cfba810c47f', 'Suppliers'               , NULL                 , NULL, NULL                      , NULL                    , 'Liabilities', '019eee86-f34b-7d73-8a79-f5c6f036439a', 0  , '{}', 'BALANCESHEET' , 'Party'        , false, true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7da8-b046-6f834dbe8a53', 'Fixed Assets'            , NULL                 , NULL, 'Fixed Assets'            , 'Fixed Assets'          , 'Assets'     , NULL, 40 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7dba-8e1e-5437bdcaa251', 'Investments'             , NULL                 , NULL, 'Investments'             , 'Investments'           , 'Assets'     , NULL, 50 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7dcc-8789-214f1ffa3929', 'Current Assets'          , NULL                 , NULL, 'Current Assets'          , 'Current Assets'        , 'Assets'     , NULL, 60 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e27-8aee-2b5930314c8a', 'Bank Accounts'           , NULL                 , NULL, 'Bank Accounts'           , 'Current Assets'        , 'Assets'     , '019eee86-f34b-7dcc-8789-214f1ffa3929', 61 , '{}', 'BALANCESHEET' , 'Bank'         , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e18-9d7c-5bea4d593ba8', 'Cash-in-Hand'            , NULL                 , NULL, 'Cash-in-Hand'            , 'Current Assets'        , 'Assets'     , '019eee86-f34b-7dcc-8789-214f1ffa3929', 62 , '{}', 'BALANCESHEET' , 'Cash'         , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e0a-a418-c45ed9b8a3a5', 'Deposits (Asset)'        , NULL                 , NULL, 'Deposits (Asset)'        , 'Current Assets'        , 'Assets'     , '019eee86-f34b-7dcc-8789-214f1ffa3929', 63 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7dfa-bcb2-8d147f424674', 'Loans & Advances (Asset)', NULL                 , NULL, 'Loans & Advances (Asset)', 'Current Assets'        , 'Assets'     , '019eee86-f34b-7dcc-8789-214f1ffa3929', 64 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7deb-bda9-7a64d8e825d2', 'Stock-in-Hand'           , NULL                 , NULL, 'Stock-in-Hand'           , 'Current Assets'        , 'Assets'     , '019eee86-f34b-7dcc-8789-214f1ffa3929', 65 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, true , true, false, 'system', 'system')
    ,('019eee86-f34b-7ddc-91e2-efca49e5e8e8', 'Sundry Debtors'          , NULL                 , NULL, 'Sundry Debtors'          , 'Current Assets'        , 'Assets'     , '019eee86-f34b-7dcc-8789-214f1ffa3929', 66 , '{}', 'BALANCESHEET' , 'Party'        , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019f081c-6764-73b0-b397-3f30a6efe73e', 'Customers'               , NULL                 , NULL, NULL                      , NULL                    , 'Assets'     , '019eee86-f34b-7ddc-91e2-efca49e5e8e8', 0  , '{}', 'BALANCESHEET' , 'Party'        , false, true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e3c-93c5-7b95790de2cf', 'Branch / Divisions'      , NULL                 , NULL, 'Branch / Divisions'      , 'Branch / Divisions'    , 'Liabilities', NULL, 70 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e4f-ae5b-497dac40d082', 'Misc. Expenses (ASSET)'  , NULL                 , NULL, 'Misc. Expenses (ASSET)'  , 'Misc. Expenses (ASSET)', 'Assets'     , NULL, 80 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e60-9ea0-2459d4159c6e', 'Suspense A/c'            , NULL                 , NULL, 'Suspense A/c'            , 'Suspense A/c'          , 'Liabilities', NULL, 90 , '{}', 'BALANCESHEET' , 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7e71-af77-a714f77b1ea2', 'Sales Accounts'          , NULL                 , NULL, 'Sales Accounts'          , 'Sales Accounts'        , 'Income'     , NULL, 100, '{}', 'PROFITANDLOSS', 'SalesPurchase', true , true, false, false, false, true , true, false, 'system', 'system')
    ,('019eee86-f34b-7e82-8d1f-1d9c9a40d066', 'Purchase Accounts'       , NULL                 , NULL, 'Purchase Accounts'       , 'Purchase Accounts'     , 'Expenses'   , NULL, 110, '{}', 'PROFITANDLOSS', 'SalesPurchase', true , true, false, false, false, true , true, false, 'system', 'system')
    ,('019eee86-f34b-7e94-abf9-c5841c09292f', 'Direct Incomes'          , 'Income (Direct)'    , NULL, 'Direct Incomes'          , 'Direct Incomes'        , 'Income'     , NULL, 120, '{}', 'PROFITANDLOSS', 'General'      , true , true, false, false, false, true , true, false, 'system', 'system')
    ,('019eee86-f34b-7ea5-a4bb-bcf1d432ed63', 'Direct Expenses'         , 'Expenses (Direct)'  , NULL, 'Direct Expenses'         , 'Direct Expenses'       , 'Expenses'   , NULL, 130, '{}', 'PROFITANDLOSS', 'General'      , true , true, false, false, false, true , true, false, 'system', 'system')
    ,('019eee86-f34b-7eb7-a296-0d3ce4f6fed1', 'Indirect Incomes'        , 'Income (Indirect)'  , NULL, 'Indirect Incomes'        , 'Indirect Incomes'      , 'Income'     , NULL, 140, '{}', 'PROFITANDLOSS', 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
    ,('019eee86-f34b-7ec8-813f-df893287fb9c', 'Indirect Expenses'       , 'Expenses (Indirect)', NULL, 'Indirect Expenses'       , 'Indirect Expenses'     , 'Expenses'   , NULL, 150, '{}', 'PROFITANDLOSS', 'General'      , true , true, false, false, false, false, true, false, 'system', 'system')
ON CONFLICT (acc_group_id) DO NOTHING;

COMMIT;
