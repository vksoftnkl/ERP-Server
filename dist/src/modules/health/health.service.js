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
const auth_epoch_service_1 = require("../app-version/services/auth-epoch.service");
const build_policy_service_1 = require("../app-version/services/build-policy.service");
const backend_build_1 = require("./backend-build");
let HealthService = class HealthService {
    prisma;
    redisCacheService;
    authEpoch;
    buildPolicy;
    constructor(prisma, redisCacheService, authEpoch, buildPolicy) {
        this.prisma = prisma;
        this.redisCacheService = redisCacheService;
        this.authEpoch = authEpoch;
        this.buildPolicy = buildPolicy;
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
        const build = (0, backend_build_1.backendBuild)();
        return {
            status: databaseStatus === 'up' && cacheStatus !== 'down' ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            version: build.version,
            build: build.build,
            commit: build.commit,
            builtAt: build.builtAt,
            dbOk: databaseStatus === 'up',
            tokenEpoch: this.authEpoch.current(),
            expectedClientBuilds: this.expectedClientBuilds(),
            database: {
                status: databaseStatus,
            },
            cache: {
                status: cacheStatus,
            },
        };
    }
    expectedClientBuilds() {
        const result = {};
        for (const policy of this.buildPolicy.list()) {
            result[policy.platform] = { enforce: policy.enforce, expectedBuild: policy.expectedBuild };
        }
        return result;
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_cache_service_1.RedisCacheService,
        auth_epoch_service_1.AuthEpochService,
        build_policy_service_1.BuildPolicyService])
], HealthService);
//# sourceMappingURL=health.service.js.map