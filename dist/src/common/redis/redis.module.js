"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisModule = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cache_manager_redis_store_1 = require("cache-manager-redis-store");
const keyv_1 = require("keyv");
const cache_invalidation_service_1 = require("./cache-invalidation.service");
const http_cache_constants_1 = require("./http-cache.constants");
const legacy_redis_keyv_store_adapter_1 = require("./legacy-redis-keyv-store.adapter");
const noop_keyv_store_adapter_1 = require("./noop-keyv-store.adapter");
const redis_cache_service_1 = require("./redis-cache.service");
const parseNumber = (value, fallback) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};
let RedisModule = class RedisModule {
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            cache_manager_1.CacheModule.registerAsync({
                isGlobal: true,
                inject: [config_1.ConfigService],
                useFactory: async (configService) => {
                    const logger = new common_1.Logger(RedisModule.name);
                    const cacheEnabled = configService.get('redis.enabled', false);
                    const ttlSeconds = parseNumber(process.env.REDIS_TTL, configService.get('redis.ttl', 3600));
                    const ttlMilliseconds = ttlSeconds * 1;
                    if (!cacheEnabled) {
                        return {
                            ttl: ttlMilliseconds,
                            stores: [
                                new keyv_1.default({
                                    namespace: http_cache_constants_1.HTTP_CACHE_NAMESPACE,
                                    store: new noop_keyv_store_adapter_1.NoopKeyvStoreAdapter(),
                                    ttl: ttlMilliseconds,
                                }),
                            ],
                        };
                    }
                    try {
                        const host = process.env.REDIS_HOST ?? configService.get('redis.host', '127.0.0.1');
                        const port = parseNumber(process.env.REDIS_PORT, configService.get('redis.port', 6379));
                        const username = process.env.REDIS_USERNAME ?? configService.get('redis.username', '');
                        const password = process.env.REDIS_PASSWORD ?? configService.get('redis.password', '');
                        const database = configService.get('redis.db', 0);
                        const tls = configService.get('redis.tls', false);
                        const connectTimeout = configService.get('redis.connectTimeoutMs', 5000);
                        const redisUrl = process.env.REDIS_URL?.trim();
                        const socketOptions = {
                            connectTimeout,
                            reconnectStrategy: (retries) => Math.min(retries * 500, 5000),
                            ...(host ? { host } : {}),
                            ...(port ? { port } : {}),
                            ...(tls ? { tls: true } : {}),
                        };
                        const store = await (0, cache_manager_redis_store_1.redisStore)(redisUrl
                            ? {
                                ttl: ttlSeconds,
                                url: redisUrl,
                                socket: {
                                    connectTimeout,
                                    reconnectStrategy: (retries) => Math.min(retries * 500, 5000),
                                },
                            }
                            : {
                                ttl: ttlSeconds,
                                socket: socketOptions,
                                ...(username ? { username } : {}),
                                ...(password ? { password } : {}),
                                database,
                            });
                        const keyvStore = new keyv_1.default({
                            namespace: http_cache_constants_1.HTTP_CACHE_NAMESPACE,
                            store: new legacy_redis_keyv_store_adapter_1.LegacyRedisKeyvStoreAdapter(store, `${http_cache_constants_1.HTTP_CACHE_NAMESPACE}:`),
                            ttl: ttlMilliseconds,
                        });
                        keyvStore.on('error', (error) => {
                            const message = error instanceof Error ? error.message : 'Unknown HTTP cache store error';
                            logger.warn(`Redis HTTP cache store error: ${message}`);
                        });
                        return {
                            ttl: ttlMilliseconds,
                            stores: [keyvStore],
                        };
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : 'Unknown Redis setup error';
                        logger.warn(`Redis HTTP cache unavailable. Falling back to no-op cache store. ${message}`);
                        return {
                            ttl: ttlMilliseconds,
                            stores: [
                                new keyv_1.default({
                                    namespace: http_cache_constants_1.HTTP_CACHE_NAMESPACE,
                                    store: new noop_keyv_store_adapter_1.NoopKeyvStoreAdapter(),
                                    ttl: ttlMilliseconds,
                                }),
                            ],
                        };
                    }
                },
            }),
        ],
        providers: [redis_cache_service_1.RedisCacheService, cache_invalidation_service_1.CacheInvalidationService],
        exports: [redis_cache_service_1.RedisCacheService, cache_invalidation_service_1.CacheInvalidationService],
    })
], RedisModule);
//# sourceMappingURL=redis.module.js.map