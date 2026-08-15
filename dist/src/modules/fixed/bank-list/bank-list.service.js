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
exports.BankListService = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../common/configured-grid-sql/configured-grid-sql.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const module_list_utils_1 = require("../../../common/utils/module-list.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const BANK_LIST_TABLE_NAME = 'bank master';
const BANK_LIST_AUDIT_SCREEN_NAME = 'Bank List Master';
const BANK_LIST_OPTIONAL_FIELDS = ['bnkShortName', 'bnkAlias', 'bnkRbiCode', 'bnkIbanSupported', 'bnkIsActive'];
let BankListService = class BankListService {
    prisma;
    auditLogService;
    configuredGridSqlService;
    requestContextService;
    constructor(prisma, auditLogService, configuredGridSqlService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.configuredGridSqlService = configuredGridSqlService;
        this.requestContextService = requestContextService;
    }
    async save(saveBankListDto) {
        if (saveBankListDto.bnkId) {
            return this.updateBank(saveBankListDto);
        }
        return this.createBank(saveBankListDto);
    }
    async list(queryDto) {
        const { page, limit, skip } = (0, module_list_utils_1.resolvePagination)(queryDto);
        const result = await (0, module_list_utils_1.runConfiguredGridQuery)(this.configuredGridSqlService, { tableName: BANK_LIST_TABLE_NAME, alias: 'bank_list_grid', search: queryDto.search, page, limit, skip });
        if (!result) {
            (0, module_service_utils_1.throwFixedBadRequest)('No configured grid found for bank list', []);
        }
        return result;
    }
    async getById(bnkId) {
        const record = await this.prisma.bankMaster.findFirst({
            where: { bnkId, bnkIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwFixedNotFound)('Bank not found', 'bnkId', `No active bank found with id ${bnkId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(bnkId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.bankMaster.findFirst({
                where: { bnkId, bnkIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwFixedNotFound)('Bank not found', 'bnkId', `No active bank found with id ${bnkId}`);
            }
            const bankUsageCount = await tx.accLedgerBankAccount.count({
                where: { lbaBankName: existing.bnkName, lbaIsDeleted: false },
            });
            if (bankUsageCount > 0) {
                (0, module_service_utils_1.throwFixedBadRequest)('Cannot delete bank with active bank-account mappings', [{ field: 'bnkId', message: `Bank ${bnkId} is used in ${bankUsageCount} ledger bank account(s).` }]);
            }
            const modifiedOn = new Date();
            const result = await tx.bankMaster.updateMany({
                where: { bnkId, bnkIsDeleted: false },
                data: {
                    bnkIsDeleted: true,
                    bnkIsActive: false,
                    bnkModifiedOn: modifiedOn,
                    bnkModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwFixedNotFound)('Bank not found', 'bnkId', `No active bank found with id ${bnkId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                bnkIsDeleted: true,
                bnkIsActive: false,
                bnkModifiedOn: modifiedOn,
                bnkModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: BANK_LIST_TABLE_NAME,
                screenName: BANK_LIST_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: bnkId,
                displayName: existing.bnkName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Bank soft deleted',
            }, tx);
            return { bnkId, deleted: true };
        });
    }
    async createBank(saveBankListDto) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveBankListDto.bnkName, 'bnkName');
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveBankListDto.bnkCreatedBy, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveBankListDto.bnkModifiedBy, createdBy);
        const data = {
            bnkName: normalizedName,
            bnkCreatedOn: now,
            bnkCreatedBy: createdBy,
        };
        (0, module_service_utils_1.applyPresentFields)(data, saveBankListDto, BANK_LIST_OPTIONAL_FIELDS);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureNameIsUnique(tx, normalizedName);
                const created = await tx.bankMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: BANK_LIST_TABLE_NAME,
                    screenName: BANK_LIST_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.bnkId,
                    displayName: payload.bnkName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Bank created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Bank already exists', [{ field: 'bnkName', message: 'Duplicate bnkName is not allowed' }]);
            throw error;
        }
    }
    async updateBank(saveBankListDto) {
        const bnkId = saveBankListDto.bnkId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.bankMaster.findFirst({
                    where: { bnkId, bnkIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwFixedNotFound)('Bank not found', 'bnkId', `No active bank found with id ${bnkId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveBankListDto.bnkName, 'bnkName');
                await this.ensureNameIsUnique(tx, normalizedName, bnkId);
                const data = {
                    bnkName: normalizedName,
                    bnkModifiedOn: new Date(),
                    bnkModifiedBy: (0, module_service_utils_1.resolveActor)(saveBankListDto.bnkModifiedBy, this.requestContextService.getUserId()),
                };
                (0, module_service_utils_1.applyPresentFields)(data, saveBankListDto, BANK_LIST_OPTIONAL_FIELDS);
                const updated = await tx.bankMaster.update({ where: { bnkId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: BANK_LIST_TABLE_NAME,
                    screenName: BANK_LIST_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: bnkId,
                    displayName: payload.bnkName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: (0, module_service_utils_1.resolveActor)(saveBankListDto.bnkModifiedBy, this.requestContextService.getUserId()),
                    notes: 'Bank updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Bank already exists', [{ field: 'bnkName', message: 'Duplicate bnkName is not allowed' }]);
            throw error;
        }
    }
    async ensureNameIsUnique(tx, bankName, excludeId) {
        const existing = await tx.bankMaster.findFirst({
            where: {
                bnkIsDeleted: false,
                bnkName: { equals: bankName, mode: 'insensitive' },
                ...(excludeId ? { bnkId: { not: excludeId } } : {}),
            },
            select: { bnkId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwFixedConflict)('Bank name already exists', [{ field: 'bnkName', message: 'Duplicate bank name is not allowed' }]);
        }
    }
    toPayload(record) {
        return {
            bnkId: record.bnkId,
            bnkName: record.bnkName,
            bnkShortName: record.bnkShortName,
            bnkAlias: record.bnkAlias,
            bnkRbiCode: record.bnkRbiCode,
            bnkIbanSupported: record.bnkIbanSupported,
            bnkIsActive: record.bnkIsActive,
            bnkIsDeleted: record.bnkIsDeleted,
            bnkSyncDate: record.bnkSyncDate ? record.bnkSyncDate.toISOString() : null,
            bnkCreatedOn: record.bnkCreatedOn.toISOString(),
            bnkCreatedBy: record.bnkCreatedBy,
            bnkModifiedOn: record.bnkModifiedOn.toISOString(),
            bnkModifiedBy: record.bnkModifiedBy,
        };
    }
};
exports.BankListService = BankListService;
exports.BankListService = BankListService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        configured_grid_sql_service_1.ConfiguredGridSqlService,
        request_context_service_1.RequestContextService])
], BankListService);
//# sourceMappingURL=bank-list.service.js.map