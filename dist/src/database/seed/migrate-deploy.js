"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPrismaMigrateDeploy = exports.resolvePrismaSchemaPath = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const consoleLogger = {
    log: (message) => console.log(`[migrate] ${message}`),
    warn: (message) => console.warn(`[migrate] ${message}`),
    error: (message) => console.error(`[migrate] ${message}`),
};
const resolvePrismaSchemaPath = () => {
    const candidates = [
        (0, node_path_1.resolve)(process.cwd(), 'prisma', 'schema.prisma'),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', '..', 'prisma', 'schema.prisma'),
    ];
    return candidates.find((candidate) => (0, node_fs_1.existsSync)(candidate));
};
exports.resolvePrismaSchemaPath = resolvePrismaSchemaPath;
const resolvePrismaCliPath = () => {
    try {
        const packageJsonPath = require.resolve('prisma/package.json');
        const packageJson = JSON.parse((0, node_fs_1.readFileSync)(packageJsonPath, 'utf8'));
        const binEntry = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.prisma;
        if (!binEntry) {
            return undefined;
        }
        const cliPath = (0, node_path_1.join)((0, node_path_1.dirname)(packageJsonPath), binEntry);
        return (0, node_fs_1.existsSync)(cliPath) ? cliPath : undefined;
    }
    catch {
        return undefined;
    }
};
const runPrismaMigrateDeploy = async (options = {}) => {
    const logger = options.logger ?? consoleLogger;
    if (process.pkg) {
        logger.warn('Running from a packaged binary — the Prisma CLI is not available, so migrations were not applied. Run `npm run prisma:migrate:deploy` from the source tree instead.');
        return false;
    }
    const schemaPath = options.schemaPath ?? (0, exports.resolvePrismaSchemaPath)();
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
    return new Promise((resolvePromise) => {
        const child = (0, node_child_process_1.spawn)(process.execPath, [cliPath, 'migrate', 'deploy', '--schema', schemaPath], {
            env: {
                ...process.env,
                ...(options.databaseUrl ? { DATABASE_URL: options.databaseUrl } : {}),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const timeout = setTimeout(() => {
            logger.error('prisma migrate deploy timed out — killing it.');
            child.kill('SIGKILL');
        }, options.timeoutMs ?? 10 * 60 * 1000);
        const emit = (chunk, level) => {
            for (const line of chunk.toString().split('\n')) {
                if (line.trim()) {
                    logger[level](line.trim());
                }
            }
        };
        child.stdout?.on('data', (chunk) => emit(chunk, 'log'));
        child.stderr?.on('data', (chunk) => emit(chunk, 'warn'));
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
exports.runPrismaMigrateDeploy = runPrismaMigrateDeploy;
//# sourceMappingURL=migrate-deploy.js.map