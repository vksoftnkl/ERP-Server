#!/usr/bin/env node
'use strict';

/**
 * Regenerates the UI-configuration seed files in prisma/seed from a reference
 * database:
 *
 *   Ui_Tables.sql          fixed.ui_tables          (grid/table registry)
 *   Ui_Table_Columns.sql   fixed.ui_table_columns   (entry-screen item grids)
 *   Grid_Details.sql       fixed.grid_details       (list/report grids + their SQL)
 *   Grid_Columns.sql       fixed.grid_columns
 *   Dropdown_Details.sql   fixed.dropdown_details   (lookup popups + their SQL)
 *   Dropdown_Columns.sql   fixed.dropdown_columns
 *
 * These six tables are configuration, not transactions: screens read them to decide
 * which columns exist, so an environment without them renders empty grids and saves
 * NULLs. Hand-editing 1600 rows is not realistic, hence this exporter.
 *
 * Usage:
 *   npm run seed:export:ui-config                 # reads DATABASE_URL from .env
 *   DATABASE_URL=postgres://... npm run seed:export:ui-config
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
    file: 'Ui_Tables.sql',
    table: 'fixed.ui_tables',
    orderBy: 'ui_tbl_id',
    conflictTarget: 'ui_tbl_id',
    sequenceColumn: 'ui_tbl_id',
    header: (count) => [
      `-- Seed: fixed.ui_tables -- the registry of entry-screen item grids (${count} rows).`,
      '--',
      '-- Every "Quotation-item"/"Sale bill item" style grid the entry screens render is a',
      '-- row here, and fixed.ui_table_columns hangs off it (fk_ui_tables). The client asks',
      '-- for a grid by ui_tbl_id -- quotation.constants.ts pins ITEM_GRID_UI_TABLE_ID = 23',
      '-- -- so the ids are written out rather than left to the sequence, and the setval at',
      '-- the bottom keeps the sequence ahead of them.',
      '--',
      '-- ui_tbl_created_by is written as \'system\' instead of the exporting environment\'s',
      '-- user uuid, which would mean nothing in another database.',
    ],
    columns: [
      column('ui_tbl_id', 'plain', 'bigint'),
      column('ui_tbl_name', 'literal', 'text'),
      column('ui_tbl_editable', 'bool', 'boolean'),
      column('ui_tbl_device_type', 'literal', 'text'),
      column('ui_tbl_is_active', 'bool', 'boolean'),
      column('ui_tbl_is_deleted', 'bool', 'boolean'),
      column('ui_tbl_created_by', 'const', 'varchar', { value: "'system'" }),
    ],
  },
  {
    file: 'Ui_Table_Columns.sql',
    table: 'fixed.ui_table_columns',
    orderBy: 'ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_id',
    conflictTarget: 'ui_tbl_clm_id',
    sequenceColumn: 'ui_tbl_clm_id',
    guard: { column: 'ui_tbl_clm_table_id', alias: 'existing', noun: 'ui table' },
    groupBy: {
      column: 'ui_tbl_clm_table_id',
      labelSql: 'SELECT ui_tbl_id AS id, ui_tbl_name AS label FROM fixed.ui_tables',
    },
    header: (count) => [
      `-- Seed: fixed.ui_table_columns -- the column layout of every entry-screen item grid (${count} rows).`,
      '--',
      '-- A grid column exists for the client only if it has a row here: the entry screens',
      '-- match each row against their local column-meaning list on a normalized token and',
      '-- skip any meaning with no row, so a missing row means the field has no cell to type',
      '-- into and every line saves NULL for it.',
      '--',
      '-- Runs after Ui_Tables.sql -- ui_tbl_clm_table_id is a foreign key into it.',
      '--',
      '-- Idempotency: a ui table that ALREADY HAS ANY COLUMN is left completely alone (the',
      '-- WHERE NOT EXISTS below), because sites re-order, re-width and hide columns and a',
      '-- re-run must not fight that. Consequence: this file does not add a newly introduced',
      '-- column to a table that is already laid out -- that is what a targeted seed like',
      '-- Quotation_Item_Grid_ItemSize_Column.sql is for.',
      '--',
      '-- ui_tbl_clm_no / _position are kept exactly as exported (duplicate numbers on a few',
      '-- tables included -- the table has no unique constraint on them, and the client sorts',
      '-- by number, so reshuffling them here would silently re-order live screens).',
    ],
    columns: [
      column('ui_tbl_clm_id', 'plain', 'bigint'),
      column('ui_tbl_clm_table_id', 'plain', 'bigint'),
      column('ui_tbl_clm_no', 'plain', 'bigint'),
      column('ui_tbl_clm_name', 'literal', 'text'),
      column('ui_tbl_clm_column_width', 'plain', 'numeric'),
      column('ui_tbl_clm_column_visibility', 'bool', 'boolean'),
      column('ui_tbl_clm_column_focus', 'bool', 'boolean'),
      column('ui_tbl_clm_column_position', 'plain', 'integer'),
      column('ui_tbl_clm_column_necessity', 'bool', 'boolean'),
      column('ui_tbl_clm_next_column', 'plain', 'integer'),
      column('ui_tbl_clm_previous_column', 'plain', 'integer'),
      column('ui_tbl_clm_is_active', 'bool', 'boolean'),
      column('ui_tbl_clm_is_deleted', 'bool', 'boolean'),
      column('ui_tbl_clm_created_by', 'const', 'varchar', { value: "'system'" }),
    ],
  },
  {
    file: 'Grid_Details.sql',
    table: 'fixed.grid_details',
    orderBy: 'grid_id',
    conflictTarget: 'grid_id',
    sequenceColumn: 'grid_id',
    header: (count) => [
      `-- Seed: fixed.grid_details -- the configured list/report grids and the SQL behind them (${count} rows).`,
      '--',
      '-- grid_sql is user-configurable SQL executed by the grid "run" endpoint through the',
      '-- read-only pool, with p_* named tokens bound as parameters (bindGridParams). It is',
      '-- dollar-quoted below ($seed$...$seed$) so quotes and newlines survive verbatim --',
      '-- nothing in the data contains that tag.',
      '--',
      '-- Ids are explicit: fixed.grid_columns references grid_id, and the client requests a',
      '-- grid by id. The setval at the bottom keeps the sequence ahead of them.',
      '--',
      '-- Idempotent: ON CONFLICT (grid_id) DO NOTHING -- an existing grid keeps its locally',
      '-- edited SQL, sort column and description.',
    ],
    columns: [
      column('grid_id', 'plain', 'bigint'),
      column('grid_name', 'literal', 'text'),
      column('grid_description', 'literal', 'text'),
      column('grid_sort_column', 'literal', 'text'),
      column('grid_sort_order', 'literal', 'text'),
      column('grid_device_type', 'literal', 'text'),
      column('grid_status', 'bool', 'boolean'),
      column('grid_is_deleted', 'bool', 'boolean'),
      column('grid_created_by', 'const', 'text', { value: "'system'" }),
      column('grid_sql', 'dollar', 'text', { ownLine: true }),
    ],
  },
  {
    file: 'Grid_Columns.sql',
    table: 'fixed.grid_columns',
    orderBy: 'grid_id, grid_column_number, grid_column_id',
    conflictTarget: 'grid_column_id',
    guard: { column: 'grid_id', alias: 'existing', noun: 'grid' },
    groupBy: {
      column: 'grid_id',
      labelSql: 'SELECT grid_id AS id, grid_name AS label FROM fixed.grid_details',
    },
    header: (count) => [
      `-- Seed: fixed.grid_columns -- the column layout of every configured grid (${count} rows).`,
      '--',
      '-- Runs after Grid_Details.sql -- grid_id is a foreign key into it, ON DELETE CASCADE.',
      '--',
      '-- grid_column_id is the primary key (uuidv7 by default) and is exported as-is, so a',
      '-- re-run conflicts on it and does nothing. On top of that, a grid that ALREADY HAS',
      '-- ANY COLUMN is skipped entirely (WHERE NOT EXISTS below): that is what protects a',
      '-- site whose columns were created independently -- their uuids differ, so conflict',
      '-- alone would duplicate the layout.',
      '--',
      '-- grid_column_sql_field_name is the field the grid SQL returns; grid_column_name is',
      '-- only the heading. Duplicate grid_column_number values inside a grid are exported as',
      '-- they are (there is no unique constraint, and renumbering would re-order the grid).',
    ],
    columns: [
      column('grid_column_id', 'literal', 'uuid'),
      column('grid_id', 'plain', 'bigint'),
      column('grid_column_number', 'plain', 'integer'),
      column('grid_column_name', 'literal', 'text'),
      column('grid_column_sql_field_name', 'literal', 'text'),
      column('grid_column_data_type', 'literal', 'text'),
      column('grid_column_width', 'plain', 'numeric'),
      column('grid_column_position', 'plain', 'numeric'),
      column('grid_column_alignment', 'literal', 'text'),
      column('grid_column_visibility', 'bool', 'boolean'),
      column('grid_column_filter', 'bool', 'boolean'),
      column('grid_column_group', 'bool', 'boolean'),
      column('grid_column_total', 'bool', 'boolean'),
      column('grid_column_color', 'literal', 'text'),
      column('grid_column_condition', 'literal', 'text'),
      column('grid_column_condition_color', 'literal', 'text'),
      column('grid_column_notes', 'literal', 'text'),
      column('grid_column_is_deleted', 'bool', 'boolean'),
      column('grid_column_created_by', 'const', 'text', { value: "'system'" }),
    ],
  },
  {
    file: 'Dropdown_Details.sql',
    table: 'fixed.dropdown_details',
    orderBy: 'dropdown_id',
    conflictTarget: 'dropdown_id',
    sequenceColumn: 'dropdown_id',
    header: (count) => [
      `-- Seed: fixed.dropdown_details -- the configured lookup popups and their SQL (${count} rows).`,
      '--',
      '-- dropdown_sql is user-configurable SQL run through the read-only pool, same contract',
      '-- as grid_sql; dollar-quoted below so quotes and newlines survive verbatim.',
      '-- dropdown_sql_regional is the localized variant where one exists.',
      '--',
      '-- Ids are explicit: fixed.dropdown_columns references dropdown_id and screens request',
      '-- a dropdown by id. The setval at the bottom keeps the sequence ahead of them.',
      '--',
      '-- Idempotent: ON CONFLICT (dropdown_id) DO NOTHING.',
    ],
    columns: [
      column('dropdown_id', 'plain', 'integer'),
      column('dropdown_name', 'literal', 'varchar'),
      column('dropdown_description', 'literal', 'text'),
      column('dropdown_sort_column', 'literal', 'varchar'),
      column('dropdown_sort_order', 'literal', 'varchar'),
      column('dropdown_max_visible_items', 'plain', 'integer'),
      column('dropdown_show_header', 'bool', 'boolean'),
      column('dropdown_width', 'plain', 'integer'),
      column('dropdown_device_type', 'literal', 'text'),
      column('dropdown_completion', 'literal', 'text'),
      column('dropdown_created_by', 'const', 'text', { value: "'system'" }),
      column('dropdown_sql', 'dollar', 'text', { ownLine: true }),
      column('dropdown_sql_regional', 'dollar', 'text', { ownLine: true }),
    ],
  },
  {
    file: 'Dropdown_Columns.sql',
    table: 'fixed.dropdown_columns',
    orderBy: 'dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_id',
    conflictTarget: 'dropdown_columns_id',
    guard: { column: 'dropdown_columns_dropdown_id', alias: 'existing', noun: 'dropdown' },
    groupBy: {
      column: 'dropdown_columns_dropdown_id',
      labelSql: 'SELECT dropdown_id AS id, dropdown_name AS label FROM fixed.dropdown_details',
    },
    header: (count) => [
      `-- Seed: fixed.dropdown_columns -- the column layout of every configured lookup popup (${count} rows).`,
      '--',
      '-- Runs after Dropdown_Details.sql -- dropdown_columns_dropdown_id is a foreign key',
      '-- into it, ON DELETE CASCADE.',
      '--',
      '-- Same two-part idempotency as Grid_Columns.sql: the exported uuid primary key makes',
      '-- a re-run a no-op, and a dropdown that already has any column is skipped entirely so',
      '-- an independently configured popup is never duplicated.',
      '--',
      '-- dropdown_columns_sql_name is the field the dropdown SQL returns;',
      '-- dropdown_columns_name is the heading, _alias the label the client shows.',
    ],
    columns: [
      column('dropdown_columns_id', 'literal', 'uuid'),
      column('dropdown_columns_dropdown_id', 'plain', 'integer'),
      column('dropdown_columns_no', 'plain', 'integer'),
      column('dropdown_columns_name', 'literal', 'varchar'),
      column('dropdown_columns_sql_name', 'literal', 'text'),
      column('dropdown_columns_alias', 'literal', 'varchar'),
      column('dropdown_columns_data_type', 'literal', 'varchar'),
      column('dropdown_columns_width', 'plain', 'numeric'),
      column('dropdown_columns_allignment', 'literal', 'varchar'),
      column('dropdown_columns_visiblity', 'bool', 'boolean'),
      column('dropdown_columns_filter', 'bool', 'boolean'),
      column('dropdown_columns_created_by', 'const', 'text', { value: "'system'" }),
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
      regenerateScript: 'seed:export:ui-config',
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
