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
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const redis_cache_service_1 = require("../../common/redis/redis-cache.service");
let HealthService = class HealthService {
    prisma;
    redisCacheService;
    constructor(prisma, redisCacheService) {
        this.prisma = prisma;
        this.redisCacheService = redisCacheService;
    }
    async check() {
        let databaseStatus = 'up';
        let cacheStatus = 'disabled';
        try {
            await this.prisma.$queryRawUnsafe('SELECT 1');
        }
        catch {
            databaseStatus = 'down';
        }
        if (this.redisCacheService.isEnabled()) {
            try {
                await this.redisCacheService.ping();
                cacheStatus = 'up';
            }
            catch {
                cacheStatus = 'down';
            }
        }
        return {
            status: databaseStatus === 'up' && cacheStatus !== 'down' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            database: {
                status: databaseStatus,
            },
            cache: {
                status: cacheStatus,
            },
        };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_cache_service_1.RedisCacheService])
], HealthService);
//# sourceMappingURL=health.service.js.map