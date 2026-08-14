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
exports.ItemsGroupMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_GROUP_TABLE_NAME = 'item group master';
const ITEM_GROUP_AUDIT_SCREEN_NAME = 'Item Group Master';
let ItemsGroupMasterService = class ItemsGroupMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemGroupDto) {
        if (saveItemGroupDto.itg_id) {
            return this.updateItemGroup(saveItemGroupDto);
        }
        return this.createItemGroup(saveItemGroupDto);
    }
    async getById(itgId) {
        const record = await this.prisma.itemGroupMaster.findFirst({
            where: {
                itgId,
                itgIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item group not found', 'itg_id', `No active item group found with id ${itgId}`);
        }
        const parentName = await this.resolveParentName(record.itgParentId);
        return this.toPayload(record, parentName);
    }
    async resolveParentName(parentId) {
        if (!parentId) {
            return null;
        }
        const parent = await this.prisma.itemGroupMaster.findFirst({
            where: { itgId: parentId },
            select: { itgName: true },
        });
        return parent?.itgName ?? null;
    }
    async toggleDelete(itgId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.itemGroupMaster.findFirst({
                where: { itgId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item group not found', 'itg_id', `No item group found with id ${itgId}`);
            }
            const wasDeleted = existing.itgIsDeleted;
            const nextDeleted = !wasDeleted;
            const modifiedOn = new Date();
            const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const subtreeIds = await this.getActiveSubtreeIds(tx, itgId);
            const ancestorIds = await this.getAncestorIds(tx, existing.itgParentId);
            const result = await tx.itemGroupMaster.updateMany({
                where: { itgId, itgIsDeleted: wasDeleted },
                data: {
                    itgIsDeleted: nextDeleted,
                    itgModifiedOn: modifiedOn,
                    itgModifiedBy: userId,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item group not found', 'itg_id', `No item group found with id ${itgId}`);
            }
            if (nextDeleted) {
                await this.removePathIds(tx, ancestorIds, subtreeIds);
            }
            else {
                await this.appendPathIds(tx, ancestorIds, subtreeIds);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                itgIsDeleted: nextDeleted,
                itgModifiedOn: modifiedOn,
                itgModifiedBy: userId,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: ITEM_GROUP_TABLE_NAME,
                screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: itgId,
                displayName: existing.itgName,
                originalRecord,
                modifiedRecord,
                userId,
                notes: nextDeleted ? 'Item group soft deleted' : 'Item group restored',
            }, tx);
            return { itg_id: itgId, deleted: nextDeleted };
        });
    }
    async createItemGroup(saveItemGroupDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                if (saveItemGroupDto.itg_parent_id) {
                    await this.ensureParentExists(saveItemGroupDto.itg_parent_id, tx);
                }
                const now = new Date();
                const createdBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                const modifiedBy = createdBy;
                const data = {
                    itgName: saveItemGroupDto.itg_name.trim(),
                    itgCreatedOn: now,
                    itgCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, saveItemGroupDto);
                const created = await tx.itemGroupMaster.create({ data });
                await this.ensureSelfInPath(tx, created.itgId);
                if (saveItemGroupDto.itg_parent_id) {
                    const ancestorIds = await this.getAncestorIds(tx, saveItemGroupDto.itg_parent_id);
                    await this.appendPathIds(tx, ancestorIds, [created.itgId]);
                }
                const refreshed = await tx.itemGroupMaster.findFirst({
                    where: {
                        itgId: created.itgId,
                        itgIsDeleted: false,
                    },
                });
                const payload = !refreshed
                    ? this.toPayload({
                        ...created,
                        itgPathIdsCache: this.mergePathIds(created.itgPathIdsCache, [created.itgId]),
                    })
                    : this.toPayload(refreshed);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_GROUP_TABLE_NAME,
                    screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.itg_id,
                    displayName: payload.itg_name,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item group created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemGroup(saveItemGroupDto) {
        const itgId = saveItemGroupDto.itg_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.itemGroupMaster.findFirst({
                    where: {
                        itgId,
                        itgIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item group not found', 'itg_id', `No active item group found with id ${itgId}`);
                }
                if (saveItemGroupDto.itg_parent_id === itgId) {
                    (0, module_service_utils_1.throwInventoryBadRequest)('Item group cannot be its own parent', [
                        {
                            field: 'itg_parent_id',
                            message: 'itg_parent_id cannot be same as itg_id',
                        },
                    ]);
                }
                if (saveItemGroupDto.itg_parent_id) {
                    await this.ensureParentExists(saveItemGroupDto.itg_parent_id, tx);
                }
                const hasParentField = (0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_parent_id');
                const nextParentId = hasParentField
                    ? (saveItemGroupDto.itg_parent_id ?? null)
                    : existing.itgParentId;
                const isParentChanged = hasParentField && nextParentId !== existing.itgParentId;
                const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, itgId) : [];
                const oldAncestorIds = isParentChanged
                    ? await this.getAncestorIds(tx, existing.itgParentId)
                    : [];
                const data = {
                    itgName: saveItemGroupDto.itg_name.trim(),
                    itgModifiedOn: new Date(),
                    itgModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveItemGroupDto);
                const updated = await tx.itemGroupMaster.update({
                    where: {
                        itgId,
                    },
                    data,
                });
                await this.ensureSelfInPath(tx, itgId);
                if (isParentChanged) {
                    const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
                    await this.removePathIds(tx, oldAncestorIds, subtreeIds);
                    await this.appendPathIds(tx, newAncestorIds, subtreeIds);
                }
                const refreshed = await tx.itemGroupMaster.findFirst({
                    where: {
                        itgId,
                        itgIsDeleted: false,
                    },
                });
                const payload = this.toPayload(refreshed ?? updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_GROUP_TABLE_NAME,
                    screenName: ITEM_GROUP_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: itgId,
                    displayName: payload.itg_name,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item group updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureParentExists(parentId, tx) {
        const parent = await tx.itemGroupMaster.findFirst({
            where: {
                itgId: parentId,
                itgIsDeleted: false,
            },
            select: {
                itgId: true,
            },
        });
        if (!parent) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Parent item group does not exist', [
                {
                    field: 'itg_parent_id',
                    message: `No active item group found with id ${parentId}`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveItemGroupDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_alias')) {
            data.itgAlias = saveItemGroupDto.itg_alias;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_short')) {
            data.itgShort = saveItemGroupDto.itg_short;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_description')) {
            data.itgDescription = saveItemGroupDto.itg_description;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_parent_id')) {
            data.itgParentId = saveItemGroupDto.itg_parent_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_sort')) {
            data.itgSort = saveItemGroupDto.itg_sort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_level')) {
            data.itgLevel = saveItemGroupDto.itg_level;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_tax_claim')) {
            data.itgTaxClaim = saveItemGroupDto.itg_tax_claim;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_default_tax_id')) {
            data.itgDefaultTaxId = saveItemGroupDto.itg_default_tax_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_default_hsn')) {
            data.itgDefaultHsn = saveItemGroupDto.itg_default_hsn;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_default_uom_id')) {
            data.itgDefaultUomId = saveItemGroupDto.itg_default_uom_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_photo')) {
            data.itgPhoto = this.decodePhotoInput(saveItemGroupDto.itg_photo);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemGroupDto, 'itg_photo_url')) {
            data.itgPhotoUrl = saveItemGroupDto.itg_photo_url;
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
            const parent = await tx.itemGroupMaster.findFirst({
                where: {
                    itgId: currentParentId,
                    itgIsDeleted: false,
                },
                select: {
                    itgId: true,
                    itgParentId: true,
                },
            });
            if (!parent) {
                break;
            }
            ancestorIds.push(parent.itgId);
            currentParentId = parent.itgParentId;
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
            const node = await tx.itemGroupMaster.findFirst({
                where: {
                    itgId: currentId,
                    itgIsDeleted: false,
                },
                select: {
                    itgId: true,
                },
            });
            if (!node) {
                continue;
            }
            subtreeIds.push(node.itgId);
            const children = await tx.itemGroupMaster.findMany({
                where: {
                    itgParentId: node.itgId,
                    itgIsDeleted: false,
                },
                select: {
                    itgId: true,
                },
            });
            for (const child of children) {
                if (!visited.has(child.itgId)) {
                    queue.push(child.itgId);
                }
            }
        }
        return subtreeIds;
    }
    async appendPathIds(tx, targetIds, idsToAdd) {
        const normalizedTargetIds = this.toUniqueIds(targetIds);
        const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
        if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0) {
            return;
        }
        const records = await tx.itemGroupMaster.findMany({
            where: {
                itgId: {
                    in: normalizedTargetIds,
                },
                itgIsDeleted: false,
            },
            select: {
                itgId: true,
                itgPathIdsCache: true,
            },
        });
        for (const record of records) {
            const nextPathIds = this.mergePathIds(record.itgPathIdsCache, normalizedIdsToAdd);
            if (this.areSameIds(record.itgPathIdsCache, nextPathIds)) {
                continue;
            }
            await tx.itemGroupMaster.update({
                where: {
                    itgId: record.itgId,
                },
                data: {
                    itgPathIdsCache: nextPathIds,
                },
            });
        }
    }
    async removePathIds(tx, targetIds, idsToRemove) {
        const normalizedTargetIds = this.toUniqueIds(targetIds);
        const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
        if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0) {
            return;
        }
        const records = await tx.itemGroupMaster.findMany({
            where: {
                itgId: {
                    in: normalizedTargetIds,
                },
                itgIsDeleted: false,
            },
            select: {
                itgId: true,
                itgPathIdsCache: true,
            },
        });
        for (const record of records) {
            const nextPathIds = this.excludePathIds(record.itgPathIdsCache, normalizedIdsToRemove);
            if (this.areSameIds(record.itgPathIdsCache, nextPathIds)) {
                continue;
            }
            await tx.itemGroupMaster.update({
                where: {
                    itgId: record.itgId,
                },
                data: {
                    itgPathIdsCache: nextPathIds,
                },
            });
        }
    }
    async ensureSelfInPath(tx, itgId) {
        await this.appendPathIds(tx, [itgId], [itgId]);
    }
    mergePathIds(existingIds, idsToAdd) {
        return this.toUniqueIds([...existingIds, ...idsToAdd]);
    }
    excludePathIds(existingIds, idsToRemove) {
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
        for (let i = 0; i < left.length; i += 1) {
            if (left[i] !== right[i]) {
                return false;
            }
        }
        return true;
    }
    decodePhotoInput(photo) {
        if (photo === undefined) {
            return undefined;
        }
        if (photo === null) {
            return null;
        }
        const trimmed = photo.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid base64 image provided', [
                {
                    field: 'itg_photo',
                    message: 'itg_photo must be a non-empty base64 string',
                },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid base64 image provided', [
                {
                    field: 'itg_photo',
                    message: 'itg_photo must be valid base64 content',
                },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record, parentName = null) {
        return {
            itg_id: record.itgId,
            itg_name: record.itgName,
            itg_alias: record.itgAlias,
            itg_short: record.itgShort,
            itg_description: record.itgDescription,
            itg_parent_id: record.itgParentId,
            itg_parent_name: parentName,
            itg_sort: record.itgSort,
            itg_level: record.itgLevel,
            itg_path_ids_cache: record.itgPathIdsCache,
            itg_tax_claim: record.itgTaxClaim,
            itg_default_tax_id: record.itgDefaultTaxId,
            itg_default_hsn: record.itgDefaultHsn,
            itg_default_uom_id: record.itgDefaultUomId,
            itg_photo: record.itgPhoto ? Buffer.from(record.itgPhoto).toString('base64') : null,
            itg_photo_url: record.itgPhotoUrl,
            itg_sync_date: record.itgSyncDate ? record.itgSyncDate.toISOString() : null,
            itg_is_active: record.itgIsActive,
            itg_is_deleted: record.itgIsDeleted,
            itg_created_on: record.itgCreatedOn.toISOString(),
            itg_created_by: record.itgCreatedBy,
            itg_modified_on: record.itgModifiedOn.toISOString(),
            itg_modified_by: record.itgModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item group name already exists', [
            { field: 'itg_name', message: 'Duplicate itg_name is not allowed' },
        ]);
    }
};
exports.ItemsGroupMasterService = ItemsGroupMasterService;
exports.ItemsGroupMasterService = ItemsGroupMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ItemsGroupMasterService);
//# sourceMappingURL=items-group-master.service.js.map