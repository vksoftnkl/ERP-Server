#!/usr/bin/env node
const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const DEFAULT_MIGRATIONS = [
  '20260228122000_fix_grid_sql_schema_qualification',
  '20260228124500_fix_grid_sql_schema_regex',
];

const printHelpAndExit = () => {
  console.log(`Usage:
  node scripts/sync-prisma-migration-checksums.js [options]

Options:
  --migration <name>   Sync this migration only (repeatable)
  --migration=<name>   Sync this migration only (repeatable)
  --dry-run            Show changes without writing to database
  --help               Show this help text

Default migrations:
  ${DEFAULT_MIGRATIONS.join('\n  ')}
`);
  process.exit(0);
};

const parseArgs = () => {
  const migrationNames = [];
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

    if (arg === '--migration') {
      const value = process.argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --migration');
      }
      migrationNames.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--migration=')) {
      const value = arg.slice('--migration='.length).trim();
      if (!value) {
        throw new Error('Missing value for --migration');
      }
      migrationNames.push(value);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    dryRun,
    migrationNames: migrationNames.length > 0 ? migrationNames : DEFAULT_MIGRATIONS,
  };
};

const getChecksum = (migrationName) => {
  const migrationFilePath = resolve(
    process.cwd(),
    join('prisma', 'migrations', migrationName, 'migration.sql'),
  );

  if (!existsSync(migrationFilePath)) {
    throw new Error(`Migration file not found: ${migrationFilePath}`);
  }

  const fileBuffer = readFileSync(migrationFilePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
};

const main = async () => {
  const { dryRun, migrationNames } = parseArgs();
  dotenv.config({ path: resolve(process.cwd(), '.env') });

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  const updated = [];
  const unchanged = [];
  const missing = [];

  try {
    await client.query('BEGIN');

    for (const migrationName of migrationNames) {
      const expectedChecksum = getChecksum(migrationName);
      const result = await client.query(
        `
          SELECT id, checksum
          FROM "public"."_prisma_migrations"
          WHERE migration_name = $1
          ORDER BY started_at DESC
        `,
        [migrationName],
      );

      if (result.rows.length === 0) {
        missing.push(migrationName);
        continue;
      }

      const mismatchedRows = result.rows.filter(
        ({ checksum: currentChecksum }) => currentChecksum !== expectedChecksum,
      );

      if (mismatchedRows.length === 0) {
        unchanged.push(migrationName);
        continue;
      }

      if (!dryRun) {
        for (const { id } of mismatchedRows) {
          await client.query(
            `
              UPDATE "public"."_prisma_migrations"
              SET checksum = $1
              WHERE id = $2
            `,
            [expectedChecksum, id],
          );
        }
      }

      updated.push({
        migrationName,
        rowCount: mismatchedRows.length,
        from: [...new Set(mismatchedRows.map(({ checksum: currentChecksum }) => currentChecksum))],
        to: expectedChecksum,
      });
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`);
  console.log(`Updated: ${updated.length}`);
  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Missing: ${missing.length}`);

  if (updated.length > 0) {
    console.log('\nUpdated migration checksums:');
    for (const item of updated) {
      console.log(`- ${item.migrationName}`);
      console.log(`  rows: ${item.rowCount}`);
      console.log(`  from: ${item.from.join(', ')}`);
      console.log(`  to:   ${item.to}`);
    }
  }

  if (unchanged.length > 0) {
    console.log('\nAlready matching:');
    for (const migrationName of unchanged) {
      console.log(`- ${migrationName}`);
    }
  }

  if (missing.length > 0) {
    console.log('\nMissing in _prisma_migrations:');
    for (const migrationName of missing) {
      console.log(`- ${migrationName}`);
    }
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
