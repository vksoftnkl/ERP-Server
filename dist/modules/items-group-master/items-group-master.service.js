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
const prisma_service_1 = require("../../database/prisma/prisma.service");
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
let ItemsGroupMasterService = class ItemsGroupMasterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(saveItemGroupDto) {
        if (saveItemGroupDto.itg_id) {
            return this.updateItemGroup(saveItemGroupDto);
        }
        return this.createItemGroup(saveItemGroupDto);
    }
    async list(queryDto) {
        const page = queryDto.page ?? DEFAULT_PAGE;
        const limit = queryDto.limit ?? DEFAULT_LIMIT;
        const skip = (page - 1) * limit;
        const where = {
            itgIsDeleted: false,
        };
        if (queryDto.itg_parent_id !== undefined) {
            where.itgParentId = queryDto.itg_parent_id;
        }
        if (queryDto.itg_is_active !== undefined) {
            where.itgIsActive = queryDto.itg_is_active;
        }
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { itgName: { contains: search, mode: 'insensitive' } },
                { itgAlias: { contains: search, mode: 'insensitive' } },
                { itgDescription: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, records] = await Promise.all([
            this.prisma.itemGroupMaster.count({ where }),
            this.prisma.itemGroupMaster.findMany({
                where,
                orderBy: [{ itgSort: 'asc' }, { itgName: 'asc' }],
                skip,
                take: limit,
            }),
        ]);
        return {
            items: records.map((record) => this.toPayload(record)),
            meta: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        };
    }
    async getById(itgId) {
        const record = await this.prisma.itemGroupMaster.findFirst({
            where: {
                itgId,
                itgIsDeleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(itgId);
        }
        return this.toPayload(record);
    }
    async softDelete(itgId) {
        const result = await this.prisma.itemGroupMaster.updateMany({
            where: {
                itgId,
                itgIsDeleted: false,
            },
            data: {
                itgIsDeleted: true,
                itgModifiedOn: new Date(),
                itgModifiedBy: DEFAULT_ACTOR,
            },
        });
        if (result.count === 0) {
            this.throwNotFound(itgId);
        }
        return {
            itg_id: itgId,
            deleted: true,
        };
    }
    async createItemGroup(saveItemGroupDto) {
        if (saveItemGroupDto.itg_parent_id) {
            await this.ensureParentExists(saveItemGroupDto.itg_parent_id);
        }
        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data = {
            itgName: saveItemGroupDto.itg_name.trim(),
            itgCreatedOn: now,
            itgCreatedBy: createdBy,
            itgModifiedOn: now,
            itgModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        try {
            const created = await this.prisma.itemGroupMaster.create({ data });
            return this.toPayload(created);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemGroup(saveItemGroupDto) {
        const itgId = saveItemGroupDto.itg_id;
        const existing = await this.prisma.itemGroupMaster.findFirst({
            where: {
                itgId,
                itgIsDeleted: false,
            },
        });
        if (!existing) {
            this.throwNotFound(itgId);
        }
        if (saveItemGroupDto.itg_parent_id === itgId) {
            this.throwBadRequest('Item group cannot be its own parent', [
                {
                    field: 'itg_parent_id',
                    message: 'itg_parent_id cannot be same as itg_id',
                },
            ]);
        }
        if (saveItemGroupDto.itg_parent_id) {
            await this.ensureParentExists(saveItemGroupDto.itg_parent_id);
        }
        const data = {
            itgName: saveItemGroupDto.itg_name.trim(),
            itgModifiedOn: new Date(),
            itgModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveItemGroupDto);
        try {
            const updated = await this.prisma.itemGroupMaster.update({
                where: {
                    itgId,
                },
                data,
            });
            return this.toPayload(updated);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async ensureParentExists(parentId) {
        const parent = await this.prisma.itemGroupMaster.findFirst({
            where: {
                itgId: parentId,
                itgIsDeleted: false,
            },
            select: {
                itgId: true,
            },
        });
        if (!parent) {
            this.throwBadRequest('Parent item group does not exist', [
                {
                    field: 'itg_parent_id',
                    message: `No active item group found with id ${parentId}`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveItemGroupDto) {
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_alias')) {
            data.itgAlias = saveItemGroupDto.itg_alias;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_short')) {
            data.itgShort = saveItemGroupDto.itg_short;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_description')) {
            data.itgDescription = saveItemGroupDto.itg_description;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_parent_id')) {
            data.itgParentId = saveItemGroupDto.itg_parent_id;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_sort')) {
            data.itgSort = saveItemGroupDto.itg_sort;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_level')) {
            data.itgLevel = saveItemGroupDto.itg_level;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_path_ids_cache')) {
            data.itgPathIdsCache = saveItemGroupDto.itg_path_ids_cache;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_tax_claim')) {
            data.itgTaxClaim = saveItemGroupDto.itg_tax_claim;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_tax_id')) {
            data.itgDefaultTaxId = saveItemGroupDto.itg_default_tax_id;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_hsn')) {
            data.itgDefaultHsn = saveItemGroupDto.itg_default_hsn;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_default_uom_id')) {
            data.itgDefaultUomId = saveItemGroupDto.itg_default_uom_id;
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_photo')) {
            data.itgPhoto = this.decodePhotoInput(saveItemGroupDto.itg_photo);
        }
        if (this.hasOwnProperty(saveItemGroupDto, 'itg_photo_url')) {
            data.itgPhotoUrl = saveItemGroupDto.itg_photo_url;
        }
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
            this.throwBadRequest('Invalid base64 image provided', [
                {
                    field: 'itg_photo',
                    message: 'itg_photo must be a non-empty base64 string',
                },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            this.throwBadRequest('Invalid base64 image provided', [
                {
                    field: 'itg_photo',
                    message: 'itg_photo must be valid base64 content',
                },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record) {
        return {
            itg_id: record.itgId,
            itg_name: record.itgName,
            itg_alias: record.itgAlias,
            itg_short: record.itgShort,
            itg_description: record.itgDescription,
            itg_parent_id: record.itgParentId,
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
        if (this.isUniqueConstraintError(error)) {
            throw new common_1.ConflictException(this.buildErrorResponse('Item group name already exists', [
                {
                    field: 'itg_name',
                    message: 'Duplicate itg_name is not allowed',
                },
            ]));
        }
    }
    isUniqueConstraintError(error) {
        if (typeof error !== 'object' || error === null || !('code' in error)) {
            return false;
        }
        return error.code === 'P2002';
    }
    throwNotFound(itgId) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Item group not found', [
            {
                field: 'itg_id',
                message: `No active item group found with id ${itgId}`,
            },
        ]));
    }
    throwBadRequest(message, errors) {
        throw new common_1.BadRequestException(this.buildErrorResponse(message, errors));
    }
    buildErrorResponse(message, errors = []) {
        return {
            success: false,
            message,
            errors,
        };
    }
    hasOwnProperty(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }
};
exports.ItemsGroupMasterService = ItemsGroupMasterService;
exports.ItemsGroupMasterService = ItemsGroupMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemsGroupMasterService);
//# sourceMappingURL=items-group-master.service.js.map