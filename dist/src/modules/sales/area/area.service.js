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
exports.AreaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const AREA_TABLE_NAME = 'area master';
const AREA_AUDIT_SCREEN_NAME = 'Area Master';
const AREA_OPTIONAL_FIELDS = [
    'armAlias',
    'armShort',
    'armSort',
    'armDistanceKm',
    'armCollectionDays',
    'armDescription',
    'armIsActive',
];
const AREA_ACCOUNT_GROUP_PARENT_ID = '019f081c-6764-73b0-b397-3f30a6efe73e';
let AreaService = class AreaService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveAreaDto) {
        if (saveAreaDto.armId) {
            return this.updateArea(saveAreaDto);
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const { areaMaster } = await this.createAreaMaster(saveAreaDto, userId);
        return areaMaster;
    }
    async createAreaMaster(dto, userId, parentId = AREA_ACCOUNT_GROUP_PARENT_ID) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(dto.armName, 'armName');
        const actor = (0, module_service_utils_1.resolveActor)(dto.armCreatedBy, userId);
        const now = new Date();
        const isDeleted = dto.armIsActive === false;
        const sort = dto.armSort ?? 0;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureCityExists(tx, dto.armCityId);
                await this.ensureNameIsUnique(tx, normalizedName, dto.armCityId);
                const parent = await tx.accountGroup.findFirst({
                    where: {
                        accGroupId: parentId,
                        accGroupIsDeleted: false,
                    },
                    select: {
                        accGroupCompanyId: true,
                        accGroupType: true,
                        accLedgerProfile: true,
                        accGroupNature: true,
                    },
                });
                if (!parent) {
                    (0, module_service_utils_1.throwSalesBadRequest)('Parent account group does not exist', [
                        {
                            field: 'parentId',
                            message: `No active account group found with id ${parentId}`,
                        },
                    ]);
                }
                const accountGroupData = {
                    accGroupName: normalizedName,
                    accGroupShort: dto.armShort ?? null,
                    accGroupDescription: dto.armDescription?.slice(0, 250) ?? null,
                    accGroupSort: Math.trunc(sort),
                    accGroupParentId: parentId,
                    accGroupCompanyId: parent.accGroupCompanyId,
                    accGroupType: parent.accGroupType,
                    accLedgerProfile: parent.accLedgerProfile,
                    accGroupNature: parent.accGroupNature,
                    accGroupChildIds: [],
                    accGroupIsActive: !isDeleted,
                    accGroupIsDeleted: isDeleted,
                    accGroupCreatedOn: now,
                    accGroupCreatedBy: actor,
                    accGroupModifiedOn: now,
                    accGroupModifiedBy: actor,
                };
                const accountGroup = await tx.accountGroup.create({ data: accountGroupData });
                const accGroupId = accountGroup.accGroupId;
                const areaData = {
                    armId: accGroupId,
                    armName: normalizedName,
                    armAlias: dto.armAlias ?? null,
                    armShort: dto.armShort ?? null,
                    armCityId: dto.armCityId,
                    armSort: sort,
                    armDescription: dto.armDescription ?? null,
                    armCollectionDays: (0, module_service_utils_1.hasOwnProperty)(dto, 'armCollectionDays')
                        ? (dto.armCollectionDays ?? [])
                        : [],
                    armIsActive: !isDeleted,
                    armIsDeleted: isDeleted,
                    armCreatedOn: now,
                    armCreatedBy: actor,
                    armModifiedOn: now,
                    armModifiedBy: actor,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(dto, 'armDistanceKm')) {
                    areaData.armDistanceKm = dto.armDistanceKm ?? null;
                }
                const created = await tx.areaMaster.create({ data: areaData });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: AREA_TABLE_NAME,
                    screenName: AREA_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.armId,
                    displayName: payload.armName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'Area created with linked account group',
                }, tx);
                return { areaMaster: payload, accGroupId };
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Area already exists', [
                {
                    field: 'armName',
                    message: 'Duplicate armName is not allowed',
                },
            ]);
            throw error;
        }
    }
    async getById(armId) {
        const record = await this.prisma.areaMaster.findFirst({
            where: {
                armId,
                armIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Area not found', 'armId', `No active area found with id ${armId}`);
        }
        const payload = this.toPayload(record);
        payload.armCityName = await this.getCityName(this.prisma, record.armCityId);
        return payload;
    }
    async softDelete(armId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.areaMaster.findFirst({
                where: {
                    armId,
                    armIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Area not found', 'armId', `No active area found with id ${armId}`);
            }
            const customerCount = await tx.customer.count({
                where: {
                    cusAreaId: armId,
                    cusIsDeleted: false,
                },
            });
            if (customerCount > 0) {
                (0, module_service_utils_1.throwSalesBadRequest)('Cannot delete area with active customers', [
                    {
                        field: 'armId',
                        message: `Area ${armId} is used by ${customerCount} customer(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.areaMaster.updateMany({
                where: {
                    armId,
                    armIsDeleted: false,
                },
                data: {
                    armIsDeleted: true,
                    armIsActive: false,
                    armModifiedOn: modifiedOn,
                    armModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Area not found', 'armId', `No active area found with id ${armId}`);
            }
            await tx.accountGroup.updateMany({
                where: { accGroupId: armId },
                data: {
                    accGroupIsActive: false,
                    accGroupIsDeleted: true,
                    accGroupModifiedOn: modifiedOn,
                    accGroupModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                armIsDeleted: true,
                armIsActive: false,
                armModifiedOn: modifiedOn,
                armModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: AREA_TABLE_NAME,
                screenName: AREA_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: armId,
                displayName: existing.armName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Area soft deleted',
            }, tx);
            return {
                armId,
                deleted: true,
            };
        });
    }
    async updateArea(saveAreaDto) {
        const armId = saveAreaDto.armId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.areaMaster.findFirst({
                    where: {
                        armId,
                        armIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Area not found', 'armId', `No active area found with id ${armId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAreaDto.armName, 'armName');
                const nextCityId = (0, module_service_utils_1.hasOwnProperty)(saveAreaDto, 'armCityId')
                    ? saveAreaDto.armCityId
                    : existing.armCityId;
                await this.ensureCityExists(tx, nextCityId);
                await this.ensureNameIsUnique(tx, normalizedName, nextCityId, armId);
                const data = {
                    armName: normalizedName,
                    armCityId: nextCityId,
                    armModifiedOn: new Date(),
                    armModifiedBy: (0, module_service_utils_1.resolveActor)(saveAreaDto.armModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveAreaDto);
                const updated = await tx.areaMaster.update({
                    where: {
                        armId,
                    },
                    data,
                });
                await tx.accountGroup.updateMany({
                    where: { accGroupId: armId },
                    data: {
                        accGroupName: updated.armName,
                        accGroupShort: updated.armShort,
                        accGroupDescription: updated.armDescription?.slice(0, 250) ?? null,
                        accGroupSort: Math.trunc((0, module_service_utils_1.toNumber)(updated.armSort)),
                        accGroupIsActive: updated.armIsActive,
                        accGroupIsDeleted: updated.armIsDeleted,
                        accGroupModifiedOn: updated.armModifiedOn,
                        accGroupModifiedBy: updated.armModifiedBy,
                    },
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: AREA_TABLE_NAME,
                    screenName: AREA_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: armId,
                    displayName: payload.armName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.armModifiedBy,
                    notes: 'Area updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Area already exists', [
                {
                    field: 'armName',
                    message: 'Duplicate armName is not allowed',
                },
            ]);
            throw error;
        }
    }
    async getCityName(client, cityId) {
        if (!cityId) {
            return null;
        }
        const city = await client.cityMaster.findFirst({
            where: { ctmId: cityId },
            select: { ctmName: true },
        });
        return city?.ctmName ?? null;
    }
    async ensureCityExists(tx, cityId) {
        const city = await tx.cityMaster.findFirst({
            where: {
                ctmId: cityId,
                ctmIsDeleted: false,
            },
            select: {
                ctmId: true,
            },
        });
        if (!city) {
            (0, module_service_utils_1.throwSalesBadRequest)('City does not exist', [
                {
                    field: 'armCityId',
                    message: `No active city found with id ${cityId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, areaName, cityId, excludeId) {
        const existing = await tx.areaMaster.findFirst({
            where: {
                armIsDeleted: false,
                armCityId: cityId,
                armName: {
                    equals: areaName,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        armId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                armId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('Area name already exists for this city', [
                {
                    field: 'armName',
                    message: 'Duplicate area name is not allowed for this city',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveAreaDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveAreaDto, AREA_OPTIONAL_FIELDS);
    }
    toPayload(record) {
        return {
            armId: record.armId,
            armName: record.armName,
            armAlias: record.armAlias,
            armShort: record.armShort,
            armCityId: record.armCityId,
            armSort: (0, module_service_utils_1.toNumber)(record.armSort),
            armDistanceKm: record.armDistanceKm,
            armCollectionDays: record.armCollectionDays,
            armDescription: record.armDescription,
            armIsActive: record.armIsActive,
            armIsDeleted: record.armIsDeleted,
            armSyncDate: record.armSyncDate ? record.armSyncDate.toISOString() : null,
            armCreatedOn: record.armCreatedOn.toISOString(),
            armCreatedBy: record.armCreatedBy,
            armModifiedOn: record.armModifiedOn.toISOString(),
            armModifiedBy: record.armModifiedBy,
        };
    }
};
exports.AreaService = AreaService;
exports.AreaService = AreaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], AreaService);
//# sourceMappingURL=area.service.js.map