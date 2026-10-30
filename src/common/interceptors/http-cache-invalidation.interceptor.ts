import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { DataChangeService } from '../data-changes/data-change.service';
import { CacheInvalidationService } from '../redis/cache-invalidation.service';
type CacheableRequest = {
  method?: string;
  originalUrl?: string;
  user?: { sid?: string | null };
};
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CACHE_SKIP_PATH_SEGMENTS = new Set(['auth', 'profile', 'health']);
/**
 * POST routes that only read: they check, preview or resolve something and
 * write nothing, so they must neither empty the cache nor make every connected
 * client re-read. Matched against the end of the path.
 */
const READ_ONLY_WRITE_SUFFIXES = [
  '/validate',
  '/verify',
  '/preview',
  '/resolve',
  '/format/test',
  '/slip-check',
  // Writes one print_share_link row, which no cached read and no screen shows;
  // the WhatsApp dialog asks for one on every open.
  '/print-share/create',
] as const;
/** Longest a write's response waits on the cache purge. */
const PURGE_WAIT_MS = 2_000;
/**
 * After every successful write:
 *
 *  1. Empty the whole HTTP cache. Not just the written resource's own routes:
 *     most cached reads are generic (`configured-grid-sql/run`,
 *     `dropdown-details/run`, `master-lookup`, stock balances, audit logs) and
 *     read tables that any write can touch, so a per-resource purge left them
 *     serving the pre-write answer until their TTL ran out.
 *  2. Announce the write on the data-change feed (`GET /data-changes/stream`),
 *     so every other open client re-reads what it shows.
 *
 * Both happen BEFORE the response is released: the client re-reads the moment
 * its save succeeds, and a purge still in flight would hand it the stale copy.
 */
@Injectable()
export class HttpCacheInvalidationInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheInvalidationService: CacheInvalidationService,
    private readonly dataChangeService: DataChangeService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<CacheableRequest>();
    if (!request.method || !WRITE_METHODS.has(request.method) || !request.originalUrl) {
      return next.handle();
    }
    const resource = this.resolveResource(request.originalUrl);
    if (!resource) {
      return next.handle();
    }
    const method = request.method;
    return next.handle().pipe(
      concatMap(async (response) => {
        await this.purgeCache();
        this.dataChangeService.publish({
          resource,
          method,
          at: Date.now(),
          originSessionId: request.user?.sid ?? null,
        });
        return response;
      }),
    );
  }
  /**
   * The purge never fails a write (the service logs and swallows Redis errors),
   * and a Redis that hangs must not hold the response either: past the bound
   * the save answers and the purge finishes behind it.
   */
  private async purgeCache(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const bound = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, PURGE_WAIT_MS);
    });
    try {
      await Promise.race([this.cacheInvalidationService.invalidatePattern('*'), bound]);
    } finally {
      clearTimeout(timer);
    }
  }
  private resolveResource(originalUrl: string): string | undefined {
    const url = new URL(originalUrl, 'http://localhost');
    const pathname = url.pathname.replace(/\/+$/, '');
    if (READ_ONLY_WRITE_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) {
      return undefined;
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 3) {
      return undefined;
    }
    const resource = segments[2];
    if (CACHE_SKIP_PATH_SEGMENTS.has(resource)) {
      return undefined;
    }
    return resource;
  }
}
