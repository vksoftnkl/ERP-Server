#!/usr/bin/env node
'use strict';

/**
 * Regenerates the reference-master seed files in prisma/seed from a reference
 * database:
 *
 *   Price_Levels.sql          fixed.price_levels
 *   Item_Price_Levels.sql     inventory.item_price_levels
 *   Item_Gst_Units.sql        inventory.item_gst_units      (GST UQC list)
 *   Stock_Adjust_Reasons.sql  fixed.stock_adj_reasons
 *   Acc_Tender_Types.sql      accounts.acc_tender_types
 *   Acc_Voucher_Types.sql     accounts.acc_voucher_types
 *
 * Small, slow-moving lists that transactions point at: a sale bill picks a price
 * level, a tender line picks a tender type, a voucher number comes from a voucher
 * type. An environment missing them cannot save those documents at all.
 *
 * Usage:
 *   npm run seed:export:masters                   # reads DATABASE_URL from .env
 *   DATABASE_URL=postgres://... npm run seed:export:masters
 *
 * Then review `git diff prisma/seed` and apply with `npm run seed:run`.
 */

const path = require('node:path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const { column, exportSeedFiles } = require('./lib/seed-file-writer');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SEED_DIR = path.resolve(process.cwd(), 'prisma', 'seed');

const TABLES = [
  {
    file: 'Price_Levels.sql',
    table: 'fixed.price_levels',
    orderBy: 'price_lvl_id',
    conflictTarget: 'price_lvl_id',
    sequenceColumn: 'price_lvl_id',
    header: (count) => [
      `-- Seed: fixed.price_levels -- the selling price levels offered on entry screens (${count} rows).`,
      '--',
      '-- Not to be confused with inventory.item_price_levels (Item_Price_Levels.sql): this',
      '-- is the fixed-schema list, and the inventory one is what sales documents carry a',
      '-- foreign key to. Both are seeded because both are read.',
      '--',
      '-- price_lvl_is_admin marks a level only an administrator may pick; is_active = false',
      '-- retires a level without deleting it, so old documents still resolve their label.',
      '--',
      '-- Ids are explicit so a level means the same thing in every environment, and the',
      '-- setval keeps the sequence past them. Idempotent: ON CONFLICT (price_lvl_id) DO',
      '-- NOTHING -- an existing level keeps its locally edited name and flags.',
      '--',
      '-- Column names are quoted where the table uses camelCase ("price_lvl_isDeleted").',
    ],
    columns: [
      column('price_lvl_id', 'plain', 'integer'),
      column('price_lvl_name', 'literal', 'varchar'),
      column('price_lvl_short', 'literal', 'varchar'),
      column('price_lvl_is_active', 'bool', 'boolean'),
      column('price_lvl_is_admin', 'bool', 'boolean'),
      column('price_lvl_isDeleted', 'bool', 'boolean', { quote: true }),
      column('price_lvl_createdBy', 'const', 'varchar', { quote: true, value: "'system'" }),
    ],
  },
  {
    file: 'Item_Price_Levels.sql',
    table: 'inventory.item_price_levels',
    orderBy: 'ipl_id',
    conflictTarget: 'ipl_id',
    sequenceColumn: 'ipl_id',
    header: (count) => [
      `-- Seed: inventory.item_price_levels -- the price levels sales documents point at (${count} rows).`,
      '--',
      '-- ipl_id is referenced ON DELETE RESTRICT by sales.customers, sales.sale_bill(_item),',
      '-- sales.sale_order(_item), sales.sale_quotation(_item) and inventory.item_qty_price,',
      '-- so the ids are written out: a customer on price level 2 has to mean the same level',
      '-- in every environment, and item rate lookups key off it.',
      '--',
      '-- ipl_uname is the short code shown in grids; ipl_admin restricts the level to',
      '-- administrators; ipl_status = false hides it from selection without breaking the',
      '-- documents that already reference it.',
      '--',
      '-- ipl_created_by / ipl_modified_by are NOT NULL, so they are written as \'system\'',
      '-- rather than the exporting environment\'s user id.',
      '--',
      '-- Idempotent: ON CONFLICT (ipl_id) DO NOTHING.',
    ],
    columns: [
      column('ipl_id', 'plain', 'integer'),
      column('ipl_name', 'literal', 'text'),
      column('ipl_uname', 'literal', 'text'),
      column('ipl_status', 'bool', 'boolean'),
      column('ipl_admin', 'bool', 'boolean'),
      column('ipl_is_deleted', 'bool', 'boolean'),
      column('ipl_created_by', 'const', 'text', { value: "'system'" }),
      column('ipl_modified_by', 'const', 'text', { value: "'system'" }),
    ],
  },
  {
    file: 'Item_Gst_Units.sql',
    table: 'inventory.item_gst_units',
    orderBy: 'item_gst_unit_code',
    conflictTarget: 'item_gst_unit_code',
    header: (count) => [
      `-- Seed: inventory.item_gst_units -- the GST UQC (Unit Quantity Code) list (${count} rows).`,
      '--',
      '-- The codes GST returns expect on invoices and returns: BAG, KGS, NOS, PCS, ... Every',
      '-- unit in inventory.item_unit_master points at one through unit_code, which is a',
      '-- foreign key to item_gst_unit_code -- the CODE, not the id.',
      '--',
      '-- That is why no id is written here: item_gst_unit_id is a plain sequence value that',
      '-- nothing references, so each environment can allocate its own.',
      '--',
      '-- Idempotent: ON CONFLICT (item_gst_unit_code) DO NOTHING -- a code already present',
      '-- keeps its name (sites do relabel a few of these).',
    ],
    columns: [
      column('item_gst_unit_code', 'literal', 'text'),
      column('item_gst_unit_name', 'literal', 'text'),
      column('item_gst_unit_created_by', 'const', 'text', { value: "'system'" }),
    ],
  },
  {
    file: 'Stock_Adjust_Reasons.sql',
    table: 'fixed.stock_adj_reasons',
    orderBy: 'sar_code',
    conflictTarget: 'sar_code',
    header: (count) => [
      `-- Seed: fixed.stock_adj_reasons -- why a physical-stock count did not match (${count} rows).`,
      '--',
      '-- Picked per line on the physical stock screen: stock.physical_stock_detail.',
      '-- psd_reason_id is a foreign key to sar_id. sar_reason_kind classifies the reason and',
      '-- sar_default_resolution is the action the screen pre-selects for it',
      '-- (ADJUST_LOSS_GAIN, RECLASSIFY, CORRECT_SOURCE_DOC, RECOUNT_REQUIRED).',
      '-- sar_affects_accounts marks the reasons that post a value difference to the ledgers,',
      '-- as opposed to the ones that only move stock between codes.',
      '--',
      '-- sar_id (uuidv7) is deliberately NOT written out: nothing outside this database',
      '-- refers to it, so each environment generates its own. The stable identity is',
      '-- sar_code, which is UNIQUE and is what this file conflicts on.',
      '--',
      '-- Idempotent: ON CONFLICT (sar_code) DO NOTHING.',
    ],
    columns: [
      column('sar_code', 'literal', 'varchar'),
      column('sar_name', 'literal', 'varchar'),
      column('sar_reason_kind', 'literal', 'varchar'),
      column('sar_default_resolution', 'literal', 'varchar'),
      column('sar_affects_accounts', 'bool', 'boolean'),
      column('sar_is_active', 'bool', 'boolean'),
      column('sar_is_deleted', 'bool', 'boolean'),
    ],
  },
  {
    file: 'State_Codes.sql',
    table: 'fixed.state_codes',
    orderBy: 'state_code',
    conflictTarget: 'state_code',
    header: (count) => [
      `-- Seed: fixed.state_codes -- the GST state codes of India (${count} rows).`,
      '--',
      '-- The two-digit code that opens every GSTIN, and the value place-of-supply is decided',
      '-- on: sales.sale_quotation, sale_bill and sale_order (twice -- place of supply and',
      '-- ship-to) all carry a foreign key to state_code, so a document stamped \'33\' has to',
      '-- mean Tamil Nadu in every environment. Without these rows no sales document saves.',
      '--',
      '-- state_code is the primary key and is issued by the GST department, not by a',
      '-- sequence, so the codes are written out verbatim and there is no setval.',
      '--',
      '-- state_ut marks a Union Territory (UTGST applies instead of SGST on an intra-UT',
      '-- supply). tin_code is the legacy VAT TIN prefix, which matches the GST code for',
      '-- every state. is_active = false retires a code without deleting it -- 25 (Daman and',
      '-- Diu) was merged into 26 in 2020, and old documents still have to resolve its label.',
      '-- 97 (Other Territory) and 99 (Centre Jurisdiction) are the department\'s own',
      '-- pseudo-states, not geography.',
      '--',
      '-- state_sync_date is left NULL: it records when a site last reconciled the list',
      '-- against the GST portal, which is per-environment and not a property of the data.',
      '--',
      '-- Idempotent: ON CONFLICT (state_code) DO NOTHING -- a code already present keeps its',
      '-- locally edited name and flags.',
    ],
    columns: [
      column('state_code', 'literal', 'char(2)'),
      column('state_name', 'literal', 'varchar'),
      column('state_ut', 'bool', 'boolean'),
      column('tin_code', 'literal', 'varchar'),
      column('is_active', 'bool', 'boolean'),
      column('is_deleted', 'bool', 'boolean'),
      column('created_by', 'const', 'varchar', { value: "'system'" }),
      column('modified_by', 'const', 'varchar', { value: "'system'" }),
    ],
  },
  {
    file: 'Acc_Tender_Types.sql',
    table: 'accounts.acc_tender_types',
    orderBy: 'ttm_display_order, ttm_type_id',
    conflictTarget: 'ttm_type_id',
    header: (count) => [
      `-- Seed: accounts.acc_tender_types -- the ways a bill can be paid (${count} rows).`,
      '--',
      '-- accounts.acc_tender_master.tnd_type_id and acc_tender_detail.td_tender_type_id are',
      '-- foreign keys here, ON DELETE RESTRICT, so the ids are written out -- a tender line',
      '-- recorded as type 3 has to stay UPI everywhere.',
      '--',
      '-- ttm_type_id has NO sequence default on this table: the id must always be supplied,',
      '-- which is why there is no setval at the bottom. Pick the next free number by hand',
      '-- when adding a tender type.',
      '--',
      '-- Flags, because they drive the payment screen:',
      '--   * ttm_needs_ref forces a reference to be typed, labelled by ttm_ref_label (a check',
      '--     constraint enforces that the label exists whenever needs_ref is true);',
      '--   * ttm_is_cash marks the tender change can be given from;',
      '--   * ttm_allow_change permits over-tender, ttm_sale_only hides it outside sales, and',
      '--     ttm_allow_in_return decides whether a refund may be paid back this way.',
      '--',
      '-- Rows are ordered by ttm_display_order, the order the screen lists them in.',
      '-- Idempotent: ON CONFLICT (ttm_type_id) DO NOTHING.',
    ],
    columns: [
      column('ttm_type_id', 'plain', 'integer'),
      column('ttm_type_name', 'literal', 'varchar'),
      column('ttm_display_name', 'literal', 'varchar'),
      column('ttm_is_cash', 'bool', 'boolean'),
      column('ttm_needs_ref', 'bool', 'boolean'),
      column('ttm_ref_label', 'literal', 'varchar'),
      column('ttm_sale_only', 'bool', 'boolean'),
      column('ttm_allow_change', 'bool', 'boolean'),
      column('ttm_allow_in_return', 'bool', 'boolean'),
      column('ttm_display_order', 'plain', 'integer'),
      column('ttm_is_active', 'bool', 'boolean'),
      column('ttm_is_deleted', 'bool', 'boolean'),
      column('ttm_created_by', 'const', 'varchar', { value: "'system'" }),
    ],
  },
  {
    file: 'Acc_Voucher_Types.sql',
    table: 'accounts.acc_voucher_types',
    orderBy: 'vchr_type_id',
    conflictTarget: 'vchr_type_id',
    sequenceColumn: 'vchr_type_id',
    header: (count) => [
      `-- Seed: accounts.acc_voucher_types -- one row per document series (${count} rows).`,
      '--',
      '-- Every numbered document resolves its series here: accounts.acc_voucher_seq keys its',
      '-- counters on seq_vchr_type_id, and the sales services allocate numbers through',
      '-- findOrCreateSequence() (src/common/Sequence/voucher-sequence.helper.ts), which copies',
      '-- vchr_no_prefix / _suffix / _width into the counter row as a format snapshot. Editing',
      '-- a type later therefore never rewrites numbers already issued.',
      '--',
      '-- This file supersedes the three single-type seeds kept alongside it',
      '-- (Acc_Voucher_Types_Sale_Bill / _Sale_Order / _Order_Advance_Receipt): it runs first',
      '-- in the manifest, so those turn into no-ops. They are left in place because each one',
      '-- documents the reasoning behind its row, and because they still add their type to a',
      '-- database seeded before this export existed.',
      '--',
      '-- The enum columns (vchr_category, vchr_nature, vchr_numbering_mode, vchr_reset_freq)',
      '-- are cast to their accounts."..." enum types on the first row; PostgreSQL resolves',
      '-- the rest of the VALUES list from it.',
      '--',
      '-- Idempotent: ON CONFLICT (vchr_type_id) DO NOTHING, and the setval keeps the sequence',
      '-- past the seeded ids.',
    ],
    columns: [
      column('vchr_type_id', 'plain', 'integer'),
      column('vchr_type_code', 'literal', 'varchar'),
      column('vchr_type_name', 'literal', 'varchar'),
      column('vchr_type_short', 'literal', 'varchar'),
      column('vchr_category', 'literal', 'accounts."VoucherCategory"'),
      column('vchr_nature', 'literal', 'accounts."VoucherNature"'),
      column('vchr_numbering_mode', 'literal', 'accounts."VoucherNumberingMode"'),
      column('vchr_no_prefix', 'literal', 'varchar'),
      column('vchr_no_suffix', 'literal', 'varchar'),
      column('vchr_no_width', 'plain', 'integer'),
      column('vchr_reset_freq', 'literal', 'accounts."VoucherResetFreq"'),
      column('vchr_allow_manual_no', 'bool', 'boolean'),
      column('vchr_affects_accounts', 'bool', 'boolean'),
      column('vchr_affects_inventory', 'bool', 'boolean'),
      column('vchr_is_cash_voucher', 'bool', 'boolean'),
      column('vchr_is_bank_voucher', 'bool', 'boolean'),
      column('vchr_print_title', 'literal', 'varchar'),
      column('vchr_sort_order', 'plain', 'integer'),
      column('vchr_is_active', 'bool', 'boolean'),
      column('vchr_tally_export_enabled', 'bool', 'boolean'),
      column('vchr_tally_voucher_type_name', 'literal', 'varchar'),
      column('vchr_tally_base_voucher_type', 'literal', 'varchar'),
      column('vchr_created_by', 'const', 'varchar', { value: "'system'" }),
    ],
  },
];

const main = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — point it at the reference database.');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const written = await exportSeedFiles({
      client,
      seedDir: SEED_DIR,
      tables: TABLES,
      regenerateScript: 'seed:export:masters',
    });
    for (const entry of written) {
      console.log(`${entry.file.padEnd(24)} ${String(entry.rows).padStart(5)} rows`);
    }
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error('Export failed:', error.message);
  process.exit(1);
});
