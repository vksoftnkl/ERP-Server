import type { Cache } from 'cache-manager';
import { RedisCacheService } from './redis-cache.service';
export declare class CacheInvalidationService {
    private readonly cacheManager;
    private readonly redisCacheService;
    private readonly logger;
    constructor(cacheManager: Cache, redisCacheService: RedisCacheService);
    invalidate(key: string): Promise<void>;
    invalidatePattern(pattern: string): Promise<void>;
    invalidatePatterns(patterns: string[]): Promise<void>;
    clearAll(): Promise<void>;
}
