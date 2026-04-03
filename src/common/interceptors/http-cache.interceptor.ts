import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import { CACHE_TTL_METADATA } from '@nestjs/cache-manager/dist/cache.constants';
import type { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
type CacheableRequest = {
  method?: string;
  originalUrl?: string;
};
const CACHE_SKIP_PATH_SEGMENTS = new Set(['auth', 'profile', 'health']);
const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;
const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function';
@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);
  constructor(
    @Inject(CACHE_MANAGER) cacheManager: Cache,
    reflector: Reflector,
  ) {
    super(cacheManager, reflector);
  }
  override async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<CacheableRequest>();
    const key = this.trackBy(context);
    const ttlValueOrFactory =
      this.reflector.get(CACHE_TTL_METADATA, context.getHandler()) ??
      this.reflector.get(CACHE_TTL_METADATA, context.getClass()) ??
      null;
    const ttlSeconds = isFunction(ttlValueOrFactory)
      ? await ttlValueOrFactory(context)
      : ttlValueOrFactory;
    if (request.method === 'GET' && (ttlSeconds === 0 || !key)) {
      this.setCacheHeader(context, 'MISS');
      return next.handle();
    }
    if (!key) {
      return next.handle();
    }
    try {
      const cachedValue = await this.cacheManager.get(key);
      this.setCacheHeader(context, isNil(cachedValue) ? 'MISS' : 'HIT');
      if (!isNil(cachedValue)) {
        return of(cachedValue);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cache lookup error';
      this.logger.warn(`Cache lookup failed for "${key}": ${message}`);
      this.setCacheHeader(context, 'MISS');
      return next.handle();
    }
    const ttlMilliseconds =
      typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds * 1000 : undefined;
    return next.handle().pipe(
      tap(async (response) => {
        if (response instanceof StreamableFile) {
          return;
        }
        try {
          if (ttlMilliseconds === undefined) {
            await this.cacheManager.set(key, response);
            return;
          }
          await this.cacheManager.set(key, response, ttlMilliseconds);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown cache write error';
          this.logger.warn(`Cache write failed for "${key}": ${message}`);
        }
      }),
    );
  }
  override trackBy(context: ExecutionContext): string | undefined {
    if (context.getType<'http'>() !== 'http') {
      return undefined;
    }
    const request = context.switchToHttp().getRequest<CacheableRequest>();
    if (request.method !== 'GET' || !request.originalUrl) {
      return undefined;
    }
    const url = new URL(request.originalUrl, 'http://localhost');
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.some((segment) => CACHE_SKIP_PATH_SEGMENTS.has(segment))) {
      return undefined;
    }
    url.searchParams.sort();
    const searchParams = url.searchParams.toString();
    return searchParams ? `${url.pathname}?${searchParams}` : url.pathname;
  }
  private setCacheHeader(context: ExecutionContext, value: 'HIT' | 'MISS'): void {
    const response = context.switchToHttp().getResponse<{ setHeader?: (name: string, value: string) => void }>();
    response?.setHeader?.('X-Cache', value);
  }
}
