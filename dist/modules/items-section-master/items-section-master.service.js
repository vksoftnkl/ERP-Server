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
const prisma_service_1 = require("../../database/prisma/prisma.service");
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
let ItemsSectionMasterService = class ItemsSectionMasterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(saveItemSectionDto) {
        if (saveItemSectionDto.sec_id) {
            return this.updateItemSection(saveItemSectionDto);
        }
        return this.createItemSection(saveItemSectionDto);
    }
    async list(queryDto) {
        const page = queryDto.page ?? DEFAULT_PAGE;
        const limit = queryDto.limit ?? DEFAULT_LIMIT;
        const skip = (page - 1) * limit;
        const where = {
            secIsDeleted: false,
        };
        if (queryDto.sec_company_id !== undefined) {
            where.secCompanyId = queryDto.sec_company_id;
        }
        if (queryDto.sec_parent_id !== undefined) {
            where.secParentId = queryDto.sec_parent_id;
        }
        if (queryDto.sec_is_active !== undefined) {
            where.secIsActive = queryDto.sec_is_active;
        }
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { secName: { contains: search, mode: 'insensitive' } },
                { secAlias: { contains: search, mode: 'insensitive' } },
                { secDescription: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, records] = await Promise.all([
            this.prisma.itemSectionMaster.count({ where }),
            this.prisma.itemSectionMaster.findMany({
                where,
                orderBy: [{ secSort: 'asc' }, { secName: 'asc' }],
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
    async getById(secId) {
        const record = await this.prisma.itemSectionMaster.findFirst({
            where: {
                secId,
                secIsDeleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(secId);
        }
        return this.toPayload(record);
    }
    async softDelete(secId) {
        const result = await this.prisma.itemSectionMaster.updateMany({
            where: {
                secId,
                secIsDeleted: false,
            },
            data: {
                secIsDeleted: true,
                secModifiedOn: new Date(),
                secModifiedBy: DEFAULT_ACTOR,
            },
        });
        if (result.count === 0) {
            this.throwNotFound(secId);
        }
        return {
            sec_id: secId,
            deleted: true,
        };
    }
    async createItemSection(saveItemSectionDto) {
        if (saveItemSectionDto.sec_parent_id) {
            await this.ensureParentExistsAndSameCompany(saveItemSectionDto.sec_parent_id, saveItemSectionDto.sec_company_id);
        }
        const now = new Date();
        const createdBy = DEFAULT_ACTOR;
        const modifiedBy = createdBy;
        const data = {
            secName: saveItemSectionDto.sec_name.trim(),
            secCompanyId: saveItemSectionDto.sec_company_id,
            secCreatedOn: now,
            secCreatedBy: createdBy,
            secModifiedOn: now,
            secModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveItemSectionDto);
        try {
            const created = await this.prisma.itemSectionMaster.create({ data });
            return this.toPayload(created);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemSection(saveItemSectionDto) {
        const secId = saveItemSectionDto.sec_id;
        const existing = await this.prisma.itemSectionMaster.findFirst({
            where: {
                secId,
                secIsDeleted: false,
            },
        });
        if (!existing) {
            this.throwNotFound(secId);
        }
        if (saveItemSectionDto.sec_parent_id === secId) {
            this.throwBadRequest('Item section cannot be its own parent', [
                {
                    field: 'sec_parent_id',
                    message: 'sec_parent_id cannot be same as sec_id',
                },
            ]);
        }
        if (saveItemSectionDto.sec_parent_id) {
            await this.ensureParentExistsAndSameCompany(saveItemSectionDto.sec_parent_id, saveItemSectionDto.sec_company_id);
        }
        const data = {
            secName: saveItemSectionDto.sec_name.trim(),
            secCompanyId: saveItemSectionDto.sec_company_id,
            secModifiedOn: new Date(),
            secModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveItemSectionDto);
        try {
            const updated = await this.prisma.itemSectionMaster.update({
                where: {
                    secId,
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
    async ensureParentExistsAndSameCompany(parentId, companyId) {
        const parent = await this.prisma.itemSectionMaster.findFirst({
            where: {
                secId: parentId,
                secIsDeleted: false,
            },
            select: {
                secId: true,
                secCompanyId: true,
            },
        });
        if (!parent) {
            this.throwBadRequest('Parent item section does not exist', [
                {
                    field: 'sec_parent_id',
                    message: `No active item section found with id ${parentId}`,
                },
            ]);
        }
        if (parent.secCompanyId !== companyId) {
            this.throwBadRequest('Parent item section must belong to the same company', [
                {
                    field: 'sec_parent_id',
                    message: 'sec_parent_id must reference a section in the same sec_company_id',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveItemSectionDto) {
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_alias')) {
            data.secAlias = saveItemSectionDto.sec_alias;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_short')) {
            data.secShort = saveItemSectionDto.sec_short;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_description')) {
            data.secDescription = saveItemSectionDto.sec_description;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_parent_id')) {
            data.secParentId = saveItemSectionDto.sec_parent_id;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_sort')) {
            data.secSort = saveItemSectionDto.sec_sort;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_level')) {
            data.secLevel = saveItemSectionDto.sec_level;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_path_ids')) {
            data.secPathIds = saveItemSectionDto.sec_path_ids;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_position')) {
            data.secPosition = saveItemSectionDto.sec_position;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_color_code')) {
            data.secColorCode = saveItemSectionDto.sec_color_code;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_icon')) {
            data.secIcon = saveItemSectionDto.sec_icon;
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_photo')) {
            data.secPhoto = this.decodePhotoInput(saveItemSectionDto.sec_photo);
        }
        if (this.hasOwnProperty(saveItemSectionDto, 'sec_photo_url')) {
            data.secPhotoUrl = saveItemSectionDto.sec_photo_url;
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
                    field: 'sec_photo',
                    message: 'sec_photo must be a non-empty base64 string',
                },
            ]);
        }
        const candidate = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
        const normalized = candidate.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
            this.throwBadRequest('Invalid base64 image provided', [
                {
                    field: 'sec_photo',
                    message: 'sec_photo must be valid base64 content',
                },
            ]);
        }
        return new Uint8Array(Buffer.from(normalized, 'base64'));
    }
    toPayload(record) {
        return {
            sec_id: record.secId,
            sec_name: record.secName,
            sec_alias: record.secAlias,
            sec_short: record.secShort,
            sec_description: record.secDescription,
            sec_company_id: record.secCompanyId,
            sec_parent_id: record.secParentId,
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
        if (this.isUniqueConstraintError(error)) {
            throw new common_1.ConflictException(this.buildErrorResponse('Item section name already exists for this company', [
                {
                    field: 'sec_name',
                    message: 'Duplicate sec_name is not allowed within sec_company_id',
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
    throwNotFound(secId) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Item section not found', [
            {
                field: 'sec_id',
                message: `No active item section found with id ${secId}`,
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
exports.ItemsSectionMasterService = ItemsSectionMasterService;
exports.ItemsSectionMasterService = ItemsSectionMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ItemsSectionMasterService);
//# sourceMappingURL=items-section-master.service.js.map