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
var ClientInstallationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientInstallationService = void 0;
const common_1 = require("@nestjs/common");
const client_info_1 = require("../../../common/client-info/client-info");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_version_constants_1 = require("../app-version.constants");
const DEFAULT_LIST_LIMIT = 100;
const DEFAULT_ACTIVE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const THROTTLE_PRUNE_AT = 10_000;
let ClientInstallationService = ClientInstallationService_1 = class ClientInstallationService {
    prisma;
    logger = new common_1.Logger(ClientInstallationService_1.name);
    lastRefreshWrite = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    recordLogin(sighting) {
        return this.write(sighting, 'login');
    }
    async recordRefresh(sighting) {
        const key = installationKey(sighting);
        const now = Date.now();
        const last = this.lastRefreshWrite.get(key);
        if (last !== undefined && now - last < app_version_constants_1.REFRESH_RECORD_INTERVAL_MS) {
            return false;
        }
        this.rememberRefresh(key, now);
        return this.write(sighting, 'refresh');
    }
    async list(query) {
        const where = {
            cinIsDeleted: false,
            ...(query.platform !== undefined && { cinPlatform: query.platform }),
            ...(query.build !== undefined && { cinBuild: query.build }),
            ...(query.companyId !== undefined && { cinCompanyId: query.companyId }),
            ...(query.userId !== undefined && { cinUserId: query.userId }),
            ...(query.deviceId !== undefined && { cinDeviceId: query.deviceId }),
        };
        const [total, rows] = await Promise.all([
            this.prisma.clientInstallation.count({ where }),
            this.prisma.clientInstallation.findMany({
                where,
                orderBy: [{ cinLastSeen: 'desc' }, { cinId: 'asc' }],
                take: query.limit ?? DEFAULT_LIST_LIMIT,
                skip: query.offset ?? 0,
            }),
        ]);
        const userIds = [...new Set(rows.map((row) => row.cinUserId))];
        const users = userIds.length === 0
            ? []
            : await this.prisma.userMaster.findMany({
                where: { usrId: { in: userIds } },
                select: { usrId: true, usrLoginName: true },
            });
        const nameOf = new Map(users.map((user) => [user.usrId, user.usrLoginName]));
        return { total, rows: rows.map((row) => toInstallationRow(row, nameOf.get(row.cinUserId))) };
    }
    async summary(query) {
        const activeDays = query.activeDays ?? DEFAULT_ACTIVE_DAYS;
        const since = new Date(Date.now() - activeDays * DAY_MS);
        const groups = await this.prisma.clientInstallation.groupBy({
            by: ['cinPlatform', 'cinBuild'],
            where: {
                cinIsDeleted: false,
                cinIsActive: true,
                cinLastSeen: { gte: since },
                ...(query.platform !== undefined && { cinPlatform: query.platform }),
            },
            _count: { _all: true },
            _max: { cinLastSeen: true },
        });
        const platforms = query.platform
            ? [query.platform]
            : client_info_1.CLIENT_PLATFORMS.filter((platform) => groups.some((g) => g.cinPlatform === platform));
        return Promise.all(platforms.map(async (platform) => {
            const latest = await this.prisma.appRelease.findFirst({
                where: { arlPlatform: platform, arlIsDeleted: false, arlIsActive: true },
                orderBy: { arlBuild: 'desc' },
                select: { arlBuild: true, arlVersion: true, arlSeverity: true },
            });
            const mine = groups
                .filter((g) => g.cinPlatform === platform)
                .sort((a, b) => (a.cinBuild ?? -1) - (b.cinBuild ?? -1));
            const known = mine.filter((g) => g.cinBuild !== null);
            const countOf = (list) => list.reduce((sum, g) => sum + g._count._all, 0);
            return {
                platform,
                activeDays,
                activeInstallations: countOf(mine),
                oldestActiveBuild: known.length > 0 ? known[0].cinBuild : null,
                newestActiveBuild: known.length > 0 ? known[known.length - 1].cinBuild : null,
                latestRelease: latest
                    ? { build: latest.arlBuild, version: latest.arlVersion, severity: latest.arlSeverity }
                    : null,
                upToDate: latest
                    ? countOf(known.filter((g) => g.cinBuild >= latest.arlBuild))
                    : 0,
                behind: latest
                    ? countOf(known.filter((g) => g.cinBuild < latest.arlBuild))
                    : 0,
                builds: mine.map((g) => ({
                    build: g.cinBuild,
                    installations: g._count._all,
                    lastSeen: g._max.cinLastSeen ? g._max.cinLastSeen.toISOString() : null,
                })),
            };
        }));
    }
    async write(sighting, kind) {
        const { client, companyId } = sighting;
        if (!companyId) {
            this.logger.debug(`Not recorded: user ${sighting.userId} has no company`);
            return false;
        }
        const now = new Date();
        const deviceId = client.deviceId ?? 'unknown';
        const ip = sighting.ip ? sighting.ip.slice(0, 60) : null;
        const loginStamp = kind === 'login' ? { cinLastLogin: now } : {};
        await this.prisma.clientInstallation.upsert({
            where: {
                cinCompanyId_cinUserId_cinDeviceId_cinPlatform: {
                    cinCompanyId: companyId,
                    cinUserId: sighting.userId,
                    cinDeviceId: deviceId,
                    cinPlatform: client.platform,
                },
            },
            create: {
                cinCompanyId: companyId,
                cinBranchId: sighting.branchId,
                cinUserId: sighting.userId,
                cinDeviceId: deviceId,
                cinPlatform: client.platform,
                cinBuild: client.build,
                cinVersion: client.version,
                cinCommit: client.commit,
                cinOs: client.deviceOs,
                cinIp: ip,
                cinFirstSeen: now,
                cinLastSeen: now,
                ...loginStamp,
                cinCreatedOn: now,
                cinCreatedBy: sighting.actor,
            },
            update: {
                cinBuild: client.build,
                ...(sighting.branchId !== null && { cinBranchId: sighting.branchId }),
                ...(client.version !== null && { cinVersion: client.version }),
                ...(client.commit !== null && { cinCommit: client.commit }),
                ...(client.deviceOs !== null && { cinOs: client.deviceOs }),
                ...(ip !== null && { cinIp: ip }),
                cinLastSeen: now,
                ...loginStamp,
                cinIsDeleted: false,
                cinModifiedOn: now,
                cinModifiedBy: sighting.actor,
            },
        });
        return true;
    }
    rememberRefresh(key, now) {
        if (this.lastRefreshWrite.size >= THROTTLE_PRUNE_AT) {
            for (const [entry, at] of this.lastRefreshWrite) {
                if (now - at >= app_version_constants_1.REFRESH_RECORD_INTERVAL_MS) {
                    this.lastRefreshWrite.delete(entry);
                }
            }
        }
        this.lastRefreshWrite.set(key, now);
    }
};
exports.ClientInstallationService = ClientInstallationService;
exports.ClientInstallationService = ClientInstallationService = ClientInstallationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientInstallationService);
function installationKey(sighting) {
    return [
        sighting.companyId ?? '-',
        sighting.userId,
        sighting.client.deviceId ?? 'unknown',
        sighting.client.platform,
    ].join('|');
}
function toInstallationRow(row, userName) {
    return {
        id: row.cinId,
        companyId: row.cinCompanyId,
        branchId: row.cinBranchId,
        userId: row.cinUserId,
        userName: userName ?? null,
        deviceId: row.cinDeviceId,
        platform: row.cinPlatform,
        build: row.cinBuild,
        version: row.cinVersion,
        commit: row.cinCommit,
        os: row.cinOs,
        ip: row.cinIp,
        firstSeen: row.cinFirstSeen.toISOString(),
        lastSeen: row.cinLastSeen.toISOString(),
        lastLogin: row.cinLastLogin ? row.cinLastLogin.toISOString() : null,
        isActive: row.cinIsActive,
        createdOn: row.cinCreatedOn.toISOString(),
        createdBy: row.cinCreatedBy,
        modifiedOn: row.cinModifiedOn ? row.cinModifiedOn.toISOString() : null,
        modifiedBy: row.cinModifiedBy,
    };
}
//# sourceMappingURL=client-installation.service.js.map