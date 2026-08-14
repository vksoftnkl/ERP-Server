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
exports.UnitsMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
let UnitsMasterService = class UnitsMasterService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(saveUnitDto) {
        if (saveUnitDto.unit_id) {
            return this.updateUnit(saveUnitDto);
        }
        return this.createUnit(saveUnitDto);
    }
    async list(queryDto) {
        const page = queryDto.page ?? DEFAULT_PAGE;
        const limit = queryDto.limit ?? DEFAULT_LIMIT;
        const skip = (page - 1) * limit;
        const where = {
            unit_is_deleted: false,
        };
        if (queryDto.unit_base_unit_id !== undefined) {
            where.unit_base_unit_id = queryDto.unit_base_unit_id;
        }
        if (queryDto.unit_is_active !== undefined) {
            where.unit_is_active = queryDto.unit_is_active;
        }
        if (queryDto.search?.trim()) {
            const search = queryDto.search.trim();
            where.OR = [
                { unit_name: { contains: search, mode: 'insensitive' } },
                { unit_alias: { contains: search, mode: 'insensitive' } },
                { unit_code: { contains: search, mode: 'insensitive' } },
                { unit_description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, records] = await Promise.all([
            this.prisma.unit.count({ where }),
            this.prisma.unit.findMany({
                where,
                orderBy: [{ unit_name: 'asc' }, { unit_id: 'asc' }],
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
    async getById(unitId) {
        const record = await this.prisma.unit.findFirst({
            where: {
                unit_id: unitId,
                unit_is_deleted: false,
            },
        });
        if (!record) {
            this.throwNotFound(unitId);
        }
        return this.toPayload(record);
    }
    async softDelete(unitId) {
        const result = await this.prisma.unit.updateMany({
            where: {
                unit_id: unitId,
                unit_is_deleted: false,
            },
            data: {
                unit_is_deleted: true,
                unit_modified_on: new Date(),
                unit_modified_by: DEFAULT_ACTOR,
            },
        });
        if (result.count === 0) {
            this.throwNotFound(unitId);
        }
        return {
            unit_id: unitId,
            deleted: true,
        };
    }
    async createUnit(saveUnitDto) {
        const baseUnitId = this.hasOwnProperty(saveUnitDto, 'unit_base_unit_id')
            ? (saveUnitDto.unit_base_unit_id ?? null)
            : null;
        const conversion = this.hasOwnProperty(saveUnitDto, 'unit_conversion')
            ? (saveUnitDto.unit_conversion ?? null)
            : null;
        this.validateConversionRules(baseUnitId, conversion);
        if (baseUnitId !== null) {
            await this.ensureBaseUnitExists(baseUnitId);
        }
        const now = new Date();
        const createdBy = this.resolveActor(saveUnitDto.unit_created_by);
        const modifiedBy = this.resolveActor(saveUnitDto.unit_modified_by, createdBy);
        const data = {
            unit_name: saveUnitDto.unit_name.trim(),
            unit_created_on: now,
            unit_created_by: createdBy,
            unit_modified_on: now,
            unit_modified_by: modifiedBy,
        };
        this.applyOptionalFields(data, saveUnitDto);
        try {
            const created = await this.prisma.unit.create({ data });
            return this.toPayload(created);
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateUnit(saveUnitDto) {
        const unitId = saveUnitDto.unit_id;
        const existing = await this.prisma.unit.findFirst({
            where: {
                unit_id: unitId,
                unit_is_deleted: false,
            },
        });
        if (!existing) {
            this.throwNotFound(unitId);
        }
        const baseUnitId = this.hasOwnProperty(saveUnitDto, 'unit_base_unit_id')
            ? (saveUnitDto.unit_base_unit_id ?? null)
            : existing.unit_base_unit_id;
        const conversion = this.hasOwnProperty(saveUnitDto, 'unit_conversion')
            ? (saveUnitDto.unit_conversion ?? null)
            : this.toNullableNumber(existing.unit_conversion);
        if (baseUnitId !== null && baseUnitId === unitId) {
            this.throwBadRequest('Validation error', [
                {
                    field: 'unit_base_unit_id',
                    message: 'unit_base_unit_id cannot be same as unit_id',
                },
            ]);
        }
        this.validateConversionRules(baseUnitId, conversion);
        if (baseUnitId !== null) {
            await this.ensureBaseUnitExists(baseUnitId);
        }
        const data = {
            unit_name: saveUnitDto.unit_name.trim(),
            unit_modified_on: new Date(),
            unit_modified_by: this.resolveActor(saveUnitDto.unit_modified_by),
        };
        this.applyOptionalFields(data, saveUnitDto);
        try {
            const updated = await this.prisma.unit.update({
                where: {
                    unit_id: unitId,
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
    async ensureBaseUnitExists(baseUnitId) {
        const baseUnit = await this.prisma.unit.findFirst({
            where: {
                unit_id: baseUnitId,
                unit_is_deleted: false,
            },
            select: {
                unit_id: true,
            },
        });
        if (!baseUnit) {
            this.throwBadRequest('Validation error', [
                {
                    field: 'unit_base_unit_id',
                    message: `No active base unit found with id ${baseUnitId}`,
                },
            ]);
        }
    }
    validateConversionRules(baseUnitId, conversion) {
        if (baseUnitId !== null) {
            if (conversion === null || conversion === undefined) {
                this.throwBadRequest('Validation error', [
                    {
                        field: 'unit_conversion',
                        message: 'unit_conversion is required when unit_base_unit_id is set',
                    },
                ]);
            }
            if (Number(conversion) <= 0) {
                this.throwBadRequest('Validation error', [
                    {
                        field: 'unit_conversion',
                        message: 'unit_conversion must be greater than 0',
                    },
                ]);
            }
            return;
        }
        if (conversion !== null && conversion !== undefined) {
            this.throwBadRequest('Validation error', [
                {
                    field: 'unit_base_unit_id',
                    message: 'unit_base_unit_id is required when unit_conversion is set',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveUnitDto) {
        if (this.hasOwnProperty(saveUnitDto, 'unit_alias')) {
            data.unit_alias = saveUnitDto.unit_alias;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_code')) {
            data.unit_code = saveUnitDto.unit_code;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_description')) {
            data.unit_description = saveUnitDto.unit_description;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_decimal_count')) {
            data.unit_decimal_count = saveUnitDto.unit_decimal_count;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_weight')) {
            data.unit_weight = saveUnitDto.unit_weight;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_loading')) {
            data.unit_loading = saveUnitDto.unit_loading;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_unloading')) {
            data.unit_unloading = saveUnitDto.unit_unloading;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_attach_charge')) {
            data.unit_attach_charge = saveUnitDto.unit_attach_charge;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_is_pack_unit')) {
            data.unit_is_pack_unit = saveUnitDto.unit_is_pack_unit;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_base_unit_id')) {
            data.unit_base_unit_id = saveUnitDto.unit_base_unit_id;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_conversion')) {
            data.unit_conversion = saveUnitDto.unit_conversion;
        }
        if (this.hasOwnProperty(saveUnitDto, 'unit_is_active')) {
            data.unit_is_active = saveUnitDto.unit_is_active;
        }
    }
    toPayload(record) {
        return {
            unit_id: record.unit_id,
            unit_name: record.unit_name,
            unit_alias: record.unit_alias,
            unit_code: record.unit_code,
            unit_description: record.unit_description,
            unit_decimal_count: record.unit_decimal_count,
            unit_weight: this.toNullableNumber(record.unit_weight),
            unit_loading: this.toNullableNumber(record.unit_loading),
            unit_unloading: this.toNullableNumber(record.unit_unloading),
            unit_attach_charge: this.toNullableNumber(record.unit_attach_charge),
            unit_is_pack_unit: record.unit_is_pack_unit,
            unit_base_unit_id: record.unit_base_unit_id,
            unit_conversion: this.toNullableNumber(record.unit_conversion),
            unit_is_active: record.unit_is_active,
            unit_is_deleted: record.unit_is_deleted,
            unit_sync_date: record.unit_sync_date ? record.unit_sync_date.toISOString() : null,
            unit_created_on: record.unit_created_on.toISOString(),
            unit_created_by: record.unit_created_by,
            unit_modified_on: record.unit_modified_on.toISOString(),
            unit_modified_by: record.unit_modified_by,
        };
    }
    toNullableNumber(value) {
        if (value === null) {
            return null;
        }
        if (typeof value === 'number') {
            return value;
        }
        return Number(value.toString());
    }
    resolveActor(value, fallback = DEFAULT_ACTOR) {
        if (!value) {
            return fallback;
        }
        const trimmed = value.trim();
        return trimmed || fallback;
    }
    handleWriteError(error) {
        if (this.isUniqueConstraintError(error)) {
            throw new common_1.ConflictException(this.buildErrorResponse('Unit name already exists', [
                {
                    field: 'unit_name',
                    message: 'Duplicate unit_name is not allowed',
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
    throwNotFound(unitId) {
        throw new common_1.NotFoundException(this.buildErrorResponse('Unit not found', [
            {
                field: 'unit_id',
                message: `No active unit found with id ${unitId}`,
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
exports.UnitsMasterService = UnitsMasterService;
exports.UnitsMasterService = UnitsMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UnitsMasterService);
//# sourceMappingURL=units-master.service.js.map