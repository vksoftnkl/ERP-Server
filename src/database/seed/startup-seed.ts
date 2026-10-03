import type { LoggerService } from '@nestjs/common';
import { runPrismaMigrateDeploy } from './migrate-deploy';
import { runDatabaseSeeds } from './seed-runner';
import type { SeedLogger } from './seed.types';

/**
 * The startup half of the seeding story: what `src/main.ts` calls before the app
 * starts listening, so a deploy needs no manual psql step.
 *
 * Why here and not in an npm lifecycle hook: PM2 runs `dist/src/main.js` directly
 * (see ecosystem.config.js), so `prestart`/`poststart` never fire on the deployed
 * node. Bootstrap is the one code path every restart and redeploy goes through.
 *
 * Environment flags (see src/config/env.validation.ts):
 *   DB_AUTO_SEED      run the seeds at startup. Default: on in production, off elsewhere.
 *   DB_AUTO_MIGRATE   run `prisma migrate deploy` first. Default: off — enable it when
 *                     the deploy pipeline does not already apply migrations itself.
 *   DB_SEED_FAIL_FAST abort startup if a seed fails. Default: off, so a bad seed
 *                     degrades reference data instead of taking the API down.
 */

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parseNumber = (value: string | undefined, defaultValue: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

const toSeedLogger = (logger: LoggerService, context: string): SeedLogger => ({
  log: (message) => {
    logger.log(message, context);
  },
  warn: (message) => {
    logger.warn(message, context);
  },
  error: (message) => {
    logger.error(message, undefined, context);
  },
});

export interface StartupDatabaseTaskOptions {
  databaseUrl?: string;
  logger: LoggerService;
}

/**
 * Throws only when a step fails AND DB_SEED_FAIL_FAST is on — bootstrap treats that
 * as fatal and exits non-zero so PM2 applies its restart backoff.
 */
export const runStartupDatabaseTasks = async (
  options: StartupDatabaseTaskOptions,
): Promise<void> => {
  const { databaseUrl, logger } = options;
  const isProduction = process.env.NODE_ENV === 'production';
  const autoSeed = parseBoolean(process.env.DB_AUTO_SEED, isProduction);
  const autoMigrate = parseBoolean(process.env.DB_AUTO_MIGRATE, false);
  const failFast = parseBoolean(process.env.DB_SEED_FAIL_FAST, false);

  if (!autoMigrate && !autoSeed) {
    return;
  }

  if (autoMigrate) {
    const migrateLogger = toSeedLogger(logger, 'Migrate');
    const migrated = await runPrismaMigrateDeploy({ databaseUrl, logger: migrateLogger });
    if (!migrated) {
      const message = 'Automatic migration failed — see the errors above.';
      if (failFast) {
        throw new Error(message);
      }
      migrateLogger.warn(`${message} Continuing startup (DB_SEED_FAIL_FAST is off).`);
      // Seeds insert into tables the migrations create, so running them against a
      // schema that failed to migrate would only produce a second wall of errors.
      return;
    }
  }

  if (!autoSeed) {
    return;
  }

  const seedLogger = toSeedLogger(logger, 'Seed');
  try {
    const summary = await runDatabaseSeeds({
      databaseUrl,
      logger: seedLogger,
      lockTimeoutSeconds: parseNumber(process.env.DB_SEED_LOCK_TIMEOUT_SECONDS, 60),
      stopOnError: failFast,
    });
    if (summary.lockBusy) {
      return;
    }
    seedLogger.log(
      `Seeding finished — ${summary.applied} applied, ${summary.skipped} skipped, ${summary.failed} failed.`,
    );
    if (summary.failed > 0 && failFast) {
      throw new Error(`${summary.failed} seed(s) failed during startup.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (failFast) {
      throw error instanceof Error ? error : new Error(message);
    }
    seedLogger.error(`Seeding failed: ${message}. Continuing startup (DB_SEED_FAIL_FAST is off).`);
  }
};
