#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("../../env.preload");
const configuration_1 = require("../../config/configuration");
const migrate_deploy_1 = require("./migrate-deploy");
const seed_runner_1 = require("./seed-runner");
const parseArgs = (argv) => {
    const args = {
        force: false,
        migrate: false,
        stopOnError: false,
        only: [],
        help: false,
    };
    for (const argument of argv) {
        if (argument === '--force') {
            args.force = true;
        }
        else if (argument === '--migrate') {
            args.migrate = true;
        }
        else if (argument === '--stop-on-error') {
            args.stopOnError = true;
        }
        else if (argument === '--help' || argument === '-h') {
            args.help = true;
        }
        else if (argument.startsWith('--only=')) {
            args.only.push(...argument
                .slice('--only='.length)
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean));
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
const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(HELP);
        return;
    }
    const databaseUrl = (0, configuration_1.default)().database.url;
    if (args.migrate) {
        const migrated = await (0, migrate_deploy_1.runPrismaMigrateDeploy)({ databaseUrl });
        if (!migrated) {
            process.exitCode = 1;
            return;
        }
    }
    const summary = await (0, seed_runner_1.runDatabaseSeeds)({
        databaseUrl,
        force: args.force,
        only: args.only,
        stopOnError: args.stopOnError,
    });
    console.log(`[seed] done — ${summary.applied} applied, ${summary.skipped} skipped, ${summary.failed} failed.`);
    if (summary.failed > 0) {
        process.exitCode = 1;
    }
};
main().catch((error) => {
    console.error('[seed] fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=seed.cli.js.map