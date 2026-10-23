import { CallHandler, ExecutionContext, Logger, StreamableFile } from '@nestjs/common';
import { CACHE_TTL_METADATA } from '@nestjs/cache-manager/dist/cache.constants';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { Observable, firstValueFrom, of } from 'rxjs';
import { HttpCacheInterceptor } from './http-cache.interceptor';

class PlainController {}
class CachedController {}
Reflect.defineMetadata(CACHE_TTL_METADATA, 30, CachedController);

const plainHandler = () => undefined;
const handlerWithTtl = (ttl: unknown) => {
  const handler = () => undefined;
  Reflect.defineMetadata(CACHE_TTL_METADATA, ttl, handler);
  return handler;
};

const contextFor = (options: {
  type?: string;
  method?: string;
  originalUrl?: string;
  handler?: () => unknown;
  controller?: new () => unknown;
  headers?: Record<string, string>;
}) =>
  ({
    getType: () => options.type ?? 'http',
    getHandler: () => options.handler ?? plainHandler,
    getClass: () => options.controller ?? PlainController,
    switchToHttp: () => ({
      getRequest: () => ({
        method: options.method ?? 'GET',
        originalUrl: options.originalUrl ?? '/api/v1/items/list',
      }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => {
          if (options.headers) options.headers[name] = value;
        },
      }),
    }),
  }) as unknown as ExecutionContext;

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('HttpCacheInterceptor', () => {
  let store: Map<string, unknown>;
  let cache: { get: jest.Mock; set: jest.Mock };
  let interceptor: HttpCacheInterceptor;
  let handle: jest.Mock;
  let next: CallHandler;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    store = new Map();
    cache = {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    };
    interceptor = new HttpCacheInterceptor(cache as unknown as Cache, new Reflector());
    handle = jest.fn(() => of({ fresh: true }));
    next = { handle } as unknown as CallHandler;
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  const run = async (context: ExecutionContext) =>
    firstValueFrom((await interceptor.intercept(context, next)) as Observable<unknown>);

  describe('trackBy', () => {
    it('keys a GET on its path with the query sorted', () => {
      expect(
        interceptor.trackBy(contextFor({ originalUrl: '/api/v1/items/list?b=2&a=1&a=0' })),
      ).toBe('/api/v1/items/list?a=1&a=0&b=2');
    });

    it('keys a GET with no query on the bare path', () => {
      expect(interceptor.trackBy(contextFor({ originalUrl: '/api/v1/items/list?' }))).toBe(
        '/api/v1/items/list',
      );
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('never caches a %s', (method) => {
      expect(interceptor.trackBy(contextFor({ method }))).toBeUndefined();
    });

    it.each(['/api/v1/auth/me', '/api/v1/profile', '/api/v1/health'])(
      'never caches %s',
      (originalUrl) => {
        expect(interceptor.trackBy(contextFor({ originalUrl }))).toBeUndefined();
      },
    );

    it('only skips a whole segment, not a path that merely contains the word', () => {
      expect(interceptor.trackBy(contextFor({ originalUrl: '/api/v1/author-list' }))).toBe(
        '/api/v1/author-list',
      );
    });

    it('skips a request with no url, and any non-http context', () => {
      expect(interceptor.trackBy(contextFor({ originalUrl: '' }))).toBeUndefined();
      expect(interceptor.trackBy(contextFor({ type: 'rpc' }))).toBeUndefined();
    });
  });

  describe('intercept', () => {
    it('hands a non-http context straight to the handler', async () => {
      await expect(run(contextFor({ type: 'ws' }))).resolves.toEqual({ fresh: true });
      expect(cache.get).not.toHaveBeenCalled();
    });

    it('does not touch the cache for a route without @CacheTTL, and says MISS', async () => {
      const headers: Record<string, string> = {};

      await expect(run(contextFor({ headers }))).resolves.toEqual({ fresh: true });

      expect(cache.get).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
      expect(headers['X-Cache']).toBe('MISS');
    });

    it('treats a zero TTL as no TTL', async () => {
      await run(contextFor({ handler: handlerWithTtl(0) }));

      expect(cache.get).not.toHaveBeenCalled();
    });

    it('does not touch the cache for a write, even on a cached route', async () => {
      await run(contextFor({ method: 'POST', handler: handlerWithTtl(30) }));

      expect(cache.get).not.toHaveBeenCalled();
    });

    it('stores a miss for the TTL in milliseconds', async () => {
      const headers: Record<string, string> = {};

      await expect(run(contextFor({ handler: handlerWithTtl(30), headers }))).resolves.toEqual({
        fresh: true,
      });
      await flush();

      expect(headers['X-Cache']).toBe('MISS');
      expect(cache.set).toHaveBeenCalledWith('/api/v1/items/list', { fresh: true }, 30_000);
    });

    it('answers a hit from the cache without running the handler', async () => {
      store.set('/api/v1/items/list', { cached: true });
      const headers: Record<string, string> = {};

      await expect(run(contextFor({ handler: handlerWithTtl(30), headers }))).resolves.toEqual({
        cached: true,
      });

      expect(handle).not.toHaveBeenCalled();
      expect(headers['X-Cache']).toBe('HIT');
    });

    it('takes the TTL from the controller when the handler has none', async () => {
      await run(contextFor({ controller: CachedController }));
      await flush();

      expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.anything(), 30_000);
    });

    it('resolves a TTL factory per request', async () => {
      const factory = jest.fn(async () => 5);

      await run(contextFor({ handler: handlerWithTtl(factory) }));
      await flush();

      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.anything(), 5_000);
    });

    it('never stores a file download', async () => {
      const file = new StreamableFile(Buffer.from('pdf'));
      handle.mockReturnValue(of(file));

      await expect(run(contextFor({ handler: handlerWithTtl(30) }))).resolves.toBe(file);
      await flush();

      expect(cache.set).not.toHaveBeenCalled();
    });

    it('serves from the handler when the cache read fails', async () => {
      cache.get.mockRejectedValue(new Error('redis gone'));
      const headers: Record<string, string> = {};

      await expect(run(contextFor({ handler: handlerWithTtl(30), headers }))).resolves.toEqual({
        fresh: true,
      });

      expect(headers['X-Cache']).toBe('MISS');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('redis gone'));
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('still answers when the cache write fails', async () => {
      cache.set.mockRejectedValue(new Error('redis full'));

      await expect(run(contextFor({ handler: handlerWithTtl(30) }))).resolves.toEqual({
        fresh: true,
      });
      await flush();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('redis full'));
    });
  });
});
