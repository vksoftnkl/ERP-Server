-- Seed: public.db_table_master -- the table registry: what every table in the
-- database IS (one row per ordinary table and per partitioned parent, never a
-- partition). The table, its CHECKs and the two views are migration
-- 20261023140000_db_table_master.
--
-- dtm_kind
--   MASTER       things a document picks from (item, customer, ledger, godown)
--   TRANSACTION  numbered, dated documents a user raises, and their lines
--   LEDGER       movements the posting engine writes from a transaction
--   BALANCE      running totals / snapshots, rebuildable from a ledger
--   LOG          history: who did what when
--   SETTING      rules and switches, per company / branch / device
--   METADATA     definitions the apps are built from (menus, grids, catalogues)
--   SYSTEM       plumbing with no business meaning
-- dtm_write_mode
--   EDITABLE     screens / the API save and change rows
--   APPEND_ONLY  insert only; a correction is a new (reversing) row
--   DERIVED      written only by server posting / engine / job code
-- dtm_parent_id
--   an item / line table -> its header (sale_bill_item -> sale_bill), a child
--   master -> its master (item_unit_conversion -> item_master). NULL for a
--   table shared by several headers (txn_charge_detail, acc_tender_detail,
--   txn_transport_detail, txn_status_log).
--
-- Ids are written out, in blocks of 100 per module (1xx core, 2xx UI, 3xx
-- audit/system, 4xx accounts, 5xx till, 6xx sales, 7xx loyalty, 8xx purchase,
-- 9xx inventory, 10xx stock, 11xx GST, 12xx print, 13xx transport), so a new
-- table takes a free id in its module's block.
--
-- A NEW TABLE: add its row here in the same change as its migration. Until
-- then public.v_db_table_master_drift lists it as UNREGISTERED and
-- test/db-table-master.e2e-spec.ts fails. A DROPPED table: delete its row in
-- the migration that drops it (it shows as MISSING otherwise).
--
-- This file owns the rows: ON CONFLICT (dtm_id) DO UPDATE, so a
-- reclassification here reaches every database on the next deploy. Only rows
-- that actually differ are touched, so dtm_modified_on means something.
--
-- A row whose table does not exist on this database is skipped, not failed:
-- public.sync_deleted_rows comes from the cloud-sync migration that is kept
-- out of git, so it exists on local installs only.
--
-- dtm_menu_id is dropped to NULL when that menu is absent here.
--
-- sync_col is the table's sync-date column, the timestamp the cloud push
-- stamps ('item_sync_date', 'saa_synced_on', 'price_lvl_SyncDate'); NULL =
-- the table has none. When a table gains or renames one, change it here:
-- the drift view reports SYNC_COLUMN until the two agree.
--
-- Run: psql "$DATABASE_URL" -f prisma/seed/Db_Table_Master.sql
--      or: npm run seed:run -- --only=Db_Table_Master.sql

BEGIN;

INSERT INTO public.db_table_master AS d
    (dtm_id, dtm_schema, dtm_table, dtm_parent_id, dtm_name, dtm_kind, dtm_module,
     dtm_col_prefix, dtm_sync_col, dtm_menu_id, dtm_write_mode, dtm_retention_days, dtm_is_active,
     dtm_description)
