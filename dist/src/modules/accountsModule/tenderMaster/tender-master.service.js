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
exports.TenderMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const TENDER_MASTER_TABLE_NAME = 'account tender master';
const TENDER_MASTER_AUDIT_SCREEN_NAME = 'Tender Master';
const TENDER_SHORT_NAME_MAX_LENGTH = 30;
const TENDER_MASTER_OPTIONAL_FIELDS = [
    'tndSettlementLedgerId',
    'tndSettlementDays',
    'tndBankAccountId',
    'tndMaxAmount',
    'tndDailyLimit',
    'tndSurchargePerc',
    'tndSurchargeAmount',
    'tndSurchargeLedgerId',
    'tndEditSurcharge',
    'tndEditLedger',
    'tndUpiVpa',
    'tndUpiQrPayload',
    'tndMerchantId',
    'tndTerminalId',
    'tndConversionRate',
    'tndNeedsRef',
    'tndAllowChange',
    'tndAllowInReturn',
    'tndOpenCashDrawer',
    'tndIsDefault',
    'tndDisplayPosition',
    'tndHotkey',
    'tndColour',
    'tndEffectiveFrom',
    'tndEffectiveTo',
    'tndRemarks',
    'tndIsActive',
];
const TENDER_MASTER_DEFAULTED_FIELDS = [
    'tndSettlementDays',
    'tndSurchargePerc',
    'tndSurchargeAmount',
    'tndEditSurcharge',
    'tndEditLedger',
    'tndConversionRate',
    'tndOpenCashDrawer',
    'tndIsDefault',
    'tndDisplayPosition',
    'tndIsActive',
];
const TENDER_MASTER_DATE_FIELDS = ['tndEffectiveFrom', 'tndEffectiveTo'];
const TENDER_MASTER_TEXT_FIELDS = [
    'tndUpiVpa',
    'tndUpiQrPayload',
    'tndMerchantId',
    'tndTerminalId',
    'tndHotkey',
    'tndColour',
    'tndRemarks',
];
const TENDER_MASTER_NAME_INCLUDE = {
    company: { select: { compName: true } },
    branch: { select: { brName: true } },
    tenderType: { select: { ttmTypeName: true } },
    ledger: { select: { ledName: true } },
    surchargeLedger: { select: { ledName: true } },
};
function dropNullish(value) {
    return value === null ? undefined : value;
}
function toDateOrNull(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `${field} must be a valid ISO date`,
            },
        ]);
    }
    return parsed;
}
const TENDER_MASTER_FIELD_TRANSFORMS = {
    ...Object.fromEntries(TENDER_MASTER_DEFAULTED_FIELDS.map((field) => [field, dropNullish])),
    ...Object.fromEntries(TENDER_MASTER_TEXT_FIELDS.map((field) => [
        field,
        (value) => (0, module_service_utils_1.normalizeNullableString)(value),
    ])),
    ...Object.fromEntries(TENDER_MASTER_DATE_FIELDS.map((field) => [
        field,
        (value) => toDateOrNull(value, field),
    ])),
};
let TenderMasterService = class TenderMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveTenderMasterDto) {
        if (saveTenderMasterDto.tndId) {
            return this.updateTender(saveTenderMasterDto);
        }
        return this.createTender(saveTenderMasterDto);
    }
    async list() {
        const records = await this.prisma.accTenderMaster.findMany({
            where: {
                tndIsDeleted: false,
            },
            include: TENDER_MASTER_NAME_INCLUDE,
            orderBy: [{ tndDisplayPosition: 'asc' }, { tndName: 'asc' }, { tndId: 'asc' }],
        });
        return records.map((record) => this.toPayload(record));
    }
    async getById(tndId) {
        const record = await this.prisma.accTenderMaster.findFirst({
            where: {
                tndId,
                tndIsDeleted: false,
            },
            include: TENDER_MASTER_NAME_INCLUDE,
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('Tender not found', 'tndId', `No active tender found with id ${tndId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(tndId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accTenderMaster.findFirst({
                where: {
                    tndId,
                    tndIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Tender not found', 'tndId', `No active tender found with id ${tndId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.accTenderMaster.updateMany({
                where: {
                    tndId,
                    tndIsDeleted: false,
                },
                data: {
                    tndIsDeleted: true,
                    tndIsActive: false,
                    tndModifiedOn: modifiedOn,
                    tndModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Tender not found', 'tndId', `No active tender found with id ${tndId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                tndIsDeleted: true,
                tndIsActive: false,
                tndModifiedOn: modifiedOn,
                tndModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: TENDER_MASTER_TABLE_NAME,
                screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: tndId,
                displayName: existing.tndName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Tender soft deleted',
            }, tx);
            return {
                tndId,
                deleted: true,
            };
        });
    }
    async createTender(saveTenderMasterDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const tndName = (0, module_service_utils_1.normalizeRequiredText)(saveTenderMasterDto.tndName, 'tndName');
                const tndShortName = this.buildShortName(saveTenderMasterDto, tndName);
                const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
                const tndBranchId = saveTenderMasterDto.tndBranchId ?? null;
                const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
                const tndMaxAmount = this.toInputNullableNumber(saveTenderMasterDto.tndMaxAmount, 'tndMaxAmount');
                this.validateAmountRange(tndMinAmount, tndMaxAmount);
                this.validateEffectiveRange(toDateOrNull(saveTenderMasterDto.tndEffectiveFrom, 'tndEffectiveFrom') ?? null, toDateOrNull(saveTenderMasterDto.tndEffectiveTo, 'tndEffectiveTo') ?? null);
                const scope = { companyId: saveTenderMasterDto.tndCompanyId, branchId: tndBranchId };
                await this.ensureCompanyExists(tx, scope.companyId);
                await this.ensureBranchExists(tx, tndBranchId);
                await this.ensureTenderTypeExists(tndTypeId, tx);
                await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx, 'tndLedgerId');
                await this.ensureLedgerExists(saveTenderMasterDto.tndSettlementLedgerId, tx, 'tndSettlementLedgerId');
                await this.ensureLedgerExists(saveTenderMasterDto.tndSurchargeLedgerId, tx, 'tndSurchargeLedgerId');
                await this.ensureBankAccountExists(tx, saveTenderMasterDto.tndBankAccountId);
                await this.ensureNameIsUnique(tx, tndName, tndShortName, scope);
                await this.ensureHotkeyIsUnique(tx, saveTenderMasterDto.tndHotkey ?? null, scope);
                await this.ensureSingleDefault(tx, saveTenderMasterDto.tndIsDefault === true, saveTenderMasterDto.tndIsActive !== false, scope);
                const now = new Date();
                const data = {
                    tndCompanyId: scope.companyId,
                    tndBranchId,
                    tndTypeId,
                    tndName,
                    tndShortName,
                    tndLedgerId: saveTenderMasterDto.tndLedgerId,
                    tndMinAmount,
                    ...this.buildOptionalData(saveTenderMasterDto),
                    tndCreatedOn: now,
                    tndCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                const created = await tx.accTenderMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: TENDER_MASTER_TABLE_NAME,
                    screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.tndId,
                    displayName: payload.tndName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Tender created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Tender already exists', [
                { field: 'tndName', message: 'Duplicate tender unique value is not allowed' },
            ]);
            throw error;
        }
    }
    async updateTender(saveTenderMasterDto) {
        const tndId = saveTenderMasterDto.tndId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accTenderMaster.findFirst({
                    where: {
                        tndId,
                        tndIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('Tender not found', 'tndId', `No active tender found with id ${tndId}`);
                }
                const tndName = (0, module_service_utils_1.normalizeRequiredText)(saveTenderMasterDto.tndName, 'tndName');
                const tndShortName = this.buildShortName(saveTenderMasterDto, tndName);
                const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
                const tndBranchId = (0, module_service_utils_1.hasOwnProperty)(saveTenderMasterDto, 'tndBranchId')
                    ? (saveTenderMasterDto.tndBranchId ?? null)
                    : existing.tndBranchId;
                const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
                const tndMaxAmount = (0, module_service_utils_1.hasOwnProperty)(saveTenderMasterDto, 'tndMaxAmount')
                    ? this.toInputNullableNumber(saveTenderMasterDto.tndMaxAmount, 'tndMaxAmount')
                    : this.toOutputNullableNumber(existing.tndMaxAmount);
                this.validateAmountRange(tndMinAmount, tndMaxAmount);
                this.validateEffectiveRange(this.resolveDate(saveTenderMasterDto, 'tndEffectiveFrom', existing.tndEffectiveFrom), this.resolveDate(saveTenderMasterDto, 'tndEffectiveTo', existing.tndEffectiveTo));
                const scope = { companyId: saveTenderMasterDto.tndCompanyId, branchId: tndBranchId };
                await this.ensureCompanyExists(tx, scope.companyId);
                await this.ensureBranchExists(tx, tndBranchId);
                await this.ensureTenderTypeExists(tndTypeId, tx);
                await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx, 'tndLedgerId');
                await this.ensureLedgerExists(saveTenderMasterDto.tndSettlementLedgerId, tx, 'tndSettlementLedgerId');
                await this.ensureLedgerExists(saveTenderMasterDto.tndSurchargeLedgerId, tx, 'tndSurchargeLedgerId');
                await this.ensureBankAccountExists(tx, saveTenderMasterDto.tndBankAccountId);
                await this.ensureNameIsUnique(tx, tndName, tndShortName, scope, tndId);
                await this.ensureHotkeyIsUnique(tx, (0, module_service_utils_1.hasOwnProperty)(saveTenderMasterDto, 'tndHotkey')
                    ? (saveTenderMasterDto.tndHotkey ?? null)
                    : existing.tndHotkey, scope, tndId);
                await this.ensureSingleDefault(tx, (0, module_service_utils_1.hasOwnProperty)(saveTenderMasterDto, 'tndIsDefault')
                    ? saveTenderMasterDto.tndIsDefault === true
                    : existing.tndIsDefault, (0, module_service_utils_1.hasOwnProperty)(saveTenderMasterDto, 'tndIsActive')
                    ? saveTenderMasterDto.tndIsActive !== false
                    : existing.tndIsActive, scope, tndId);
                const data = {
                    tndCompanyId: scope.companyId,
                    tndBranchId,
                    tndTypeId,
                    tndName,
                    tndShortName,
                    tndLedgerId: saveTenderMasterDto.tndLedgerId,
                    tndMinAmount,
                    ...this.buildOptionalData(saveTenderMasterDto),
                    tndModifiedOn: new Date(),
                    tndModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                const updated = await tx.accTenderMaster.update({
                    where: {
                        tndId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: TENDER_MASTER_TABLE_NAME,
                    screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: tndId,
                    displayName: payload.tndName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Tender updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Tender already exists', [
                { field: 'tndName', message: 'Duplicate tender unique value is not allowed' },
            ]);
            throw error;
        }
    }
    async ensureCompanyExists(tx, companyId) {
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
            (0, module_service_utils_1.throwAccountsBadRequest)('Company does not exist', [
                {
                    field: 'tndCompanyId',
                    message: `No active company found with id ${companyId}`,
                },
            ]);
        }
    }
    async ensureBranchExists(tx, branchId) {
        if (branchId === null) {
            return;
        }
        const branch = await tx.branchMaster.findFirst({
            where: {
                brId: branchId,
                brIsDeleted: false,
            },
            select: {
                brId: true,
            },
        });
        if (!branch) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Branch does not exist', [
                {
                    field: 'tndBranchId',
                    message: `No active branch found with id ${branchId}`,
                },
            ]);
        }
    }
    async ensureTenderTypeExists(typeId, tx) {
        const tenderType = await tx.accTenderType.findFirst({
            where: {
                ttmTypeId: typeId,
                ttmIsDeleted: false,
            },
            select: {
                ttmTypeId: true,
            },
        });
        if (!tenderType) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Tender type does not exist', [
                {
                    field: 'tndTypeId',
                    message: `No active tender type found with id ${typeId.toString()}`,
                },
            ]);
        }
    }
    async ensureLedgerExists(ledgerId, tx, field) {
        if (ledgerId === null || ledgerId === undefined) {
            return;
        }
        const ledger = await tx.accLedgerMaster.findFirst({
            where: {
                ledId: ledgerId,
                ledIsDeleted: false,
            },
            select: {
                ledId: true,
            },
        });
        if (!ledger) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Ledger does not exist', [
                {
                    field,
                    message: `No active account ledger found with id ${ledgerId}`,
                },
            ]);
        }
    }
    async ensureBankAccountExists(tx, bankAccountId) {
        if (bankAccountId === null || bankAccountId === undefined) {
            return;
        }
        const bankAccount = await tx.accLedgerBankAccount.findFirst({
            where: {
                lbaId: bankAccountId,
                lbaIsDeleted: false,
            },
            select: {
                lbaId: true,
            },
        });
        if (!bankAccount) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Bank account does not exist', [
                {
                    field: 'tndBankAccountId',
                    message: `No active ledger bank account found with id ${bankAccountId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, tndName, tndShortName, scope, excludeTndId) {
        const scopeWhere = {
            tndIsDeleted: false,
            tndCompanyId: scope.companyId,
            tndBranchId: scope.branchId,
            ...(excludeTndId
                ? {
                    tndId: {
                        not: excludeTndId,
                    },
                }
                : {}),
        };
        const existingName = await tx.accTenderMaster.findFirst({
            where: {
                ...scopeWhere,
                tndName: {
                    equals: tndName,
                    mode: 'insensitive',
                },
            },
            select: {
                tndId: true,
            },
        });
        if (existingName) {
            (0, module_service_utils_1.throwAccountsConflict)('Tender name already exists for this company and branch', [{ field: 'tndName', message: 'Duplicate tndName is not allowed for this company/branch' }]);
        }
        const existingShortName = await tx.accTenderMaster.findFirst({
            where: {
                ...scopeWhere,
                tndShortName: {
                    equals: tndShortName,
                    mode: 'insensitive',
                },
            },
            select: {
                tndId: true,
            },
        });
        if (existingShortName) {
            (0, module_service_utils_1.throwAccountsConflict)('Tender short name already exists for this company and branch', [
                {
                    field: 'tndShortName',
                    message: 'Duplicate tndShortName is not allowed for this company/branch',
                },
            ]);
        }
    }
    async ensureHotkeyIsUnique(tx, tndHotkey, scope, excludeTndId) {
        if (tndHotkey === null) {
            return;
        }
        const existing = await tx.accTenderMaster.findFirst({
            where: {
                tndIsDeleted: false,
                tndCompanyId: scope.companyId,
                tndBranchId: scope.branchId,
                tndHotkey,
                ...(excludeTndId ? { tndId: { not: excludeTndId } } : {}),
            },
            select: {
                tndId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('Tender hotkey already exists for this company and branch', [
                {
                    field: 'tndHotkey',
                    message: 'Duplicate tndHotkey is not allowed for this company/branch',
                },
            ]);
        }
    }
    async ensureSingleDefault(tx, tndIsDefault, tndIsActive, scope, excludeTndId) {
        if (!tndIsDefault || !tndIsActive) {
            return;
        }
        const existing = await tx.accTenderMaster.findFirst({
            where: {
                tndIsDeleted: false,
                tndIsActive: true,
                tndIsDefault: true,
                tndCompanyId: scope.companyId,
                tndBranchId: scope.branchId,
                ...(excludeTndId ? { tndId: { not: excludeTndId } } : {}),
            },
            select: {
                tndId: true,
                tndName: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('A default tender already exists for this company and branch', [
                {
                    field: 'tndIsDefault',
                    message: `${existing.tndName} is already the default tender for this company/branch`,
                },
            ]);
        }
    }
    validateAmountRange(tndMinAmount, tndMaxAmount) {
        if (tndMaxAmount === null || tndMaxAmount === undefined) {
            return;
        }
        if (tndMaxAmount < tndMinAmount) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'tndMaxAmount',
                    message: 'tndMaxAmount must be greater than or equal to tndMinAmount',
                },
            ]);
        }
    }
    validateEffectiveRange(tndEffectiveFrom, tndEffectiveTo) {
        if (tndEffectiveFrom === null || tndEffectiveTo === null) {
            return;
        }
        if (tndEffectiveTo.getTime() < tndEffectiveFrom.getTime()) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'tndEffectiveTo',
                    message: 'tndEffectiveTo must be on or after tndEffectiveFrom',
                },
            ]);
        }
    }
    resolveDate(saveTenderMasterDto, field, current) {
        if (!(0, module_service_utils_1.hasOwnProperty)(saveTenderMasterDto, field)) {
            return current;
        }
        return toDateOrNull(saveTenderMasterDto[field], field) ?? null;
    }
    buildOptionalData(saveTenderMasterDto) {
        const data = {};
        (0, module_service_utils_1.applyPresentFields)(data, saveTenderMasterDto, TENDER_MASTER_OPTIONAL_FIELDS, TENDER_MASTER_FIELD_TRANSFORMS);
        return data;
    }
    parseTenderTypeId(value, field) {
        const normalized = value.trim();
        if (!/^\d+$/.test(normalized)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid numeric identifier`,
                },
            ]);
        }
        const parsed = Number(normalized);
        if (!Number.isSafeInteger(parsed) || parsed > 2147483647) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid numeric identifier`,
                },
            ]);
        }
        return parsed;
    }
    toInputNumber(value, field) {
        if (!Number.isFinite(value)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a finite number`,
                },
            ]);
        }
        return value;
    }
    toInputNullableNumber(value, field) {
        if (value === null || value === undefined) {
            return value;
        }
        return this.toInputNumber(value, field);
    }
    buildShortName(saveTenderMasterDto, tndName) {
        const provided = saveTenderMasterDto.tndShortName?.trim();
        return (provided || tndName).slice(0, TENDER_SHORT_NAME_MAX_LENGTH);
    }
    toOutputNumber(value) {
        if (typeof value === 'number') {
            return value;
        }
        return Number(value.toString());
    }
    toOutputNullableNumber(value) {
        return value === null ? null : this.toOutputNumber(value);
    }
    toOutputDateOnly(value) {
        return value === null ? null : value.toISOString().slice(0, 10);
    }
    toPayload(record) {
        return {
            tndId: record.tndId,
            tndCompanyId: record.tndCompanyId,
            tndBranchId: record.tndBranchId,
            tndTypeId: record.tndTypeId.toString(),
            tndName: record.tndName,
            tndShortName: record.tndShortName,
            tndLedgerId: record.tndLedgerId,
            tndSettlementLedgerId: record.tndSettlementLedgerId,
            tndCompanyName: record.company?.compName ?? null,
            tndBranchName: record.branch?.brName ?? null,
            tndTypeName: record.tenderType?.ttmTypeName ?? null,
            tndLedgerName: record.ledger?.ledName ?? null,
            tndSurchargeLedgerName: record.surchargeLedger?.ledName ?? null,
            tndSettlementDays: record.tndSettlementDays,
            tndBankAccountId: record.tndBankAccountId,
            tndMinAmount: this.toOutputNumber(record.tndMinAmount),
            tndMaxAmount: this.toOutputNullableNumber(record.tndMaxAmount),
            tndDailyLimit: this.toOutputNullableNumber(record.tndDailyLimit),
            tndSurchargePerc: this.toOutputNumber(record.tndSurchargePerc),
            tndSurchargeAmount: this.toOutputNumber(record.tndSurchargeAmount),
            tndSurchargeLedgerId: record.tndSurchargeLedgerId,
            tndEditSurcharge: record.tndEditSurcharge,
            tndEditLedger: record.tndEditLedger,
            tndUpiVpa: record.tndUpiVpa,
            tndUpiQrPayload: record.tndUpiQrPayload,
            tndMerchantId: record.tndMerchantId,
            tndTerminalId: record.tndTerminalId,
            tndConversionRate: this.toOutputNumber(record.tndConversionRate),
            tndNeedsRef: record.tndNeedsRef,
            tndAllowChange: record.tndAllowChange,
            tndAllowInReturn: record.tndAllowInReturn,
            tndOpenCashDrawer: record.tndOpenCashDrawer,
            tndIsDefault: record.tndIsDefault,
            tndDisplayPosition: record.tndDisplayPosition,
            tndHotkey: record.tndHotkey,
            tndColour: record.tndColour,
            tndEffectiveFrom: this.toOutputDateOnly(record.tndEffectiveFrom),
            tndEffectiveTo: this.toOutputDateOnly(record.tndEffectiveTo),
            tndRemarks: record.tndRemarks,
            tndIsActive: record.tndIsActive,
            tndIsDeleted: record.tndIsDeleted,
            tndSyncDate: record.tndSyncDate ? record.tndSyncDate.toISOString() : null,
            tndCreatedOn: record.tndCreatedOn.toISOString(),
            tndCreatedBy: record.tndCreatedBy,
            tndModifiedOn: record.tndModifiedOn ? record.tndModifiedOn.toISOString() : null,
            tndModifiedBy: record.tndModifiedBy,
        };
    }
};
exports.TenderMasterService = TenderMasterService;
exports.TenderMasterService = TenderMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], TenderMasterService);
//# sourceMappingURL=tender-master.service.js.map