"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStartupDatabaseTasks = void 0;
const migrate_deploy_1 = require("./migrate-deploy");
const seed_runner_1 = require("./seed-runner");
const parseBoolean = (value, defaultValue) => {
    if (value === undefined || value.trim() === '') {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};
const parseNumber = (value, defaultValue) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};
const toSeedLogger = (logger, context) => ({
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
const runStartupDatabaseTasks = async (options) => {
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
        const migrated = await (0, migrate_deploy_1.runPrismaMigrateDeploy)({ databaseUrl, logger: migrateLogger });
        if (!migrated) {
            const message = 'Automatic migration failed — see the errors above.';
            if (failFast) {
                throw new Error(message);
            }
            migrateLogger.warn(`${message} Continuing startup (DB_SEED_FAIL_FAST is off).`);
            return;
        }
    }
    if (!autoSeed) {
        return;
    }
    const seedLogger = toSeedLogger(logger, 'Seed');
    try {
        const summary = await (0, seed_runner_1.runDatabaseSeeds)({
            databaseUrl,
            logger: seedLogger,
            lockTimeoutSeconds: parseNumber(process.env.DB_SEED_LOCK_TIMEOUT_SECONDS, 60),
            stopOnError: failFast,
        });
        if (summary.lockBusy) {
            return;
        }
        seedLogger.log(`Seeding finished — ${summary.applied} applied, ${summary.skipped} skipped, ${summary.failed} failed.`);
        if (summary.failed > 0 && failFast) {
            throw new Error(`${summary.failed} seed(s) failed during startup.`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (failFast) {
            throw error instanceof Error ? error : new Error(message);
        }
        seedLogger.error(`Seeding failed: ${message}. Continuing startup (DB_SEED_FAIL_FAST is off).`);
    }
};
exports.runStartupDatabaseTasks = runStartupDatabaseTasks;
//# sourceMappingURL=startup-seed.js.map