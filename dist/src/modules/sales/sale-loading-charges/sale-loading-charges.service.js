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
exports.SaleLoadingChargeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const SALE_LOADING_CHARGE_RELATIONS = {
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
};
const SALE_LOADING_CHARGE_TABLE_NAME = 'sale loading charges';
const SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME = 'Sale Loading Charges';
const SALE_LOADING_CHARGE_OPTIONAL_FIELDS = [
    'ilcCompId',
    'ilcBranchId',
    'ilcFromWeight',
    'ilcToWeight',
    'ilcLoadChrg',
    'ilcUnloadChrg',
    'ilcIsActive',
];
let SaleLoadingChargeService = class SaleLoadingChargeService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(dto) {
        if (dto.ilcId) {
            return this.updateSaleLoadingCharge(dto);
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.createSaleLoadingCharge(dto, userId);
    }
    async createSaleLoadingCharge(dto, userId) {
        const actor = (0, module_service_utils_1.resolveActor)(dto.ilcCreatedBy, userId);
        const now = new Date();
        const isDeleted = dto.ilcIsActive === false;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const data = {
                    ilcCompId: dto.ilcCompId ?? null,
                    ilcBranchId: dto.ilcBranchId ?? null,
                    ilcFromWeight: dto.ilcFromWeight ?? 0,
                    ilcToWeight: dto.ilcToWeight ?? 0,
                    ilcLoadChrg: dto.ilcLoadChrg ?? 0,
                    ilcUnloadChrg: dto.ilcUnloadChrg ?? 0,
                    ilcIsActive: !isDeleted,
                    ilcIsDeleted: isDeleted,
                    ilcCreatedOn: now,
                    ilcCreatedBy: actor,
                    ilcModifiedOn: now,
                    ilcModifiedBy: actor,
                };
                const created = await tx.saleLoadingCharge.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: SALE_LOADING_CHARGE_TABLE_NAME,
                    screenName: SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.ilcId,
                    displayName: `ILC-${payload.ilcFromWeight}-${payload.ilcToWeight}`,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'Sale loading charge created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async getById(ilcId) {
        const record = await this.prisma.saleLoadingCharge.findFirst({
            where: {
                ilcId,
                ilcIsDeleted: false,
            },
            include: SALE_LOADING_CHARGE_RELATIONS,
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Sale loading charge not found', 'ilcId', `No active sale loading charge found with id ${ilcId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(ilcId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.saleLoadingCharge.findFirst({
                where: {
                    ilcId,
                    ilcIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Sale loading charge not found', 'ilcId', `No active sale loading charge found with id ${ilcId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.saleLoadingCharge.updateMany({
                where: {
                    ilcId,
                    ilcIsDeleted: false,
                },
                data: {
                    ilcIsDeleted: true,
                    ilcIsActive: false,
                    ilcModifiedOn: modifiedOn,
                    ilcModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Sale loading charge not found', 'ilcId', `No active sale loading charge found with id ${ilcId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                ilcIsDeleted: true,
                ilcIsActive: false,
                ilcModifiedOn: modifiedOn,
                ilcModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SALE_LOADING_CHARGE_TABLE_NAME,
                screenName: SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ilcId,
                displayName: `ILC-${existing.ilcFromWeight}-${existing.ilcToWeight}`,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Sale loading charge soft deleted',
            }, tx);
            return {
                ilcId,
                deleted: true,
            };
        });
    }
    async updateSaleLoadingCharge(dto) {
        const ilcId = dto.ilcId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.saleLoadingCharge.findFirst({
                    where: {
                        ilcId,
                        ilcIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Sale loading charge not found', 'ilcId', `No active sale loading charge found with id ${ilcId}`);
                }
                const data = {
                    ilcModifiedOn: new Date(),
                    ilcModifiedBy: (0, module_service_utils_1.resolveActor)(dto.ilcModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, dto);
                const updated = await tx.saleLoadingCharge.update({
                    where: { ilcId },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SALE_LOADING_CHARGE_TABLE_NAME,
                    screenName: SALE_LOADING_CHARGE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: ilcId,
                    displayName: `ILC-${payload.ilcFromWeight}-${payload.ilcToWeight}`,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.ilcModifiedBy,
                    notes: 'Sale loading charge updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Sale loading charge already exists', [
            {
                field: 'ilcFromWeight',
                message: 'Duplicate sale loading charge range is not allowed',
            },
        ]);
        if ((0, module_service_utils_1.isExclusionConstraintError)(error)) {
            (0, module_service_utils_1.throwSalesConflict)('Overlapping sale loading charge slab', [
                {
                    field: 'ilcFromWeight',
                    message: 'Weight range overlaps an existing slab for this company/branch. Slabs may touch at a boundary (0-100, 100-200) but not overlap.',
                },
            ]);
        }
        if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid relation reference', [
                {
                    field: 'request',
                    message: 'Referenced company or branch does not exist',
                },
            ]);
        }
    }
    applyOptionalFields(data, dto) {
        (0, module_service_utils_1.applyPresentFields)(data, dto, SALE_LOADING_CHARGE_OPTIONAL_FIELDS);
    }
    toPayload(record) {
        return {
            ilcId: record.ilcId,
            ilcCompId: record.ilcCompId,
            ilcCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
            ilcBranchId: record.ilcBranchId,
            ilcBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
            ilcFromWeight: record.ilcFromWeight ? (0, module_service_utils_1.toNumber)(record.ilcFromWeight) : null,
            ilcToWeight: record.ilcToWeight ? (0, module_service_utils_1.toNumber)(record.ilcToWeight) : null,
            ilcLoadChrg: record.ilcLoadChrg ? (0, module_service_utils_1.toNumber)(record.ilcLoadChrg) : null,
            ilcUnloadChrg: record.ilcUnloadChrg ? (0, module_service_utils_1.toNumber)(record.ilcUnloadChrg) : null,
            ilcIsActive: record.ilcIsActive,
            ilcIsDeleted: record.ilcIsDeleted,
            ilcSyncDate: record.ilcSyncDate ? record.ilcSyncDate.toISOString() : null,
            ilcCreatedOn: record.ilcCreatedOn.toISOString(),
            ilcCreatedBy: record.ilcCreatedBy,
            ilcModifiedOn: record.ilcModifiedOn.toISOString(),
            ilcModifiedBy: record.ilcModifiedBy,
        };
    }
};
exports.SaleLoadingChargeService = SaleLoadingChargeService;
exports.SaleLoadingChargeService = SaleLoadingChargeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], SaleLoadingChargeService);
//# sourceMappingURL=sale-loading-charges.service.js.map