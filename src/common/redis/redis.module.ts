import { CacheModule } from '@nestjs/cache-manager';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import Keyv from 'keyv';
import { CacheInvalidationService } from './cache-invalidation.service';
import { HTTP_CACHE_NAMESPACE } from './http-cache.constants';
import { LegacyRedisKeyvStoreAdapter } from './legacy-redis-keyv-store.adapter';
import { NoopKeyvStoreAdapter } from './noop-keyv-store.adapter';
import { RedisCacheService } from './redis-cache.service';

const parseNumber = (value: string | number | undefined, fallback: number): number => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger(RedisModule.name);
        const cacheEnabled = configService.get<boolean>('redis.enabled', false);
        const ttlSeconds = parseNumber(process.env.REDIS_TTL, configService.get<number>('redis.ttl', 3600));
        const ttlMilliseconds = ttlSeconds * 1000;

        if (!cacheEnabled) {
          return {
            ttl: ttlMilliseconds,
            stores: [
              new Keyv({
                namespace: HTTP_CACHE_NAMESPACE,
                store: new NoopKeyvStoreAdapter(),
                ttl: ttlMilliseconds,
              }),
            ],
          };
        }

        try {
          const host = process.env.REDIS_HOST ?? configService.get<string>('redis.host', '127.0.0.1');
          const port = parseNumber(process.env.REDIS_PORT, configService.get<number>('redis.port', 6379));
          const username =
            process.env.REDIS_USERNAME ?? configService.get<string>('redis.username', '');
          const password =
            process.env.REDIS_PASSWORD ?? configService.get<string>('redis.password', '');
          const database = configService.get<number>('redis.db', 0);
          const tls = configService.get<boolean>('redis.tls', false);
          const connectTimeout = configService.get<number>('redis.connectTimeoutMs', 5000);
          const redisUrl = process.env.REDIS_URL?.trim();
          const socketOptions = {
            connectTimeout,
            reconnectStrategy: (retries: number) => Math.min(retries * 500, 5000),
            ...(host ? { host } : {}),
            ...(port ? { port } : {}),
            ...(tls ? { tls: true } : {}),
          };

          const store = await redisStore(
            redisUrl
              ? {
                  ttl: ttlSeconds,
                  url: redisUrl,
                  socket: {
                    connectTimeout,
                    reconnectStrategy: (retries: number) => Math.min(retries * 500, 5000),
                  },
                }
              : {
                  ttl: ttlSeconds,
                  socket: socketOptions,
                  ...(username ? { username } : {}),
                  ...(password ? { password } : {}),
                  database,
                },
          );

          const keyvStore = new Keyv({
            namespace: HTTP_CACHE_NAMESPACE,
            store: new LegacyRedisKeyvStoreAdapter(store, `${HTTP_CACHE_NAMESPACE}:`),
            ttl: ttlMilliseconds,
          });

          keyvStore.on('error', (error) => {
            const message =
              error instanceof Error ? error.message : 'Unknown HTTP cache store error';
            logger.warn(`Redis HTTP cache store error: ${message}`);
          });

          return {
            ttl: ttlMilliseconds,
            stores: [keyvStore],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown Redis setup error';
          logger.warn(`Redis HTTP cache unavailable. Falling back to no-op cache store. ${message}`);
          return {
            ttl: ttlMilliseconds,
            stores: [
              new Keyv({
                namespace: HTTP_CACHE_NAMESPACE,
                store: new NoopKeyvStoreAdapter(),
                ttl: ttlMilliseconds,
              }),
            ],
          };
        }
      },
    }),
  ],
  providers: [RedisCacheService, CacheInvalidationService],
  exports: [RedisCacheService, CacheInvalidationService],
})
export class RedisModule {}
