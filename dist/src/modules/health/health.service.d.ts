import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisCacheService } from '../../common/redis/redis-cache.service';
export declare class HealthService {
    private readonly prisma;
    private readonly redisCacheService;
    constructor(prisma: PrismaService, redisCacheService: RedisCacheService);
    check(): Promise<{
        status: 'ok' | 'degraded';
        timestamp: string;
        database: {
            status: 'up' | 'down';
        };
        cache: {
            status: 'up' | 'down' | 'disabled';
        };
    }>;
}
