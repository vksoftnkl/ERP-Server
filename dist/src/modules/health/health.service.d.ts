import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
export interface HealthStatus {
    status: 'ok' | 'degraded';
    timestamp: string;
    version: string;
    build: number | null;
    commit: string | null;
    dbOk: boolean;
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
    constructor(prisma: PrismaService, redisCacheService: RedisCacheService);
    check(): Promise<HealthStatus>;
}
