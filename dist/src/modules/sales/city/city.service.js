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
exports.CityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const CITY_TABLE_NAME = 'city master';
const CITY_AUDIT_SCREEN_NAME = 'City Master';
const CITY_OPTIONAL_FIELDS = ['ctmAlias', 'ctmShort', 'ctmOrder', 'ctmDescription', 'ctmIsActive'];
const CITY_ACCOUNT_GROUP_PARENT_ID = '019f081c-6764-73b0-b397-3f30a6efe73e';
let CityService = class CityService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveCityDto) {
        if (saveCityDto.ctmId) {
            return this.updateCity(saveCityDto);
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const { cityMaster } = await this.createCityMaster(saveCityDto, userId);
        return cityMaster;
    }
    async createCityMaster(dto, userId, parentId = CITY_ACCOUNT_GROUP_PARENT_ID) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(dto.ctmName, 'ctmName');
        const actor = (0, module_service_utils_1.resolveActor)(dto.ctmCreatedBy, userId);
        const now = new Date();
        const isDeleted = dto.ctmIsActive === false;
        const order = dto.ctmOrder ?? 0;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureStateExists(tx, dto.ctmStateId);
                await this.ensureNameIsUnique(tx, normalizedName, dto.ctmStateId);
                const parent = await tx.accGroupMaster.findFirst({
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
                    accGroupShort: dto.ctmShort ?? null,
                    accGroupDescription: dto.ctmDescription?.slice(0, 250) ?? null,
                    accGroupSort: Math.trunc(order),
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
                const accountGroup = await tx.accGroupMaster.create({ data: accountGroupData });
                const accGroupId = accountGroup.accGroupId;
                const cityData = {
                    ctmId: accGroupId,
                    ctmName: normalizedName,
                    ctmAlias: dto.ctmAlias ?? null,
                    ctmShort: dto.ctmShort ?? null,
                    ctmStateId: dto.ctmStateId,
                    ctmOrder: order,
                    ctmDescription: dto.ctmDescription ?? null,
                    ctmIsActive: !isDeleted,
                    ctmIsDeleted: isDeleted,
                    ctmCreatedOn: now,
                    ctmCreatedBy: actor,
                    ctmModifiedOn: now,
                    ctmModifiedBy: actor,
                };
                const created = await tx.cityMaster.create({ data: cityData });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: CITY_TABLE_NAME,
                    screenName: CITY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.ctmId,
                    displayName: payload.ctmName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'City created with linked account group',
                }, tx);
                return { cityMaster: payload, accGroupId };
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'City already exists', [
                {
                    field: 'ctmName',
                    message: 'Duplicate ctmName is not allowed',
                },
            ]);
            throw error;
        }
    }
    async getById(ctmId) {
        const record = await this.prisma.cityMaster.findFirst({
            where: {
                ctmId,
                ctmIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('City not found', 'ctmId', `No active city found with id ${ctmId}`);
        }
        const payload = this.toPayload(record);
        payload.ctmStateName = await this.getStateName(this.prisma, record.ctmStateId);
        return payload;
    }
    async softDelete(ctmId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.cityMaster.findFirst({
                where: {
                    ctmId,
                    ctmIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('City not found', 'ctmId', `No active city found with id ${ctmId}`);
            }
            const areaCount = await tx.areaMaster.count({
                where: {
                    armCityId: ctmId,
                    armIsDeleted: false,
                },
            });
            if (areaCount > 0) {
                (0, module_service_utils_1.throwSalesBadRequest)('Cannot delete city with active areas', [
                    {
                        field: 'ctmId',
                        message: `City ${ctmId} is used by ${areaCount} area(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.cityMaster.updateMany({
                where: {
                    ctmId,
                    ctmIsDeleted: false,
                },
                data: {
                    ctmIsDeleted: true,
                    ctmIsActive: false,
                    ctmModifiedOn: modifiedOn,
                    ctmModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('City not found', 'ctmId', `No active city found with id ${ctmId}`);
            }
            await tx.accGroupMaster.updateMany({
                where: { accGroupId: ctmId },
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
                ctmIsDeleted: true,
                ctmIsActive: false,
                ctmModifiedOn: modifiedOn,
                ctmModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: CITY_TABLE_NAME,
                screenName: CITY_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ctmId,
                displayName: existing.ctmName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'City soft deleted',
            }, tx);
            return {
                ctmId,
                deleted: true,
            };
        });
    }
    async updateCity(saveCityDto) {
        const ctmId = saveCityDto.ctmId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.cityMaster.findFirst({
                    where: {
                        ctmId,
                        ctmIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('City not found', 'ctmId', `No active city found with id ${ctmId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveCityDto.ctmName, 'ctmName');
                const nextStateId = (0, module_service_utils_1.hasOwnProperty)(saveCityDto, 'ctmStateId')
                    ? saveCityDto.ctmStateId
                    : existing.ctmStateId;
                await this.ensureStateExists(tx, nextStateId);
                await this.ensureNameIsUnique(tx, normalizedName, nextStateId, ctmId);
                const data = {
                    ctmName: normalizedName,
                    ctmStateId: nextStateId,
                    ctmModifiedOn: new Date(),
                    ctmModifiedBy: (0, module_service_utils_1.resolveActor)(saveCityDto.ctmModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveCityDto);
                const updated = await tx.cityMaster.update({
                    where: {
                        ctmId,
                    },
                    data,
                });
                await tx.accGroupMaster.updateMany({
                    where: { accGroupId: ctmId },
                    data: {
                        accGroupName: updated.ctmName,
                        accGroupShort: updated.ctmShort,
                        accGroupDescription: updated.ctmDescription?.slice(0, 250) ?? null,
                        accGroupSort: Math.trunc((0, module_service_utils_1.toNumber)(updated.ctmOrder)),
                        accGroupIsActive: updated.ctmIsActive,
                        accGroupIsDeleted: updated.ctmIsDeleted,
                        accGroupModifiedOn: updated.ctmModifiedOn,
                        accGroupModifiedBy: updated.ctmModifiedBy,
                    },
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: CITY_TABLE_NAME,
                    screenName: CITY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ctmId,
                    displayName: payload.ctmName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.ctmModifiedBy,
                    notes: 'City updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'City already exists', [
                {
                    field: 'ctmName',
                    message: 'Duplicate ctmName is not allowed',
                },
            ]);
            throw error;
        }
    }
    async getStateName(client, stateId) {
        if (!stateId) {
            return null;
        }
        const state = await client.stateMaster.findFirst({
            where: { stmId: stateId },
            select: { stmName: true },
        });
        return state?.stmName ?? null;
    }
    async ensureStateExists(tx, stateId) {
        const state = await tx.stateMaster.findFirst({
            where: {
                stmId: stateId,
                stmIsDeleted: false,
            },
            select: {
                stmId: true,
            },
        });
        if (!state) {
            (0, module_service_utils_1.throwSalesBadRequest)('State does not exist', [
                {
                    field: 'ctmStateId',
                    message: `No active state found with id ${stateId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, cityName, stateId, excludeId) {
        const existing = await tx.cityMaster.findFirst({
            where: {
                ctmIsDeleted: false,
                ctmStateId: stateId,
                ctmName: {
                    equals: cityName,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        ctmId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                ctmId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('City name already exists for this state', [
                {
                    field: 'ctmName',
                    message: 'Duplicate city name is not allowed for this state',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveCityDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveCityDto, CITY_OPTIONAL_FIELDS);
    }
    toPayload(record) {
        return {
            ctmId: record.ctmId,
            ctmName: record.ctmName,
            ctmAlias: record.ctmAlias,
            ctmShort: record.ctmShort,
            ctmStateId: record.ctmStateId,
            ctmOrder: (0, module_service_utils_1.toNumber)(record.ctmOrder),
            ctmDescription: record.ctmDescription,
            ctmIsActive: record.ctmIsActive,
            ctmIsDeleted: record.ctmIsDeleted,
            ctmSyncDate: record.ctmSyncDate ? record.ctmSyncDate.toISOString() : null,
            ctmCreatedOn: record.ctmCreatedOn.toISOString(),
            ctmCreatedBy: record.ctmCreatedBy,
            ctmModifiedOn: record.ctmModifiedOn.toISOString(),
            ctmModifiedBy: record.ctmModifiedBy,
        };
    }
};
exports.CityService = CityService;
exports.CityService = CityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], CityService);
//# sourceMappingURL=city.service.js.map