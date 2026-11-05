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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpCacheInvalidationInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const data_change_service_1 = require("../data-changes/data-change.service");
const cache_invalidation_service_1 = require("../redis/cache-invalidation.service");
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CACHE_SKIP_PATH_SEGMENTS = new Set(['auth', 'profile', 'health']);
const READ_ONLY_WRITE_SUFFIXES = [
    '/validate',
    '/verify',
    '/preview',
    '/resolve',
    '/format/test',
    '/slip-check',
    '/print-share/create',
];
const PURGE_WAIT_MS = 2_000;
let HttpCacheInvalidationInterceptor = class HttpCacheInvalidationInterceptor {
    cacheInvalidationService;
    dataChangeService;
    constructor(cacheInvalidationService, dataChangeService) {
        this.cacheInvalidationService = cacheInvalidationService;
        this.dataChangeService = dataChangeService;
    }
    intercept(context, next) {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const request = context.switchToHttp().getRequest();
        if (!request.method || !WRITE_METHODS.has(request.method) || !request.originalUrl) {
            return next.handle();
        }
        const resource = this.resolveResource(request.originalUrl);
        if (!resource) {
            return next.handle();
        }
        const method = request.method;
        return next.handle().pipe((0, operators_1.concatMap)(async (response) => {
            await this.purgeCache();
            this.dataChangeService.publish({
                resource,
                method,
                at: Date.now(),
                originSessionId: request.user?.sid ?? null,
            });
            return response;
        }));
    }
    async purgeCache() {
        let timer;
        const bound = new Promise((resolve) => {
            timer = setTimeout(resolve, PURGE_WAIT_MS);
        });
        try {
            await Promise.race([this.cacheInvalidationService.invalidatePattern('*'), bound]);
        }
        finally {
            clearTimeout(timer);
        }
    }
    resolveResource(originalUrl) {
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
};
exports.HttpCacheInvalidationInterceptor = HttpCacheInvalidationInterceptor;
exports.HttpCacheInvalidationInterceptor = HttpCacheInvalidationInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_invalidation_service_1.CacheInvalidationService,
        data_change_service_1.DataChangeService])
], HttpCacheInvalidationInterceptor);
//# sourceMappingURL=http-cache-invalidation.interceptor.js.map