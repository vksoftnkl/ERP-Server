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
exports.SupplierGroupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const SUPPLIER_GROUP_TABLE_NAME = 'supplier groups';
const SUPPLIER_GROUP_AUDIT_SCREEN_NAME = 'Supplier Group Master';
const SUPPLIER_GROUP_OPTIONAL_FIELDS = ['spgAlias', 'spgShort', 'spgDesc', 'spgIsActive'];
let SupplierGroupService = class SupplierGroupService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveSupplierGroupDto) {
        if (saveSupplierGroupDto.spgId) {
            return this.updateSupplierGroup(saveSupplierGroupDto);
        }
        return this.createSupplierGroup(saveSupplierGroupDto);
    }
    async getById(spgId) {
        const record = await this.prisma.supplierGroup.findFirst({
            where: { spgId, spgIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwPurchaseNotFound)('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(spgId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.supplierGroup.findFirst({
                where: { spgId, spgIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwPurchaseNotFound)('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
            }
            const supplierCount = await tx.supplier.count({
                where: { supGroupId: spgId, supIsDeleted: false },
            });
            if (supplierCount > 0) {
                (0, module_service_utils_1.throwPurchaseBadRequest)('Cannot delete supplier group with active suppliers', [
                    { field: 'spgId', message: `Supplier group ${spgId} is used by ${supplierCount} supplier(s).` },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.supplierGroup.updateMany({
                where: { spgId, spgIsDeleted: false },
                data: { spgIsDeleted: true, spgIsActive: false, spgModifiedOn: modifiedOn, spgModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwPurchaseNotFound)('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                spgIsDeleted: true,
                spgIsActive: false,
                spgModifiedOn: modifiedOn,
                spgModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SUPPLIER_GROUP_TABLE_NAME,
                screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: spgId,
                displayName: existing.spgName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Supplier group soft deleted',
            }, tx);
            return { spgId, deleted: true };
        });
    }
    async createSupplierGroup(saveSupplierGroupDto) {
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveSupplierGroupDto.spgCreatedBy, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveSupplierGroupDto.spgModifiedBy, createdBy);
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierGroupDto.spgName, 'spgName');
        const data = {
            spgName: normalizedName,
            spgCreatedOn: now,
            spgCreatedBy: createdBy,
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveSupplierGroupDto, SUPPLIER_GROUP_OPTIONAL_FIELDS);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureNameIsUnique(tx, normalizedName);
                const created = await tx.supplierGroup.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: SUPPLIER_GROUP_TABLE_NAME,
                    screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.spgId,
                    displayName: payload.spgName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Supplier group created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Supplier group name already exists', [
                { field: 'spgName', message: 'Duplicate supplier group name is not allowed' },
            ]);
            throw error;
        }
    }
    async updateSupplierGroup(saveSupplierGroupDto) {
        const spgId = saveSupplierGroupDto.spgId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.supplierGroup.findFirst({
                    where: { spgId, spgIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwPurchaseNotFound)('Supplier group not found', 'spgId', `No active supplier group found with id ${spgId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierGroupDto.spgName, 'spgName');
                await this.ensureNameIsUnique(tx, normalizedName, spgId);
                const data = {
                    spgName: normalizedName,
                    spgModifiedOn: new Date(),
                    spgModifiedBy: (0, module_service_utils_1.resolveActor)(saveSupplierGroupDto.spgModifiedBy, this.requestContextService.getUserId()),
                };
                (0, module_service_utils_1.applyPresentFields)(data, saveSupplierGroupDto, SUPPLIER_GROUP_OPTIONAL_FIELDS);
                const updated = await tx.supplierGroup.update({ where: { spgId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SUPPLIER_GROUP_TABLE_NAME,
                    screenName: SUPPLIER_GROUP_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: spgId,
                    displayName: payload.spgName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.spgModifiedBy,
                    notes: 'Supplier group updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Supplier group name already exists', [
                { field: 'spgName', message: 'Duplicate supplier group name is not allowed' },
            ]);
            throw error;
        }
    }
    async ensureNameIsUnique(tx, groupName, excludeId) {
        const existing = await tx.supplierGroup.findFirst({
            where: {
                spgIsDeleted: false,
                spgName: { equals: groupName, mode: 'insensitive' },
                ...(excludeId ? { spgId: { not: excludeId } } : {}),
            },
            select: { spgId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwPurchaseConflict)('Supplier group name already exists', [
                { field: 'spgName', message: 'Duplicate supplier group name is not allowed' },
            ]);
        }
    }
    toPayload(record) {
        return {
            spgId: record.spgId,
            spgName: record.spgName,
            spgAlias: record.spgAlias,
            spgShort: record.spgShort,
            spgDesc: record.spgDesc,
            spgIsActive: record.spgIsActive,
            spgIsDeleted: record.spgIsDeleted,
            spgSyncDate: record.spgSyncDate ? record.spgSyncDate.toISOString() : null,
            spgCreatedOn: record.spgCreatedOn.toISOString(),
            spgCreatedBy: record.spgCreatedBy,
            spgModifiedOn: record.spgModifiedOn.toISOString(),
            spgModifiedBy: record.spgModifiedBy,
        };
    }
};
exports.SupplierGroupService = SupplierGroupService;
exports.SupplierGroupService = SupplierGroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], SupplierGroupService);
//# sourceMappingURL=supplier-group.service.js.map