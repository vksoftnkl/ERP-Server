import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CacheInvalidationService } from '../redis/cache-invalidation.service';
export declare class HttpCacheInvalidationInterceptor implements NestInterceptor {
    private readonly cacheInvalidationService;
    constructor(cacheInvalidationService: CacheInvalidationService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
    private resolveResource;
    private buildInvalidationPatterns;
}
