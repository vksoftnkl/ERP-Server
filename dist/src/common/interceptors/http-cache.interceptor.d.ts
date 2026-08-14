import { CallHandler, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
export declare class HttpCacheInterceptor extends CacheInterceptor {
    private readonly logger;
    constructor(cacheManager: Cache, reflector: Reflector);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>>;
    trackBy(context: ExecutionContext): string | undefined;
    private setCacheHeader;
}
