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
exports.AppUpdateService = void 0;
exports.mostUrgent = mostUrgent;
exports.toReleaseResponse = toReleaseResponse;
const common_1 = require("@nestjs/common");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_version_constants_1 = require("../app-version.constants");
const app_version_error_codes_1 = require("../types/app-version-error-codes");
let AppUpdateService = class AppUpdateService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async check(platform, currentBuild) {
        const live = liveReleasesOf(platform);
        const [missed, latest] = await Promise.all([
            this.prisma.appRelease.findMany({
                where: { ...live, arlBuild: { gt: currentBuild } },
                select: { arlSeverity: true },
            }),
            this.prisma.appRelease.findFirst({ where: live, orderBy: { arlBuild: 'desc' } }),
        ]);
        const updateAvailable = missed.length > 0;
        return {
            platform,
            currentBuild,
            updateAvailable,
            severity: updateAvailable ? mostUrgent(missed.map((row) => row.arlSeverity)) : null,
            latestBuild: latest?.arlBuild ?? null,
            latestVersion: latest?.arlVersion ?? null,
            downloadUrl: latest?.arlDownloadUrl ?? null,
            notes: latest?.arlNotes ?? null,
            releasedAt: latest ? latest.arlReleasedAt.toISOString() : null,
            missedBuilds: missed.length,
        };
    }
    async listReleases(platform) {
        const rows = await this.prisma.appRelease.findMany({
            where: platform ? liveReleasesOf(platform) : { arlIsDeleted: false, arlIsActive: true },
            orderBy: [{ arlPlatform: 'asc' }, { arlBuild: 'desc' }],
        });
        return rows.map(toReleaseResponse);
    }
    async createRelease(dto, actor) {
        const existing = await this.prisma.appRelease.findUnique({
            where: { arlPlatform_arlBuild: { arlPlatform: dto.platform, arlBuild: dto.build } },
            select: { arlIsDeleted: true },
        });
        if (existing) {
            throw buildExists(dto.platform, dto.build, existing.arlIsDeleted);
        }
        const inUse = await this.prisma.clientInstallation.aggregate({
            where: { cinPlatform: dto.platform, cinIsDeleted: false, cinBuild: { not: null } },
            _max: { cinBuild: true },
        });
        const highestInUse = inUse._max.cinBuild;
        if (highestInUse !== null && dto.build < highestInUse) {
            throw new common_1.ConflictException((0, app_version_error_codes_1.appVersionErrorBody)(`Build ${dto.build} is lower than build ${highestInUse}, which ${dto.platform} clients already run`, 'build', app_version_error_codes_1.AppVersionErrorCode.RELEASE_BUILD_TOO_LOW));
        }
        const now = new Date();
        try {
            const row = await this.prisma.appRelease.create({
                data: {
                    arlPlatform: dto.platform,
                    arlBuild: dto.build,
                    arlVersion: dto.version,
                    arlCommit: blankToNull(dto.commit),
                    arlSeverity: dto.severity ?? 'normal',
                    arlNotes: blankToNull(dto.notes),
                    arlDownloadUrl: blankToNull(dto.downloadUrl),
                    arlReleasedAt: dto.releasedAt ? new Date(dto.releasedAt) : now,
                    arlCreatedOn: now,
                    arlCreatedBy: actor,
                },
            });
            return toReleaseResponse(row);
        }
        catch (error) {
            if ((0, module_shared_utils_1.isUniqueConstraintError)(error)) {
                throw buildExists(dto.platform, dto.build, false);
            }
            throw error;
        }
    }
    async updateRelease(platform, build, dto, actor) {
        const where = { arlPlatform_arlBuild: { arlPlatform: platform, arlBuild: build } };
        const row = await this.prisma.appRelease.findUnique({ where });
        if (!row) {
            throw new common_1.NotFoundException((0, app_version_error_codes_1.appVersionErrorBody)(`No ${platform} release with build ${build}`, 'build', app_version_error_codes_1.AppVersionErrorCode.RELEASE_NOT_FOUND));
        }
        const data = {};
        if (dto.version !== undefined && dto.version !== null)
            data.arlVersion = dto.version;
        if (dto.commit !== undefined)
            data.arlCommit = blankToNull(dto.commit);
        if (dto.severity !== undefined && dto.severity !== null)
            data.arlSeverity = dto.severity;
        if (dto.notes !== undefined)
            data.arlNotes = blankToNull(dto.notes);
        if (dto.downloadUrl !== undefined)
            data.arlDownloadUrl = blankToNull(dto.downloadUrl);
        if (dto.releasedAt !== undefined && dto.releasedAt !== null) {
            data.arlReleasedAt = new Date(dto.releasedAt);
        }
        if (dto.isActive !== undefined && dto.isActive !== null)
            data.arlIsActive = dto.isActive;
        if (dto.isDeleted !== undefined && dto.isDeleted !== null)
            data.arlIsDeleted = dto.isDeleted;
        if (Object.keys(data).length === 0) {
            return toReleaseResponse(row);
        }
        const updated = await this.prisma.appRelease.update({
            where,
            data: { ...data, arlModifiedOn: new Date(), arlModifiedBy: actor },
        });
        return toReleaseResponse(updated);
    }
};
exports.AppUpdateService = AppUpdateService;
exports.AppUpdateService = AppUpdateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppUpdateService);
function liveReleasesOf(platform) {
    return { arlPlatform: platform, arlIsDeleted: false, arlIsActive: true };
}
function mostUrgent(severities) {
    let best = 'normal';
    for (const value of severities) {
        const severity = app_version_constants_1.RELEASE_SEVERITIES.includes(value)
            ? value
            : 'normal';
        if (app_version_constants_1.SEVERITY_RANK[severity] > app_version_constants_1.SEVERITY_RANK[best]) {
            best = severity;
        }
    }
    return best;
}
function buildExists(platform, build, yanked) {
    return new common_1.ConflictException((0, app_version_error_codes_1.appVersionErrorBody)(yanked
        ? `${platform} build ${build} was registered and yanked; restore it with PATCH isDeleted:false`
        : `${platform} build ${build} is already registered`, 'build', app_version_error_codes_1.AppVersionErrorCode.RELEASE_BUILD_EXISTS));
}
function blankToNull(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
function toReleaseResponse(row) {
    return {
        id: row.arlId,
        platform: row.arlPlatform,
        build: row.arlBuild,
        version: row.arlVersion,
        commit: row.arlCommit,
        severity: row.arlSeverity,
        notes: row.arlNotes,
        downloadUrl: row.arlDownloadUrl,
        releasedAt: row.arlReleasedAt.toISOString(),
        isActive: row.arlIsActive,
        isDeleted: row.arlIsDeleted,
        createdOn: row.arlCreatedOn.toISOString(),
        createdBy: row.arlCreatedBy,
        modifiedOn: row.arlModifiedOn ? row.arlModifiedOn.toISOString() : null,
        modifiedBy: row.arlModifiedBy,
    };
}
//# sourceMappingURL=app-update.service.js.map