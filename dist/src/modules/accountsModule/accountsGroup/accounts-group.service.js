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
exports.AccountsGroupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ACCOUNT_GROUP_TABLE_NAME = 'account groups';
const ACCOUNT_GROUP_AUDIT_SCREEN_NAME = 'Account Group Master';
let AccountsGroupService = class AccountsGroupService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveAccountGroupDto) {
        if (saveAccountGroupDto.accGroupId) {
            return this.updateAccountGroup(saveAccountGroupDto);
        }
        return this.createAccountGroup(saveAccountGroupDto);
    }
    async getById(accGroupId) {
        const record = await this.prisma.accountGroup.findFirst({
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
            const existing = await tx.accountGroup.findFirst({
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
            const hasChildren = await tx.accountGroup.count({
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
            const ancestorIds = await this.getAncestorIds(tx, existing.accGroupParentId);
            const modifiedOn = new Date();
            const result = await tx.accountGroup.updateMany({
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
            await this.removeChildIds(tx, ancestorIds, [accGroupId]);
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
                tableName: ACCOUNT_GROUP_TABLE_NAME,
                screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
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
    async createAccountGroup(saveAccountGroupDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAccountGroupDto.accGroupName, 'accGroupName');
                if (!saveAccountGroupDto.accGroupParentId) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Parent account group is required', [
                        {
                            field: 'accGroupParentId',
                            message: 'accGroupParentId is required to create an account group',
                        },
                    ]);
                }
                const parent = await this.ensureParentExists(saveAccountGroupDto.accGroupParentId, tx);
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
                    accGroupChildIds: [],
                    accGroupCreatedOn: now,
                    accGroupCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, saveAccountGroupDto);
                const created = await tx.accountGroup.create({ data });
                await this.ensureSelfInChildIds(tx, created.accGroupId);
                if (created.accGroupParentId) {
                    const ancestorIds = await this.getAncestorIds(tx, created.accGroupParentId);
                    await this.appendChildIds(tx, ancestorIds, [created.accGroupId]);
                }
                const refreshed = await tx.accountGroup.findFirst({
                    where: {
                        accGroupId: created.accGroupId,
                        accGroupIsDeleted: false,
                    },
                });
                const finalRecord = refreshed ??
                    {
                        ...created,
                        accGroupChildIds: this.mergeChildIds(created.accGroupChildIds, [created.accGroupId]),
                    };
                const parentName = await this.getParentName(finalRecord.accGroupParentId, tx);
                const payload = this.toPayload(finalRecord, parentName);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ACCOUNT_GROUP_TABLE_NAME,
                    screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
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
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account group already exists', [
                { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' },
            ]);
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
    async updateAccountGroup(saveAccountGroupDto) {
        const accGroupId = saveAccountGroupDto.accGroupId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accountGroup.findFirst({
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
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAccountGroupDto.accGroupName, 'accGroupName');
                if (saveAccountGroupDto.accGroupParentId === accGroupId) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Account group cannot be its own parent', [
                        {
                            field: 'accGroupParentId',
                            message: 'accGroupParentId cannot be same as accGroupId',
                        },
                    ]);
                }
                const hasParentField = (0, module_service_utils_1.hasOwnProperty)(saveAccountGroupDto, 'accGroupParentId');
                const nextParentId = hasParentField
                    ? (saveAccountGroupDto.accGroupParentId ?? null)
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
                await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, accGroupId);
                const oldAncestorIds = isParentChanged
                    ? await this.getAncestorIds(tx, existing.accGroupParentId)
                    : [];
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
                this.applyOptionalFields(data, saveAccountGroupDto);
                const updated = await tx.accountGroup.update({
                    where: {
                        accGroupId,
                    },
                    data,
                });
                await this.ensureSelfInChildIds(tx, accGroupId);
                if (isParentChanged) {
                    const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
                    await this.removeChildIds(tx, oldAncestorIds, subtreeIds);
                    await this.appendChildIds(tx, newAncestorIds, subtreeIds);
                }
                const refreshed = await tx.accountGroup.findFirst({
                    where: {
                        accGroupId,
                        accGroupIsDeleted: false,
                    },
                });
                const finalRecord = refreshed ?? updated;
                const originalParentName = await this.getParentName(existing.accGroupParentId, tx);
                const parentName = await this.getParentName(finalRecord.accGroupParentId, tx);
                const payload = this.toPayload(finalRecord, parentName);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ACCOUNT_GROUP_TABLE_NAME,
                    screenName: ACCOUNT_GROUP_AUDIT_SCREEN_NAME,
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
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account group already exists', [
                { field: 'accGroupName', message: 'Duplicate accGroupName is not allowed' },
            ]);
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
        const parent = await tx.accountGroup.findFirst({
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
    async ensureNameIsUnique(tx, groupName, companyId, excludeId) {
        const existing = await tx.accountGroup.findFirst({
            where: {
                accGroupIsDeleted: false,
                accGroupCompanyId: companyId,
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
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('Account group name already exists for this company', [
                {
                    field: 'accGroupName',
                    message: 'Duplicate accGroupName is not allowed for this company',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveAccountGroupDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountGroupDto, 'accGroupAlias')) {
            data.accGroupAlias = saveAccountGroupDto.accGroupAlias;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountGroupDto, 'accGroupShort')) {
            data.accGroupShort = saveAccountGroupDto.accGroupShort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountGroupDto, 'accGroupDescription')) {
            data.accGroupDescription = saveAccountGroupDto.accGroupDescription;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountGroupDto, 'accGroupParentId')) {
            data.accGroupParentId = saveAccountGroupDto.accGroupParentId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountGroupDto, 'accGroupSort')) {
            data.accGroupSort = saveAccountGroupDto.accGroupSort;
        }
    }
    async getAncestorIds(tx, startParentId) {
        const ancestorIds = [];
        const visited = new Set();
        let currentParentId = startParentId;
        while (currentParentId) {
            if (visited.has(currentParentId)) {
                break;
            }
            visited.add(currentParentId);
            const parent = await tx.accountGroup.findFirst({
                where: {
                    accGroupId: currentParentId,
                    accGroupIsDeleted: false,
                },
                select: {
                    accGroupId: true,
                    accGroupParentId: true,
                },
            });
            if (!parent) {
                break;
            }
            ancestorIds.push(parent.accGroupId);
            currentParentId = parent.accGroupParentId;
        }
        return ancestorIds;
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
            const node = await tx.accountGroup.findFirst({
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
            const children = await tx.accountGroup.findMany({
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
    async appendChildIds(tx, targetIds, idsToAdd) {
        const normalizedTargetIds = this.toUniqueIds(targetIds);
        const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
        if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
            return;
        }
        const records = await tx.accountGroup.findMany({
            where: {
                accGroupId: {
                    in: normalizedTargetIds,
                },
                accGroupIsDeleted: false,
            },
            select: {
                accGroupId: true,
                accGroupChildIds: true,
            },
        });
        for (const record of records) {
            const nextChildIds = this.mergeChildIds(record.accGroupChildIds, normalizedIdsToAdd);
            if (this.areSameIds(record.accGroupChildIds, nextChildIds)) {
                continue;
            }
            await tx.accountGroup.update({
                where: {
                    accGroupId: record.accGroupId,
                },
                data: {
                    accGroupChildIds: nextChildIds,
                },
            });
        }
    }
    async removeChildIds(tx, targetIds, idsToRemove) {
        const normalizedTargetIds = this.toUniqueIds(targetIds);
        const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
        if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
            return;
        }
        const records = await tx.accountGroup.findMany({
            where: {
                accGroupId: {
                    in: normalizedTargetIds,
                },
                accGroupIsDeleted: false,
            },
            select: {
                accGroupId: true,
                accGroupChildIds: true,
            },
        });
        for (const record of records) {
            const nextChildIds = this.excludeChildIds(record.accGroupChildIds, normalizedIdsToRemove);
            if (this.areSameIds(record.accGroupChildIds, nextChildIds)) {
                continue;
            }
            await tx.accountGroup.update({
                where: {
                    accGroupId: record.accGroupId,
                },
                data: {
                    accGroupChildIds: nextChildIds,
                },
            });
        }
    }
    async ensureSelfInChildIds(tx, accGroupId) {
        await this.appendChildIds(tx, [accGroupId], [accGroupId]);
    }
    mergeChildIds(existingIds, idsToAdd) {
        return this.toUniqueIds([...existingIds, ...idsToAdd]);
    }
    excludeChildIds(existingIds, idsToRemove) {
        const removeSet = new Set(idsToRemove);
        return existingIds.filter((id) => !removeSet.has(id));
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
    areSameIds(left, right) {
        if (left.length !== right.length) {
            return false;
        }
        for (let index = 0; index < left.length; index += 1) {
            if (left[index] !== right[index]) {
                return false;
            }
        }
        return true;
    }
    async getParentName(parentId, client = this.prisma) {
        if (!parentId) {
            return null;
        }
        const parent = await client.accountGroup.findFirst({
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
            accGroupChildIds: record.accGroupChildIds,
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
exports.AccountsGroupService = AccountsGroupService;
exports.AccountsGroupService = AccountsGroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], AccountsGroupService);
//# sourceMappingURL=accounts-group.service.js.map