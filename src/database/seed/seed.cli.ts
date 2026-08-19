#!/usr/bin/env node
import '../../env.preload';
import configuration from '../../config/configuration';
import { runPrismaMigrateDeploy } from './migrate-deploy';
import { runDatabaseSeeds } from './seed-runner';

/**
 * Manual entry point for the same runner the app uses at startup.
 *
 *   npm run seed:run                    # every seed, against DATABASE_URL
 *   npm run seed:run -- --only=Bank_Master.sql
 *   npm run seed:run -- --force         # re-run 'once' seeds too
 *   npm run db:deploy                   # migrate deploy + seeds (deploy command)
 */

const parseArgs = (argv: string[]) => {
  const args = { force: false, migrate: false, stopOnError: false, only: [] as string[], help: false };
  for (const argument of argv) {
    if (argument === '--force') {
      args.force = true;
    } else if (argument === '--migrate') {
      args.migrate = true;
    } else if (argument === '--stop-on-error') {
      args.stopOnError = true;
    } else if (argument === '--help' || argument === '-h') {
      args.help = true;
    } else if (argument.startsWith('--only=')) {
      args.only.push(
        ...argument
          .slice('--only='.length)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
    }
  }
  return args;
};

const HELP = `Usage: seed.cli [options]

  --migrate         run "prisma migrate deploy" before seeding
  --only=a,b        run only these seeds (file name or TS seed name)
  --force           run seeds marked "once" even if they already ran
  --stop-on-error   stop at the first failing seed
  -h, --help        show this message
`;

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  const databaseUrl = configuration().database.url;

  if (args.migrate) {
    const migrated = await runPrismaMigrateDeploy({ databaseUrl });
    if (!migrated) {
      process.exitCode = 1;
      return;
    }
  }

  const summary = await runDatabaseSeeds({
    databaseUrl,
    force: args.force,
    only: args.only,
    stopOnError: args.stopOnError,
  });

  console.log(
    `[seed] done — ${summary.applied} applied, ${summary.skipped} skipped, ${summary.failed} failed.`,
  );
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
};

main().catch((error: unknown) => {
  console.error('[seed] fatal:', error);
  process.exit(1);
});
