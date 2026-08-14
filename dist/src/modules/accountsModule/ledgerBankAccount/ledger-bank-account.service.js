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
exports.LedgerBankAccountService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const LEDGER_BANK_ACCOUNT_TABLE_NAME = 'acc ledger bank accounts';
const LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME = 'Ledger Bank Account';
let LedgerBankAccountService = class LedgerBankAccountService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveLedgerBankAccountDto) {
        if (saveLedgerBankAccountDto.lbaId) {
            return this.updateLedgerBankAccount(saveLedgerBankAccountDto);
        }
        return this.createLedgerBankAccount(saveLedgerBankAccountDto);
    }
    async getById(lbaId) {
        const record = await this.prisma.accLedgerBankAccount.findFirst({
            where: {
                lbaId,
                lbaIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(lbaId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accLedgerBankAccount.findFirst({
                where: {
                    lbaId,
                    lbaIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.accLedgerBankAccount.updateMany({
                where: {
                    lbaId,
                    lbaIsDeleted: false,
                },
                data: {
                    lbaIsDeleted: true,
                    lbaIsActive: false,
                    lbaModifiedOn: modifiedOn,
                    lbaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                lbaIsDeleted: true,
                lbaIsActive: false,
                lbaModifiedOn: modifiedOn,
                lbaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
                screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: lbaId,
                displayName: existing.lbaAccountHolder,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Ledger bank account soft deleted',
            }, tx);
            return {
                lbaId,
                deleted: true,
            };
        });
    }
    async createLedgerBankAccount(saveLedgerBankAccountDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const accountHolder = (0, module_service_utils_1.normalizeRequiredText)(saveLedgerBankAccountDto.lbaAccountHolder, 'lbaAccountHolder');
                const bankName = (0, module_service_utils_1.normalizeRequiredText)(saveLedgerBankAccountDto.lbaBankName, 'lbaBankName');
                const accountNo = (0, module_service_utils_1.normalizeRequiredText)(saveLedgerBankAccountDto.lbaAccountNo, 'lbaAccountNo');
                const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
                const requestedCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaCompanyId')
                    ? (saveLedgerBankAccountDto.lbaCompanyId ?? null)
                    : undefined;
                const companyId = await this.resolveCompanyId(requestedCompanyId, null, ledger.ledCompanyId, tx);
                await this.ensureAccountNumberIsUnique(tx, saveLedgerBankAccountDto.lbaLedgerId, accountNo);
                if (saveLedgerBankAccountDto.lbaIsDefault === true) {
                    await this.clearDefaultAccount(tx, saveLedgerBankAccountDto.lbaLedgerId);
                }
                const now = new Date();
                const data = {
                    lbaCompanyId: companyId,
                    lbaLedgerId: saveLedgerBankAccountDto.lbaLedgerId,
                    lbaAccountHolder: accountHolder,
                    lbaBankName: bankName,
                    lbaAccountNo: accountNo,
                    lbaCreatedOn: now,
                    lbaCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveLedgerBankAccountDto);
                const created = await tx.accLedgerBankAccount.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
                    screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.lbaId,
                    displayName: payload.lbaAccountHolder,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Ledger bank account created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Ledger bank account already exists', [{ field: 'lbaAccountNo', message: 'Duplicate lbaAccountNo is not allowed' }]);
            if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Invalid reference value provided', [
                    { field: 'lbaLedgerId', message: 'Referenced ledger or company does not exist' },
                ]);
            }
            throw error;
        }
    }
    async updateLedgerBankAccount(saveLedgerBankAccountDto) {
        const lbaId = saveLedgerBankAccountDto.lbaId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accLedgerBankAccount.findFirst({
                    where: {
                        lbaId,
                        lbaIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
                }
                const accountHolder = (0, module_service_utils_1.normalizeRequiredText)(saveLedgerBankAccountDto.lbaAccountHolder, 'lbaAccountHolder');
                const bankName = (0, module_service_utils_1.normalizeRequiredText)(saveLedgerBankAccountDto.lbaBankName, 'lbaBankName');
                const accountNo = (0, module_service_utils_1.normalizeRequiredText)(saveLedgerBankAccountDto.lbaAccountNo, 'lbaAccountNo');
                const ledger = await this.ensureLedgerExists(saveLedgerBankAccountDto.lbaLedgerId, tx);
                const requestedCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaCompanyId')
                    ? (saveLedgerBankAccountDto.lbaCompanyId ?? null)
                    : undefined;
                const companyId = await this.resolveCompanyId(requestedCompanyId, existing.lbaCompanyId, ledger.ledCompanyId, tx);
                await this.ensureAccountNumberIsUnique(tx, saveLedgerBankAccountDto.lbaLedgerId, accountNo, lbaId);
                if (saveLedgerBankAccountDto.lbaIsDefault === true) {
                    await this.clearDefaultAccount(tx, saveLedgerBankAccountDto.lbaLedgerId, lbaId);
                }
                const data = {
                    lbaCompanyId: companyId,
                    lbaLedgerId: saveLedgerBankAccountDto.lbaLedgerId,
                    lbaAccountHolder: accountHolder,
                    lbaBankName: bankName,
                    lbaAccountNo: accountNo,
                    lbaModifiedOn: new Date(),
                    lbaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveLedgerBankAccountDto);
                const updated = await tx.accLedgerBankAccount.update({
                    where: {
                        lbaId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
                    screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: lbaId,
                    displayName: payload.lbaAccountHolder,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Ledger bank account updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Ledger bank account already exists', [{ field: 'lbaAccountNo', message: 'Duplicate lbaAccountNo is not allowed' }]);
            if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Invalid reference value provided', [
                    { field: 'lbaLedgerId', message: 'Referenced ledger or company does not exist' },
                ]);
            }
            throw error;
        }
    }
    async ensureLedgerExists(lbaLedgerId, tx) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: {
                ledId: lbaLedgerId,
                ledIsDeleted: false,
            },
            select: {
                ledId: true,
                ledCompanyId: true,
            },
        });
        if (!ledger) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Account ledger does not exist', [
                {
                    field: 'lbaLedgerId',
                    message: `No active account ledger found with id ${lbaLedgerId}`,
                },
            ]);
        }
        return ledger;
    }
    async ensureCompanyExists(compId, tx) {
        const company = await tx.company.findFirst({
            where: {
                compId,
                compIsDeleted: false,
            },
            select: {
                compId: true,
            },
        });
        if (!company) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Company does not exist', [
                {
                    field: 'lbaCompanyId',
                    message: `No active company found with id ${compId}`,
                },
            ]);
        }
    }
    async resolveCompanyId(requestedCompanyId, fallbackCompanyId, ledgerCompanyId, tx) {
        let companyId = requestedCompanyId === undefined ? fallbackCompanyId : requestedCompanyId;
        if (ledgerCompanyId !== null) {
            if (companyId === null) {
                companyId = ledgerCompanyId;
            }
            else if (companyId !== ledgerCompanyId) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Ledger company mismatch', [
                    {
                        field: 'lbaCompanyId',
                        message: `lbaCompanyId ${companyId} must match ledger company id ${ledgerCompanyId}`,
                    },
                ]);
            }
        }
        if (companyId !== null) {
            await this.ensureCompanyExists(companyId, tx);
        }
        return companyId;
    }
    async ensureAccountNumberIsUnique(tx, lbaLedgerId, lbaAccountNo, excludeLbaId) {
        const existing = await tx.accLedgerBankAccount.findFirst({
            where: {
                lbaIsDeleted: false,
                lbaLedgerId,
                lbaAccountNo: {
                    equals: lbaAccountNo,
                    mode: 'insensitive',
                },
                ...(excludeLbaId
                    ? {
                        lbaId: {
                            not: excludeLbaId,
                        },
                    }
                    : {}),
            },
            select: {
                lbaId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('Ledger bank account already exists for this ledger', [
                {
                    field: 'lbaAccountNo',
                    message: 'Duplicate lbaAccountNo is not allowed for this ledger',
                },
            ]);
        }
    }
    async clearDefaultAccount(tx, lbaLedgerId, excludeLbaId) {
        await tx.accLedgerBankAccount.updateMany({
            where: {
                lbaLedgerId,
                lbaIsDeleted: false,
                lbaIsDefault: true,
                ...(excludeLbaId
                    ? {
                        lbaId: {
                            not: excludeLbaId,
                        },
                    }
                    : {}),
            },
            data: {
                lbaIsDefault: false,
                lbaModifiedOn: new Date(),
                lbaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            },
        });
    }
    applyOptionalFields(data, saveLedgerBankAccountDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaBranchName')) {
            data.lbaBranchName = saveLedgerBankAccountDto.lbaBranchName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaIfscCode')) {
            data.lbaIfscCode = saveLedgerBankAccountDto.lbaIfscCode;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaMicrCode')) {
            data.lbaMicrCode = saveLedgerBankAccountDto.lbaMicrCode;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaAccountType')) {
            data.lbaAccountType = saveLedgerBankAccountDto.lbaAccountType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaUpiId')) {
            data.lbaUpiId = saveLedgerBankAccountDto.lbaUpiId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaChequeName')) {
            data.lbaChequeName = saveLedgerBankAccountDto.lbaChequeName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaIsDefault')) {
            data.lbaIsDefault = saveLedgerBankAccountDto.lbaIsDefault;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaIsActive')) {
            data.lbaIsActive = saveLedgerBankAccountDto.lbaIsActive;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerBankAccountDto, 'lbaRemarks')) {
            data.lbaRemarks = saveLedgerBankAccountDto.lbaRemarks;
        }
    }
    toPayload(record) {
        return {
            lbaId: record.lbaId,
            lbaCompanyId: record.lbaCompanyId,
            lbaLedgerId: record.lbaLedgerId,
            lbaAccountHolder: record.lbaAccountHolder,
            lbaBankName: record.lbaBankName,
            lbaBranchName: record.lbaBranchName,
            lbaAccountNo: record.lbaAccountNo,
            lbaIfscCode: record.lbaIfscCode,
            lbaMicrCode: record.lbaMicrCode,
            lbaAccountType: record.lbaAccountType,
            lbaUpiId: record.lbaUpiId,
            lbaChequeName: record.lbaChequeName,
            lbaIsDefault: record.lbaIsDefault,
            lbaIsActive: record.lbaIsActive,
            lbaIsDeleted: record.lbaIsDeleted,
            lbaSyncDate: record.lbaSyncDate ? record.lbaSyncDate.toISOString() : null,
            lbaCreatedOn: record.lbaCreatedOn.toISOString(),
            lbaCreatedBy: record.lbaCreatedBy,
            lbaModifiedOn: record.lbaModifiedOn.toISOString(),
            lbaModifiedBy: record.lbaModifiedBy,
            lbaRemarks: record.lbaRemarks,
        };
    }
};
exports.LedgerBankAccountService = LedgerBankAccountService;
exports.LedgerBankAccountService = LedgerBankAccountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], LedgerBankAccountService);
//# sourceMappingURL=ledger-bank-account.service.js.map