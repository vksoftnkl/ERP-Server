import type { SeedLogger } from './seed.types';
export declare const resolvePrismaSchemaPath: () => string | undefined;
export interface MigrateDeployOptions {
    databaseUrl?: string;
    schemaPath?: string;
    logger?: SeedLogger;
    timeoutMs?: number;
}
export declare const runPrismaMigrateDeploy: (options?: MigrateDeployOptions) => Promise<boolean>;
