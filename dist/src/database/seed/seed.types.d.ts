import type { PrismaClient } from '@prisma/client';
export type SeedMode = 'always' | 'once';
export interface SeedManifestEntry {
    file: string;
    mode?: SeedMode;
    description?: string;
}
export interface SeedManifest {
    seeds: SeedManifestEntry[];
}
export interface TsSeed {
    name: string;
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
    lockBusy: boolean;
}
export interface SeedLogger {
    log(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
export interface SeedRunOptions {
    databaseUrl?: string;
    seedDir?: string;
    only?: string[];
    force?: boolean;
    stopOnError?: boolean;
    lockTimeoutSeconds?: number;
    logger?: SeedLogger;
    prisma?: PrismaClient;
}
