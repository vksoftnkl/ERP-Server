import '../src/env.preload';

import { PrismaClient } from '@prisma/client';

/**
 * public.db_table_master, the table registry (migration
 * 20261023140000_db_table_master, rows from prisma/seed/Db_Table_Master.sql),
 * against the live database. Read-only.
 *
 * A failure here means a migration added or dropped a table without touching
 * the seed file: add the table's row there (a free id in its module's block),
 * or delete the row of a dropped table, and re-run the seed. SYNC_COLUMN means
 * the row's sync_col is not the table's sync-date column any more.
 *
 *     npm run test:e2e -- db-table-master
 */
const prisma = new PrismaClient();

interface DriftRow {
  drift: 'UNREGISTERED' | 'MISSING' | 'PARTITION' | 'SYNC_COLUMN';
  drift_schema: string;
  drift_table: string;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('db_table_master', () => {
  it('registers every table in the database, and nothing else', async () => {
    const drift = await prisma.$queryRaw<DriftRow[]>`
      SELECT drift, drift_schema, drift_table
        FROM public.v_db_table_master_drift
       ORDER BY drift, drift_schema, drift_table`;

    expect(drift.map((r) => `${r.drift} ${r.drift_schema}.${r.drift_table}`)).toEqual([]);
  });

  it('never calls a year-partitioned table a master, setting, definition or plumbing', async () => {
    const rows = await prisma.$queryRaw<Array<{ dtm_table: string; dtm_kind: string }>>`
      SELECT dtm_schema || '.' || dtm_table AS dtm_table, dtm_kind
        FROM public.v_db_table_master
       WHERE dtm_is_partitioned
         AND dtm_kind IN ('MASTER', 'SETTING', 'METADATA', 'SYSTEM')
       ORDER BY 1`;

    expect(rows).toEqual([]);
  });
});
