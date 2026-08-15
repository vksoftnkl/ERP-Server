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
exports.ItemsBrandMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_BRAND_TABLE_NAME = 'item brand master';
const ITEM_BRAND_AUDIT_SCREEN_NAME = 'Item Brand Master';
let ItemsBrandMasterService = class ItemsBrandMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemBrandDto) {
        if (saveItemBrandDto.brand_id) {
            return this.updateItemBrand(saveItemBrandDto);
        }
        return this.createItemBrand(saveItemBrandDto);
    }
    async getById(brandId) {
        const record = await this.prisma.itemBrandMaster.findFirst({
            where: {
                brand_id: brandId,
                brand_is_deleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item brand not found', 'brand_id', `No active item brand found with id ${brandId}`);
        }
        const parentName = await this.getParentName(record.brand_parent_id);
        return this.toPayload(record, parentName);
    }
    async getParentName(parentId) {
        if (!parentId)
            return null;
        const parent = await this.prisma.itemBrandMaster.findFirst({
            where: { brand_id: parentId },
            select: { brand_name: true },
        });
        return parent?.brand_name ?? null;
    }
    async toggleDelete(brandId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.itemBrandMaster.findFirst({
                where: {
                    brand_id: brandId,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item brand not found', 'brand_id', `No item brand found with id ${brandId}`);
            }
            const wasDeleted = existing.brand_is_deleted;
            const nextDeleted = !wasDeleted;
            const subtreeIds = await this.getActiveSubtreeIds(tx, brandId);
            const ancestorIds = await this.getAncestorIds(tx, existing.brand_parent_id);
            const modifiedOn = new Date();
            const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.itemBrandMaster.updateMany({
                where: {
                    brand_id: brandId,
                    brand_is_deleted: wasDeleted,
                },
                data: {
                    brand_is_deleted: nextDeleted,
                    brand_modified_on: modifiedOn,
                    brand_modified_by: userId,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item brand not found', 'brand_id', `No item brand found with id ${brandId}`);
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
                brand_is_deleted: nextDeleted,
                brand_modified_on: modifiedOn,
                brand_modified_by: userId,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: ITEM_BRAND_TABLE_NAME,
                screenName: ITEM_BRAND_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: brandId,
                displayName: existing.brand_name,
                originalRecord,
                modifiedRecord,
                userId,
                notes: nextDeleted ? 'Item brand soft deleted' : 'Item brand restored',
            }, tx);
            return {
                brand_id: brandId,
                deleted: nextDeleted,
            };
        });
    }
    async createItemBrand(saveItemBrandDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                if (saveItemBrandDto.brand_parent_id) {
                    await this.ensureParentExists(saveItemBrandDto.brand_parent_id, tx);
                }
                const now = new Date();
                const createdBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
                const modifiedBy = createdBy;
                const data = {
                    brand_name: saveItemBrandDto.brand_name.trim(),
                    brand_created_on: now,
                    brand_created_by: createdBy,
                };
                this.applyOptionalFields(data, saveItemBrandDto);
                const created = await tx.itemBrandMaster.create({ data });
                await this.ensureSelfInPath(tx, created.brand_id);
                if (saveItemBrandDto.brand_parent_id) {
                    const ancestorIds = await this.getAncestorIds(tx, saveItemBrandDto.brand_parent_id);
                    await this.appendPathIds(tx, ancestorIds, [created.brand_id]);
                }
                const refreshed = await tx.itemBrandMaster.findFirst({
                    where: {
                        brand_id: created.brand_id,
                        brand_is_deleted: false,
                    },
                });
                const payload = !refreshed
                    ? this.toPayload({
                        ...created,
                        brand_path_ids: this.mergePathIds(created.brand_path_ids, [created.brand_id]),
                    })
                    : this.toPayload(refreshed);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_BRAND_TABLE_NAME,
                    screenName: ITEM_BRAND_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.brand_id,
                    displayName: payload.brand_name,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item brand created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemBrand(saveItemBrandDto) {
        const brandId = saveItemBrandDto.brand_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.itemBrandMaster.findFirst({
                    where: {
                        brand_id: brandId,
                        brand_is_deleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item brand not found', 'brand_id', `No active item brand found with id ${brandId}`);
                }
                if (saveItemBrandDto.brand_parent_id === brandId) {
                    (0, module_service_utils_1.throwInventoryBadRequest)('Item brand cannot be its own parent', [
                        {
                            field: 'brand_parent_id',
                            message: 'brand_parent_id cannot be same as brand_id',
                        },
                    ]);
                }
                if (saveItemBrandDto.brand_parent_id) {
                    await this.ensureParentExists(saveItemBrandDto.brand_parent_id, tx);
                }
                const hasParentField = (0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_parent_id');
                const nextParentId = hasParentField
                    ? (saveItemBrandDto.brand_parent_id ?? null)
                    : existing.brand_parent_id;
                const isParentChanged = hasParentField && nextParentId !== existing.brand_parent_id;
                const subtreeIds = isParentChanged ? await this.getActiveSubtreeIds(tx, brandId) : [];
                const oldAncestorIds = isParentChanged
                    ? await this.getAncestorIds(tx, existing.brand_parent_id)
                    : [];
                const data = {
                    brand_name: saveItemBrandDto.brand_name.trim(),
                    brand_modified_on: new Date(),
                    brand_modified_by: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveItemBrandDto);
                const updated = await tx.itemBrandMaster.update({
                    where: {
                        brand_id: brandId,
                    },
                    data,
                });
                await this.ensureSelfInPath(tx, brandId);
                if (isParentChanged) {
                    const newAncestorIds = await this.getAncestorIds(tx, nextParentId);
                    await this.removePathIds(tx, oldAncestorIds, subtreeIds);
                    await this.appendPathIds(tx, newAncestorIds, subtreeIds);
                }
                const refreshed = await tx.itemBrandMaster.findFirst({
                    where: {
                        brand_id: brandId,
                        brand_is_deleted: false,
                    },
                });
                const payload = this.toPayload(refreshed ?? updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_BRAND_TABLE_NAME,
                    screenName: ITEM_BRAND_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: brandId,
                    displayName: payload.brand_name,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item brand updated',
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
        const parent = await tx.itemBrandMaster.findFirst({
            where: {
                brand_id: parentId,
                brand_is_deleted: false,
            },
            select: {
                brand_id: true,
            },
        });
        if (!parent) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Parent item brand does not exist', [
                {
                    field: 'brand_parent_id',
                    message: `No active item brand found with id ${parentId}`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveItemBrandDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_alias')) {
            data.brand_alias = saveItemBrandDto.brand_alias;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_short')) {
            data.brand_short = saveItemBrandDto.brand_short;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_description')) {
            data.brand_description = saveItemBrandDto.brand_description;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_parent_id')) {
            data.brand_parent_id = saveItemBrandDto.brand_parent_id;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_sort')) {
            data.brand_sort = saveItemBrandDto.brand_sort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_level')) {
            data.brand_level = saveItemBrandDto.brand_level;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_photo')) {
            data.brand_photo = this.decodePhotoInput(saveItemBrandDto.brand_photo);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemBrandDto, 'brand_photo_url')) {
            data.brand_photo_url = saveItemBrandDto.brand_photo_url;
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
            const parent = await tx.itemBrandMaster.findFirst({
                where: {
                    brand_id: currentParentId,
                    brand_is_deleted: false,
                },
                select: {
                    brand_id: true,
                    brand_parent_id: true,
                },
            });
            if (!parent) {
                break;
            }
            ancestorIds.push(parent.brand_id);
            currentParentId = parent.brand_parent_id;
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
            const node = await tx.itemBrandMaster.findFirst({
                where: {
                    brand_id: currentId,
                    brand_is_deleted: false,
                },
                select: {
                    brand_id: true,
                },
            });
            if (!node) {
                continue;
            }
            subtreeIds.push(node.brand_id);
            const children = await tx.itemBrandMaster.findMany({
                where: {
                    brand_parent_id: node.brand_id,
                    brand_is_deleted: false,
                },
                select: {
                    brand_id: true,
                },
            });
            for (const child of children) {
                if (!visited.has(child.brand_id)) {
                    queue.push(child.brand_id);
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
        const records = await tx.itemBrandMaster.findMany({
            where: {
                brand_id: {
                    in: normalizedTargetIds,
                },
                brand_is_deleted: false,
            },
            select: {
                brand_id: true,
                brand_path_ids: true,
            },
        });
        for (const record of records) {
            const nextPathIds = this.mergePathIds(record.brand_path_ids, normalizedIdsToAdd);
            if (this.areSameIds(record.brand_path_ids, nextPathIds)) {
                continue;
            }
            await tx.itemBrandMaster.update({
                where: {
                    brand_id: record.brand_id,
                },
                data: {
                    brand_path_ids: nextPathIds,
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
        const records = await tx.itemBrandMaster.findMany({
            where: {
                brand_id: {
                    in: normalizedTargetIds,
                },
                brand_is_deleted: false,
            },
            select: {
                brand_id: true,
                brand_path_ids: true,
            },
        });
        for (const record of records) {
            const nextPathIds = this.excludePathIds(record.brand_path_ids, normalizedIdsToRemove);
            if (this.areSameIds(record.brand_path_ids, nextPathIds)) {
                continue;
            }
            await tx.itemBrandMaster.update({
                where: {
                    brand_id: record.brand_id,
                },
                data: {
                    brand_path_ids: nextPathIds,
                },
            });
        }
    }
    async ensureSelfInPath(tx, brandId) {
        await this.appendPathIds(tx, [brandId], [brandId]);
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
                    field: 'brand_photo',
                    message: 'brand_photo must be a non-empty base64 string',
                },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Invalid base64 image provided', [
                {
                    field: 'brand_photo',
                    message: 'brand_photo must be valid base64 content',
                },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record, parentName = null) {
        return {
            brand_id: record.brand_id,
            brand_name: record.brand_name,
            brand_alias: record.brand_alias,
            brand_short: record.brand_short,
            brand_description: record.brand_description,
            brand_photo: record.brand_photo ? Buffer.from(record.brand_photo).toString('base64') : null,
            brand_photo_url: record.brand_photo_url,
            brand_parent_id: record.brand_parent_id,
            brand_parent_name: parentName,
            brand_sort: record.brand_sort,
            brand_level: record.brand_level,
            brand_path_ids: record.brand_path_ids,
            brand_is_active: record.brand_is_active,
            brand_is_deleted: record.brand_is_deleted,
            brand_sync_date: record.brand_sync_date ? record.brand_sync_date.toISOString() : null,
            brand_created_on: record.brand_created_on.toISOString(),
            brand_created_by: record.brand_created_by,
            brand_modified_on: record.brand_modified_on.toISOString(),
            brand_modified_by: record.brand_modified_by,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item brand name already exists', [
            { field: 'brand_name', message: 'Duplicate brand_name is not allowed' },
        ]);
    }
};
exports.ItemsBrandMasterService = ItemsBrandMasterService;
exports.ItemsBrandMasterService = ItemsBrandMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ItemsBrandMasterService);
//# sourceMappingURL=items-brand-master.service.js.map