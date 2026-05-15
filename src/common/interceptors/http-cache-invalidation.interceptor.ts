import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheInvalidationService } from '../redis/cache-invalidation.service';
type CacheableRequest = {
  method?: string;
  originalUrl?: string;
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
    const resourcePattern = this.resolveResourcePattern(request.originalUrl);
    if (!resourcePattern) {
      return next.handle();
    }
    return next.handle().pipe(
      tap(async () => {
        await this.cacheInvalidationService.invalidatePattern(resourcePattern);
      }),
    );
  }
  private resolveResourcePattern(originalUrl: string): string | undefined {
    const url = new URL(originalUrl, 'http://localhost');
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 3) {
      return undefined;
    }
    const [apiPrefix, version, resource] = segments;
    if (CACHE_SKIP_PATH_SEGMENTS.has(resource)) {
      return undefined;
    }
    return `/${apiPrefix}/${version}/${resource}`;
  }
}