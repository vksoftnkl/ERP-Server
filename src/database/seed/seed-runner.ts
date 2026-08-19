import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { TS_SEEDS } from './seeds';
import type {
  SeedLogger,
  SeedManifest,
  SeedManifestEntry,
  SeedResult,
  SeedRunOptions,
  SeedRunSummary,
  TsSeed,
} from './seed.types';

/**
 * Runs the contents of `prisma/seed` against the database.
 *
 * Used two ways:
 *   * automatically at startup (`src/main.ts`, gated by DB_AUTO_SEED), which is what
 *     makes a deploy self-seeding — PM2 launches `dist/src/main.js` directly, so an
 *     npm lifecycle hook would never fire there;
 *   * manually through the CLI (`npm run seed:run`, `npm run db:deploy`).
 *
 * Guarantees it relies on:
 *   * every seed file is idempotent, so the default mode re-runs them all each time;
 *   * a session advisory lock serialises concurrent boots (PM2 restart storms, two
 *     instances), so two processes never seed the same database at once;
 *   * `public._erp_seed_history` records what ran, when, and for how long.
 */

/** Arbitrary but fixed key; identifies this runner's advisory lock. */
const SEED_ADVISORY_LOCK_KEY = '728419263';
const HISTORY_TABLE = 'public._erp_seed_history';
const MANIFEST_FILE = 'seed.manifest.json';
const DEFAULT_LOCK_TIMEOUT_SECONDS = 60;

interface HistoryRow {
  seed_name: string;
  checksum: string;
  last_status: string;
}

