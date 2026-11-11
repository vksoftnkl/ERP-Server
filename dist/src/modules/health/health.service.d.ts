import { PrismaService } from '../../database/prisma/prisma.service';
import type { ClientPlatform } from '../../common/client-info/client-info';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
import { AuthEpochService } from '../app-version/services/auth-epoch.service';
import { BuildPolicyService } from '../app-version/services/build-policy.service';
export interface ExpectedClientBuild {
    enforce: boolean;
    expectedBuild: number | null;
}
export interface HealthStatus {
    status: 'ok' | 'degraded';
    timestamp: string;
    version: string;
    build: number | null;
    commit: string | null;
    builtAt: string | null;
    dbOk: boolean;
    tokenEpoch: number;
    expectedClientBuilds: Record<ClientPlatform, ExpectedClientBuild>;
    database: {
        status: 'up' | 'down';
    };
    cache: {
        status: 'up' | 'down' | 'disabled';
    };
}
export declare class HealthService {
    private readonly prisma;
    private readonly redisCacheService;
    private readonly authEpoch;
    private readonly buildPolicy;
    constructor(prisma: PrismaService, redisCacheService: RedisCacheService, authEpoch: AuthEpochService, buildPolicy: BuildPolicyService);
    check(): Promise<HealthStatus>;
    private expectedClientBuilds;
}
