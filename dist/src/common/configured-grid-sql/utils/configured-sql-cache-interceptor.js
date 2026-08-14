"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfiguredGridCacheInterceptor = void 0;
const common_1 = require("@nestjs/common");
const cache_manager_1 = require("@nestjs/cache-manager");
let ConfiguredGridCacheInterceptor = class ConfiguredGridCacheInterceptor extends cache_manager_1.CacheInterceptor {
    trackBy(context) {
        const req = context.switchToHttp().getRequest();
        if (req.method !== 'GET') {
            return undefined;
        }
        const q = req.query ?? {};
        const key = [
            req.path,
            `grid_id=${q.grid_id ?? ''}`,
            `page=${q.page ?? 1}`,
            `limit=${q.limit ?? 20}`,
            `search=${(q.search ?? '').toString().trim().toLowerCase()}`,
            `grid_param=${q.grid_param ?? ''}`,
        ].join('|');
        return key;
    }
};
exports.ConfiguredGridCacheInterceptor = ConfiguredGridCacheInterceptor;
exports.ConfiguredGridCacheInterceptor = ConfiguredGridCacheInterceptor = __decorate([
    (0, common_1.Injectable)()
], ConfiguredGridCacheInterceptor);
//# sourceMappingURL=configured-sql-cache-interceptor.js.map