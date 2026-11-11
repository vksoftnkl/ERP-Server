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
var LegacyUsageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyUsageService = void 0;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_version_constants_1 = require("../app-version.constants");
let LegacyUsageService = LegacyUsageService_1 = class LegacyUsageService {
    prisma;
    logger = new common_1.Logger(LegacyUsageService_1.name);
    pending = new Map();
    droppedKeys = 0;
    timer = null;
    flushChain = Promise.resolve();
    constructor(prisma) {
        this.prisma = prisma;
    }
    onModuleInit() {
        this.timer = setInterval(() => {
            void this.flush();
        }, app_version_constants_1.LEGACY_FLUSH_INTERVAL_MS);
        this.timer.unref?.();
    }
    async onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flush();
    }
    record(name, client, count = 1) {
        try {
            const field = typeof name === 'string' ? name.trim().slice(0, 100) : '';
            const times = Math.floor(count);
            if (!field || !Number.isFinite(times) || times < 1) {
                return;
            }
            const now = new Date();
            this.merge({
                name: field,
                platform: client?.platform ?? 'unknown',
                build: client?.build ?? app_version_constants_1.LEGACY_UNKNOWN_BUILD,
                count: times,
                firstSeen: now,
                lastSeen: now,
            });
        }
        catch {
        }
    }
    flush() {
        const run = this.flushChain.then(() => this.flushOnce());
        this.flushChain = run.catch(() => undefined);
        return run.catch(() => 0);
    }
    async list(query) {
        await this.flush();
        const where = {
            aluIsDeleted: false,
            ...(query.name !== undefined &&
                query.name.trim() !== '' && {
                aluName: { contains: query.name.trim(), mode: 'insensitive' },
            }),
            ...(query.platform !== undefined && { aluPlatform: query.platform }),
            ...(query.build !== undefined && { aluBuild: query.build }),
        };
        const rows = await this.prisma.appLegacyUsage.findMany({
            where,
            orderBy: [{ aluName: 'asc' }, { aluPlatform: 'asc' }, { aluBuild: 'asc' }],
        });
        return rows.map(toLegacyUsageRow);
    }
    pendingCount() {
        return this.pending.size;
    }
    async flushOnce() {
        if (this.pending.size === 0) {
            return 0;
        }
        const batch = [...this.pending.values()];
        this.pending = new Map();
        let written = 0;
        for (let index = 0; index < batch.length; index += 1) {
            try {
                await this.write(batch[index]);
                written += 1;
            }
            catch (error) {
                batch.slice(index).forEach((entry) => this.merge(entry));
                this.logger.warn(`Legacy usage: ${batch.length - index} counter(s) kept for the next flush: ${describe(error)}`);
                break;
            }
        }
        if (this.droppedKeys > 0) {
            this.logger.warn(`Legacy usage: ${this.droppedKeys} new counter(s) dropped (over ${app_version_constants_1.LEGACY_MAX_PENDING_KEYS} pending)`);
            this.droppedKeys = 0;
        }
        return written;
    }
    async write(entry, isRetry = false) {
        const now = new Date();
        try {
            await this.prisma.appLegacyUsage.upsert({
                where: {
                    aluName_aluPlatform_aluBuild: {
                        aluName: entry.name,
                        aluPlatform: entry.platform,
                        aluBuild: entry.build,
                    },
                },
                create: {
                    aluName: entry.name,
                    aluPlatform: entry.platform,
                    aluBuild: entry.build,
                    aluCount: entry.count,
                    aluFirstSeen: entry.firstSeen,
                    aluLastSeen: entry.lastSeen,
                    aluCreatedOn: now,
                    aluCreatedBy: app_version_constants_1.SYSTEM_ACTOR,
                },
                update: {
                    aluCount: { increment: entry.count },
                    aluLastSeen: entry.lastSeen,
                    aluModifiedOn: now,
                    aluModifiedBy: app_version_constants_1.SYSTEM_ACTOR,
                },
            });
        }
        catch (error) {
            if (!isRetry && (0, module_shared_utils_1.isUniqueConstraintError)(error)) {
                await this.write(entry, true);
                return;
            }
            throw error;
        }
    }
    merge(entry) {
        const key = `${entry.name}\u0000${entry.platform}\u0000${entry.build}`;
        const held = this.pending.get(key);
        if (held) {
            held.count += entry.count;
            if (entry.firstSeen < held.firstSeen)
                held.firstSeen = entry.firstSeen;
            if (entry.lastSeen > held.lastSeen)
                held.lastSeen = entry.lastSeen;
            return;
        }
        if (this.pending.size >= app_version_constants_1.LEGACY_MAX_PENDING_KEYS) {
            this.droppedKeys += 1;
            return;
        }
        this.pending.set(key, { ...entry });
    }
};
exports.LegacyUsageService = LegacyUsageService;
exports.LegacyUsageService = LegacyUsageService = LegacyUsageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LegacyUsageService);
function toLegacyUsageRow(row) {
    return {
        id: row.aluId,
        name: row.aluName,
        platform: row.aluPlatform,
        build: row.aluBuild,
        count: row.aluCount,
        firstSeen: row.aluFirstSeen.toISOString(),
        lastSeen: row.aluLastSeen.toISOString(),
    };
}
function describe(error) {
    return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
//# sourceMappingURL=legacy-usage.service.js.map