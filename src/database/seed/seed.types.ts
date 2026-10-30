import type { PrismaClient } from '@prisma/client';

/**
 * How often a seed is executed.
 *
 * `always` — run on every deploy. This is the default and the mode every seed in
 *   `prisma/seed` is written for: each one guards its inserts with `ON CONFLICT DO
 *   NOTHING` / `WHERE NOT EXISTS`, so re-running is a cheap no-op. It also keeps
 *   data-dependent seeds correct: `Acc_Voucher_Seq_Sale_Bill.sql` inserts nothing
 *   until the company/branch rows it joins to exist, and under `once` that empty
 *   first run would be recorded as done and the counter row would never appear.
 *
 * `once` — run a single time and never again while the file's checksum is unchanged.
 *   Use it only for a seed that is genuinely not safe to repeat (one that generates
 *   demo rows, or overwrites values an operator is expected to edit afterwards).
 */
export type SeedMode = 'always' | 'once';

/** One entry of `prisma/seed/seed.manifest.json`. */
export interface SeedManifestEntry {
  /** File name inside `prisma/seed`, e.g. `Bank_Master.sql`. */
  file: string;
  mode?: SeedMode;
  /** Free text, shown in logs. */
  description?: string;
}

export interface SeedManifest {
  seeds: SeedManifestEntry[];
}

/**
 * A seed written in TypeScript rather than SQL, executed through Prisma.
 * Registered in `src/database/seed/seeds/index.ts`.
 */
export interface TsSeed {
  /** Stable identity in the history table — renaming re-runs the seed. */
  name: string;
  /**
   * Bump when the seeded data changes. It takes the place of a file checksum, so
   * under `mode: 'once'` a bumped version makes the seed run again.
   */
  version: string;
  mode?: SeedMode;
  description?: string;
  run(prisma: PrismaClient): Promise<void>;
}

export type SeedStatus = 'applied' | 'skipped' | 'failed';

export interface SeedResult {
  name: string;
  kind: 'sql' | 'ts';
  status: SeedStatus;
  durationMs: number;
  error?: string;
}

export interface SeedRunSummary {
  applied: number;
  skipped: number;
  failed: number;
  results: SeedResult[];
  /** True when another process held the seed lock and this run did nothing. */
  lockBusy: boolean;
}

export interface SeedLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface SeedRunOptions {
  /** Postgres connection string. Falls back to `DATABASE_URL`. */
  databaseUrl?: string;
  /** Directory holding the seed files. Falls back to the resolved `prisma/seed`. */
  seedDir?: string;
  /** Run only these seeds (file name or TS seed name). Empty/undefined runs all. */
  only?: string[];
  /** Ignore recorded history, so even `once` seeds run again. */
  force?: boolean;
  /** Stop at the first failing seed instead of continuing with the rest. */
  stopOnError?: boolean;
  /** Seconds to wait for the advisory lock before giving up. */
  lockTimeoutSeconds?: number;
  logger?: SeedLogger;
  /** Reuse an existing client for TS seeds instead of creating one. */
  prisma?: PrismaClient;
}