const consoleLogger: SeedLogger = {
  log: (message) => console.log(`[seed] ${message}`),
  warn: (message) => console.warn(`[seed] ${message}`),
  error: (message) => console.error(`[seed] ${message}`),
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

/**
 * Locate `prisma/seed` from wherever the process was started.
 *
 * `dist/src/database/seed/seed-runner.js` (deploy), `src/database/seed/seed-runner.ts`
 * (tsx) and the pkg snapshot all sit at different depths, and CloudJiffy starts PM2
 * from the app root, so try the cwd first and fall back to paths relative to this file.
 */
export const resolveSeedDirectory = (): string => {
  const candidates = [
    resolve(process.cwd(), 'prisma', 'seed'),
    resolve(__dirname, '..', '..', '..', 'prisma', 'seed'),
    resolve(__dirname, '..', '..', '..', '..', 'prisma', 'seed'),
    resolve(__dirname, '..', '..', '..', '..', '..', 'prisma', 'seed'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
};

const readManifest = (seedDir: string, logger: SeedLogger): SeedManifestEntry[] => {
  const manifestPath = join(seedDir, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as SeedManifest;
    return Array.isArray(parsed.seeds) ? parsed.seeds.filter((entry) => Boolean(entry?.file)) : [];
  } catch (error) {
    logger.warn(
      `${MANIFEST_FILE} could not be parsed (${describeError(error)}); falling back to file-name order.`,
    );
    return [];
  }
};

/** Manifest order first, then any unlisted .sql file in file-name order. */
const collectSqlSeeds = (seedDir: string, logger: SeedLogger): SeedManifestEntry[] => {
  if (!existsSync(seedDir)) {
    logger.warn(`Seed directory not found at ${seedDir} — nothing to run.`);
    return [];
  }
  const filesOnDisk = readdirSync(seedDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
  const manifestEntries = readManifest(seedDir, logger);
  const ordered: SeedManifestEntry[] = [];
  const seen = new Set<string>();
  for (const entry of manifestEntries) {
    if (!filesOnDisk.includes(entry.file)) {
      logger.warn(`${MANIFEST_FILE} lists ${entry.file}, which is not in ${seedDir} — skipped.`);
      continue;
    }
    ordered.push(entry);
    seen.add(entry.file);
  }
  for (const fileName of filesOnDisk) {
    if (!seen.has(fileName)) {
      ordered.push({ file: fileName });
    }
  }
  return ordered;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const checksumOf = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

const ensureHistoryTable = async (client: Client): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
      seed_name    text PRIMARY KEY,
      seed_kind    text NOT NULL,
      checksum     text NOT NULL,
      last_status  text NOT NULL,
      last_error   text,
      duration_ms  integer NOT NULL DEFAULT 0,
      run_count    integer NOT NULL DEFAULT 0,
      first_run_at timestamptz NOT NULL DEFAULT now(),
      last_run_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
};

const loadHistory = async (client: Client): Promise<Map<string, HistoryRow>> => {
  const { rows } = await client.query<HistoryRow>(
    `SELECT seed_name, checksum, last_status FROM ${HISTORY_TABLE}`,
  );
  return new Map(rows.map((row) => [row.seed_name, row]));
};

const recordHistory = async (
  client: Client,
  seed: { name: string; kind: 'sql' | 'ts'; checksum: string },
  status: 'success' | 'failed',
  durationMs: number,
  errorMessage: string | null,
): Promise<void> => {
  await client.query(
    `INSERT INTO ${HISTORY_TABLE}
       (seed_name, seed_kind, checksum, last_status, last_error, duration_ms, run_count)
     VALUES ($1, $2, $3, $4, $5, $6, 1)
     ON CONFLICT (seed_name) DO UPDATE SET
       seed_kind   = EXCLUDED.seed_kind,
       checksum    = EXCLUDED.checksum,
       last_status = EXCLUDED.last_status,
       last_error  = EXCLUDED.last_error,
       duration_ms = EXCLUDED.duration_ms,
       run_count   = ${HISTORY_TABLE}.run_count + 1,
       last_run_at = now()`,
    [seed.name, seed.kind, seed.checksum, status, errorMessage, Math.round(durationMs)],
  );
};

/**
 * A `once` seed is skipped when it has already succeeded with the same checksum.
 * `always` seeds (the default) are never skipped.
 */
const shouldSkip = (
  mode: 'always' | 'once',
  checksum: string,
  history: HistoryRow | undefined,
  force: boolean,
): boolean =>
  mode === 'once' &&
  !force &&
  history !== undefined &&
  history.checksum === checksum &&
  history.last_status === 'success';

const acquireLock = async (
  client: Client,
  timeoutSeconds: number,
  logger: SeedLogger,
): Promise<boolean> => {
  const deadline = Date.now() + timeoutSeconds * 1000;
  for (;;) {
    const { rows } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS locked',
      [SEED_ADVISORY_LOCK_KEY],
    );
    if (rows[0]?.locked) {
      return true;
    }
    if (Date.now() >= deadline) {
      return false;
    }
    logger.log('Another process is seeding; waiting for the lock…');
    await sleep(2000);
  }
};

export const runDatabaseSeeds = async (options: SeedRunOptions = {}): Promise<SeedRunSummary> => {
  const logger = options.logger ?? consoleLogger;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Cannot seed: no database URL was provided and DATABASE_URL is unset.');
  }
  const seedDir =
    options.seedDir && isAbsolute(options.seedDir)
      ? options.seedDir
      : options.seedDir
        ? resolve(process.cwd(), options.seedDir)
        : resolveSeedDirectory();
  const only = options.only?.filter(Boolean) ?? [];
  const isSelected = (name: string): boolean =>
    only.length === 0 || only.includes(name) || only.includes(name.replace(/\.sql$/i, ''));

  const sqlEntries = collectSqlSeeds(seedDir, logger).filter((entry) => isSelected(entry.file));
  const tsSeeds: TsSeed[] = TS_SEEDS.filter((seed) => isSelected(seed.name));
  const results: SeedResult[] = [];
  const summary: SeedRunSummary = { applied: 0, skipped: 0, failed: 0, results, lockBusy: false };

  if (sqlEntries.length === 0 && tsSeeds.length === 0) {
    logger.warn('No seeds matched — nothing to do.');
    return summary;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let lockHeld = false;
  const ownsPrisma = !options.prisma;
  let prisma: PrismaClient | undefined = options.prisma;

  try {
    lockHeld = await acquireLock(client, options.lockTimeoutSeconds ?? DEFAULT_LOCK_TIMEOUT_SECONDS, logger);
    if (!lockHeld) {
      summary.lockBusy = true;
      logger.warn('Seed lock is held by another process — skipping this run.');
      return summary;
    }

    await ensureHistoryTable(client);
    const history = await loadHistory(client);
    logger.log(`Running ${sqlEntries.length} SQL seed(s) and ${tsSeeds.length} TS seed(s) from ${seedDir}`);

    for (const entry of sqlEntries) {
      const filePath = join(seedDir, entry.file);
      const sql = readFileSync(filePath, 'utf8');
      const checksum = checksumOf(sql);
      const mode = entry.mode ?? 'always';
      if (shouldSkip(mode, checksum, history.get(entry.file), options.force ?? false)) {
        results.push({ name: entry.file, kind: 'sql', status: 'skipped', durationMs: 0 });
        summary.skipped += 1;
        continue;
      }
      const startedAt = Date.now();
      try {
        // One simple-protocol query per file: PostgreSQL runs a multi-statement
        // string as a single implicit transaction, and the files that need explicit
        // control (Item_Master_Widget_Config_Menu29, Quotation_Item_Grid_ItemSize_Column)
        // already carry their own BEGIN/COMMIT.
        await client.query(sql);
        const durationMs = Date.now() - startedAt;
        await recordHistory(client, { name: entry.file, kind: 'sql', checksum }, 'success', durationMs, null);
        results.push({ name: entry.file, kind: 'sql', status: 'applied', durationMs });
        summary.applied += 1;
        logger.log(`✔ ${entry.file} (${durationMs}ms)`);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = describeError(error);
        // The failed statement may have aborted an open transaction on this
        // connection; roll back so the history write and later seeds still work.
        await client.query('ROLLBACK').catch(() => undefined);
        await recordHistory(
          client,
          { name: entry.file, kind: 'sql', checksum },
          'failed',
          durationMs,
          message,
        ).catch(() => undefined);
        results.push({ name: entry.file, kind: 'sql', status: 'failed', durationMs, error: message });
        summary.failed += 1;
        logger.error(`✖ ${entry.file}: ${message}`);
        if (options.stopOnError) {
          return summary;
        }
      }
    }

    for (const seed of tsSeeds) {
      const mode = seed.mode ?? 'always';
      const checksum = checksumOf(`${seed.name}@${seed.version}`);
      if (shouldSkip(mode, checksum, history.get(seed.name), options.force ?? false)) {
        results.push({ name: seed.name, kind: 'ts', status: 'skipped', durationMs: 0 });
        summary.skipped += 1;
        continue;
      }
      if (!prisma) {
        prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      }
      const startedAt = Date.now();
      try {
        await seed.run(prisma);
        const durationMs = Date.now() - startedAt;
        await recordHistory(client, { name: seed.name, kind: 'ts', checksum }, 'success', durationMs, null);
        results.push({ name: seed.name, kind: 'ts', status: 'applied', durationMs });
        summary.applied += 1;
        logger.log(`✔ ${seed.name} (${durationMs}ms)`);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = describeError(error);
        await recordHistory(
          client,
          { name: seed.name, kind: 'ts', checksum },
          'failed',
          durationMs,
          message,
        ).catch(() => undefined);
        results.push({ name: seed.name, kind: 'ts', status: 'failed', durationMs, error: message });
        summary.failed += 1;
        logger.error(`✖ ${seed.name}: ${message}`);
        if (options.stopOnError) {
          return summary;
        }
      }
    }

    return summary;
  } finally {
    if (lockHeld) {
      await client
        .query('SELECT pg_advisory_unlock($1::bigint)', [SEED_ADVISORY_LOCK_KEY])
        .catch(() => undefined);
    }
    if (ownsPrisma && prisma) {
      await prisma.$disconnect().catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
};
