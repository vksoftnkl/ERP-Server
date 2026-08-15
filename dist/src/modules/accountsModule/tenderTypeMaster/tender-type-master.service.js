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
exports.TenderTypeMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const TENDER_TYPE_MASTER_TABLE_NAME = 'tender type';
const TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME = 'Tender Type Master';
let TenderTypeMasterService = class TenderTypeMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveTenderTypeMasterDto) {
        if (saveTenderTypeMasterDto.ttmTypeId) {
            return this.updateTenderType(saveTenderTypeMasterDto);
        }
        return this.createTenderType(saveTenderTypeMasterDto);
    }
    async getById(ttmTypeId) {
        const record = await this.prisma.accTenderType.findFirst({
            where: {
                ttmTypeId: this.parseTenderTypeId(ttmTypeId, 'ttmTypeId'),
                ttmIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('Tender type not found', 'ttmTypeId', `No active tender type found with id ${ttmTypeId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(ttmTypeId) {
        const tenderTypeId = this.parseTenderTypeId(ttmTypeId, 'ttmTypeId');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accTenderType.findFirst({
                where: {
                    ttmTypeId: tenderTypeId,
                    ttmIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Tender type not found', 'ttmTypeId', `No active tender type found with id ${ttmTypeId}`);
            }
            const activeTendersCount = await tx.accTenderMaster.count({
                where: {
                    tndTypeId: tenderTypeId,
                    tndIsDeleted: false,
                },
            });
            if (activeTendersCount > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Cannot delete tender type with active tenders', [
                    {
                        field: 'ttmTypeId',
                        message: `Tender type ${ttmTypeId} is used by ${activeTendersCount} tender(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.accTenderType.updateMany({
                where: {
                    ttmTypeId: tenderTypeId,
                    ttmIsDeleted: false,
                },
                data: {
                    ttmIsDeleted: true,
                    ttmIsActive: false,
                    ttmModifiedOn: modifiedOn,
                    ttmModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Tender type not found', 'ttmTypeId', `No active tender type found with id ${ttmTypeId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                ttmIsDeleted: true,
                ttmIsActive: false,
                ttmModifiedOn: modifiedOn,
                ttmModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: TENDER_TYPE_MASTER_TABLE_NAME,
                screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ttmTypeId,
                displayName: existing.ttmTypeName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Tender type soft deleted',
            }, tx);
            return {
                ttmTypeId,
                deleted: true,
            };
        });
    }
    async createTenderType(saveTenderTypeMasterDto) {
        try {
            return this.prisma.$transaction(async (tx) => {
                const ttmTypeName = (0, module_service_utils_1.normalizeRequiredText)(saveTenderTypeMasterDto.ttmTypeName, 'ttmTypeName');
                await this.ensureNameIsUnique(tx, ttmTypeName);
                const now = new Date();
                const data = {
                    ttmTypeId: await this.allocateTypeId(tx),
                    ttmTypeName,
                    ttmDisplayName: this.buildDisplayName(saveTenderTypeMasterDto, ttmTypeName),
                    ttmCreatedOn: now,
                    ttmCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveTenderTypeMasterDto, 'ttmIsActive')) {
                    data.ttmIsActive = saveTenderTypeMasterDto.ttmIsActive;
                }
                const created = await tx.accTenderType.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: TENDER_TYPE_MASTER_TABLE_NAME,
                    screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.ttmTypeId,
                    displayName: payload.ttmTypeName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Tender type created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Tender type already exists', [{ field: 'ttmTypeName', message: 'Duplicate tender type unique value is not allowed' }]);
            throw error;
        }
    }
    async updateTenderType(saveTenderTypeMasterDto) {
        const ttmTypeId = saveTenderTypeMasterDto.ttmTypeId;
        const tenderTypeId = this.parseTenderTypeId(ttmTypeId, 'ttmTypeId');
        try {
            return this.prisma.$transaction(async (tx) => {
                const existing = await tx.accTenderType.findFirst({
                    where: {
                        ttmTypeId: tenderTypeId,
                        ttmIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('Tender type not found', 'ttmTypeId', `No active tender type found with id ${ttmTypeId}`);
                }
                const ttmTypeName = (0, module_service_utils_1.normalizeRequiredText)(saveTenderTypeMasterDto.ttmTypeName, 'ttmTypeName');
                await this.ensureNameIsUnique(tx, ttmTypeName, tenderTypeId);
                const data = {
                    ttmTypeName,
                    ttmDisplayName: this.buildDisplayName(saveTenderTypeMasterDto, ttmTypeName),
                    ttmModifiedOn: new Date(),
                    ttmModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveTenderTypeMasterDto, 'ttmIsActive')) {
                    data.ttmIsActive = saveTenderTypeMasterDto.ttmIsActive;
                }
                const updated = await tx.accTenderType.update({
                    where: {
                        ttmTypeId: tenderTypeId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: TENDER_TYPE_MASTER_TABLE_NAME,
                    screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ttmTypeId,
                    displayName: payload.ttmTypeName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Tender type updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Tender type already exists', [{ field: 'ttmTypeName', message: 'Duplicate tender type unique value is not allowed' }]);
            throw error;
        }
    }
    async allocateTypeId(tx) {
        const highest = await tx.accTenderType.aggregate({
            _max: { ttmTypeId: true },
        });
        return (highest._max.ttmTypeId ?? 0) + 1;
    }
    async ensureNameIsUnique(tx, ttmTypeName, excludeTtmTypeId) {
        const existing = await tx.accTenderType.findFirst({
            where: {
                ttmTypeName: {
                    equals: ttmTypeName,
                    mode: 'insensitive',
                },
                ...(excludeTtmTypeId
                    ? {
                        ttmTypeId: {
                            not: excludeTtmTypeId,
                        },
                    }
                    : {}),
            },
            select: {
                ttmTypeId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('Tender type name already exists', [
                { field: 'ttmTypeName', message: 'Duplicate ttmTypeName is not allowed' },
            ]);
        }
    }
    buildDisplayName(saveTenderTypeMasterDto, ttmTypeName) {
        const provided = saveTenderTypeMasterDto.ttmDisplayName?.trim();
        return provided || ttmTypeName;
    }
    parseTenderTypeId(value, field) {
        const normalized = value.trim();
        if (!/^\d+$/.test(normalized)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid numeric identifier`,
                },
            ]);
        }
        const parsed = Number(normalized);
        if (!Number.isSafeInteger(parsed) || parsed > 2147483647) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid numeric identifier`,
                },
            ]);
        }
        return parsed;
    }
    toPayload(record) {
        return {
            ttmTypeId: record.ttmTypeId.toString(),
            ttmTypeName: record.ttmTypeName,
            ttmDisplayName: record.ttmDisplayName,
            ttmIsActive: record.ttmIsActive,
            ttmIsDeleted: record.ttmIsDeleted,
            ttmSyncDate: record.ttmSyncDate ? record.ttmSyncDate.toISOString() : null,
            ttmCreatedOn: record.ttmCreatedOn.toISOString(),
            ttmCreatedBy: record.ttmCreatedBy,
            ttmModifiedOn: record.ttmModifiedOn ? record.ttmModifiedOn.toISOString() : null,
            ttmModifiedBy: record.ttmModifiedBy,
        };
    }
};
exports.TenderTypeMasterService = TenderTypeMasterService;
exports.TenderTypeMasterService = TenderTypeMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], TenderTypeMasterService);
//# sourceMappingURL=tender-type-master.service.js.map