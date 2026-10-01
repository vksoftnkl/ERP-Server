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
const cache_invalidation_service_1 = require("../redis/cache-invalidation.service");
const http_cache_constants_1 = require("../redis/http-cache.constants");
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CACHE_SKIP_PATH_SEGMENTS = new Set(['auth', 'profile', 'health']);
let HttpCacheInvalidationInterceptor = class HttpCacheInvalidationInterceptor {
    cacheInvalidationService;
    constructor(cacheInvalidationService) {
        this.cacheInvalidationService = cacheInvalidationService;
    }
    intercept(context, next) {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const request = context.switchToHttp().getRequest();
        if (!request.method || !WRITE_METHODS.has(request.method) || !request.originalUrl) {
            return next.handle();
        }
        const resolved = this.resolveResource(request.originalUrl);
        if (!resolved) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.tap)(async () => {
            const patterns = this.buildInvalidationPatterns(resolved);
            await this.cacheInvalidationService.invalidatePatterns(patterns);
        }));
    }
    resolveResource(originalUrl) {
        const url = new URL(originalUrl, 'http://localhost');
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length < 3) {
            return undefined;
        }
        const [apiPrefix, version, resource] = segments;
        if (CACHE_SKIP_PATH_SEGMENTS.has(resource)) {
            return undefined;
        }
        return { apiBase: `/${apiPrefix}/${version}`, resource };
    }
    buildInvalidationPatterns({ apiBase, resource }) {
        const patterns = new Set([`${apiBase}/${resource}`]);
        const related = http_cache_constants_1.RELATED_RESOURCE_INVALIDATIONS[resource];
        if (related) {
            for (const relatedResource of related) {
                patterns.add(`${apiBase}/${relatedResource}`);
            }
        }
        return [...patterns];
    }
};
exports.HttpCacheInvalidationInterceptor = HttpCacheInvalidationInterceptor;
exports.HttpCacheInvalidationInterceptor = HttpCacheInvalidationInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_invalidation_service_1.CacheInvalidationService])
], HttpCacheInvalidationInterceptor);
//# sourceMappingURL=http-cache-invalidation.interceptor.js.map