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
exports.ItemsCategoryMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_CATEGORY_TABLE_NAME = 'item category master';
const ITEM_CATEGORY_AUDIT_SCREEN_NAME = 'Category Master';
let ItemsCategoryMasterService = class ItemsCategoryMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemCategoryDto) {
        if (saveItemCategoryDto.category_id) {
            return this.updateItemCategory(saveItemCategoryDto);
        }
        return this.createItemCategory(saveItemCategoryDto);
    }
    async getById(categoryId) {
        const record = await this.prisma.categoryMaster.findFirst({
            where: {
                categoryId,
                categoryIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item category not found', 'category_id', `No active item category found with id ${categoryId}`);
        }
        const parentName = await this.getParentName(record.categoryParentId);
        return this.toPayload(record, parentName);
    }
    async getParentName(parentId) {
        if (!parentId)
            return null;
        const parent = await this.prisma.categoryMaster.findFirst({
            where: { categoryId: parentId },
            select: { categoryName: true },
        });
        return parent?.categoryName ?? null;
    }
    async toggleDelete(categoryId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.categoryMaster.findFirst({
                where: {
                    categoryId,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item category not found', 'category_id', `No item category found with id ${categoryId}`);
            }
            const wasDeleted = existing.categoryIsDeleted;
            const nextDeleted = !wasDeleted;
            const subtreeIds = await this.getActiveSubtreeIds(tx, categoryId);
            const ancestorIds = await this.getAncestorIds(tx, existing.categoryParentId);
            const modifiedOn = new Date();
            const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.categoryMaster.updateMany({
                where: {
                    categoryId,
                    categoryIsDeleted: wasDeleted,
                },
                data: {
                    categoryIsDeleted: nextDeleted,
                    categoryModifiedOn: modifiedOn,
                    categoryModifiedBy: userId,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item category not found', 'category_id', `No item category found with id ${categoryId}`);
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
                categoryIsDeleted: nextDeleted,
                categoryModifiedOn: modifiedOn,
                categoryModifiedBy: userId,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: ITEM_CATEGORY_TABLE_NAME,
                screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: categoryId,
                displayName: existing.categoryName,
                originalRecord,
                modifiedRecord,
                userId,
                notes: nextDeleted ? 'Item category soft deleted' : 'Item category restored',
            }, tx);
            return {
                category_id: categoryId,
                deleted: nextDeleted,
            };
        });
    }
    async createItemCategory(saveItemCategoryDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                if (saveItemCategoryDto.category_parent_id) {
                    await this.ensureParentExists(saveItemCategoryDto.category_parent_id, tx);
                }
                const now = new Date();
                const createdBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                const modifiedBy = createdBy;
                const data = {
                    categoryName: saveItemCategoryDto.category_name.trim(),
                    categoryCreatedOn: now,
                    categoryCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, saveItemCategoryDto);
                const created = await tx.categoryMaster.create({ data });
                await this.ensureSelfInPath(tx, created.categoryId);
                if (saveItemCategoryDto.category_parent_id) {
                    const ancestorIds = await this.getAncestorIds(tx, saveItemCategoryDto.category_parent_id);
                    await this.appendPathIds(tx, ancestorIds, [created.categoryId]);
                }
                const refreshed = await tx.categoryMaster.findFirst({
                    where: {
                        categoryId: created.categoryId,
                        categoryIsDeleted: false,
                    },
                });
                const payload = !refreshed
                    ? this.toPayload({
                        ...created,
                        categoryPathIdsCache: this.mergePathIds(created.categoryPathIdsCache, [
                            created.categoryId,
                        ]),
                    })
                    : this.toPayload(refreshed);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_CATEGORY_TABLE_NAME,
                    screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.category_id,
                    displayName: payload.category_name,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item category created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemCategory(saveItemCategoryDto) {
        const categoryId = saveItemCategoryDto.category_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.categoryMaster.findFirst({
                    where: {
                        categoryId,
                        categoryIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item category not found', 'category_id', `No active item category found with id ${categoryId}`);
                }
                if (saveItemCategoryDto.category_parent_id === categoryId) {
                    (0, module_service_utils_1.throwInventoryBadRequest)('Item category cannot be its own parent', [
                        {
                            field: 'category_parent_id',
                            message: 'category_parent_id cannot be same as category_id',
                        },
                    ]);
                }
                if (saveItemCategoryDto.category_parent_id) {
                    await this.ensureParentExists(saveItemCategoryDto.category_parent_id, tx);
                }
                const hasParentField = (0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_parent_id');
                const nextParentId = hasParentField
                    ? (saveItemCategoryDto.category_parent_id ?? null)
                    : existing.categoryParentId;
                const isParentChanged = hasParentField && nextParentId !== existing.categoryParentId;
                const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, categoryId) : [];
                const oldAncestorIds = isParentChanged
                    ? await this.getAncestorIds(tx, existing.categoryParentId)
                    : [];
                const data = {
                    categoryName: saveItemCategoryDto.category_name.trim(),
                    categoryModifiedOn: new Date(),
                    categoryModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveItemCategoryDto);
                const updated = await tx.categoryMaster.update({
                    where: {
                        categoryId,
                    },
                    data,
                });
                await this.ensureSelfInPath(tx, categoryId);
                if (isParentChanged) {
                    const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
                    await this.removePathIds(tx, oldAncestorIds, subtreeIds);
                    await this.appendPathIds(tx, newAncestorIds, subtreeIds);
                }
                const refreshed = await tx.categoryMaster.findFirst({
                    where: {
                        categoryId,
                        categoryIsDeleted: false,
                    },
                });
                const payload = this.toPayload(refreshed ?? updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_CATEGORY_TABLE_NAME,
                    screenName: ITEM_CATEGORY_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: categoryId,
                    displayName: payload.category_name,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item category updated',
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
        const parent = await tx.categoryMaster.findFirst({
            where: {
                categoryId: parentId,
                categoryIsDeleted: false,
            },
            select: {
                categoryId: true,
            },
        });
        if (!parent) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Parent item category does not exist', [
                {
                    field: 'category_parent_id',
                    message: `No active item category found with id ${parentId}`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveItemCategoryDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_alias')) {
            data.categoryAlias = saveItemCategoryDto.category_alias;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_short')) {
            data.categoryShort = saveItemCategoryDto.category_short;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_description')) {
            data.categoryDescription = saveItemCategoryDto.category_description;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_parent_id')) {
            data.categoryParentId = saveItemCategoryDto.category_parent_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_sort')) {
            data.categorySort = saveItemCategoryDto.category_sort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_level')) {
            data.categoryLevel = saveItemCategoryDto.category_level;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_photo')) {
            data.categoryPhoto = this.decodePhotoInput(saveItemCategoryDto.category_photo);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemCategoryDto, 'category_photo_url')) {
            data.categoryPhotoUrl = saveItemCategoryDto.category_photo_url;
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
            const parent = await tx.categoryMaster.findFirst({
                where: {
                    categoryId: currentParentId,
                    categoryIsDeleted: false,
                },
                select: {
                    categoryId: true,
                    categoryParentId: true,
                },
            });
            if (!parent) {
                break;
            }
            ancestorIds.push(parent.categoryId);
            currentParentId = parent.categoryParentId;
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
            const node = await tx.categoryMaster.findFirst({
                where: {
                    categoryId: currentId,
                    categoryIsDeleted: false,
                },
                select: {
                    categoryId: true,
                },
            });
            if (!node) {
                continue;
            }
            subtreeIds.push(node.categoryId);
            const children = await tx.categoryMaster.findMany({
                where: {
                    categoryParentId: node.categoryId,
                    categoryIsDeleted: false,
                },
                select: {
                    categoryId: true,
                },
            });
            for (const child of children) {
                if (!visited.has(child.categoryId)) {
                    queue.push(child.categoryId);
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
        const records = await tx.categoryMaster.findMany({
            where: {
                categoryId: {
                    in: normalizedTargetIds,
                },
                categoryIsDeleted: false,
            },
            select: {
                categoryId: true,
                categoryPathIdsCache: true,
            },
        });
        for (const record of records) {
            const nextPathIds = this.mergePathIds(record.categoryPathIdsCache, normalizedIdsToAdd);
            if (this.areSameIds(record.categoryPathIdsCache, nextPathIds)) {
                continue;
            }
            await tx.categoryMaster.update({
                where: {
                    categoryId: record.categoryId,
                },
                data: {
                    categoryPathIdsCache: nextPathIds,
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
        const records = await tx.categoryMaster.findMany({
            where: {
                categoryId: {
                    in: normalizedTargetIds,
                },
                categoryIsDeleted: false,
            },
            select: {
                categoryId: true,
                categoryPathIdsCache: true,
            },
        });
        for (const record of records) {
            const nextPathIds = this.excludePathIds(record.categoryPathIdsCache, normalizedIdsToRemove);
            if (this.areSameIds(record.categoryPathIdsCache, nextPathIds)) {
                continue;
            }
            await tx.categoryMaster.update({
                where: {
                    categoryId: record.categoryId,
                },
                data: {
                    categoryPathIdsCache: nextPathIds,
                },
            });
        }
    }
    async ensureSelfInPath(tx, categoryId) {
        await this.appendPathIds(tx, [categoryId], [categoryId]);
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
                    field: 'category_photo',
                    message: 'category_photo must be a non-empty base64 string',
                },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid base64 image provided', [
                {
                    field: 'category_photo',
                    message: 'category_photo must be valid base64 content',
                },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record, parentName = null) {
        return {
            category_id: record.categoryId,
            category_name: record.categoryName,
            category_alias: record.categoryAlias,
            category_short: record.categoryShort,
            category_description: record.categoryDescription,
            category_parent_id: record.categoryParentId,
            category_parent_name: parentName,
            category_sort: record.categorySort,
            category_level: record.categoryLevel,
            category_path_ids_cache: record.categoryPathIdsCache,
            category_tax_claim: null,
            category_default_tax_id: null,
            category_default_hsn: null,
            category_default_uom_id: null,
            category_photo: record.categoryPhoto
                ? Buffer.from(record.categoryPhoto).toString('base64')
                : null,
            category_photo_url: record.categoryPhotoUrl,
            category_sync_date: record.categorySyncDate ? record.categorySyncDate.toISOString() : null,
            category_is_active: record.categoryIsActive,
            category_is_deleted: record.categoryIsDeleted,
            category_created_on: record.categoryCreatedOn.toISOString(),
            category_created_by: record.categoryCreatedBy,
            category_modified_on: record.categoryModifiedOn.toISOString(),
            category_modified_by: record.categoryModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item category name already exists', [{ field: 'category_name', message: 'Duplicate category_name is not allowed' }]);
    }
};
exports.ItemsCategoryMasterService = ItemsCategoryMasterService;
exports.ItemsCategoryMasterService = ItemsCategoryMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ItemsCategoryMasterService);
//# sourceMappingURL=items-category-master.service.js.map