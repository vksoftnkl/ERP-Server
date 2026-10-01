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
exports.ItemsSectionMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const master_tree_helper_1 = require("../utils/master-tree.helper");
const ITEM_SECTION_TABLE_NAME = 'item section master';
const ITEM_SECTION_AUDIT_SCREEN_NAME = 'Item Section Master';
const ITEM_SECTION_REFERENCES = [
    {
        table: 'inventory.item_master',
        column: 'item_section_id',
        live: 'item_is_deleted = false',
        label: 'items',
    },
];
const ITEM_SECTION_DELETE_STATE = {
    label: 'item section',
    idField: 'sec_id',
    restoreRoute: '/item-sections/restore',
};
let ItemsSectionMasterService = class ItemsSectionMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemSectionDto) {
        if (saveItemSectionDto.sec_id) {
            return this.updateItemSection(saveItemSectionDto);
        }
        return this.createItemSection(saveItemSectionDto);
    }
    async getById(secId) {
        const record = await this.prisma.itemSectionMaster.findFirst({
            where: { secId, secIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item section not found', 'sec_id', `No active item section found with id ${secId}`);
        }
        const parentName = await this.getParentName(record.secParentId);
        return this.toPayload(record, parentName);
    }
    async getParentName(parentId) {
        if (!parentId)
            return null;
        const parent = await this.prisma.itemSectionMaster.findFirst({
            where: { secId: parentId },
            select: { secName: true },
        });
        return parent?.secName ?? null;
    }
    async softDelete(secId) {
        return this.setDeleted(secId, true);
    }
    async restore(secId) {
        return this.setDeleted(secId, false);
    }
    async setDeleted(secId, wantDeleted) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.itemSectionMaster.findFirst({
                where: { secId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item section not found', 'sec_id', `No item section found with id ${secId}`);
            }
            (0, master_tree_helper_1.assertDeleteState)(existing.secIsDeleted, wantDeleted, ITEM_SECTION_DELETE_STATE);
            if (wantDeleted) {
                await (0, master_tree_helper_1.assertNoLiveChildren)(tx, master_tree_helper_1.ITEM_SECTION_TREE, secId);
                await (0, master_tree_helper_1.assertNoLiveReferences)(tx, ITEM_SECTION_REFERENCES, secId, ITEM_SECTION_DELETE_STATE);
            }
            else {
                await (0, master_tree_helper_1.assertParentLive)(tx, master_tree_helper_1.ITEM_SECTION_TREE, existing.secParentId);
            }
            const wasDeleted = existing.secIsDeleted;
            const nextDeleted = wantDeleted;
            const subtreeIds = nextDeleted ? await this.getActiveSubtreeIds(tx, secId) : [];
            const ancestorIds = await this.getAncestorIds(tx, existing.secParentId);
            const modifiedOn = new Date();
            const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.itemSectionMaster.updateMany({
                where: { secId, secIsDeleted: wasDeleted },
                data: { secIsDeleted: nextDeleted, secModifiedOn: modifiedOn, secModifiedBy: userId },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item section not found', 'sec_id', `No item section found with id ${secId}`);
            }
            if (nextDeleted) {
                await this.removePathIds(tx, ancestorIds, subtreeIds);
            }
            else {
                await this.appendPathIds(tx, ancestorIds, await this.getActiveSubtreeIds(tx, secId));
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                secIsDeleted: nextDeleted,
                secModifiedOn: modifiedOn,
                secModifiedBy: userId,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: ITEM_SECTION_TABLE_NAME,
                screenName: ITEM_SECTION_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: secId,
                displayName: existing.secName,
                originalRecord,
                modifiedRecord,
                userId,
                notes: nextDeleted ? 'Item section soft deleted' : 'Item section restored',
            }, tx);
            return { sec_id: secId, deleted: nextDeleted };
        });
    }
    async createItemSection(saveItemSectionDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                if (saveItemSectionDto.sec_parent_id) {
                    await this.ensureParentExists(saveItemSectionDto.sec_parent_id, tx);
                }
                const now = new Date();
                const createdBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                const data = {
                    secName: saveItemSectionDto.sec_name.trim(),
                    secCreatedOn: now,
                    secCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, saveItemSectionDto);
                const created = await tx.itemSectionMaster.create({ data });
                await this.ensureSelfInPath(tx, created.secId);
                if (saveItemSectionDto.sec_parent_id) {
                    const ancestorIds = await this.getAncestorIds(tx, saveItemSectionDto.sec_parent_id);
                    await this.appendPathIds(tx, ancestorIds, [created.secId]);
                }
                await (0, master_tree_helper_1.relevelSubtree)(tx, master_tree_helper_1.ITEM_SECTION_TREE, created.secId);
                const refreshed = await tx.itemSectionMaster.findFirst({
                    where: { secId: created.secId, secIsDeleted: false },
                });
                const payload = !refreshed
                    ? this.toPayload({
                        ...created,
                        secPathIds: this.mergePathIds(created.secPathIds, [created.secId]),
                    })
                    : this.toPayload(refreshed);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_SECTION_TABLE_NAME,
                    screenName: ITEM_SECTION_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.sec_id,
                    displayName: payload.sec_name,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item section created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemSection(saveItemSectionDto) {
        const secId = saveItemSectionDto.sec_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.itemSectionMaster.findFirst({
                    where: { secId, secIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item section not found', 'sec_id', `No active item section found with id ${secId}`);
                }
                if (saveItemSectionDto.sec_parent_id === secId) {
                    (0, module_service_utils_1.throwInventoryBadRequest)('Item section cannot be its own parent', [{ field: 'sec_parent_id', message: 'sec_parent_id cannot be same as sec_id' }]);
                }
                if (saveItemSectionDto.sec_parent_id) {
                    await this.ensureParentExists(saveItemSectionDto.sec_parent_id, tx);
                }
                const hasParentField = saveItemSectionDto.sec_parent_id !== undefined;
                const nextParentId = hasParentField
                    ? (saveItemSectionDto.sec_parent_id ?? null)
                    : existing.secParentId;
                const isParentChanged = hasParentField && nextParentId !== existing.secParentId;
                if (isParentChanged) {
                    await (0, master_tree_helper_1.assertNotUnderOwnSubtree)(tx, master_tree_helper_1.ITEM_SECTION_TREE, secId, nextParentId);
                }
                const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, secId) : [];
                const oldAncestorIds = isParentChanged
                    ? await this.getAncestorIds(tx, existing.secParentId)
                    : [];
                const data = {
                    secName: saveItemSectionDto.sec_name.trim(),
                    secModifiedOn: new Date(),
                    secModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveItemSectionDto);
                const updated = await tx.itemSectionMaster.update({ where: { secId }, data });
                await this.ensureSelfInPath(tx, secId);
                if (isParentChanged) {
                    const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
                    await this.removePathIds(tx, oldAncestorIds, subtreeIds);
                    await this.appendPathIds(tx, newAncestorIds, subtreeIds);
                }
                await (0, master_tree_helper_1.relevelSubtree)(tx, master_tree_helper_1.ITEM_SECTION_TREE, secId);
                const refreshed = await tx.itemSectionMaster.findFirst({
                    where: { secId, secIsDeleted: false },
                });
                const payload = this.toPayload(refreshed ?? updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_SECTION_TABLE_NAME,
                    screenName: ITEM_SECTION_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: secId,
                    displayName: payload.sec_name,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item section updated',
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
        const parent = await tx.itemSectionMaster.findFirst({
            where: { secId: parentId, secIsDeleted: false },
            select: { secId: true, secLevel: true },
        });
        if (!parent) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Parent item section does not exist', [
                { field: 'sec_parent_id', message: `No active item section found with id ${parentId}` },
            ]);
        }
        return parent;
    }
    applyOptionalFields(data, saveItemSectionDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_alias'))
            data.secAlias = saveItemSectionDto.sec_alias;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_short'))
            data.secShort = saveItemSectionDto.sec_short;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_description'))
            data.secDescription = saveItemSectionDto.sec_description;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_parent_id'))
            data.secParentId = saveItemSectionDto.sec_parent_id;
        const position = saveItemSectionDto.sec_sort !== undefined
            ? saveItemSectionDto.sec_sort
            : saveItemSectionDto.sec_position;
        if (position !== undefined) {
            data.secSort = position;
            data.secPosition = position;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_color_code'))
            data.secColorCode = saveItemSectionDto.sec_color_code;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_icon'))
            data.secIcon = saveItemSectionDto.sec_icon;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_photo')) {
            data.secPhoto = this.decodePhotoInput(saveItemSectionDto.sec_photo);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemSectionDto, 'sec_photo_url'))
            data.secPhotoUrl = saveItemSectionDto.sec_photo_url;
    }
    async getAncestorIds(tx, startParentId) {
        const ancestorIds = [];
        const visited = new Set();
        let currentParentId = startParentId;
        while (currentParentId) {
            if (visited.has(currentParentId))
                break;
            visited.add(currentParentId);
            const parent = await tx.itemSectionMaster.findFirst({
                where: { secId: currentParentId, secIsDeleted: false },
                select: { secId: true, secParentId: true },
            });
            if (!parent)
                break;
            ancestorIds.push(parent.secId);
            currentParentId = parent.secParentId;
        }
        return ancestorIds;
    }
    async getActiveSubtreeIds(tx, rootId) {
        const subtreeIds = [];
        const visited = new Set();
        const queue = [rootId];
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId))
                continue;
            visited.add(currentId);
            const node = await tx.itemSectionMaster.findFirst({
                where: { secId: currentId, secIsDeleted: false },
                select: { secId: true },
            });
            if (!node)
                continue;
            subtreeIds.push(node.secId);
            const children = await tx.itemSectionMaster.findMany({
                where: { secParentId: node.secId, secIsDeleted: false },
                select: { secId: true },
            });
            for (const child of children) {
                if (!visited.has(child.secId)) {
                    queue.push(child.secId);
                }
            }
        }
        return subtreeIds;
    }
    async appendPathIds(tx, targetIds, idsToAdd) {
        const normalizedTargetIds = this.toUniqueIds(targetIds);
        const normalizedIdsToAdd = this.toUniqueIds(idsToAdd);
        if (normalizedTargetIds.length === 0 || normalizedIdsToAdd.length === 0)
            return;
        const records = await tx.itemSectionMaster.findMany({
            where: { secId: { in: normalizedTargetIds }, secIsDeleted: false },
            select: { secId: true, secPathIds: true },
        });
        for (const record of records) {
            const nextPathIds = this.mergePathIds(record.secPathIds, normalizedIdsToAdd);
            if (this.areSameIds(record.secPathIds, nextPathIds))
                continue;
            await tx.itemSectionMaster.update({
                where: { secId: record.secId },
                data: { secPathIds: nextPathIds },
            });
        }
    }
    async removePathIds(tx, targetIds, idsToRemove) {
        const normalizedTargetIds = this.toUniqueIds(targetIds);
        const normalizedIdsToRemove = this.toUniqueIds(idsToRemove);
        if (normalizedTargetIds.length === 0 || normalizedIdsToRemove.length === 0)
            return;
        const records = await tx.itemSectionMaster.findMany({
            where: { secId: { in: normalizedTargetIds }, secIsDeleted: false },
            select: { secId: true, secPathIds: true },
        });
        for (const record of records) {
            const nextPathIds = this.excludePathIds(record.secPathIds, normalizedIdsToRemove);
            if (this.areSameIds(record.secPathIds, nextPathIds))
                continue;
            await tx.itemSectionMaster.update({
                where: { secId: record.secId },
                data: { secPathIds: nextPathIds },
            });
        }
    }
    async ensureSelfInPath(tx, secId) {
        await this.appendPathIds(tx, [secId], [secId]);
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
        if (left.length !== right.length)
            return false;
        for (let i = 0; i < left.length; i += 1) {
            if (left[i] !== right[i])
                return false;
        }
        return true;
    }
    decodePhotoInput(photo) {
        if (photo === undefined)
            return undefined;
        if (photo === null)
            return null;
        if (Buffer.isBuffer(photo)) {
            if (photo.length === 0) {
                (0, module_service_utils_1.throwInventoryBadRequest)('Invalid image provided', [
                    { field: 'sec_photo', message: 'sec_photo must contain binary image data' },
                ]);
            }
            return new Uint8Array(photo);
        }
        if (photo instanceof Uint8Array) {
            if (photo.length === 0) {
                (0, module_service_utils_1.throwInventoryBadRequest)('Invalid image provided', [
                    { field: 'sec_photo', message: 'sec_photo must contain binary image data' },
                ]);
            }
            return new Uint8Array(photo);
        }
        const trimmed = photo.trim();
        if (!trimmed) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid base64 image provided', [
                { field: 'sec_photo', message: 'sec_photo must be a non-empty base64 string' },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid base64 image provided', [
                { field: 'sec_photo', message: 'sec_photo must be valid base64 content' },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record, parentName = null) {
        return {
            sec_id: record.secId,
            sec_name: record.secName,
            sec_alias: record.secAlias,
            sec_short: record.secShort,
            sec_description: record.secDescription,
            sec_parent_id: record.secParentId,
            sec_parent_name: parentName,
            sec_sort: record.secSort,
            sec_level: record.secLevel,
            sec_path_ids: record.secPathIds,
            sec_position: record.secPosition,
            sec_color_code: record.secColorCode,
            sec_icon: record.secIcon,
            sec_photo: record.secPhoto ? Buffer.from(record.secPhoto).toString('base64') : null,
            sec_photo_url: record.secPhotoUrl,
            sec_sync_date: record.secSyncDate ? record.secSyncDate.toISOString() : null,
            sec_is_active: record.secIsActive,
            sec_is_deleted: record.secIsDeleted,
            sec_created_on: record.secCreatedOn.toISOString(),
            sec_created_by: record.secCreatedBy,
            sec_modified_on: record.secModifiedOn.toISOString(),
            sec_modified_by: record.secModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item section name already exists', [{ field: 'sec_name', message: 'Duplicate sec_name is not allowed' }]);
    }
};
exports.ItemsSectionMasterService = ItemsSectionMasterService;
exports.ItemsSectionMasterService = ItemsSectionMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ItemsSectionMasterService);
//# sourceMappingURL=items-section-master.service.js.map