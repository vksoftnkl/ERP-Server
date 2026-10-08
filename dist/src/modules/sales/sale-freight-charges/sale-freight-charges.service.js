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
exports.SaleFreightChargeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const SALE_FREIGHT_CHARGE_RELATIONS = {
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
};
const SALE_FREIGHT_CHARGE_TABLE_NAME = 'sale freight charges';
const SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME = 'Sale Freight Charges';
const SALE_FREIGHT_CHARGE_OPTIONAL_FIELDS = [
    'frCompanyId',
    'frBranchId',
    'frFromKm',
    'frToKm',
    'frFreightChrg',
    'frFromWeight',
    'frToWeight',
    'frIsActive',
];
let SaleFreightChargeService = class SaleFreightChargeService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(dto) {
        if (dto.frId) {
            return this.updateSaleFreightCharge(dto);
        }
        const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.createSaleFreightCharge(dto, userId);
    }
    async createSaleFreightCharge(dto, userId) {
        const actor = (0, module_service_utils_1.resolveActor)(dto.frCreatedBy, userId);
        const now = new Date();
        const isDeleted = dto.frIsActive === false;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const data = {
                    frCompanyId: dto.frCompanyId ?? null,
                    frBranchId: dto.frBranchId ?? null,
                    frFromKm: dto.frFromKm ?? 0,
                    frToKm: dto.frToKm ?? 0,
                    frFreightChrg: dto.frFreightChrg ?? 0,
                    frFromWeight: dto.frFromWeight ?? 0,
                    frToWeight: dto.frToWeight ?? 0,
                    frIsActive: !isDeleted,
                    frIsDeleted: isDeleted,
                    frCreatedOn: now,
                    frCreatedBy: actor,
                    frModifiedOn: now,
                    frModifiedBy: actor,
                };
                const created = await tx.saleFreightCharge.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: SALE_FREIGHT_CHARGE_TABLE_NAME,
                    screenName: SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.frId,
                    displayName: `FR-${payload.frFromKm}-${payload.frToKm}`,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: actor,
                    notes: 'Sale freight charge created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async getById(frId) {
        const record = await this.prisma.saleFreightCharge.findFirst({
            where: {
                frId,
                frIsDeleted: false,
            },
            include: SALE_FREIGHT_CHARGE_RELATIONS,
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Sale freight charge not found', 'frId', `No active sale freight charge found with id ${frId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(frId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.saleFreightCharge.findFirst({
                where: {
                    frId,
                    frIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Sale freight charge not found', 'frId', `No active sale freight charge found with id ${frId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.saleFreightCharge.updateMany({
                where: {
                    frId,
                    frIsDeleted: false,
                },
                data: {
                    frIsDeleted: true,
                    frIsActive: false,
                    frModifiedOn: modifiedOn,
                    frModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Sale freight charge not found', 'frId', `No active sale freight charge found with id ${frId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                frIsDeleted: true,
                frIsActive: false,
                frModifiedOn: modifiedOn,
                frModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SALE_FREIGHT_CHARGE_TABLE_NAME,
                screenName: SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: frId,
                displayName: `FR-${existing.frFromKm}-${existing.frToKm}`,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Sale freight charge soft deleted',
            }, tx);
            return {
                frId,
                deleted: true,
            };
        });
    }
    async updateSaleFreightCharge(dto) {
        const frId = dto.frId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.saleFreightCharge.findFirst({
                    where: {
                        frId,
                        frIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Sale freight charge not found', 'frId', `No active sale freight charge found with id ${frId}`);
                }
                const data = {
                    frModifiedOn: new Date(),
                    frModifiedBy: (0, module_service_utils_1.resolveActor)(dto.frModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, dto);
                const updated = await tx.saleFreightCharge.update({
                    where: { frId },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SALE_FREIGHT_CHARGE_TABLE_NAME,
                    screenName: SALE_FREIGHT_CHARGE_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: frId,
                    displayName: `FR-${payload.frFromKm}-${payload.frToKm}`,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.frModifiedBy,
                    notes: 'Sale freight charge updated',
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
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Sale freight charge already exists', [
            {
                field: 'frFromKm',
                message: 'Duplicate sale freight charge range is not allowed',
            },
        ]);
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
        (0, module_service_utils_1.applyPresentFields)(data, dto, SALE_FREIGHT_CHARGE_OPTIONAL_FIELDS);
    }
    toPayload(record) {
        return {
            frId: record.frId,
            frCompanyId: record.frCompanyId,
            frCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
            frBranchId: record.frBranchId,
            frBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
            frFromKm: record.frFromKm,
            frToKm: record.frToKm,
            frFreightChrg: record.frFreightChrg ? (0, module_service_utils_1.toNumber)(record.frFreightChrg) : null,
            frFromWeight: record.frFromWeight ? (0, module_service_utils_1.toNumber)(record.frFromWeight) : null,
            frToWeight: record.frToWeight ? (0, module_service_utils_1.toNumber)(record.frToWeight) : null,
            frIsActive: record.frIsActive,
            frIsDeleted: record.frIsDeleted,
            frSyncDate: record.frSyncDate ? record.frSyncDate.toISOString() : null,
            frCreatedOn: record.frCreatedOn.toISOString(),
            frCreatedBy: record.frCreatedBy,
            frModifiedOn: record.frModifiedOn.toISOString(),
            frModifiedBy: record.frModifiedBy,
        };
    }
};
exports.SaleFreightChargeService = SaleFreightChargeService;
exports.SaleFreightChargeService = SaleFreightChargeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], SaleFreightChargeService);
//# sourceMappingURL=sale-freight-charges.service.js.map