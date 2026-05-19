import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheInvalidationService } from '../redis/cache-invalidation.service';
import { RELATED_RESOURCE_INVALIDATIONS } from '../redis/http-cache.constants';
type CacheableRequest = {
  method?: string;
  originalUrl?: string;
};
type ResolvedResource = {
  apiBase: string;
  resource: string;
};
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CACHE_SKIP_PATH_SEGMENTS = new Set(['auth', 'profile', 'health']);
@Injectable()
export class HttpCacheInvalidationInterceptor implements NestInterceptor {
  constructor(private readonly cacheInvalidationService: CacheInvalidationService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<CacheableRequest>();
    if (!request.method || !WRITE_METHODS.has(request.method) || !request.originalUrl) {
      return next.handle();
    }
    const resolved = this.resolveResource(request.originalUrl);
    if (!resolved) {
      return next.handle();
    }
    return next.handle().pipe(
      tap(async () => {
        const patterns = this.buildInvalidationPatterns(resolved);
        await this.cacheInvalidationService.invalidatePatterns(patterns);
      }),
    );
  }
  private resolveResource(originalUrl: string): ResolvedResource | undefined {
    const url = new URL(originalUrl, 'http://localhost');
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 3) {
      return undefined;
    }
    const [apiPrefix, version, resource] = segments;
    if (CACHE_SKIP_PATH_SEGMENTS.has(resource)) {
      return undefined;
    }
    return { apiBase: `/${apiPrefix}/${version}`, resource };
  }
  private buildInvalidationPatterns({ apiBase, resource }: ResolvedResource): string[] {
    const patterns = new Set<string>([`${apiBase}/${resource}`]);
    // Bust explicitly related resources (e.g. ui-table-masters → ui-table-columns)
    const related = RELATED_RESOURCE_INVALIDATIONS[resource];
    if (related) {
      for (const relatedResource of related) {
        patterns.add(`${apiBase}/${relatedResource}`);
      }
    }
    return [...patterns];
  }
}