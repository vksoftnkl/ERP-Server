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
var HttpCacheInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpCacheInterceptor = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
const cache_constants_1 = require("@nestjs/cache-manager/dist/cache.constants");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const core_1 = require("@nestjs/core");
const CACHE_SKIP_PATH_SEGMENTS = new Set(['auth', 'profile', 'health']);
const isNil = (value) => value === null || value === undefined;
const isFunction = (value) => typeof value === 'function';
let HttpCacheInterceptor = HttpCacheInterceptor_1 = class HttpCacheInterceptor extends cache_manager_1.CacheInterceptor {
    logger = new common_1.Logger(HttpCacheInterceptor_1.name);
    constructor(cacheManager, reflector) {
        super(cacheManager, reflector);
    }
    async intercept(context, next) {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const key = this.trackBy(context);
        const ttlValueOrFactory = this.reflector.get(cache_constants_1.CACHE_TTL_METADATA, context.getHandler()) ??
            this.reflector.get(cache_constants_1.CACHE_TTL_METADATA, context.getClass()) ??
            null;
        const ttlSeconds = isFunction(ttlValueOrFactory)
            ? await ttlValueOrFactory(context)
            : ttlValueOrFactory;
        if (!key) {
            return next.handle();
        }
        const ttlIsExplicit = typeof ttlSeconds === 'number' && ttlSeconds > 0;
        if (!ttlIsExplicit) {
            this.setCacheHeader(context, 'MISS');
            return next.handle();
        }
        const ttlMilliseconds = ttlSeconds * 1000;
        try {
            const cachedValue = await this.cacheManager.get(key);
            this.setCacheHeader(context, isNil(cachedValue) ? 'MISS' : 'HIT');
            if (!isNil(cachedValue)) {
                return (0, rxjs_1.of)(cachedValue);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown cache lookup error';
            this.logger.warn(`Cache lookup failed for "${key}": ${message}`);
            this.setCacheHeader(context, 'MISS');
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.tap)(async (response) => {
            if (response instanceof common_1.StreamableFile) {
                return;
            }
            try {
                await this.cacheManager.set(key, response, ttlMilliseconds);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown cache write error';
                this.logger.warn(`Cache write failed for "${key}": ${message}`);
            }
        }));
    }
    trackBy(context) {
        if (context.getType() !== 'http') {
            return undefined;
        }
        const request = context.switchToHttp().getRequest();
        if (request.method !== 'GET' || !request.originalUrl) {
            return undefined;
        }
        const url = new URL(request.originalUrl, 'http://localhost');
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.some((segment) => CACHE_SKIP_PATH_SEGMENTS.has(segment))) {
            return undefined;
        }
        url.searchParams.sort();
        const searchParams = url.searchParams.toString();
        return searchParams ? `${url.pathname}?${searchParams}` : url.pathname;
    }
    setCacheHeader(context, value) {
        const response = context.switchToHttp().getResponse();
        response?.setHeader?.('X-Cache', value);
    }
};
exports.HttpCacheInterceptor = HttpCacheInterceptor;
exports.HttpCacheInterceptor = HttpCacheInterceptor = HttpCacheInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(cache_manager_1.CACHE_MANAGER)),
    __metadata("design:paramtypes", [Object, core_1.Reflector])
], HttpCacheInterceptor);
//# sourceMappingURL=http-cache.interceptor.js.map