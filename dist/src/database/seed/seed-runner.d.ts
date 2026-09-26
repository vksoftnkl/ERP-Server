import type { SeedRunOptions, SeedRunSummary } from './seed.types';
export declare const resolveSeedDirectory: () => string;
export declare const runDatabaseSeeds: (options?: SeedRunOptions) => Promise<SeedRunSummary>;
