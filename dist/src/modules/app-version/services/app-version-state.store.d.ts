import { Prisma } from '@prisma/client';
import { type ClientPlatform } from '../../../common/client-info/client-info';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { CompatManifest } from '../compat/compat-manifest';
import type { ReleaseImport } from '../compat/release-list';
export type BuildPolicySource = 'manifest' | 'manual';
export interface BuildPolicy {
    platform: ClientPlatform;
    enforce: boolean;
    expectedBuild: number | null;
    message: string | null;
    downloadUrl: string | null;
    source: BuildPolicySource;
    changedOn: Date | null;
    changedBy: string | null;
}
export interface BuildPolicyValues {
    enforce: boolean;
    expectedBuild: number | null;
    message: string | null;
    downloadUrl: string | null;
}
export interface BackendUpdateInput {
    build: number;
    version: string;
    commit: string | null;
    manifest: CompatManifest;
    releases: ReleaseImport[] | null;
    actor: string;
}
export interface BackendUpdateOutcome {
    bumped: boolean;
    epoch: number;
    previousBuild: number | null;
    policiesWritten: ClientPlatform[];
    policiesKeptManual: ClientPlatform[];
    policiesNoValue: ClientPlatform[];
    releasesImported: number | null;
}
export declare class AppVersionStateStore {
    private readonly prisma;
    constructor(prisma: PrismaService);
    readEpoch(): Promise<number>;
    readPolicies(): Promise<BuildPolicy[]>;
    applyBackendUpdate(input: BackendUpdateInput, whileLocked?: (outcome: BackendUpdateOutcome) => Promise<void>): Promise<BackendUpdateOutcome>;
    closeOpenLoginSessions(actor: string): Promise<number>;
    setExpectedBuild(tx: Prisma.TransactionClient, platform: ClientPlatform, build: number, downloadUrl: string | null, actor: string): Promise<boolean>;
    writePolicy(platform: ClientPlatform, source: BuildPolicySource | null, actor: string, change: (current: BuildPolicy | null) => BuildPolicyValues): Promise<BuildPolicy>;
}
