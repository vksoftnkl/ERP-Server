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
const prisma_service_1 = require("../../database/prisma/prisma.service");
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
let ItemsBrandMasterService = class ItemsBrandMasterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(saveItemBrandDto) {
        if (saveItemBrandDto.brand_id) {
            return this.updateItemBrand(saveItemBrandDto);
        }
        return this.createItemBrand(saveItemBrandDto);
    }
    async list(queryDto) {
        const page = queryDto.page ?? DEFAULT_PAGE;
        const limit = queryDto.limit ?? DEFAULT_LIMIT;
        const skip = (page - 1) * limit;
        const where = {
            brand_is_deleted: false,
        };
        if (queryDto.brand_parent_id !== undefined) {
            where.brand_parent_id = queryDto.brand_parent_id;
        }
        if (queryDto.brand_is_active !== undefined) {
            where.brand_is_active = queryDto.brand_is_active;
        }
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { brand_name: { contains: search, mode: 'insensitive' } },
                { brand_alias: { contains: search, mode: 'insensitive' } },
                { brand_description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, records] = await Promise.all([
            this.prisma.itemBrandMaster.count({ where }),
            this.prisma.itemBrandMaster.findMany({
                where,
                orderBy: [{ brand_sort: 'asc' }, { brand_name: 'asc' }],
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
    async getById(brandId) {
        const record = await this.prisma.itemBrandMaster.findFirst({
            where: {
                brand_id: brandId,
                brand_is_deleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(brandId);
        }
        return this.toPayload(record);
    }
    async softDelete(brandId) {
        const result = await this.prisma.itemBrandMaster.updateMany({
            where: {
                brand_id: brandId,
                brand_is_deleted: false,
            },
            data: {
                brand_is_deleted: true,
                brand_modified_on: new Date(),
                brand_modified_by: DEFAULT_ACTOR,
            },
        });
        if (result.count === 0) {
            this.throwNotFound(brandId);
        }
        return {
            brand_id: brandId,
            deleted: true,
        };
    }
    async createItemBrand(saveItemBrandDto) {
        if (saveItemBrandDto.brand_parent_id) {
            await this.ensureParentExists(saveItemBrandDto.brand_parent_id);
        }
        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data = {
            brand_name: saveItemBrandDto.brand_name.trim(),
            brand_created_on: now,
            brand_created_by: createdBy,
            brand_modified_on: now,
            brand_modified_by: modifiedBy,
        };
        this.applyOptionalFields(data, saveItemBrandDto);
        try {
            const created = await this.prisma.itemBrandMaster.create({ data });
            return this.toPayload(created);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemBrand(saveItemBrandDto) {
        const brandId = saveItemBrandDto.brand_id;
        const existing = await this.prisma.itemBrandMaster.findFirst({
            where: {
                brand_id: brandId,
                brand_is_deleted: false,
            },
        });
        if (!existing) {
            this.throwNotFound(brandId);
        }
        if (saveItemBrandDto.brand_parent_id === brandId) {
            this.throwBadRequest('Item brand cannot be its own parent', [
                {
                    field: 'brand_parent_id',
                    message: 'brand_parent_id cannot be same as brand_id',
                },
            ]);
        }
        if (saveItemBrandDto.brand_parent_id) {
            await this.ensureParentExists(saveItemBrandDto.brand_parent_id);
        }
        const data = {
            brand_name: saveItemBrandDto.brand_name.trim(),
            brand_modified_on: new Date(),
            brand_modified_by: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveItemBrandDto);
        try {
            const updated = await this.prisma.itemBrandMaster.update({
                where: {
                    brand_id: brandId,
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
        const parent = await this.prisma.itemBrandMaster.findFirst({
            where: {
                brand_id: parentId,
                brand_is_deleted: false,
            },
            select: {
                brand_id: true,
            },
        });
        if (!parent) {
            this.throwBadRequest('Parent item brand does not exist', [
                {
                    field: 'brand_parent_id',
                    message: `No active item brand found with id ${parentId}`,
                },
            ]);
        }
    }
    applyOptionalFields(data, saveItemBrandDto) {
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_alias')) {
            data.brand_alias = saveItemBrandDto.brand_alias;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_short')) {
            data.brand_short = saveItemBrandDto.brand_short;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_description')) {
            data.brand_description = saveItemBrandDto.brand_description;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_parent_id')) {
            data.brand_parent_id = saveItemBrandDto.brand_parent_id;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_sort')) {
            data.brand_sort = saveItemBrandDto.brand_sort;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_level')) {
            data.brand_level = saveItemBrandDto.brand_level;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_path_ids')) {
            data.brand_path_ids = saveItemBrandDto.brand_path_ids;
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_photo')) {
            data.brand_photo = this.decodePhotoInput(saveItemBrandDto.brand_photo);
        }
        if (this.hasOwnProperty(saveItemBrandDto, 'brand_photo_url')) {
            data.brand_photo_url = saveItemBrandDto.brand_photo_url;
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
                    field: 'brand_photo',
                    message: 'brand_photo must be a non-empty base64 string',
                },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            this.throwBadRequest('Invalid base64 image provided', [
                {
                    field: 'brand_photo',
                    message: 'brand_photo must be valid base64 content',
                },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record) {
        return {
            brand_id: record.brand_id,
            brand_name: record.brand_name,
            brand_alias: record.brand_alias,
            brand_short: record.brand_short,
            brand_description: record.brand_description,
            brand_photo: record.brand_photo ? Buffer.from(record.brand_photo).toString('base64') : null,
            brand_photo_url: record.brand_photo_url,
            brand_parent_id: record.brand_parent_id,
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
        if (this.isUniqueConstraintError(error)) {
            throw new common_1.ConflictException(this.buildErrorResponse('Item brand name already exists', [
                {
                    field: 'brand_name',
                    message: 'Duplicate brand_name is not allowed',
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
    throwNotFound(brandId) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Item brand not found', [
            {
                field: 'brand_id',
                message: `No active item brand found with id ${brandId}`,
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
exports.ItemsBrandMasterService = ItemsBrandMasterService;
exports.ItemsBrandMasterService = ItemsBrandMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemsBrandMasterService);
//# sourceMappingURL=items-brand-master.service.js.map