#!/usr/bin/env node
const { resolve } = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const TABLE_REFS = {
  ui_table: '"fixed"."ui_table"',
  ui_table_columns: '"fixed"."ui_table_columns"',
  ui_tables: '"fixed"."ui_tables"',
};

const printHelpAndExit = () => {
  console.log(`Usage:
  node scripts/repair-ui-table-drift.js [options]

Options:
  --dry-run   Inspect and print the repair actions without writing changes
  --help      Show this help text

What it repairs:
  - Renames fixed.ui_table to fixed.ui_table_columns when the drifted table exists
  - Renames the serial sequence if required
  - Re-adds ui_tbl_clm_table_id when it is missing
  - Re-adds the foreign key to fixed.ui_tables without deleting data
`);
  process.exit(0);
};

const parseArgs = () => {
  let dryRun = false;

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit();
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun };
};

const getTableCount = async (client, tableName) => {
  const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${TABLE_REFS[tableName]}`);
  return BigInt(result.rows[0].count);
};

const getExistingTables = async (client) => {
  const result = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'fixed'
      AND tablename IN ('ui_table', 'ui_table_columns', 'ui_tables')
    ORDER BY tablename
  `);

  return new Set(result.rows.map((row) => row.tablename));
};

const sequenceExists = async (client, sequenceName) => {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_class AS cls
      JOIN pg_namespace AS nsp
        ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'fixed'
        AND cls.relkind = 'S'
        AND cls.relname = $1
      LIMIT 1
    `,
    [sequenceName],
  );

  return result.rows.length > 0;
};

const columnExists = async (client, tableName, columnName) => {
  const result = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'fixed'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return result.rows.length > 0;
};

const getForeignKey = async (client, tableName) => {
  const result = await client.query(
    `
    SELECT con.conname, con.convalidated
    FROM pg_constraint AS con
    JOIN pg_class AS src_table
      ON src_table.oid = con.conrelid
    JOIN pg_namespace AS src_schema
      ON src_schema.oid = src_table.relnamespace
    JOIN pg_attribute AS src_col
      ON src_col.attrelid = src_table.oid
     AND src_col.attnum = con.conkey[1]
    JOIN pg_class AS dst_table
      ON dst_table.oid = con.confrelid
    JOIN pg_namespace AS dst_schema
      ON dst_schema.oid = dst_table.relnamespace
    JOIN pg_attribute AS dst_col
      ON dst_col.attrelid = dst_table.oid
     AND dst_col.attnum = con.confkey[1]
    WHERE src_schema.nspname = 'fixed'
      AND src_table.relname = $1
      AND con.contype = 'f'
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
      AND src_col.attname = 'ui_tbl_clm_table_id'
      AND dst_schema.nspname = 'fixed'
      AND dst_table.relname = 'ui_tables'
      AND dst_col.attname = 'ui_tbl_id'
    LIMIT 1
  `,
    [tableName],
  );

  return result.rows[0] ?? null;
};

const getOrphanedRelationCount = async (client, tableName) => {
  const result = await client.query(`
    SELECT COUNT(*)::bigint AS count
    FROM ${TABLE_REFS[tableName]} AS columns
    LEFT JOIN "fixed"."ui_tables" AS tables
      ON tables."ui_tbl_id" = columns."ui_tbl_clm_table_id"
    WHERE columns."ui_tbl_clm_table_id" IS NOT NULL
      AND tables."ui_tbl_id" IS NULL
  `);

  return BigInt(result.rows[0].count);
};

const main = async () => {
  const { dryRun } = parseArgs();
  dotenv.config({ path: resolve(process.cwd(), '.env') });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  const actions = [];

  const runStep = async (description, sql) => {
    actions.push(`${dryRun ? '[dry-run]' : '[apply]'} ${description}`);
    if (!dryRun) {
      await client.query(sql);
    }
  };

  await client.connect();

  try {
    await client.query('BEGIN');

    const existingTables = await getExistingTables(client);
    const initialHasUiTable = existingTables.has('ui_table');
    const initialHasUiTableColumns = existingTables.has('ui_table_columns');

    if (!existingTables.has('ui_tables')) {
      throw new Error('Expected fixed.ui_tables to exist, but it was not found.');
    }

    const counts = {};
    if (existingTables.has('ui_table')) {
      counts.ui_table = await getTableCount(client, 'ui_table');
    }
    if (existingTables.has('ui_table_columns')) {
      counts.ui_table_columns = await getTableCount(client, 'ui_table_columns');
    }

    if (existingTables.has('ui_table') && existingTables.has('ui_table_columns')) {
      throw new Error(
        `Both fixed.ui_table (${counts.ui_table.toString()} rows) and fixed.ui_table_columns (${counts.ui_table_columns.toString()} rows) exist. Refusing to guess which table should be kept.`,
      );
    }

    const liveTableNameBeforeRepair = existingTables.has('ui_table_columns') ? 'ui_table_columns' : 'ui_table';

    if (existingTables.has('ui_table') && !existingTables.has('ui_table_columns')) {
      await runStep(
        'rename fixed.ui_table to fixed.ui_table_columns',
        'ALTER TABLE "fixed"."ui_table" RENAME TO "ui_table_columns"',
      );
      existingTables.delete('ui_table');
      existingTables.add('ui_table_columns');

      const hasLegacySequence = await sequenceExists(client, 'ui_table_ui_tbl_clm_id_seq');
      const hasExpectedSequence = await sequenceExists(client, 'ui_table_columns_ui_tbl_clm_id_seq');

      if (hasLegacySequence && !hasExpectedSequence) {
        await runStep(
          'rename fixed.ui_table_ui_tbl_clm_id_seq to fixed.ui_table_columns_ui_tbl_clm_id_seq',
          'ALTER SEQUENCE "fixed"."ui_table_ui_tbl_clm_id_seq" RENAME TO "ui_table_columns_ui_tbl_clm_id_seq"',
        );
      }

      if (hasLegacySequence || hasExpectedSequence) {
        await runStep(
          'attach the ui_table_columns id sequence to fixed.ui_table_columns.ui_tbl_clm_id',
          `
            ALTER SEQUENCE "fixed"."ui_table_columns_ui_tbl_clm_id_seq"
            OWNED BY "fixed"."ui_table_columns"."ui_tbl_clm_id"
          `,
        );
        await runStep(
          'restore the default sequence for fixed.ui_table_columns.ui_tbl_clm_id',
          `
            ALTER TABLE "fixed"."ui_table_columns"
            ALTER COLUMN "ui_tbl_clm_id"
            SET DEFAULT nextval('fixed.ui_table_columns_ui_tbl_clm_id_seq'::regclass)
          `,
        );
      }
    }

    if (!existingTables.has('ui_table_columns')) {
      throw new Error('Neither fixed.ui_table_columns nor a drifted fixed.ui_table table was found.');
    }

    const liveTableNameForChecks = dryRun ? liveTableNameBeforeRepair : 'ui_table_columns';
    const hasRelationColumn = await columnExists(client, liveTableNameForChecks, 'ui_tbl_clm_table_id');
    if (!hasRelationColumn) {
      await runStep(
        'add fixed.ui_table_columns.ui_tbl_clm_table_id',
        'ALTER TABLE "fixed"."ui_table_columns" ADD COLUMN "ui_tbl_clm_table_id" BIGINT',
      );
    }

    const foreignKey = await getForeignKey(client, liveTableNameForChecks);
    if (!foreignKey) {
      await runStep(
        'add the ui_table_columns -> ui_tables foreign key as NOT VALID to preserve existing rows',
        `
          ALTER TABLE "fixed"."ui_table_columns"
          ADD CONSTRAINT "ui_table_columns_ui_tbl_clm_table_id_fkey"
          FOREIGN KEY ("ui_tbl_clm_table_id")
          REFERENCES "fixed"."ui_tables"("ui_tbl_id")
          ON DELETE SET NULL
          ON UPDATE CASCADE
          NOT VALID
        `,
      );
    }

    const orphanedRelationCount = await getOrphanedRelationCount(client, liveTableNameForChecks);
    const activeForeignKey = foreignKey ?? (await getForeignKey(client, liveTableNameForChecks));

    if (activeForeignKey && !activeForeignKey.convalidated && orphanedRelationCount === 0n) {
      await runStep(
        `validate foreign key ${activeForeignKey.conname}`,
        `ALTER TABLE "fixed"."ui_table_columns" VALIDATE CONSTRAINT "${activeForeignKey.conname}"`,
      );
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`);
    console.log(`Initial fixed.ui_table: ${initialHasUiTable ? 'yes' : 'no'}`);
    console.log(`Initial fixed.ui_table_columns: ${initialHasUiTableColumns ? 'yes' : 'no'}`);
    console.log(`Orphaned ui_tbl_clm_table_id values: ${orphanedRelationCount.toString()}`);

    if (actions.length > 0) {
      console.log('\nActions:');
      for (const action of actions) {
        console.log(`- ${action}`);
      }
    } else {
      console.log('\nNo repair actions were needed.');
    }

    if (orphanedRelationCount > 0n) {
      console.log(
        '\nForeign key validation was left incomplete because some ui_tbl_clm_table_id values do not match fixed.ui_tables.ui_tbl_id.',
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
