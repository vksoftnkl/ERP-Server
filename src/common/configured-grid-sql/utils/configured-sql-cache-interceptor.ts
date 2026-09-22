// configured-grid-cache.interceptor.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

type GridCacheRequest = {
  method?: string;
  path?: string;
  query?: Record<string, unknown>;
};

/** Query values reach us untyped; render each one the way a template literal would. */
const text = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(text).join(',');
  return JSON.stringify(value) ?? '';
};

@Injectable()
export class ConfiguredGridCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest<GridCacheRequest>();

    // Only cache GET requests
    if (req.method !== 'GET') {
      return undefined; // undefined = skip cache
    }

    const q: Record<string, unknown> = req.query ?? {};

    // Build a deterministic key from ALL params that affect the result
    const key = [
      req.path ?? '', // e.g. /v1/configured-grid-sql/run
      `grid_id=${text(q.grid_id)}`,
      `page=${text(q.page ?? 1)}`,
      `limit=${text(q.limit ?? 20)}`,
      `search=${text(q.search).trim().toLowerCase()}`, // normalize search
      `grid_param=${text(q.grid_param)}`,
    ].join('|');

    return key;
  }
}
