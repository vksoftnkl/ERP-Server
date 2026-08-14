import { ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
export declare class ConfiguredGridCacheInterceptor extends CacheInterceptor {
    trackBy(context: ExecutionContext): string | undefined;
}
