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
exports.AccGroupMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ACC_GROUP_MASTER_TABLE_NAME = 'account groups';
const ACC_GROUP_MASTER_AUDIT_SCREEN_NAME = 'Account Group Master';
let AccGroupMasterService = class AccGroupMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveAccGroupMasterDto) {
        if (saveAccGroupMasterDto.accGroupId) {
            return this.updateAccGroupMaster(saveAccGroupMasterDto);
        }
        return this.createAccGroupMaster(saveAccGroupMasterDto);
    }
    async getById(accGroupId) {
        const record = await this.prisma.accGroupMaster.findFirst({
            where: {
                accGroupId,
                accGroupIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
        }
        const parentName = await this.getParentName(record.accGroupParentId);
        const companyName = await this.getCompanyName(record.accGroupCompanyId);
        return this.toPayload(record, parentName, companyName);
    }
    async softDelete(accGroupId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accGroupMaster.findFirst({
                where: {
                    accGroupId,
                    accGroupIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
            }
            if (existing.accGroupIsReserved) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Reserved account group cannot be deleted', [
                    {
                        field: 'accGroupId',
                        message: `Account group ${accGroupId} is reserved and cannot be deleted`,
                    },
                ]);
            }
            const hasChildren = await tx.accGroupMaster.count({
                where: {
                    accGroupParentId: accGroupId,
                    accGroupIsDeleted: false,
                },
            });
            if (hasChildren > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Cannot delete account group with active children', [
                    {
                        field: 'accGroupId',
                        message: `Account group ${accGroupId} has child groups. Reassign or delete them first.`,
                    },
                ]);
            }
            const ledgerCount = await tx.accLedgerMaster.count({
                where: {
                    ledGroupId: accGroupId,
                    ledIsDeleted: false,
                },
            });
            if (ledgerCount > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Cannot delete account group with active ledgers', [
                    {
                        field: 'accGroupId',
                        message: `Account group ${accGroupId} is used by ${ledgerCount} ledger(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.accGroupMaster.updateMany({
                where: {
                    accGroupId,
                    accGroupIsDeleted: false,
                },
                data: {
                    accGroupIsDeleted: true,
                    accGroupIsActive: false,
                    accGroupModifiedOn: modifiedOn,
                    accGroupModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                accGroupIsDeleted: true,
                accGroupIsActive: false,
                accGroupModifiedOn: modifiedOn,
                accGroupModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: ACC_GROUP_MASTER_TABLE_NAME,
                screenName: ACC_GROUP_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: accGroupId,
                displayName: existing.accGroupName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Account group soft deleted',
            }, tx);
            return {
                accGroupId,
                deleted: true,
            };
        });
    }
    async createAccGroupMaster(saveAccGroupMasterDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAccGroupMasterDto.accGroupName, 'accGroupName');
                if (!saveAccGroupMasterDto.accGroupParentId) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Parent account group is required', [
                        {
                            field: 'accGroupParentId',
                            message: 'accGroupParentId is required to create an account group',
                        },
                    ]);
                }
                const parent = await this.ensureParentExists(saveAccGroupMasterDto.accGroupParentId, tx);
                const companyId = parent.accGroupCompanyId;
                await this.ensureNameIsUnique(tx, normalizedName, companyId);
                const now = new Date();
                const createdBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                const data = {
                    accGroupCompanyId: companyId,
                    accGroupName: normalizedName,
                    accGroupType: parent.accGroupType,
                    accLedgerProfile: parent.accLedgerProfile,
                    accGroupNature: parent.accGroupNature,
                    accGroupCreatedOn: now,
                    accGroupCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, saveAccGroupMasterDto);
                const created = await tx.accGroupMaster.create({ data });
                const parentName = await this.getParentName(created.accGroupParentId, tx);
                const payload = this.toPayload(created, parentName);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ACC_GROUP_MASTER_TABLE_NAME,
                    screenName: ACC_GROUP_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.accGroupId,
                    displayName: payload.accGroupName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Account group created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account group already exists', [{ field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' }]);
            if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Invalid reference value provided', [
                    {
                        field: 'accGroupCompanyId',
                        message: 'Referenced company or parent account group does not exist',
                    },
                ]);
            }
            throw error;
        }
    }
    async updateAccGroupMaster(saveAccGroupMasterDto) {
        const accGroupId = saveAccGroupMasterDto.accGroupId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accGroupMaster.findFirst({
                    where: {
                        accGroupId,
                        accGroupIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('Account group not found', 'accGroupId', `No active account group found with id ${accGroupId}`);
                }
                if (existing.accGroupIsReserved) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Reserved account group cannot be edited', [
                        {
                            field: 'accGroupId',
                            message: `Account group ${accGroupId} is reserved and cannot be edited`,
                        },
                    ]);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAccGroupMasterDto.accGroupName, 'accGroupName');
                if (saveAccGroupMasterDto.accGroupParentId === accGroupId) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Account group cannot be its own parent', [
                        {
                            field: 'accGroupParentId',
                            message: 'accGroupParentId cannot be same as accGroupId',
                        },
                    ]);
                }
                const hasParentField = (0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupParentId');
                const nextParentId = hasParentField
                    ? (saveAccGroupMasterDto.accGroupParentId ?? null)
                    : existing.accGroupParentId;
                const isParentChanged = hasParentField && nextParentId !== existing.accGroupParentId;
                const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, accGroupId) : [];
                if (isParentChanged && nextParentId && subtreeIds.includes(nextParentId)) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Circular hierarchy is not allowed', [
                        {
                            field: 'accGroupParentId',
                            message: 'Parent cannot be a child of the same account group',
                        },
                    ]);
                }
                const parent = nextParentId ? await this.ensureParentExists(nextParentId, tx) : null;
                const nextCompanyId = parent ? parent.accGroupCompanyId : existing.accGroupCompanyId;
                await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId, {
                    accGroupName: existing.accGroupName,
                    accGroupCompanyId: existing.accGroupCompanyId,
                });
                const data = {
                    accGroupCompanyId: nextCompanyId,
                    accGroupName: normalizedName,
                    accGroupModifiedOn: new Date(),
                    accGroupModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                if (parent) {
                    data.accGroupType = parent.accGroupType;
                    data.accLedgerProfile = parent.accLedgerProfile;
                    data.accGroupNature = parent.accGroupNature;
                }
                this.applyOptionalFields(data, saveAccGroupMasterDto);
                const updated = await tx.accGroupMaster.update({
                    where: {
                        accGroupId,
                    },
                    data,
                });
                const originalParentName = await this.getParentName(existing.accGroupParentId, tx);
                const parentName = await this.getParentName(updated.accGroupParentId, tx);
                const payload = this.toPayload(updated, parentName);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ACC_GROUP_MASTER_TABLE_NAME,
                    screenName: ACC_GROUP_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: accGroupId,
                    displayName: payload.accGroupName,
                    originalRecord: this.toPayload(existing, originalParentName),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Account group updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account group already exists', [{ field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' }]);
            if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Invalid reference value provided', [
                    {
                        field: 'accGroupCompanyId',
                        message: 'Referenced company or parent account group does not exist',
                    },
                ]);
            }
            throw error;
        }
    }
    async ensureParentExists(parentId, tx) {
        const parent = await tx.accGroupMaster.findFirst({
            where: {
                accGroupId: parentId,
                accGroupIsDeleted: false,
            },
            select: {
                accGroupId: true,
                accGroupCompanyId: true,
                accGroupType: true,
                accLedgerProfile: true,
                accGroupNature: true,
            },
        });
        if (!parent) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Parent account group does not exist', [
                {
                    field: 'accGroupParentId',
                    message: `No active account group found with id ${parentId}`,
                },
            ]);
        }
        return parent;
    }
    async ensureNameIsUnique(tx, groupName, companyId, excludeId, previous) {
        const nextCompanyId = companyId ?? null;
        if (previous &&
            previous.accGroupName.trim().toLowerCase() === groupName.trim().toLowerCase() &&
            previous.accGroupCompanyId === nextCompanyId) {
            return;
        }
        const existing = await tx.accGroupMaster.findFirst({
            where: {
                accGroupIsDeleted: false,
                ...(nextCompanyId === null
                    ? {}
                    : { OR: [{ accGroupCompanyId: nextCompanyId }, { accGroupCompanyId: null }] }),
                accGroupName: {
                    equals: groupName,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        accGroupId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                accGroupId: true,
                accGroupCompanyId: true,
            },
        });
        if (existing) {
            const clashCompanyId = existing.accGroupCompanyId ?? null;
            let message;
            if (clashCompanyId === nextCompanyId) {
                message =
                    nextCompanyId === null
                        ? `Account group "${groupName}" already exists as a shared group`
                        : 'Duplicate accGroupName is not allowed for this company';
            }
            else if (nextCompanyId === null) {
                message = `Account group "${groupName}" already exists in one company, and a shared group is visible from every company`;
            }
            else {
                message = `Account group "${groupName}" already exists as a shared group, which this company also sees`;
            }
            (0, module_service_utils_1.throwAccountsConflict)('Account group name already exists', [
                { field: 'accGroupName', message },
            ]);
        }
    }
    applyOptionalFields(data, saveAccGroupMasterDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupAlias')) {
            data.accGroupAlias = saveAccGroupMasterDto.accGroupAlias;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupShort')) {
            data.accGroupShort = saveAccGroupMasterDto.accGroupShort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupDescription')) {
            data.accGroupDescription = saveAccGroupMasterDto.accGroupDescription;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupParentId')) {
            data.accGroupParentId = saveAccGroupMasterDto.accGroupParentId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupSort')) {
            data.accGroupSort = saveAccGroupMasterDto.accGroupSort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupBehaveAsSubledger')) {
            data.accGroupBehaveAsSubledger = saveAccGroupMasterDto.accGroupBehaveAsSubledger;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupNetDebitCredit')) {
            data.accGroupNetDebitCredit = saveAccGroupMasterDto.accGroupNetDebitCredit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupUsedForCalculation')) {
            data.accGroupUsedForCalculation = saveAccGroupMasterDto.accGroupUsedForCalculation;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupAffectsGrossProfit')) {
            data.accGroupAffectsGrossProfit = saveAccGroupMasterDto.accGroupAffectsGrossProfit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccGroupMasterDto, 'accGroupIsActive')) {
            data.accGroupIsActive = saveAccGroupMasterDto.accGroupIsActive;
        }
    }
    async getActiveSubtreeIds(tx, rootId) {
        const subtreeIds = [];
        const visited = new Set();
        const queue = [rootId];
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) {
                continue;
            }
            visited.add(currentId);
            const node = await tx.accGroupMaster.findFirst({
                where: {
                    accGroupId: currentId,
                    accGroupIsDeleted: false,
                },
                select: {
                    accGroupId: true,
                },
            });
            if (!node) {
                continue;
            }
            subtreeIds.push(node.accGroupId);
            const children = await tx.accGroupMaster.findMany({
                where: {
                    accGroupParentId: node.accGroupId,
                    accGroupIsDeleted: false,
                },
                select: {
                    accGroupId: true,
                },
            });
            for (const child of children) {
                if (!visited.has(child.accGroupId)) {
                    queue.push(child.accGroupId);
                }
            }
        }
        return subtreeIds;
    }
    async getParentName(parentId, client = this.prisma) {
        if (!parentId) {
            return null;
        }
        const parent = await client.accGroupMaster.findFirst({
            where: {
                accGroupId: parentId,
                accGroupIsDeleted: false,
            },
            select: {
                accGroupName: true,
            },
        });
        return parent?.accGroupName ?? null;
    }
    async getCompanyName(companyId, client = this.prisma) {
        if (!companyId) {
            return null;
        }
        const company = await client.company.findFirst({
            where: {
                compId: companyId,
            },
            select: {
                compName: true,
            },
        });
        return company?.compName ?? null;
    }
    toPayload(record, accGroupParentName = null, accGroupCompanyName = null) {
        return {
            accGroupId: record.accGroupId,
            accGroupCompanyId: record.accGroupCompanyId,
            accGroupCompanyName,
            accGroupName: record.accGroupName,
            accGroupAlias: record.accGroupAlias,
            accGroupShort: record.accGroupShort,
            accGroupDescription: record.accGroupDescription,
            accGroupTallyName: record.accGroupTallyName,
            accGroupPrimaryName: record.accGroupPrimaryName,
            accGroupNature: record.accGroupNature,
            accLedgerProfile: record.accLedgerProfile,
            accGroupTallyGuid: record.accGroupTallyGuid,
            accGroupTallyMasterId: record.accGroupTallyMasterId?.toString() ?? null,
            accGroupTallyAlterId: record.accGroupTallyAlterId?.toString() ?? null,
            accGroupParentId: record.accGroupParentId,
            accGroupParentName,
            accGroupSort: record.accGroupSort,
            accGroupType: record.accGroupType,
            accGroupIsDefault: record.accGroupIsDefault,
            accGroupIsReserved: record.accGroupIsReserved,
            accGroupBehaveAsSubledger: record.accGroupBehaveAsSubledger,
            accGroupNetDebitCredit: record.accGroupNetDebitCredit,
            accGroupUsedForCalculation: record.accGroupUsedForCalculation,
            accGroupAffectsGrossProfit: record.accGroupAffectsGrossProfit,
            accGroupIsActive: record.accGroupIsActive,
            accGroupIsDeleted: record.accGroupIsDeleted,
            accGroupSyncDate: record.accGroupSyncDate ? record.accGroupSyncDate.toISOString() : null,
            accGroupCreatedOn: record.accGroupCreatedOn.toISOString(),
            accGroupCreatedBy: record.accGroupCreatedBy,
            accGroupModifiedOn: record.accGroupModifiedOn.toISOString(),
            accGroupModifiedBy: record.accGroupModifiedBy,
        };
    }
};
exports.AccGroupMasterService = AccGroupMasterService;
exports.AccGroupMasterService = AccGroupMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], AccGroupMasterService);
//# sourceMappingURL=acc-group-master.service.js.map