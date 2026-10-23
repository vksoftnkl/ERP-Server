import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { CacheInvalidationService } from './cache-invalidation.service';
import type { RedisCacheService } from './redis-cache.service';

describe('CacheInvalidationService', () => {
  let cache: { del: jest.Mock; clear: jest.Mock };
  let redis: { isEnabled: jest.Mock; keys: jest.Mock; delMany: jest.Mock };
  let service: CacheInvalidationService;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    cache = { del: jest.fn(async () => true), clear: jest.fn(async () => true) };
    redis = {
      isEnabled: jest.fn(() => true),
      keys: jest.fn(async () => []),
      delMany: jest.fn(async (keys: string[]) => keys.length),
    };
    service = new CacheInvalidationService(
      cache as unknown as Cache,
      redis as unknown as RedisCacheService,
    );
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  describe('invalidate', () => {
    it('drops one key from the cache manager', async () => {
      await service.invalidate('/api/v1/items/list');

      expect(cache.del).toHaveBeenCalledWith('/api/v1/items/list');
    });

    it('only warns when the delete fails', async () => {
      cache.del.mockRejectedValue(new Error('down'));

      await expect(service.invalidate('k')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Failed to invalidate cache key "k": down');
    });
  });

  describe('invalidatePattern', () => {
    it('looks the pattern up under the http-cache namespace and deletes the hits', async () => {
      redis.keys.mockResolvedValue(['http-cache:/api/v1/items/a', 'http-cache:/api/v1/items/b']);

      await service.invalidatePattern('/api/v1/items');

      expect(redis.keys).toHaveBeenCalledWith('http-cache:/api/v1/items*');
      expect(redis.delMany).toHaveBeenCalledWith([
        'http-cache:/api/v1/items/a',
        'http-cache:/api/v1/items/b',
      ]);
    });

    it('turns "*" into the whole namespace', async () => {
      await service.invalidatePattern('*');

      expect(redis.keys).toHaveBeenCalledWith('http-cache:*');
    });

    it('skips the delete when nothing matches', async () => {
      await service.invalidatePattern('/x');

      expect(redis.delMany).not.toHaveBeenCalled();
    });

    it('does nothing when Redis is off', async () => {
      redis.isEnabled.mockReturnValue(false);

      await service.invalidatePattern('*');

      expect(redis.keys).not.toHaveBeenCalled();
    });

    it('only warns when Redis fails', async () => {
      redis.keys.mockRejectedValue(new Error('timeout'));

      await expect(service.invalidatePattern('/x')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Failed to invalidate cache pattern "/x": timeout');
    });
  });

  describe('invalidatePatterns', () => {
    it('deletes the union of every pattern, each key once', async () => {
      redis.keys
        .mockResolvedValueOnce(['http-cache:/a/1', 'http-cache:/shared'])
        .mockResolvedValueOnce(['http-cache:/shared', 'http-cache:/b/1']);

      await service.invalidatePatterns(['/a', '/b*']);

      expect(redis.keys.mock.calls).toEqual([['http-cache:/a*'], ['http-cache:/b*']]);
      expect(redis.delMany).toHaveBeenCalledWith([
        'http-cache:/a/1',
        'http-cache:/shared',
        'http-cache:/b/1',
      ]);
    });

    it('does nothing for an empty list or when Redis is off', async () => {
      await service.invalidatePatterns([]);
      redis.isEnabled.mockReturnValue(false);
      await service.invalidatePatterns(['/a']);

      expect(redis.keys).not.toHaveBeenCalled();
    });

    it('skips the delete when nothing matches', async () => {
      await service.invalidatePatterns(['/a', '/b']);

      expect(redis.delMany).not.toHaveBeenCalled();
    });

    it('only warns when Redis fails', async () => {
      redis.delMany.mockRejectedValue(new Error('gone'));
      redis.keys.mockResolvedValue(['http-cache:/a']);

      await expect(service.invalidatePatterns(['/a', '/b'])).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Failed to invalidate cache patterns "/a, /b": gone');
    });
  });

  describe('clearAll', () => {
    it('clears the in-memory cache when Redis is off', async () => {
      redis.isEnabled.mockReturnValue(false);

      await service.clearAll();

      expect(cache.clear).toHaveBeenCalledTimes(1);
      expect(redis.keys).not.toHaveBeenCalled();
    });

    it('only warns when the in-memory clear fails', async () => {
      redis.isEnabled.mockReturnValue(false);
      cache.clear.mockRejectedValue(new Error('nope'));

      await expect(service.clearAll()).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Failed to clear cache: nope');
    });

    it('deletes only the http-cache namespace when Redis is on', async () => {
      await service.clearAll();

      expect(redis.keys).toHaveBeenCalledWith('http-cache:*');
      expect(cache.clear).not.toHaveBeenCalled();
    });
  });
});
