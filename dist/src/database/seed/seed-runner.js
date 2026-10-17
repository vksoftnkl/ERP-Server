"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDatabaseSeeds = exports.resolveSeedDirectory = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const seeds_1 = require("./seeds");
const SEED_ADVISORY_LOCK_KEY = '728419263';
const HISTORY_TABLE = 'public._erp_seed_history';
const MANIFEST_FILE = 'seed.manifest.json';
const DEFAULT_LOCK_TIMEOUT_SECONDS = 60;
const consoleLogger = {
    log: (message) => console.log(`[seed] ${message}`),
    warn: (message) => console.warn(`[seed] ${message}`),
    error: (message) => console.error(`[seed] ${message}`),
};
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const resolveSeedDirectory = () => {
    const candidates = [
        (0, node_path_1.resolve)(process.cwd(), 'prisma', 'seed'),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', 'prisma', 'seed'),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', '..', 'prisma', 'seed'),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', '..', '..', 'prisma', 'seed'),
    ];
    for (const candidate of candidates) {
        if ((0, node_fs_1.existsSync)(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
};
exports.resolveSeedDirectory = resolveSeedDirectory;
const readManifest = (seedDir, logger) => {
    const manifestPath = (0, node_path_1.join)(seedDir, MANIFEST_FILE);
    if (!(0, node_fs_1.existsSync)(manifestPath)) {
        return [];
    }
    try {
        const parsed = JSON.parse((0, node_fs_1.readFileSync)(manifestPath, 'utf8'));
        return Array.isArray(parsed.seeds) ? parsed.seeds.filter((entry) => Boolean(entry?.file)) : [];
    }
    catch (error) {
        logger.warn(`${MANIFEST_FILE} could not be parsed (${describeError(error)}); falling back to file-name order.`);
        return [];
    }
};
const collectSqlSeeds = (seedDir, logger) => {
    if (!(0, node_fs_1.existsSync)(seedDir)) {
        logger.warn(`Seed directory not found at ${seedDir} — nothing to run.`);
        return [];
    }
    const filesOnDisk = (0, node_fs_1.readdirSync)(seedDir)
        .filter((fileName) => fileName.toLowerCase().endsWith('.sql'))
        .sort((left, right) => left.localeCompare(right));
    const manifestEntries = readManifest(seedDir, logger);
    const ordered = [];
    const seen = new Set();
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
const describeError = (error) => error instanceof Error ? error.message : String(error);
const checksumOf = (value) => (0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex');
const ensureHistoryTable = async (client) => {
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
const loadHistory = async (client) => {
    const { rows } = await client.query(`SELECT seed_name, checksum, last_status FROM ${HISTORY_TABLE}`);
    return new Map(rows.map((row) => [row.seed_name, row]));
};
const recordHistory = async (client, seed, status, durationMs, errorMessage) => {
    await client.query(`INSERT INTO ${HISTORY_TABLE}
       (seed_name, seed_kind, checksum, last_status, last_error, duration_ms, run_count)
     VALUES ($1, $2, $3, $4, $5, $6, 1)
     ON CONFLICT (seed_name) DO UPDATE SET
       seed_kind   = EXCLUDED.seed_kind,
       checksum    = EXCLUDED.checksum,
       last_status = EXCLUDED.last_status,
       last_error  = EXCLUDED.last_error,
       duration_ms = EXCLUDED.duration_ms,
       run_count   = ${HISTORY_TABLE}.run_count + 1,
       last_run_at = now()`, [seed.name, seed.kind, seed.checksum, status, errorMessage, Math.round(durationMs)]);
};
const shouldSkip = (mode, checksum, history, force) => mode === 'once' &&
    !force &&
    history !== undefined &&
    history.checksum === checksum &&
    history.last_status === 'success';
const acquireLock = async (client, timeoutSeconds, logger) => {
    const deadline = Date.now() + timeoutSeconds * 1000;
    for (;;) {
        const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [SEED_ADVISORY_LOCK_KEY]);
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
const runDatabaseSeeds = async (options = {}) => {
    const logger = options.logger ?? consoleLogger;
    const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('Cannot seed: no database URL was provided and DATABASE_URL is unset.');
    }
    const seedDir = options.seedDir && (0, node_path_1.isAbsolute)(options.seedDir)
        ? options.seedDir
        : options.seedDir
            ? (0, node_path_1.resolve)(process.cwd(), options.seedDir)
            : (0, exports.resolveSeedDirectory)();
    const only = options.only?.filter(Boolean) ?? [];
    const isSelected = (name) => only.length === 0 || only.includes(name) || only.includes(name.replace(/\.sql$/i, ''));
    const sqlEntries = collectSqlSeeds(seedDir, logger).filter((entry) => isSelected(entry.file));
    const tsSeeds = seeds_1.TS_SEEDS.filter((seed) => isSelected(seed.name));
    const results = [];
    const summary = { applied: 0, skipped: 0, failed: 0, results, lockBusy: false };
    if (sqlEntries.length === 0 && tsSeeds.length === 0) {
        logger.warn('No seeds matched — nothing to do.');
        return summary;
    }
    const client = new pg_1.Client({ connectionString: databaseUrl });
    await client.connect();
    let lockHeld = false;
    const ownsPrisma = !options.prisma;
    let prisma = options.prisma;
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
            const filePath = (0, node_path_1.join)(seedDir, entry.file);
            const sql = (0, node_fs_1.readFileSync)(filePath, 'utf8');
            const checksum = checksumOf(sql);
            const mode = entry.mode ?? 'always';
            if (shouldSkip(mode, checksum, history.get(entry.file), options.force ?? false)) {
                results.push({ name: entry.file, kind: 'sql', status: 'skipped', durationMs: 0 });
                summary.skipped += 1;
                continue;
            }
            const startedAt = Date.now();
            try {
                await client.query(sql);
                const durationMs = Date.now() - startedAt;
                await recordHistory(client, { name: entry.file, kind: 'sql', checksum }, 'success', durationMs, null);
                results.push({ name: entry.file, kind: 'sql', status: 'applied', durationMs });
                summary.applied += 1;
                logger.log(`✔ ${entry.file} (${durationMs}ms)`);
            }
            catch (error) {
                const durationMs = Date.now() - startedAt;
                const message = describeError(error);
                await client.query('ROLLBACK').catch(() => undefined);
                await recordHistory(client, { name: entry.file, kind: 'sql', checksum }, 'failed', durationMs, message).catch(() => undefined);
                results.push({
                    name: entry.file,
                    kind: 'sql',
                    status: 'failed',
                    durationMs,
                    error: message,
                });
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
                prisma = new client_1.PrismaClient({ datasources: { db: { url: databaseUrl } } });
            }
            const startedAt = Date.now();
            try {
                await seed.run(prisma);
                const durationMs = Date.now() - startedAt;
                await recordHistory(client, { name: seed.name, kind: 'ts', checksum }, 'success', durationMs, null);
                results.push({ name: seed.name, kind: 'ts', status: 'applied', durationMs });
                summary.applied += 1;
                logger.log(`✔ ${seed.name} (${durationMs}ms)`);
            }
            catch (error) {
                const durationMs = Date.now() - startedAt;
                const message = describeError(error);
                await recordHistory(client, { name: seed.name, kind: 'ts', checksum }, 'failed', durationMs, message).catch(() => undefined);
                results.push({ name: seed.name, kind: 'ts', status: 'failed', durationMs, error: message });
                summary.failed += 1;
                logger.error(`✖ ${seed.name}: ${message}`);
                if (options.stopOnError) {
                    return summary;
                }
            }
        }
        return summary;
    }
    finally {
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
exports.runDatabaseSeeds = runDatabaseSeeds;
//# sourceMappingURL=seed-runner.js.map