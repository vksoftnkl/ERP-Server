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
exports.CompanyGroupMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const COMPANY_GROUP_MASTER_TABLE_NAME = 'company group master';
const COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME = 'Company Group Master';
let CompanyGroupMasterService = class CompanyGroupMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveCompanyGroupMasterDto) {
        if (saveCompanyGroupMasterDto.cogGroupId) {
            return this.updateGroup(saveCompanyGroupMasterDto);
        }
        return this.createGroup(saveCompanyGroupMasterDto);
    }
    async getById(cogGroupId) {
        const record = await this.prisma.companyGroupMaster.findFirst({
            where: {
                cogGroupId,
                cogIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(cogGroupId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.companyGroupMaster.findFirst({
                where: {
                    cogGroupId,
                    cogIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.companyGroupMaster.updateMany({
                where: {
                    cogGroupId,
                    cogIsDeleted: false,
                },
                data: {
                    cogIsDeleted: true,
                    cogIsActive: false,
                    cogModifiedOn: modifiedOn,
                    cogModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                cogIsDeleted: true,
                cogIsActive: false,
                cogModifiedOn: modifiedOn,
                cogModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
                screenName: COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: cogGroupId,
                displayName: existing.cogGroupName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Company group soft deleted',
            }, tx);
            return {
                cogGroupId,
                deleted: true,
            };
        });
    }
    async createGroup(saveCompanyGroupMasterDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const groupName = (0, module_service_utils_1.normalizeRequiredText)(saveCompanyGroupMasterDto.cogGroupName, 'cogGroupName');
                const companyIds = this.toUniqueIds(saveCompanyGroupMasterDto.cogCompanyIds);
                await this.ensureGroupNameIsUnique(tx, groupName);
                const now = new Date();
                const data = {
                    cogGroupName: groupName,
                    cogCompanyIds: companyIds,
                    cogCreatedOn: now,
                    cogCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveCompanyGroupMasterDto, 'cogIsActive')) {
                    data.cogIsActive = saveCompanyGroupMasterDto.cogIsActive;
                }
                const created = await tx.companyGroupMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
                    screenName: COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.cogGroupId,
                    displayName: payload.cogGroupName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Company group created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Company group already exists', [{ field: 'cogGroupName', message: 'Duplicate company group unique value is not allowed' }]);
            throw error;
        }
    }
    async updateGroup(saveCompanyGroupMasterDto) {
        const cogGroupId = saveCompanyGroupMasterDto.cogGroupId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.companyGroupMaster.findFirst({
                    where: {
                        cogGroupId,
                        cogIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('Company group not found', 'cogGroupId', `No active company group found with id ${cogGroupId}`);
                }
                const groupName = (0, module_service_utils_1.normalizeRequiredText)(saveCompanyGroupMasterDto.cogGroupName, 'cogGroupName');
                const companyIds = this.toUniqueIds(saveCompanyGroupMasterDto.cogCompanyIds);
                await this.ensureGroupNameIsUnique(tx, groupName, cogGroupId);
                const data = {
                    cogGroupName: groupName,
                    cogCompanyIds: companyIds,
                    cogModifiedOn: new Date(),
                    cogModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if ((0, module_service_utils_1.hasOwnProperty)(saveCompanyGroupMasterDto, 'cogIsActive')) {
                    data.cogIsActive = saveCompanyGroupMasterDto.cogIsActive;
                }
                const updated = await tx.companyGroupMaster.update({
                    where: {
                        cogGroupId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: COMPANY_GROUP_MASTER_TABLE_NAME,
                    screenName: COMPANY_GROUP_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: cogGroupId,
                    displayName: payload.cogGroupName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Company group updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Company group already exists', [{ field: 'cogGroupName', message: 'Duplicate company group unique value is not allowed' }]);
            throw error;
        }
    }
    async ensureGroupNameIsUnique(tx, cogGroupName, excludeGroupId) {
        const existing = await tx.companyGroupMaster.findFirst({
            where: {
                cogIsDeleted: false,
                cogGroupName: {
                    equals: cogGroupName,
                    mode: 'insensitive',
                },
                ...(excludeGroupId
                    ? {
                        cogGroupId: {
                            not: excludeGroupId,
                        },
                    }
                    : {}),
            },
            select: {
                cogGroupId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('Company group name already exists', [
                { field: 'cogGroupName', message: 'Duplicate cogGroupName is not allowed' },
            ]);
        }
    }
    toUniqueIds(ids) {
        const uniqueIds = [];
        const seen = new Set();
        for (const id of ids) {
            if (!seen.has(id)) {
                seen.add(id);
                uniqueIds.push(id);
            }
        }
        return uniqueIds;
    }
    toPayload(record) {
        return {
            cogGroupId: record.cogGroupId,
            cogGroupName: record.cogGroupName,
            cogCompanyIds: record.cogCompanyIds,
            cogIsActive: record.cogIsActive,
            cogIsDeleted: record.cogIsDeleted,
            cogSyncDate: record.cogSyncDate ? record.cogSyncDate.toISOString() : null,
            cogCreatedOn: record.cogCreatedOn.toISOString(),
            cogCreatedBy: record.cogCreatedBy,
            cogModifiedOn: record.cogModifiedOn.toISOString(),
            cogModifiedBy: record.cogModifiedBy,
        };
    }
};
exports.CompanyGroupMasterService = CompanyGroupMasterService;
exports.CompanyGroupMasterService = CompanyGroupMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], CompanyGroupMasterService);
//# sourceMappingURL=company-group-master.service.js.map