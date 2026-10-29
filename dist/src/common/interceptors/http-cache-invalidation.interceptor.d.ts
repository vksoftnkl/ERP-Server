import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataChangeService } from '../data-changes/data-change.service';
import { CacheInvalidationService } from '../redis/cache-invalidation.service';
export declare class HttpCacheInvalidationInterceptor implements NestInterceptor {
    private readonly cacheInvalidationService;
    private readonly dataChangeService;
    constructor(cacheInvalidationService: CacheInvalidationService, dataChangeService: DataChangeService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
    private purgeCache;
    private resolveResource;
}
