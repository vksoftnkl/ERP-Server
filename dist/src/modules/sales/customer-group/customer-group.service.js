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
exports.CustomerGroupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const CUSTOMER_GROUP_TABLE_NAME = 'cust groups';
const CUSTOMER_GROUP_AUDIT_SCREEN_NAME = 'Customer Group Master';
const CUSTOMER_GROUP_OPTIONAL_FIELDS = [
    'cgrCompanyId',
    'cgrBranchId',
    'cgrAlias',
    'cgrShort',
    'cgrNarration',
    'cgrOrder',
    'cgrDiscPerc',
    'cgrCollectionDays',
    'cgrDebitAllowed',
    'cgrDebitDays',
    'cgrDebitLimit',
    'cgrBillsLimit',
    'cgrOverdueBilling',
    'cgrIsActive',
];
let CustomerGroupService = class CustomerGroupService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveCustomerGroupDto) {
        if (saveCustomerGroupDto.cgrId) {
            return this.updateCustomerGroup(saveCustomerGroupDto);
        }
        return this.createCustomerGroup(saveCustomerGroupDto);
    }
    async getById(cgrId) {
        const record = await this.prisma.custGroup.findFirst({
            where: {
                cgrId,
                cgrIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Customer group not found', 'cgrId', `No active customer group found with id ${cgrId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(cgrId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.custGroup.findFirst({
                where: {
                    cgrId,
                    cgrIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Customer group not found', 'cgrId', `No active customer group found with id ${cgrId}`);
            }
            const customerCount = await tx.customer.count({
                where: {
                    cusGroupId: cgrId,
                    cusIsDeleted: false,
                },
            });
            if (customerCount > 0) {
                (0, module_service_utils_1.throwSalesBadRequest)('Cannot delete customer group with active customers', [
                    {
                        field: 'cgrId',
                        message: `Customer group ${cgrId} is used by ${customerCount} customer(s).`,
                    },
                ]);
            }
            const modifiedOn = new Date();
            const result = await tx.custGroup.updateMany({
                where: {
                    cgrId,
                    cgrIsDeleted: false,
                },
                data: {
                    cgrIsDeleted: true,
                    cgrIsActive: false,
                    cgrModifiedOn: modifiedOn,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Customer group not found', 'cgrId', `No active customer group found with id ${cgrId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                cgrIsDeleted: true,
                cgrIsActive: false,
                cgrModifiedOn: modifiedOn,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: CUSTOMER_GROUP_TABLE_NAME,
                screenName: CUSTOMER_GROUP_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: cgrId,
                displayName: existing.cgrName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Customer group soft deleted',
            }, tx);
            return {
                cgrId,
                deleted: true,
            };
        });
    }
    async createCustomerGroup(saveCustomerGroupDto) {
        const now = new Date();
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveCustomerGroupDto.cgrName, 'cgrName');
        const companyId = (0, module_service_utils_1.hasOwnProperty)(saveCustomerGroupDto, 'cgrCompanyId')
            ? (saveCustomerGroupDto.cgrCompanyId ?? null)
            : null;
        const data = {
            cgrName: normalizedName,
            cgrCompanyId: companyId,
            cgrCollectionDays: (0, module_service_utils_1.hasOwnProperty)(saveCustomerGroupDto, 'cgrCollectionDays')
                ? (saveCustomerGroupDto.cgrCollectionDays ?? [])
                : [],
            cgrCreatedOn: now,
        };
        this.applyOptionalFields(data, saveCustomerGroupDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureCompanyExists(tx, companyId);
                await this.ensureNameIsUnique(tx, normalizedName, companyId);
                const created = await tx.custGroup.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: CUSTOMER_GROUP_TABLE_NAME,
                    screenName: CUSTOMER_GROUP_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.cgrId,
                    displayName: payload.cgrName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Customer group created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Customer group name already exists', [
                {
                    field: 'cgrName',
                    message: 'Duplicate customer group name is not allowed',
                },
            ]);
            throw error;
        }
    }
    async updateCustomerGroup(saveCustomerGroupDto) {
        const cgrId = saveCustomerGroupDto.cgrId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.custGroup.findFirst({
                    where: {
                        cgrId,
                        cgrIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Customer group not found', 'cgrId', `No active customer group found with id ${cgrId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveCustomerGroupDto.cgrName, 'cgrName');
                const nextCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveCustomerGroupDto, 'cgrCompanyId')
                    ? (saveCustomerGroupDto.cgrCompanyId ?? null)
                    : existing.cgrCompanyId;
                await this.ensureCompanyExists(tx, nextCompanyId);
                await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, cgrId);
                const data = {
                    cgrName: normalizedName,
                    cgrCompanyId: nextCompanyId,
                    cgrModifiedOn: new Date(),
                };
                this.applyOptionalFields(data, saveCustomerGroupDto);
                const updated = await tx.custGroup.update({
                    where: {
                        cgrId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: CUSTOMER_GROUP_TABLE_NAME,
                    screenName: CUSTOMER_GROUP_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: cgrId,
                    displayName: payload.cgrName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Customer group updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Customer group name already exists', [
                {
                    field: 'cgrName',
                    message: 'Duplicate customer group name is not allowed',
                },
            ]);
            throw error;
        }
    }
    async ensureCompanyExists(tx, companyId) {
        if (companyId === null) {
            return;
        }
        const company = await tx.company.findFirst({
            where: {
                compId: companyId,
                compIsDeleted: false,
            },
            select: {
                compId: true,
            },
        });
        if (!company) {
            (0, module_service_utils_1.throwSalesBadRequest)('Company does not exist', [
                {
                    field: 'cgrCompanyId',
                    message: `No active company found with id ${companyId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, groupName, companyId, excludeId) {
        const existing = await tx.custGroup.findFirst({
            where: {
                cgrIsDeleted: false,
                cgrCompanyId: companyId,
                cgrName: {
                    equals: groupName,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        cgrId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                cgrId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwSalesConflict)('Customer group name already exists for this company', [
                {
                    field: 'cgrName',
                    message: 'Duplicate customer group name is not allowed for this company',
                },
            ]);
        }
    }
    applyOptionalFields(data, saveCustomerGroupDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveCustomerGroupDto, CUSTOMER_GROUP_OPTIONAL_FIELDS, {
            cgrCollectionDays: (value) => value ?? [],
        });
    }
    toPayload(record) {
        return {
            cgrId: record.cgrId,
            cgrCompanyId: record.cgrCompanyId,
            cgrBranchId: record.cgrBranchId,
            cgrName: record.cgrName,
            cgrAlias: record.cgrAlias,
            cgrShort: record.cgrShort,
            cgrNarration: record.cgrNarration,
            cgrOrder: (0, module_service_utils_1.toNumber)(record.cgrOrder),
            cgrDiscPerc: (0, module_service_utils_1.toNumber)(record.cgrDiscPerc),
            cgrCollectionDays: record.cgrCollectionDays,
            cgrDebitAllowed: record.cgrDebitAllowed,
            cgrDebitDays: record.cgrDebitDays,
            cgrDebitLimit: (0, module_service_utils_1.toNumber)(record.cgrDebitLimit),
            cgrBillsLimit: record.cgrBillsLimit,
            cgrOverdueBilling: record.cgrOverdueBilling,
            cgrIsActive: record.cgrIsActive,
            cgrIsDeleted: record.cgrIsDeleted,
            cgrCreatedOn: record.cgrCreatedOn.toISOString(),
            cgrModifiedOn: record.cgrModifiedOn.toISOString(),
        };
    }
};
exports.CustomerGroupService = CustomerGroupService;
exports.CustomerGroupService = CustomerGroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], CustomerGroupService);
//# sourceMappingURL=customer-group.service.js.map