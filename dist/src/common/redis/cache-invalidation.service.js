"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CacheInvalidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheInvalidationService = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const common_1 = require("@nestjs/common");
const redis_cache_service_1 = require("./redis-cache.service");
const http_cache_constants_1 = require("./http-cache.constants");
let CacheInvalidationService = CacheInvalidationService_1 = class CacheInvalidationService {
    cacheManager;
    redisCacheService;
    logger = new common_1.Logger(CacheInvalidationService_1.name);
    constructor(cacheManager, redisCacheService) {
        this.cacheManager = cacheManager;
        this.redisCacheService = redisCacheService;
    }
    async invalidate(key) {
        try {
            await this.cacheManager.del(key);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown cache invalidation error';
            this.logger.warn(`Failed to invalidate cache key "${key}": ${message}`);
        }
    }
    async invalidatePattern(pattern) {
        if (!this.redisCacheService.isEnabled()) {
            return;
        }
        try {
            const keys = await this.redisCacheService.keys((0, http_cache_constants_1.buildHttpCacheStoragePattern)(pattern));
            if (keys.length === 0) {
                return;
            }
            await this.redisCacheService.delMany(keys);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown cache pattern invalidation error';
            this.logger.warn(`Failed to invalidate cache pattern "${pattern}": ${message}`);
        }
    }
    async invalidatePatterns(patterns) {
        if (!this.redisCacheService.isEnabled() || patterns.length === 0) {
            return;
        }
        try {
            const keyArrays = await Promise.all(patterns.map((pattern) => this.redisCacheService.keys((0, http_cache_constants_1.buildHttpCacheStoragePattern)(pattern))));
            const keys = [...new Set(keyArrays.flat())];
            if (keys.length === 0) {
                return;
            }
            await this.redisCacheService.delMany(keys);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown cache pattern invalidation error';
            this.logger.warn(`Failed to invalidate cache patterns "${patterns.join(', ')}": ${message}`);
        }
    }
    async clearAll() {
        if (!this.redisCacheService.isEnabled()) {
            try {
                await this.cacheManager.clear();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown cache clear operation error';
                this.logger.warn(`Failed to clear cache: ${message}`);
            }
            return;
        }
        await this.invalidatePattern('*');
    }
};
exports.CacheInvalidationService = CacheInvalidationService;
exports.CacheInvalidationService = CacheInvalidationService = CacheInvalidationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object, redis_cache_service_1.RedisCacheService])
], CacheInvalidationService);
//# sourceMappingURL=cache-invalidation.service.js.map