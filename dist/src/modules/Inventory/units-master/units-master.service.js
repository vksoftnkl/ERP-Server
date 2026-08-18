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
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const UNIT_TABLE_NAME = 'item_unit_master';
const UNIT_AUDIT_SCREEN_NAME = 'Units Master';
const LEGACY_UNIT_UUID_NUMERIC_COMPARISON_PATTERN = /\b(?:[a-z_][a-z0-9_$]*\s*\.\s*)?(unit_id|unit_base_unit_id)\s*=\s*[-+]?\d+\b/i;
let UnitsMasterService = class UnitsMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveUnitDto) {
        if (saveUnitDto.unit_id) {
            return this.updateUnit(saveUnitDto);
        }
        return this.createUnit(saveUnitDto);
    }
    async getById(unitId) {
        const record = await this.prisma.unit.findFirst({
            where: { unit_id: unitId, unit_is_deleted: false },
            include: {
                baseUnit: { select: { unit_name: true } },
                gstUnit: { select: { itemGstUnitName: true } },
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Unit not found', 'unit_id', `No active unit found with id ${unitId}`);
        }
        const payload = this.toPayload(record, record.baseUnit?.unit_name ?? null, record.gstUnit?.itemGstUnitName ?? null);
        return {
            unit_id: payload.unit_id,
            unit_name: payload.unit_name,
            unit_alias: payload.unit_alias,
            unit_code: payload.unit_code,
            unit_code_name: payload.unit_code_name,
            unit_description: payload.unit_description,
            unit_decimal_count: payload.unit_decimal_count,
            unit_weight: payload.unit_weight,
            unit_loading: payload.unit_loading,
            unit_unloading: payload.unit_unloading,
            unit_attach_charge: payload.unit_attach_charge,
            unit_is_pack_unit: payload.unit_is_pack_unit,
            unit_base_unit_id: payload.unit_base_unit_id,
            unit_base_unit_name: payload.unit_base_unit_name,
            unit_conversion: payload.unit_conversion,
            unit_is_active: payload.unit_is_active,
        };
    }
    async toggleDelete(unitId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.unit.findFirst({
                where: { unit_id: unitId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwInventoryNotFound)('Unit not found', 'unit_id', `No unit found with id ${unitId}`);
            }
            const wasDeleted = existing.unit_is_deleted;
            const nextDeleted = !wasDeleted;
            const modifiedOn = new Date();
            const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.unit.updateMany({
                where: { unit_id: unitId, unit_is_deleted: wasDeleted },
                data: {
                    unit_is_deleted: nextDeleted,
                    unit_modified_on: modifiedOn,
                    unit_modified_by: userId,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwInventoryNotFound)('Unit not found', 'unit_id', `No unit found with id ${unitId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                unit_is_deleted: nextDeleted,
                unit_modified_on: modifiedOn,
                unit_modified_by: userId,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: UNIT_TABLE_NAME,
                screenName: UNIT_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: unitId,
                displayName: existing.unit_name,
                originalRecord,
                modifiedRecord,
                userId,
                notes: nextDeleted ? 'Unit soft deleted' : 'Unit restored',
            }, tx);
            return { unit_id: unitId, deleted: nextDeleted };
        });
    }
    async createUnit(saveUnitDto) {
        const baseUnitId = (0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_base_unit_id')
            ? (saveUnitDto.unit_base_unit_id ?? null)
            : null;
        const conversion = (0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_conversion')
            ? (saveUnitDto.unit_conversion ?? null)
            : null;
        this.validateConversionRules(baseUnitId, conversion);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveUnitDto.unit_created_by, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveUnitDto.unit_modified_by, createdBy);
        const data = {
            unit_name: saveUnitDto.unit_name.trim(),
            unit_created_on: now,
            unit_created_by: createdBy,
        };
        this.applyOptionalFields(data, saveUnitDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const created = await tx.unit.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: UNIT_TABLE_NAME,
                    screenName: UNIT_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.unit_id,
                    displayName: payload.unit_name,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Unit created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateUnit(saveUnitDto) {
        const unitId = saveUnitDto.unit_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.unit.findFirst({
                    where: { unit_id: unitId, unit_is_deleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Unit not found', 'unit_id', `No active unit found with id ${unitId}`);
                }
                const baseUnitId = (0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_base_unit_id')
                    ? (saveUnitDto.unit_base_unit_id ?? null)
                    : existing.unit_base_unit_id;
                const conversion = (0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_conversion')
                    ? (saveUnitDto.unit_conversion ?? null)
                    : (0, module_service_utils_1.toNullableNumber)(existing.unit_conversion);
                if (baseUnitId !== null && baseUnitId === unitId) {
                    (0, module_service_utils_1.throwInventoryBadRequest)('Validation error', [
                        { field: 'unit_base_unit_id', message: 'unit_base_unit_id cannot be same as unit_id' },
                    ]);
                }
                this.validateConversionRules(baseUnitId, conversion);
                const data = {
                    unit_name: saveUnitDto.unit_name.trim(),
                    unit_modified_on: new Date(),
                    unit_modified_by: (0, module_service_utils_1.resolveActor)(saveUnitDto.unit_modified_by, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveUnitDto);
                const updated = await tx.unit.update({ where: { unit_id: unitId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: UNIT_TABLE_NAME,
                    screenName: UNIT_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: unitId,
                    displayName: payload.unit_name,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.unit_modified_by,
                    notes: 'Unit updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    validateConversionRules(baseUnitId, conversion) {
        if (baseUnitId !== null) {
            if (conversion === null || conversion === undefined) {
                (0, module_service_utils_1.throwInventoryBadRequest)('Validation error', [
                    {
                        field: 'unit_conversion',
                        message: 'unit_conversion is required when unit_base_unit_id is set',
                    },
                ]);
            }
            if (Number(conversion) <= 0) {
                (0, module_service_utils_1.throwInventoryBadRequest)('Validation error', [
                    { field: 'unit_conversion', message: 'unit_conversion must be greater than 0' },
                ]);
            }
        }
    }
    applyOptionalFields(data, saveUnitDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_alias'))
            data.unit_alias = saveUnitDto.unit_alias;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_code'))
            data.unit_code = saveUnitDto.unit_code;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_description'))
            data.unit_description = saveUnitDto.unit_description;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_decimal_count'))
            data.unit_decimal_count = saveUnitDto.unit_decimal_count;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_weight'))
            data.unit_weight = saveUnitDto.unit_weight;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_loading'))
            data.unit_loading = saveUnitDto.unit_loading;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_unloading'))
            data.unit_unloading = saveUnitDto.unit_unloading;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_attach_charge'))
            data.unit_attach_charge = saveUnitDto.unit_attach_charge;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_is_pack_unit'))
            data.unit_is_pack_unit = saveUnitDto.unit_is_pack_unit;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_base_unit_id'))
            data.unit_base_unit_id = saveUnitDto.unit_base_unit_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_conversion'))
            data.unit_conversion = saveUnitDto.unit_conversion;
        if ((0, module_service_utils_1.hasOwnProperty)(saveUnitDto, 'unit_is_active'))
            data.unit_is_active = saveUnitDto.unit_is_active;
    }
    toPayload(record, baseUnitName = null, unitCodeName = null) {
        return {
            unit_id: record.unit_id,
            unit_name: record.unit_name,
            unit_alias: record.unit_alias,
            unit_code: record.unit_code,
            unit_code_name: unitCodeName,
            unit_description: record.unit_description,
            unit_decimal_count: record.unit_decimal_count,
            unit_weight: (0, module_service_utils_1.toNullableNumber)(record.unit_weight),
            unit_loading: (0, module_service_utils_1.toNullableNumber)(record.unit_loading),
            unit_unloading: (0, module_service_utils_1.toNullableNumber)(record.unit_unloading),
            unit_attach_charge: (0, module_service_utils_1.toNullableNumber)(record.unit_attach_charge),
            unit_is_pack_unit: record.unit_is_pack_unit,
            unit_base_unit_id: record.unit_base_unit_id,
            unit_base_unit_name: baseUnitName,
            unit_conversion: (0, module_service_utils_1.toNullableNumber)(record.unit_conversion),
            unit_is_active: record.unit_is_active,
            unit_is_deleted: record.unit_is_deleted,
            unit_sync_date: record.unit_sync_date ? record.unit_sync_date.toISOString() : null,
            unit_created_on: record.unit_created_on.toISOString(),
            unit_created_by: record.unit_created_by,
            unit_modified_on: record.unit_modified_on.toISOString(),
            unit_modified_by: record.unit_modified_by,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Unit name already exists', [
            { field: 'unit_name', message: 'Duplicate unit_name is not allowed' },
        ]);
    }
};
exports.UnitsMasterService = UnitsMasterService;
exports.UnitsMasterService = UnitsMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], UnitsMasterService);
//# sourceMappingURL=units-master.service.js.map