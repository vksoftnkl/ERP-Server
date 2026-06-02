// configured-grid-cache.interceptor.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

@Injectable()
export class ConfiguredGridCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();

    // Only cache GET requests
    if (req.method !== 'GET') {
      return undefined; // undefined = skip cache
    }

    const q = req.query ?? {};

    // Build a deterministic key from ALL params that affect the result
    const key = [
      req.path,                       // e.g. /v1/configured-grid-sql/run
      `grid_id=${q.grid_id ?? ''}`,
      `page=${q.page ?? 1}`,
      `limit=${q.limit ?? 20}`,
      `search=${(q.search ?? '').toString().trim().toLowerCase()}`, // normalize search
      `grid_param=${q.grid_param ?? ''}`,
    ].join('|');

    return key;
  }
}