SELECT v.id, v.sch, v.tbl, v.parent, v.name, v.kind, v.module, v.prefix, v.sync_col,
       (SELECT m.menu_id FROM fixed.menu_master m WHERE m.menu_id = v.menu),
       v.write_mode, v.keep_days, v.active, v.descr
  FROM (VALUES
    -- 100s CORE / HR / shared document tables
    ( 101, 'public',     'companys',                   NULL,  'Company',                          'MASTER',      'CORE',      'comp_',             'comp_sync_date',           56,    'EDITABLE',    NULL,  true,   'One row per company (GSTIN, PAN, addresses, theme).'),
    ( 102, 'public',     'company_group_master',       NULL,  'Company Group',                    'MASTER',      'CORE',      'cog_',              'cog_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Named sets of companies (cog_company_ids).'),
    ( 103, 'public',     'company_aato',               101,   'Company Turnover (AATO)',          'SETTING',     'CORE',      'caa_',              'caa_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Aggregate annual turnover per company per FY; drives e-invoice applicability. COMPUTED or DECLARED.'),
    ( 104, 'public',     'branch_master',              NULL,  'Branch',                           'MASTER',      'CORE',      'br_',               'br_sync_date',             191,   'EDITABLE',    NULL,  true,   NULL),
    ( 105, 'public',     'fiscal_years',               NULL,  'Financial Year',                   'MASTER',      'CORE',      'fy_',               'fy_sync_date',             64,    'EDITABLE',    NULL,  true,   'Per company; carries the lock date and the carry-forward stamp.'),
    ( 106, 'public',     'user_master',                NULL,  'User',                             'MASTER',      'CORE',      'usr_',              'usr_sync_date',            58,    'EDITABLE',    NULL,  true,   NULL),
    ( 107, 'public',     'user_menus',                 106,   'User Menu Rights',                 'MASTER',      'CORE',      'um_',               'um_sync_date',             58,    'EDITABLE',    NULL,  true,   'Per-user rights per menu (view/create/.../post). A save is a FULL REPLACE of the user''s rows.'),
    ( 108, 'fixed',      'device_master',              NULL,  'Device',                           'MASTER',      'CORE',      'dev_',              'dev_sync_date',            239,   'EDITABLE',    NULL,  true,   'Registered client devices; a device may be bound to a till counter.'),
    ( 109, 'fixed',      'state_codes',                NULL,  'GST State Code',                   'MASTER',      'CORE',      'state_',            'state_sync_date',          NULL,  'EDITABLE',    NULL,  true,   'Statutory GST state / UT codes. Seeded (State_Codes.sql).'),
    ( 110, 'public',     'app_setting_def',            NULL,  'Setting Definition',               'METADATA',    'CORE',      'asd_',              'asd_sync_date',            246,   'EDITABLE',    NULL,  true,   'Catalogue of every configurable setting; one row per setting, forever.'),
    ( 111, 'public',     'app_setting_value',          110,   'Setting Value',                    'SETTING',     'CORE',      'asv_',              'asv_sync_date',            246,   'EDITABLE',    NULL,  true,   'Overrides per setting per scope target; a row exists only where somebody changed something.'),
    ( 112, 'public',     'app_theme_master',           NULL,  'App Theme',                        'SETTING',     'CORE',      'thm_',              'thm_sync_date',            266,   'EDITABLE',    NULL,  true,   'Theme tokens per theme.'),
    ( 113, 'public',     'app_theme_template',         NULL,  'App Theme Template',               'METADATA',    'CORE',      'tpl_',              'tpl_sync_date',            266,   'EDITABLE',    NULL,  true,   'The QSS rules every client applies, with {{key}} placeholders.'),
    ( 114, 'public',     'statutory_limits',           NULL,  'Statutory Limit',                  'SETTING',     'CORE',      'stl_',              'stl_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Every rupee figure, percentage and day count that comes from an Act, per company, with an effective date.'),
    ( 115, 'public',     'batches_prefix',             NULL,  'Batch Prefix',                     'SETTING',     'CORE',      NULL,                'sync_date',                NULL,  'EDITABLE',    NULL,  true,   'Batch number prefixes already used.'),
    ( 116, 'public',     'charge_master',              NULL,  'Charge',                           'MASTER',      'CORE',      'chg_',              'chg_sync_date',            245,   'EDITABLE',    NULL,  true,   'Additional charges (freight, packing ...) with their ledger and tax.'),
    ( 120, 'public',     'employee_departments',       NULL,  'Department',                       'MASTER',      'HR',        'edpt_',             'edpt_sync_date',           70,    'EDITABLE',    NULL,  true,   NULL),
    ( 121, 'public',     'employee_designations',      NULL,  'Designation',                      'MASTER',      'HR',        'ed_',               'ed_sync_date',             71,    'EDITABLE',    NULL,  true,   NULL),
    ( 122, 'public',     'employee_master',            NULL,  'Employee',                         'MASTER',      'HR',        'emp_',              'emp_sync_date',            57,    'EDITABLE',    NULL,  true,   NULL),
    ( 150, 'public',     'txn_charge_detail',          NULL,  'Document Charge Line',             'TRANSACTION', 'CORE',      'cd_',               'cd_sync_date',             NULL,  'EDITABLE',    NULL,  true,   'Charge lines of every document type (cd_src_doc_type); no single header, so no parent.'),
    ( 151, 'public',     'txn_hold',                   NULL,  'Held Document',                    'TRANSACTION', 'CORE',      'txh_',              'txh_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'A parked bill / order, resumed later at the counter.'),
    ( 152, 'public',     'txn_status_log',             NULL,  'Document Status Step',             'LOG',         'CORE',      'tsl_',              'tsl_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'One row per status STEP (post, cancel, amend ...) of every document type, not one per save.'),
    -- 200s UI definitions (fixed schema)
    ( 201, 'fixed',      'menu_master',                NULL,  'Menu',                             'METADATA',    'UI',        'menu_',             'menu_sync_date',           NULL,  'EDITABLE',    NULL,  true,   'The application menu tree; menu ids are referenced by rights, layouts and the clients. Seeded (Menu_Master.sql).'),
    ( 202, 'fixed',      'form_section',               NULL,  'Form Section',                     'METADATA',    'UI',        'section_',          'section_sync_date',        243,   'EDITABLE',    NULL,  true,   'Widget-master layout sections per menu.'),
    ( 203, 'fixed',      'form_field',                 202,   'Form Field',                       'METADATA',    'UI',        'field_',            'field_sync_date',          243,   'EDITABLE',    NULL,  true,   NULL),
    ( 204, 'fixed',      'grid_details',               NULL,  'Grid',                             'METADATA',    'UI',        'grid_',             'grid_sync_on',             73,    'EDITABLE',    NULL,  true,   'Configured list / report grids and their SQL (no comments allowed in grid_sql).'),
    ( 205, 'fixed',      'grid_columns',               204,   'Grid Column',                      'METADATA',    'UI',        'grid_column_',      'grid_column_sync_on',      73,    'EDITABLE',    NULL,  true,   NULL),
    ( 206, 'fixed',      'dropdown_details',           NULL,  'Dropdown',                         'METADATA',    'UI',        'dropdown_',         'dropdown_sync_on',         77,    'EDITABLE',    NULL,  true,   'Configured lookup popups and their SQL.'),
    ( 207, 'fixed',      'dropdown_columns',           206,   'Dropdown Column',                  'METADATA',    'UI',        'dropdown_columns_', 'dropdown_columns_sync_on', 77,    'EDITABLE',    NULL,  true,   NULL),
    ( 208, 'fixed',      'ui_tables',                  NULL,  'Entry Grid',                       'METADATA',    'UI',        'ui_tbl_',           'ui_tbl_sync_date',         242,   'EDITABLE',    NULL,  true,   'Entry-screen item grids (the "UI Table Master" screen).'),
    ( 209, 'fixed',      'ui_table_columns',           208,   'Entry Grid Column',                'METADATA',    'UI',        'ui_tbl_clm_',       'ui_tbl_clm_sync_date',     242,   'EDITABLE',    NULL,  true,   NULL),
    ( 210, 'fixed',      'error_message',              NULL,  'Error Message',                    'METADATA',    'UI',        'erm_',              'erm_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Plain words for each error code, per variant and language. Seeded from Error_Messages.json.'),
    ( 211, 'fixed',      'error_message_catalogue',    NULL,  'Error Message Catalogue',          'METADATA',    'UI',        'emc_',              'emc_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'The one version of fixed.error_message the apps cache against.'),
    -- 300s audit / system
    ( 301, 'audit',      'audit_screen',               NULL,  'Audit Screen',                     'METADATA',    'AUDIT',     'screen_',           'screen_sync_date',         NULL,  'EDITABLE',    NULL,  true,   'Screens the audit log files changes under (master / transaction / settings).'),
    ( 302, 'audit',      'audit_log',                  NULL,  'Audit Log',                        'LOG',         'AUDIT',     'log_',              'log_sync_date',            106,   'APPEND_ONLY', 365,   true,   'Before / after of every audited save. 365 days = the default of QueueService.scheduleAuditLogArchival.'),
    ( 303, 'audit',      'user_login_sessions',        NULL,  'Login Session',                    'LOG',         'AUDIT',     'uls_',              'uls_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'One row per login; updated at refresh and logout.'),
    ( 304, 'public',     '_prisma_migrations',         NULL,  'Prisma Migrations',                'SYSTEM',      'SYSTEM',    NULL,                NULL,                       NULL,  'EDITABLE',    NULL,  true,   'Prisma''s own migration history.'),
    ( 305, 'public',     '_erp_seed_history',          NULL,  'Seed History',                     'SYSTEM',      'SYSTEM',    NULL,                NULL,                       NULL,  'EDITABLE',    NULL,  true,   'The seed runner''s bookkeeping: one row per seed file.'),
    ( 306, 'public',     'sync_deleted_rows',          NULL,  'Sync Tombstone',                   'SYSTEM',      'SYSTEM',    'sdr_',              'sdr_sync_date',            NULL,  'APPEND_ONLY', 30,    true,   'Offline -> cloud sync: one row per hard delete. Local installs only; 30 days after it was replayed.'),
    ( 307, 'public',     'db_table_master',            NULL,  'Table Registry',                   'METADATA',    'SYSTEM',    'dtm_',              'dtm_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'This table: what every table in the database is. Seeded (Db_Table_Master.sql).'),
    -- 400s ACCOUNTS
    ( 401, 'accounts',   'acc_group_master',           NULL,  'Account Group',                    'MASTER',      'ACCOUNTS',  'acc_',              'acc_group_sync_date',      54,    'EDITABLE',    NULL,  true,   'Chart of accounts groups. State / city / area masters mirror into a row here (same id).'),
    ( 402, 'accounts',   'acc_ledger_master',          NULL,  'Ledger',                           'MASTER',      'ACCOUNTS',  'led_',              'led_sync_date',            53,    'EDITABLE',    NULL,  true,   'Every ledger. Customers and suppliers mirror into a row here (same id).'),
    ( 403, 'accounts',   'acc_ledger_bank_accounts',   402,   'Ledger Bank Account',              'MASTER',      'ACCOUNTS',  'lba_',              'lba_sync_date',            NULL,  'EDITABLE',    NULL,  true,   NULL),
    ( 404, 'accounts',   'acc_ship_addrs',             402,   'Ledger Shipping Address',          'MASTER',      'ACCOUNTS',  'saa_',              'saa_synced_on',            NULL,  'EDITABLE',    NULL,  true,   NULL),
    ( 405, 'accounts',   'acc_party_tax_certificate',  402,   'Party Tax Certificate',            'MASTER',      'ACCOUNTS',  'ptc_',              'ptc_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'What a party has shown us that changes a TDS / TCS rate or a refusal (LDC_197, Form 60 ...).'),
    ( 406, 'accounts',   'acc_ledger_role',            NULL,  'Ledger Role',                      'METADATA',    'ACCOUNTS',  'alr_',              'alr_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Every posting role and the kind of ledger it may take. New roles need fn_ledger_map_catalogue().'),
    ( 407, 'accounts',   'acc_ledger_map',             NULL,  'Ledger Mapping',                   'SETTING',     'ACCOUNTS',  'alm_',              'alm_sync_date',            250,   'EDITABLE',    NULL,  true,   'Role -> ledger, per company (optionally per branch).'),
    ( 408, 'accounts',   'acc_voucher_types',          NULL,  'Voucher Type',                     'METADATA',    'ACCOUNTS',  'vchr_',             'vchr_sync_date',           NULL,  'EDITABLE',    NULL,  true,   'Seeded; vchr_menu_id names the menu whose rights judge the type.'),
    ( 409, 'accounts',   'acc_voucher_seq',            NULL,  'Voucher Number Series',            'SYSTEM',      'ACCOUNTS',  'seq_',              'seq_sync_date',            65,    'EDITABLE',    NULL,  true,   'Running counters for voucher numbers.'),
    ( 410, 'accounts',   'acc_tender_types',           NULL,  'Tender Type',                      'METADATA',    'ACCOUNTS',  'ttm_',              'ttm_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'CASH / CARD / UPI / CHEQUE ... Seeded (Acc_Tender_Types.sql).'),
    ( 411, 'accounts',   'acc_tender_master',          NULL,  'Tender',                           'MASTER',      'ACCOUNTS',  'tnd_',              'tnd_sync_date',            95,    'EDITABLE',    NULL,  true,   NULL),
    ( 412, 'accounts',   'acc_cheque_book',            NULL,  'Cheque Book',                      'MASTER',      'ACCOUNTS',  'acb_',              NULL,                       263,   'EDITABLE',    NULL,  true,   'Our cheque books; acb_next_leaf is handed out under FOR UPDATE.'),
    ( 413, 'accounts',   'tds_rates',                  NULL,  'TDS Rate',                         'MASTER',      'ACCOUNTS',  'tdr_',              'tdr_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'TDS sections and their rates.'),
    ( 414, 'fixed',      'bank_master',                NULL,  'Bank',                             'MASTER',      'ACCOUNTS',  'bnk_',              'bnk_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Bank names. Seeded (Bank_Master.sql).'),
    ( 420, 'accounts',   'acc_voucher_header',         NULL,  'Voucher',                          'TRANSACTION', 'ACCOUNTS',  'avh_',              'avh_sync_date',            262,   'EDITABLE',    NULL,  true,   'Every accounting voucher, typed by acc_voucher_types. Totals are derived by trigger; never write them.'),
    ( 421, 'accounts',   'acc_vouchers',               420,   'Voucher Leg',                      'TRANSACTION', 'ACCOUNTS',  'av_',               'av_sync_date',             262,   'EDITABLE',    NULL,  true,   'Dr / Cr legs. ck_avh_balanced fires per statement.'),
    ( 422, 'accounts',   'acc_opening_balance',        NULL,  'Opening Balance',                  'TRANSACTION', 'ACCOUNTS',  'op_',               'op_sync_date',             55,    'EDITABLE',    NULL,  true,   'Opening balance per ledger per FY; balance-sheet ledgers only.'),
    ( 423, 'accounts',   'acc_pdc_register',           NULL,  'Post-dated Cheque',                'TRANSACTION', 'ACCOUNTS',  'apd_',              'apd_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Post-dated cheques and mandates, received (R) and issued (P).'),
    ( 424, 'accounts',   'acc_temp_credit',            NULL,  'Temp Credit',                      'TRANSACTION', 'ACCOUNTS',  'atc_',              'atc_sync_date',            257,   'EDITABLE',    NULL,  true,   'WHO took a small counter loan; the outstanding lives on acc_bill_balance.'),
    ( 425, 'accounts',   'acc_tender_detail',          NULL,  'Tender Line',                      'TRANSACTION', 'ACCOUNTS',  'td_',               'td_sync_date',             NULL,  'EDITABLE',    NULL,  true,   'Money lines of bills, receipts and payments (td_src_doc_type); no single header, so no parent.'),
    ( 426, 'accounts',   'acc_settlement_import',      NULL,  'Settlement Statement',             'TRANSACTION', 'ACCOUNTS',  'asi_',              'asi_sync_date',            278,   'EDITABLE',    NULL,  true,   'A provider payout (acquirer / PSP); posting writes one TSet voucher.'),
    ( 427, 'accounts',   'acc_settlement_line',        426,   'Settlement Statement Line',        'TRANSACTION', 'ACCOUNTS',  'asl_',              'asl_sync_date',            278,   'EDITABLE',    NULL,  true,   NULL),
    ( 430, 'accounts',   'acc_bill_balance',           NULL,  'Bill Balance',                     'BALANCE',     'ACCOUNTS',  'abl_',              'abl_sync_date',            NULL,  'DERIVED',     NULL,  true,   'One row per bill, written by posting. abl_status / abl_pending_amount are generated columns.'),
    ( 431, 'accounts',   'acc_bill_adjustment',        NULL,  'Bill Adjustment',                  'LEDGER',      'ACCOUNTS',  'abj_',              'abj_sync_date',            NULL,  'DERIVED',     NULL,  true,   'One row per settlement event against one bill; written by posting, unwound by amend.'),
    ( 432, 'accounts',   'acc_voucher_doc_register',   NULL,  'GST Document Register',            'LEDGER',      'ACCOUNTS',  'gdr_',              'gdr_sync_date',            NULL,  'DERIVED',     NULL,  true,   'One row per GST document, written at post.'),
    ( 433, 'accounts',   'acc_voucher_doc_detail',     432,   'GST Document Line',                'LEDGER',      'ACCOUNTS',  'vtx_',              'vtx_sync_date',            NULL,  'DERIVED',     NULL,  true,   NULL),
    ( 434, 'accounts',   'acc_voucher_doc_einvoice',   432,   'GST Document e-Invoice',           'LEDGER',      'ACCOUNTS',  'gde_',              'gde_sync_date',            NULL,  'DERIVED',     NULL,  true,   NULL),
    ( 435, 'accounts',   'acc_voucher_doc_ewaybill',   432,   'GST Document e-Way Bill',          'LEDGER',      'ACCOUNTS',  'gdw_',              'gdw_sync_date',            NULL,  'DERIVED',     NULL,  true,   NULL),
    ( 436, 'accounts',   'acc_tcs_register',           NULL,  'TCS Register',                     'LEDGER',      'ACCOUNTS',  'atc_',              'atc_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Form 27EQ projection: written at post, never edited.'),
    ( 437, 'accounts',   'acc_tds_register',           NULL,  'TDS Register',                     'LEDGER',      'ACCOUNTS',  'atd_',              'atd_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Form 26Q projection: written at post, never edited.'),
    ( 440, 'accounts',   'acc_opening_run',            NULL,  'Opening Carry-forward Run',        'LOG',         'ACCOUNTS',  'aor_',              'aor_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'One row per year-end carry-forward run, never updated.'),
    -- 500s TILL
    ( 501, 'accounts',   'till_counter',               NULL,  'Till Counter',                     'MASTER',      'TILL',      'tcn_',              'tcn_sync_date',            275,   'EDITABLE',    NULL,  true,   NULL),
    ( 502, 'accounts',   'till_safe',                  NULL,  'Till Safe',                        'MASTER',      'TILL',      'tsf_',              'tsf_sync_date',            280,   'EDITABLE',    NULL,  true,   NULL),
    ( 503, 'accounts',   'till_reason',                NULL,  'Till Reason',                      'MASTER',      'TILL',      'trs_',              'trs_sync_date',            281,   'EDITABLE',    NULL,  true,   NULL),
    ( 504, 'accounts',   'till_denomination',          NULL,  'Denomination',                     'MASTER',      'TILL',      'tdn_',              'tdn_sync_date',            282,   'EDITABLE',    NULL,  true,   NULL),
    ( 505, 'accounts',   'till_approval_rule',         NULL,  'Till Approval Rule',               'SETTING',     'TILL',      'tar_',              'tar_sync_date',            276,   'EDITABLE',    NULL,  true,   NULL),
    ( 506, 'accounts',   'till_approval_authority',    NULL,  'Till Approval Authority',          'SETTING',     'TILL',      'taa_',              'taa_sync_date',            285,   'EDITABLE',    NULL,  true,   'Who may approve which till event, up to what amount.'),
    ( 510, 'accounts',   'till_business_day',          NULL,  'Business Day',                     'TRANSACTION', 'TILL',      'tbd_',              'tbd_sync_date',            274,   'EDITABLE',    NULL,  true,   'One per branch per trading date (not the calendar date).'),
    ( 511, 'accounts',   'till_session',               NULL,  'Till Session',                     'TRANSACTION', 'TILL',      'tss_',              'tss_sync_date',            273,   'EDITABLE',    NULL,  true,   NULL),
    ( 512, 'accounts',   'till_cash_movement',         NULL,  'Cash Movement',                    'TRANSACTION', 'TILL',      'tcm_',              'tcm_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Float, pickup, top-up, drop, handover ...'),
    ( 513, 'accounts',   'till_count',                 NULL,  'Till Count',                       'TRANSACTION', 'TILL',      'tct_',              'tct_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Every count is its own row and stays; a recount does not erase the first.'),
    ( 514, 'accounts',   'till_count_line',            513,   'Till Count Line',                  'TRANSACTION', 'TILL',      'tcl_',              'tcl_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   NULL),
    ( 515, 'accounts',   'till_variance',              NULL,  'Till Variance',                    'TRANSACTION', 'TILL',      'tvr_',              'tvr_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'A shortage / excess and its decision.'),
    ( 516, 'accounts',   'till_approval',              NULL,  'Till Approval',                    'TRANSACTION', 'TILL',      'tap_',              'tap_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'An approved EXCEPTION (variance, payout over limit, no-sale drawer ...), not a voucher approval.'),
    ( 520, 'accounts',   'till_event',                 NULL,  'Till Event',                       'LOG',         'TILL',      'tev_',              'tev_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'The append-only till journal; TillEventService is the single writer.'),
    ( 521, 'accounts',   'till_void',                  NULL,  'Bill Void',                        'LOG',         'TILL',      'tvd_',              'tvd_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'One row per voided sale bill, stamped once inside the cancel''s transaction.'),
    ( 522, 'accounts',   'till_session_review',        NULL,  'Till Session Review',              'LOG',         'TILL',      'tsr_',              'tsr_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'HO''s view of a session or day, written at the cloud only.'),
    -- 600s SALES
    ( 601, 'sales',      'state_master',               NULL,  'State',                            'MASTER',      'SALES',     'stm_',              'stm_sync_date',            18,    'EDITABLE',    NULL,  true,   'Mirrors into an acc_group_master row with the same id.'),
    ( 602, 'sales',      'city_master',                NULL,  'City',                             'MASTER',      'SALES',     'ctm_',              'ctm_sync_date',            19,    'EDITABLE',    NULL,  true,   'Mirrors into an acc_group_master row with the same id.'),
    ( 603, 'sales',      'area_master',                NULL,  'Area',                             'MASTER',      'SALES',     'arm_',              'arm_sync_date',            20,    'EDITABLE',    NULL,  true,   'Mirrors into an acc_group_master row with the same id.'),
    ( 604, 'sales',      'cust_groups',                NULL,  'Customer Group',                   'MASTER',      'SALES',     'cgr_',              'cgr_sync_date',            21,    'EDITABLE',    NULL,  true,   NULL),
    ( 605, 'sales',      'customers',                  NULL,  'Customer',                         'MASTER',      'SALES',     'cus_',              'cus_sync_date',            10,    'EDITABLE',    NULL,  true,   'Mirrors into an acc_ledger_master row with the same id.'),
    ( 606, 'sales',      'cust_item_rates',            605,   'Customer Item Rate',               'MASTER',      'SALES',     'csr_',              'csr_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Special rate / discount per customer per item unit.'),
    ( 607, 'sales',      'sale_agent_groups',          NULL,  'Agent Group',                      'MASTER',      'SALES',     'sa_',               'sa_grp_sync_date',         204,   'EDITABLE',    NULL,  true,   NULL),
    ( 608, 'sales',      'sale_agents',                NULL,  'Agent',                            'MASTER',      'SALES',     'sa_',               'sa_sync_date',             203,   'EDITABLE',    NULL,  true,   NULL),
    ( 609, 'sales',      'sale_freight_charges',       NULL,  'Freight Charge Slab',              'SETTING',     'SALES',     'fr_',               'fr_sync_date',             130,   'EDITABLE',    NULL,  true,   'Freight by distance and weight band.'),
    ( 610, 'sales',      'sale_loading_charges',       NULL,  'Loading Charge',                   'SETTING',     'SALES',     'ilc_',              'ilc_sync_date',            177,   'EDITABLE',    NULL,  true,   NULL),
    ( 620, 'sales',      'sale_quotation',             NULL,  'Quotation',                        'TRANSACTION', 'SALES',     'sq_',               'sq_sync_date',             14,    'EDITABLE',    NULL,  true,   NULL),
    ( 621, 'sales',      'sale_quotation_item',        620,   'Quotation Item',                   'TRANSACTION', 'SALES',     'sqi_',              'sqi_sync_date',            14,    'EDITABLE',    NULL,  true,   NULL),
    ( 622, 'sales',      'sale_order',                 NULL,  'Sales Order',                      'TRANSACTION', 'SALES',     'so_',               'so_sync_date',             11,    'EDITABLE',    NULL,  true,   NULL),
    ( 623, 'sales',      'sale_order_item',            622,   'Sales Order Item',                 'TRANSACTION', 'SALES',     'soi_',              'soi_sync_date',            11,    'EDITABLE',    NULL,  true,   NULL),
    ( 624, 'sales',      'sale_dc',                    NULL,  'Delivery Challan',                 'TRANSACTION', 'SALES',     'sdc_',              'sdc_sync_date',            182,   'EDITABLE',    NULL,  true,   'Goods out before the invoice; a stock and GST document with no tax liability.'),
    ( 625, 'sales',      'sale_dc_item',               624,   'Delivery Challan Item',            'TRANSACTION', 'SALES',     'sdi_',              'sdi_sync_date',            182,   'EDITABLE',    NULL,  true,   NULL),
    ( 626, 'sales',      'sale_dc_return',             NULL,  'Delivery Challan Return',          'TRANSACTION', 'SALES',     'sdr_',              'sdr_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Un-billed goods coming back off a challan.'),
    ( 627, 'sales',      'sale_dc_return_item',        626,   'Delivery Challan Return Item',     'TRANSACTION', 'SALES',     'sdri_',             'sdri_sync_date',           NULL,  'EDITABLE',    NULL,  true,   NULL),
    ( 628, 'sales',      'sale_bill',                  NULL,  'Sale Bill',                        'TRANSACTION', 'SALES',     'sb_',               'sb_sync_date',             12,    'EDITABLE',    NULL,  true,   NULL),
    ( 629, 'sales',      'sale_bill_item',             628,   'Sale Bill Item',                   'TRANSACTION', 'SALES',     'sbi_',              'sbi_sync_date',            12,    'EDITABLE',    NULL,  true,   'Profit columns are PER UNIT.'),
    ( 630, 'sales',      'sale_return',                NULL,  'Sales Return',                     'TRANSACTION', 'SALES',     'sr_',               'sr_sync_date',             13,    'EDITABLE',    NULL,  true,   'The credit note; against a bill or free.'),
    ( 631, 'sales',      'sale_return_item',           630,   'Sales Return Item',                'TRANSACTION', 'SALES',     'sri_',              'sri_sync_date',            13,    'EDITABLE',    NULL,  true,   NULL),
    -- 700s LOYALTY / PROMOTION
    ( 701, 'sales',      'loyalty_scheme',             NULL,  'Loyalty Scheme',                   'MASTER',      'LOYALTY',   'lsc_',              'lsc_sync_date',            67,    'EDITABLE',    NULL,  true,   'Campaign header; rules only, no balances.'),
    ( 702, 'sales',      'loyalty_scheme_branch',      701,   'Loyalty Scheme Branch',            'MASTER',      'LOYALTY',   'lsb_',              'lsb_sync_date',            67,    'EDITABLE',    NULL,  true,   NULL),
    ( 703, 'sales',      'loyalty_scheme_item',        701,   'Loyalty Scheme Item',              'MASTER',      'LOYALTY',   'lsi_',              'lsi_sync_date',            67,    'EDITABLE',    NULL,  true,   'Which stock a scheme applies to.'),
    ( 704, 'sales',      'loyalty_scheme_party',       701,   'Loyalty Scheme Party',             'MASTER',      'LOYALTY',   'lsp_',              'lsp_sync_date',            67,    'EDITABLE',    NULL,  true,   'Who a scheme applies to.'),
    ( 705, 'sales',      'loyalty_scheme_slab',        701,   'Loyalty Scheme Slab',              'MASTER',      'LOYALTY',   'lss_',              'lss_sync_date',            67,    'EDITABLE',    NULL,  true,   'Earn-rate bands.'),
    ( 706, 'sales',      'loyalty_scheme_gift',        701,   'Loyalty Scheme Gift',              'MASTER',      'LOYALTY',   'lsg_',              'lsg_sync_date',            67,    'EDITABLE',    NULL,  true,   'What points may be exchanged for.'),
    ( 707, 'sales',      'loyalty_member',             NULL,  'Loyalty Member',                   'MASTER',      'LOYALTY',   'lmb_',              'lmb_sync_date',            79,    'EDITABLE',    NULL,  true,   'One points wallet per customer per company, with its running totals.'),
    ( 708, 'sales',      'loyalty_coupon_batch',       NULL,  'Coupon Batch',                     'MASTER',      'LOYALTY',   'lcb_',              'lcb_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'What a coupon of this kind is worth and how it behaves.'),
    ( 709, 'sales',      'loyalty_coupon',             708,   'Coupon',                           'MASTER',      'LOYALTY',   'lcp_',              'lcp_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'One issued coupon; never partitioned, never carried forward.'),
    ( 710, 'sales',      'loyalty_gift_redeem',        NULL,  'Gift Redemption',                  'TRANSACTION', 'LOYALTY',   'lgr_',              'lgr_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'A redemption slip with its own number series.'),
    ( 711, 'sales',      'loyalty_gift_redeem_item',   710,   'Gift Redemption Item',             'TRANSACTION', 'LOYALTY',   'lgd_',              'lgd_sync_date',            NULL,  'EDITABLE',    NULL,  true,   NULL),
    ( 712, 'sales',      'loyalty_ledger',             NULL,  'Loyalty Points Ledger',            'LEDGER',      'LOYALTY',   'lld_',              'lld_sync_date',            79,    'APPEND_ONLY', NULL,  true,   'One row per point movement, drawn from one lot (EARN / OPENING / ADJUST / TRANSFER).'),
    ( 713, 'sales',      'loyalty_coupon_txn',         NULL,  'Coupon Movement',                  'LEDGER',      'LOYALTY',   'lct_',              'lct_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Signed movements against a coupon; a reversal repeats its type.'),
    ( 720, 'sales',      'promotion_scheme',           NULL,  'Promotion Scheme',                 'MASTER',      'LOYALTY',   'prm_',              'prm_sync_date',            247,   'EDITABLE',    NULL,  true,   NULL),
    ( 721, 'sales',      'promotion_scheme_branch',    720,   'Promotion Scheme Branch',          'MASTER',      'LOYALTY',   'prb_',              'prb_sync_date',            247,   'EDITABLE',    NULL,  true,   NULL),
    ( 722, 'sales',      'promotion_scheme_item',      720,   'Promotion Scheme Item',            'MASTER',      'LOYALTY',   'pri_',              'pri_sync_date',            247,   'EDITABLE',    NULL,  true,   NULL),
    ( 723, 'sales',      'promotion_scheme_party',     720,   'Promotion Scheme Party',           'MASTER',      'LOYALTY',   'prp_',              'prp_sync_date',            247,   'EDITABLE',    NULL,  true,   NULL),
    ( 724, 'sales',      'promotion_scheme_slab',      720,   'Promotion Scheme Slab',            'MASTER',      'LOYALTY',   'prs_',              'prs_sync_date',            247,   'EDITABLE',    NULL,  true,   NULL),
    ( 725, 'sales',      'promotion_usage',            NULL,  'Promotion Usage',                  'LEDGER',      'LOYALTY',   'pru_',              'pru_sync_date',            NULL,  'DERIVED',     NULL,  true,   'What a campaign actually gave away, per document per scheme.'),
    -- 800s PURCHASE
    ( 801, 'purchase',   'supplier_groups',            NULL,  'Supplier Group',                   'MASTER',      'PURCHASE',  'spg_',              'spg_sync_date',            27,    'EDITABLE',    NULL,  true,   NULL),
    ( 802, 'purchase',   'suppliers',                  NULL,  'Supplier',                         'MASTER',      'PURCHASE',  'sup_',              'sup_sync_date',            22,    'EDITABLE',    NULL,  true,   'Mirrors into an acc_ledger_master row with the same id.'),
    ( 803, 'purchase',   'pur_terms',                  NULL,  'PO Terms',                         'MASTER',      'PURCHASE',  'pte_',              'pte_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Terms picked on a purchase order; company NULL = shared. The PO keeps its own copy of the text.'),
    -- 900s INVENTORY
    ( 901, 'inventory',  'item_group_master',          NULL,  'Item Group',                       'MASTER',      'INVENTORY', 'itg_',              'itg_sync_date',            35,    'EDITABLE',    NULL,  true,   NULL),
    ( 902, 'inventory',  'item_category_master',       NULL,  'Item Category',                    'MASTER',      'INVENTORY', 'category_',         'category_sync_date',       240,   'EDITABLE',    NULL,  true,   NULL),
    ( 903, 'inventory',  'item_brand_master',          NULL,  'Item Brand',                       'MASTER',      'INVENTORY', 'brand_',            'brand_sync_date',          36,    'EDITABLE',    NULL,  true,   NULL),
    ( 904, 'inventory',  'item_section_master',        NULL,  'Item Section',                     'MASTER',      'INVENTORY', 'sec_',              'sec_sync_date',            37,    'EDITABLE',    NULL,  true,   NULL),
    ( 905, 'inventory',  'item_unit_master',           NULL,  'Unit',                             'MASTER',      'INVENTORY', 'unit_',             'unit_sync_date',           38,    'EDITABLE',    NULL,  true,   NULL),
    ( 906, 'inventory',  'item_gst_units',             NULL,  'GST Unit (UQC)',                   'MASTER',      'INVENTORY', 'item_gst_unit_',    'item_gst_unit_sync_date',  NULL,  'EDITABLE',    NULL,  true,   'Statutory unit quantity codes. Seeded (Item_Gst_Units.sql).'),
    ( 907, 'inventory',  'tax_rate_master',            NULL,  'GST Rate',                         'MASTER',      'INVENTORY', 'tax_',              'tax_sync_date',            40,    'EDITABLE',    NULL,  true,   'One row per rate, shared by every company. Items and lines point here.'),
    ( 908, 'inventory',  'tax_rate_ledger',            907,   'GST Rate Ledger Override',         'SETTING',     'INVENTORY', 'trl_',              'trl_sync_date',            40,    'EDITABLE',    NULL,  true,   'Per-rate ledger overrides of acc_ledger_map.'),
    ( 909, 'inventory',  'item_tax_master',            NULL,  'Item Tax (retired)',               'MASTER',      'INVENTORY', 'tax_',              'tax_sync_date',            NULL,  'EDITABLE',    NULL,  false,  'Retired 2026-09-30: never read it, taxes are tax_rate_master ids. Table kept until asked.'),
    ( 910, 'inventory',  'item_master',                NULL,  'Item',                             'MASTER',      'INVENTORY', 'item_',             'item_sync_date',           29,    'EDITABLE',    NULL,  true,   NULL),
    ( 911, 'inventory',  'item_unit_conversion',       910,   'Item Unit',                        'MASTER',      'INVENTORY', 'iuc_',              'iuc_sync_date',            29,    'EDITABLE',    NULL,  true,   'The units an item is sold in and their factor to the base unit.'),
    ( 912, 'inventory',  'item_ean_codes',             911,   'Item Barcode',                     'MASTER',      'INVENTORY', 'ean_',              'ean_sync_date',            29,    'EDITABLE',    NULL,  true,   NULL),
    ( 913, 'inventory',  'item_price_master',          910,   'Item Price',                       'MASTER',      'INVENTORY', 'ipm_',              'ipm_sync_date',            29,    'EDITABLE',    NULL,  true,   'Written only through PriceMasterWriter.'),
    ( 914, 'inventory',  'item_qty_price',             910,   'Item Qty-wise Price',              'MASTER',      'INVENTORY', 'iqp_',              'iqp_sync_date',            244,   'EDITABLE',    NULL,  true,   'Written only through PriceMasterWriter.'),
    ( 915, 'inventory',  'item_reorders',              910,   'Item Reorder Level',               'MASTER',      'INVENTORY', 'ir_',               'ir_sync_date',             NULL,  'EDITABLE',    NULL,  true,   NULL),
    ( 916, 'inventory',  'item_price_levels',          NULL,  'Price Level',                      'MASTER',      'INVENTORY', 'ipl_',              'ipl_sync_date',            174,   'EDITABLE',    NULL,  true,   'The price levels customers, bills and schemes point at.'),
    ( 917, 'fixed',      'price_levels',               NULL,  'Price Level (fixed)',              'MASTER',      'INVENTORY', 'price_',            'price_lvl_SyncDate',       NULL,  'EDITABLE',    NULL,  true,   'Fixed-schema price level list (/price-level-master).'),
    ( 918, 'fixed',      'hsn_master',                 NULL,  'HSN Code',                         'MASTER',      'INVENTORY', 'hsn_',              'hsn_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Seeded (Hsn_Master.sql).'),
    ( 919, 'inventory',  'godown_locations',           NULL,  'Godown',                           'MASTER',      'INVENTORY', 'gdl_',              'gdl_sync_date',            39,    'EDITABLE',    NULL,  true,   NULL),
    ( 920, 'inventory',  'item_batch_master',          NULL,  'Item Batch',                       'MASTER',      'INVENTORY', 'btm_',              'btm_sync_date',            NULL,  'EDITABLE',    NULL,  true,   NULL),
    ( 921, 'inventory',  'item_size_master',           NULL,  'Item Size',                        'MASTER',      'INVENTORY', 'isz_',              'isz_sync_date',            291,  'EDITABLE',    NULL,  true,   'Textile sizes picked on an inward line; company NULL = shared.'),
    ( 922, 'inventory',  'item_colour_master',         NULL,  'Item Colour',                      'MASTER',      'INVENTORY', 'icl_',              'icl_sync_date',            292,  'EDITABLE',    NULL,  true,   'Textile colours picked on an inward line; company NULL = shared.'),
    ( 930, 'inventory',  'item_batch_stock',           NULL,  'Batch Stock (legacy)',             'BALANCE',     'INVENTORY', 'ibs_',              'ibs_sync_date',            NULL,  'DERIVED',     NULL,  true,   'Pre-engine batch balance; the stock engine keeps stock.stock_balance.'),
    ( 931, 'inventory',  'item_stock_ledger',          NULL,  'Item Stock Ledger (legacy)',       'LEDGER',      'INVENTORY', 'stl_',              'stl_synced_on',            NULL,  'APPEND_ONLY', NULL,  true,   'Pre-engine ledger; the stock engine writes stock.stock_ledger.'),
    ( 932, 'inventory',  'item_stock_balance',         NULL,  'Item Stock Balance (legacy)',      'BALANCE',     'INVENTORY', 'isb_',              'isb_sync_date',            NULL,  'DERIVED',     NULL,  true,   'Pre-engine balance; the stock engine keeps stock.stock_balance.'),
    ( 940, 'inventory',  'item_tax_history',           NULL,  'Item Tax History',                 'LOG',         'INVENTORY', 'ith_',              'ith_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Which tax an item carried, from when to when.'),
    ( 941, 'inventory',  'item_price_change_log',      NULL,  'Price Change Log',                 'LOG',         'INVENTORY', 'ipcl_',             'ipcl_sync_date',           290,   'APPEND_ONLY', NULL,  true,   'Every change to item_price_master / item_qty_price, before and after.'),
    -- 1000s STOCK
    (1001, 'stock',      'stock_reason_master',        NULL,  'Stock Reason',                     'MASTER',      'STOCK',     'srm_',              'srm_sync_date',            293,   'EDITABLE',    NULL,  true,   NULL),
    (1002, 'fixed',      'stock_adj_reasons',          NULL,  'Stock Adjustment Reason (fixed)',  'MASTER',      'STOCK',     'sar_',              'sar_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Fixed-schema reason list (/stock-adj-reasons).'),
    (1003, 'stock',      'stock_track_preset',         NULL,  'Tracking Preset',                  'SETTING',     'STOCK',     'spt_',              'spt_sync_date',            249,   'EDITABLE',    NULL,  true,   'Named tracking-flag combinations plus policy defaults.'),
    (1004, 'stock',      'stock_track_policy',         NULL,  'Tracking Policy',                  'SETTING',     'STOCK',     'stp_',              'stp_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Tracking flags per item group or item.'),
    (1005, 'stock',      'stock_ageing_slab',          NULL,  'Ageing Slab',                      'SETTING',     'STOCK',     'sag_',              'sag_sync_date',            294,   'EDITABLE',    NULL,  true,   NULL),
    (1006, 'stock',      'stock_reorder_policy',       NULL,  'Reorder Policy',                   'SETTING',     'STOCK',     'srp_',              'srp_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'MANUAL or COMPUTED reorder levels.'),
    (1010, 'stock',      'stock_voucher',              NULL,  'Stock Voucher',                    'TRANSACTION', 'STOCK',     'svh_',              'svh_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'Opening, physical, transfer, adjustment / issue / damage / expiry; one engine (StockPostingService).'),
    (1011, 'stock',      'stock_voucher_item',         1010,  'Stock Voucher Item',               'TRANSACTION', 'STOCK',     'svi_',              'svi_sync_date',            NULL,  'EDITABLE',    NULL,  true,   NULL),
    (1012, 'stock',      'stock_reservation',          NULL,  'Stock Reservation',                'TRANSACTION', 'STOCK',     'srv_',              'srv_sync_date',            NULL,  'DERIVED',     NULL,  true,   'Quantity held for an order; OPEN -> CONSUMED / RELEASED / EXPIRED.'),
    (1020, 'stock',      'stock_ledger',               NULL,  'Stock Ledger',                     'LEDGER',      'STOCK',     'sml_',              'sml_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Every stock movement. A cancel adds a reversal row; the forward row stays live.'),
    (1021, 'stock',      'stock_lot',                  NULL,  'Stock Lot',                        'MASTER',      'STOCK',     'slt_',              'slt_sync_date',            NULL,  'DERIVED',     NULL,  true,   'Lot identity (batch / MRP / price / none), created by the engine.'),
    (1022, 'stock',      'stock_batch_detail',         NULL,  'Batch Detail',                     'MASTER',      'STOCK',     'sbd_',              'sbd_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'A batch''s size / colour / model, keyed by (company, batch no).'),
    (1030, 'stock',      'stock_balance',              NULL,  'Stock Balance',                    'BALANCE',     'STOCK',     'sbl_',              'sbl_sync_date',            NULL,  'DERIVED',     NULL,  true,   'On-hand per godown / item / lot / bucket, kept by the engine.'),
    (1031, 'stock',      'stock_item_cost',            NULL,  'Item Average Cost',                'BALANCE',     'STOCK',     'sic_',              'sic_sync_date',            NULL,  'DERIVED',     NULL,  true,   NULL),
    (1032, 'stock',      'stock_transit',              NULL,  'Stock in Transit',                 'BALANCE',     'STOCK',     'stt_',              'stt_sync_date',            NULL,  'DERIVED',     NULL,  true,   'Transfers sent and not yet received.'),
    (1033, 'stock',      'stock_valuation_snap',       NULL,  'Stock Valuation Snapshot',         'BALANCE',     'STOCK',     'svs_',              'svs_sync_date',            NULL,  'DERIVED',     NULL,  true,   'DAY / MONTH / YEAR_OPEN / YEAR_CLOSE values.'),
    (1034, 'stock',      'stock_demand_daily',         NULL,  'Daily Demand',                     'BALANCE',     'STOCK',     'sdd_',              'sdd_sync_date',            NULL,  'DERIVED',     NULL,  true,   'Rebuilt from the ledger by fn_sdd_rebuild(); fix the ledger, not this.'),
    (1035, 'stock',      'stock_forecast',             NULL,  'Stock Forecast',                   'BALANCE',     'STOCK',     'sfc_',              'sfc_sync_date',            NULL,  'DERIVED',     NULL,  true,   NULL),
    (1036, 'stock',      'stock_movement_class',       NULL,  'ABC / XYZ / FSN Class',            'BALANCE',     'STOCK',     'smc_',              'smc_sync_date',            NULL,  'DERIVED',     NULL,  true,   NULL),
    -- 1100s GST
    (1101, 'public',     'gst_provider',               NULL,  'GST Provider',                     'SETTING',     'GST',       'gpv_',              'gpv_sync_date',            269,   'EDITABLE',    NULL,  true,   'GSP catalogue. Seeded (Gsp_Providers.sql).'),
    (1102, 'public',     'gst_provider_service',       1101,  'GST Provider Service',             'SETTING',     'GST',       'gps_',              'gps_sync_date',            269,   'EDITABLE',    NULL,  true,   NULL),
    (1103, 'public',     'gst_provider_endpoint',      1102,  'GST Provider Endpoint',            'SETTING',     'GST',       'gpe_',              'gpe_sync_date',            269,   'EDITABLE',    NULL,  true,   NULL),
    (1104, 'public',     'gst_provider_field_map',     1103,  'GST Provider Field Map',           'SETTING',     'GST',       'gfm_',              'gfm_sync_date',            269,   'EDITABLE',    NULL,  true,   NULL),
    (1105, 'public',     'gst_provider_error_map',     1101,  'GST Provider Error Map',           'SETTING',     'GST',       'gem_',              'gem_sync_date',            269,   'EDITABLE',    NULL,  true,   NULL),
    (1106, 'public',     'gst_provider_account',       1101,  'GST Provider Account',             'SETTING',     'GST',       'gpa_',              'gpa_sync_date',            269,   'EDITABLE',    NULL,  true,   NULL),
    (1107, 'public',     'gst_company_credential',     NULL,  'GST Credential',                   'SETTING',     'GST',       'gcc_',              'gcc_sync_date',            270,   'EDITABLE',    NULL,  true,   'Encrypted with GST_CRED_KEY.'),
    (1108, 'public',     'gst_auth_session',           1107,  'GST Auth Session',                 'SYSTEM',      'GST',       'gas_',              'gas_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'The live provider token; rotates every few hours, never returned to a client.'),
    (1110, 'public',     'gst_api_log',                NULL,  'GST API Log',                      'LOG',         'GST',       'gal_',              'gal_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'Every call to a GST provider.'),
    -- 1200s PRINT
    (1201, 'public',     'print_purpose',              NULL,  'Print Purpose',                    'METADATA',    'PRINT',     'ppo_',              'ppo_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'What a document is printed for (invoice, customer copy ...).'),
    (1202, 'public',     'print_template',             NULL,  'Print Template',                   'SETTING',     'PRINT',     'ptl_',              'ptl_sync_date',            62,    'EDITABLE',    NULL,  true,   NULL),
    (1203, 'public',     'print_template_version',     1202,  'Print Template Version',           'SETTING',     'PRINT',     'ptv_',              'ptv_sync_date',            62,    'EDITABLE',    NULL,  true,   NULL),
    (1204, 'public',     'print_template_dataset',     1203,  'Print Template Dataset',           'SETTING',     'PRINT',     'ptd_',              'ptd_sync_date',            62,    'EDITABLE',    NULL,  true,   NULL),
    (1205, 'public',     'print_template_assignment',  NULL,  'Print Assignment',                 'SETTING',     'PRINT',     'pta_',              'pta_sync_date',            248,   'EDITABLE',    NULL,  true,   'Which template and printer a purpose uses, per device.'),
    (1206, 'public',     'printer_profile',            NULL,  'Printer Profile',                  'SETTING',     'PRINT',     'prf_',              'prf_sync_date',            NULL,  'EDITABLE',    NULL,  true,   NULL),
    (1210, 'public',     'print_log',                  NULL,  'Print Log',                        'LOG',         'PRINT',     'plg_',              'plg_sync_date',            NULL,  'APPEND_ONLY', NULL,  true,   'One row per print / reprint attempt.'),
    -- 1300s TRANSPORT
    (1301, 'public',     'transporter_master',         NULL,  'Transporter',                      'MASTER',      'TRANSPORT', 'trn_',              'trn_sync_date',            149,   'EDITABLE',    NULL,  true,   'GSTIN or TRANSIN on an e-way bill.'),
    (1302, 'public',     'vehicle_master',             NULL,  'Vehicle',                          'MASTER',      'TRANSPORT', 'veh_',              'veh_sync_date',            125,   'EDITABLE',    NULL,  true,   NULL),
    (1310, 'public',     'txn_transport_detail',       NULL,  'Document Transport',               'TRANSACTION', 'TRANSPORT', 'ttd_',              'ttd_sync_date',            NULL,  'EDITABLE',    NULL,  true,   'The transport band of every goods-moving document; no single header, so no parent.')
  ) AS v(id, sch, tbl, parent, name, kind, module, prefix, sync_col, menu, write_mode, keep_days, active, descr)
 WHERE to_regclass(format('%I.%I', v.sch, v.tbl)) IS NOT NULL
ON CONFLICT (dtm_id) DO UPDATE SET
    dtm_schema         = EXCLUDED.dtm_schema,
    dtm_table          = EXCLUDED.dtm_table,
    dtm_parent_id      = EXCLUDED.dtm_parent_id,
    dtm_name           = EXCLUDED.dtm_name,
    dtm_kind           = EXCLUDED.dtm_kind,
    dtm_module         = EXCLUDED.dtm_module,
    dtm_col_prefix     = EXCLUDED.dtm_col_prefix,
    dtm_sync_col       = EXCLUDED.dtm_sync_col,
    dtm_menu_id        = EXCLUDED.dtm_menu_id,
    dtm_write_mode     = EXCLUDED.dtm_write_mode,
    dtm_retention_days = EXCLUDED.dtm_retention_days,
    dtm_is_active      = EXCLUDED.dtm_is_active,
    dtm_description    = EXCLUDED.dtm_description,
    dtm_modified_on    = now()
 WHERE (d.dtm_schema, d.dtm_table, d.dtm_parent_id, d.dtm_name, d.dtm_kind, d.dtm_module,
        d.dtm_col_prefix, d.dtm_sync_col, d.dtm_menu_id, d.dtm_write_mode, d.dtm_retention_days,
        d.dtm_is_active, d.dtm_description)
       IS DISTINCT FROM
       (EXCLUDED.dtm_schema, EXCLUDED.dtm_table, EXCLUDED.dtm_parent_id, EXCLUDED.dtm_name,
        EXCLUDED.dtm_kind, EXCLUDED.dtm_module, EXCLUDED.dtm_col_prefix, EXCLUDED.dtm_sync_col,
        EXCLUDED.dtm_menu_id,
        EXCLUDED.dtm_write_mode, EXCLUDED.dtm_retention_days, EXCLUDED.dtm_is_active,
        EXCLUDED.dtm_description);

-- Past the highest id written out above, so a row added without an id does not collide.
SELECT setval(pg_get_serial_sequence('public.db_table_master', 'dtm_id'),
              GREATEST((SELECT max(dtm_id) FROM public.db_table_master), 1));

COMMIT;
