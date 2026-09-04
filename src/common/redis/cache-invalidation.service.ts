import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { RedisCacheService } from './redis-cache.service';
import { buildHttpCacheStoragePattern } from './http-cache.constants';
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly redisCacheService: RedisCacheService,
  ) {}
  async invalidate(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cache invalidation error';
      this.logger.warn(`Failed to invalidate cache key "${key}": ${message}`);
    }
  }
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      return;
    }
    try {
      const keys = await this.redisCacheService.keys(buildHttpCacheStoragePattern(pattern));
      if (keys.length === 0) {
        return;
      }
      await this.redisCacheService.delMany(keys);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown cache pattern invalidation error';
      this.logger.warn(`Failed to invalidate cache pattern "${pattern}": ${message}`);
    }
  }

  async invalidatePatterns(patterns: string[]): Promise<void> {
    if (!this.redisCacheService.isEnabled() || patterns.length === 0) {
      return;
    }
    try {
      const keyArrays = await Promise.all(
        patterns.map((pattern) => this.redisCacheService.keys(buildHttpCacheStoragePattern(pattern))),
      );
      const keys = [...new Set(keyArrays.flat())];
      if (keys.length === 0) {
        return;
      }
      await this.redisCacheService.delMany(keys);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown cache pattern invalidation error';
      this.logger.warn(
        `Failed to invalidate cache patterns "${patterns.join(', ')}": ${message}`,
      );
    }
  }
  async clearAll(): Promise<void> {
    if (!this.redisCacheService.isEnabled()) {
      try {
        await this.cacheManager.clear();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown cache clear operation error';
        this.logger.warn(`Failed to clear cache: ${message}`);
      }
      return;
    }
    await this.invalidatePattern('*');
  }
}
