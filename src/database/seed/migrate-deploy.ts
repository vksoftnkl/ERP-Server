import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { SeedLogger } from './seed.types';

/**
 * Applies pending Prisma migrations by shelling out to the Prisma CLI.
 *
 * `prisma` is a runtime dependency (not a devDependency), so the CLI is present in a
 * production install and this works on the deployed node without npx or a network
 * round-trip. It is the same command as `npm run prisma:migrate:deploy`, minus the
 * schema rebuild — the deployed tree ships the generated `prisma/schema.prisma`.
 */

const consoleLogger: SeedLogger = {
  log: (message) => console.log(`[migrate] ${message}`),
  warn: (message) => console.warn(`[migrate] ${message}`),
  error: (message) => console.error(`[migrate] ${message}`),
};

export const resolvePrismaSchemaPath = (): string | undefined => {
  const candidates = [
    resolve(process.cwd(), 'prisma', 'schema.prisma'),
    resolve(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
    resolve(__dirname, '..', '..', '..', '..', 'prisma', 'schema.prisma'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
};

const resolvePrismaCliPath = (): string | undefined => {
  try {
    const packageJsonPath = require.resolve('prisma/package.json');
    const packageJson = require(packageJsonPath) as { bin?: Record<string, string> | string };
    const binEntry =
      typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.prisma;
    if (!binEntry) {
      return undefined;
    }
    const cliPath = join(dirname(packageJsonPath), binEntry);
    return existsSync(cliPath) ? cliPath : undefined;
  } catch {
    return undefined;
  }
};

export interface MigrateDeployOptions {
  databaseUrl?: string;
  schemaPath?: string;
  logger?: SeedLogger;
  /** Milliseconds before the CLI is killed. Default 10 minutes. */
  timeoutMs?: number;
}

/** Resolves true when every pending migration applied, false when the step could not run. */
export const runPrismaMigrateDeploy = async (
  options: MigrateDeployOptions = {},
): Promise<boolean> => {
  const logger = options.logger ?? consoleLogger;
  if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
    logger.warn(
      'Running from a packaged binary — the Prisma CLI is not available, so migrations were not applied. Run `npm run prisma:migrate:deploy` from the source tree instead.',
    );
    return false;
  }
  const schemaPath = options.schemaPath ?? resolvePrismaSchemaPath();
  if (!schemaPath) {
    logger.error('prisma/schema.prisma not found — migrations were not applied.');
    return false;
  }
  const cliPath = resolvePrismaCliPath();
  if (!cliPath) {
    logger.error('The Prisma CLI could not be resolved — migrations were not applied.');
    return false;
  }

  logger.log(`Applying pending migrations (${schemaPath})…`);
  return new Promise<boolean>((resolvePromise) => {
    const child = spawn(process.execPath, [cliPath, 'migrate', 'deploy', '--schema', schemaPath], {
      env: {
        ...process.env,
        ...(options.databaseUrl ? { DATABASE_URL: options.databaseUrl } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(
      () => {
        logger.error('prisma migrate deploy timed out — killing it.');
        child.kill('SIGKILL');
      },
      options.timeoutMs ?? 10 * 60 * 1000,
    );
    // The CLI writes informational lines ("Environment variables loaded from .env",
    // deprecation notices) to stderr, so stderr is logged at warn level; the real
    // verdict is the exit code handled below.
    const emit = (chunk: Buffer, level: 'log' | 'warn'): void => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) {
          logger[level](line.trim());
        }
      }
    };
    child.stdout?.on('data', (chunk: Buffer) => emit(chunk, 'log'));
    child.stderr?.on('data', (chunk: Buffer) => emit(chunk, 'warn'));
    child.on('error', (error) => {
      clearTimeout(timeout);
      logger.error(`prisma migrate deploy could not start: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        logger.log('Migrations are up to date.');
        resolvePromise(true);
        return;
      }
      logger.error(`prisma migrate deploy exited with code ${code}.`);
      resolvePromise(false);
    });
  });
};
