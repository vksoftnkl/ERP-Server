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
exports.AccountLedgerMastersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ACCOUNT_LEDGER_MASTER_TABLE_NAME = 'acc_ledger_master';
const ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME = 'Account Ledger Master';
const LEDGER_BANK_ACCOUNT_TABLE_NAME = 'acc_ledger_bank_accounts';
const LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME = 'Ledger Bank Account';
const LEDGER_BANK_ACCOUNT_ORDER_BY = [
    { lbaIsDefault: 'desc' },
    { lbaCreatedOn: 'asc' },
];
const ACCOUNT_LEDGER_MASTER_RELATIONS = {
    company: { select: { compName: true } },
    branches: { select: { brName: true } },
    accountGroup: { select: { accGroupName: true, accLedgerProfile: true } },
    bankAccounts: {
        where: { lbaIsDeleted: false },
        orderBy: LEDGER_BANK_ACCOUNT_ORDER_BY,
    },
};
let AccountLedgerMastersService = class AccountLedgerMastersService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveAccountLedgerMasterDto) {
        if (saveAccountLedgerMasterDto.ledId) {
            return this.updateLedger(saveAccountLedgerMasterDto);
        }
        return this.createLedger(saveAccountLedgerMasterDto);
    }
    async saveMany(saveAccountLedgerMasterDtos) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const results = [];
                for (const dto of saveAccountLedgerMasterDtos) {
                    const payload = dto.ledId
                        ? await this.updateLedgerWithinTx(dto, tx)
                        : await this.createLedgerWithinTx(dto, tx);
                    results.push(payload);
                }
                return results;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account ledger already exists', [{ field: 'ledName', message: 'Duplicate ledName is not allowed' }]);
            throw error;
        }
    }
    async get(params = {}) {
        const { ledId } = params;
        if (ledId) {
            const record = await this.prisma.accLedgerMaster.findFirst({
                where: { ledId, ledIsDeleted: false },
                include: ACCOUNT_LEDGER_MASTER_RELATIONS,
            });
            if (!record) {
                (0, module_service_utils_1.throwAccountsNotFound)('Account ledger not found', 'ledId', `No active account ledger found with id ${ledId}`);
            }
            return this.toPayload(record);
        }
        const where = { ledIsDeleted: false };
        const [records, total] = await Promise.all([
            this.prisma.accLedgerMaster.findMany({
                where,
                orderBy: { ledName: 'asc' },
                include: ACCOUNT_LEDGER_MASTER_RELATIONS,
            }),
            this.prisma.accLedgerMaster.count({ where }),
        ]);
        return { data: records.map((r) => this.toPayload(r)), total };
    }
    async softDelete(ledId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accLedgerMaster.findFirst({
                where: {
                    ledId,
                    ledIsDeleted: false,
                },
                include: ACCOUNT_LEDGER_MASTER_RELATIONS,
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Account ledger not found', 'ledId', `No active account ledger found with id ${ledId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.accLedgerMaster.updateMany({
                where: {
                    ledId,
                    ledIsDeleted: false,
                },
                data: {
                    ledIsDeleted: true,
                    ledIsActive: false,
                    ledModifiedOn: modifiedOn,
                    ledModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Account ledger not found', 'ledId', `No active account ledger found with id ${ledId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                ledIsDeleted: true,
                ledIsActive: false,
                ledModifiedOn: modifiedOn,
                ledModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
                screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: ledId,
                displayName: existing.ledName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Account ledger soft deleted',
            }, tx);
            return {
                ledId,
                deleted: true,
            };
        });
    }
    async createLedger(saveAccountLedgerMasterDto) {
        try {
            return await this.prisma.$transaction((tx) => this.createLedgerWithinTx(saveAccountLedgerMasterDto, tx));
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account ledger already exists', [{ field: 'ledName', message: 'Duplicate ledName is not allowed' }]);
            throw error;
        }
    }
    async createLedgerWithinTx(saveAccountLedgerMasterDto, tx) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAccountLedgerMasterDto.ledName, 'ledName');
        await this.ensureGroupExists(saveAccountLedgerMasterDto.ledGroupId, tx);
        const companyId = saveAccountLedgerMasterDto.ledCompanyId ?? null;
        const branchId = saveAccountLedgerMasterDto.ledBranchId ?? null;
        const groupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        const now = new Date();
        const createdBy = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const data = {
            ledCompanyId: companyId,
            ledBranchId: branchId,
            ledGroupId: groupId,
            ledName: normalizedName,
            ledLedgerType: 'PARTY',
            ledCreatedOn: now,
            ledCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveAccountLedgerMasterDto);
        const created = await tx.accLedgerMaster.create({
            data,
            include: ACCOUNT_LEDGER_MASTER_RELATIONS,
        });
        await this.syncBankAccounts(tx, created.ledId, created.ledCompanyId, saveAccountLedgerMasterDto.ledgerBankAccount);
        const bankAccounts = await this.loadBankAccounts(tx, created.ledId);
        const payload = this.toPayload({ ...created, bankAccounts });
        await this.auditLogService.logEntityChange({
            action: 'New',
            tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
            screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ledId,
            displayName: payload.ledName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            notes: 'Account ledger created',
        }, tx);
        return payload;
    }
    async updateLedger(saveAccountLedgerMasterDto) {
        try {
            return await this.prisma.$transaction((tx) => this.updateLedgerWithinTx(saveAccountLedgerMasterDto, tx));
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Account ledger already exists', [{ field: 'ledName', message: 'Duplicate ledName is not allowed' }]);
            throw error;
        }
    }
    async updateLedgerWithinTx(saveAccountLedgerMasterDto, tx) {
        const ledId = saveAccountLedgerMasterDto.ledId;
        const existing = await tx.accLedgerMaster.findFirst({
            where: {
                ledId,
                ledIsDeleted: false,
            },
            include: ACCOUNT_LEDGER_MASTER_RELATIONS,
        });
        if (!existing) {
            (0, module_service_utils_1.throwAccountsNotFound)('Account ledger not found', 'ledId', `No active account ledger found with id ${ledId}`);
        }
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveAccountLedgerMasterDto.ledName, 'ledName');
        const nextGroupId = saveAccountLedgerMasterDto.ledGroupId;
        await this.ensureGroupExists(nextGroupId, tx);
        const nextCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledCompanyId')
            ? (saveAccountLedgerMasterDto.ledCompanyId ?? null)
            : existing.ledCompanyId;
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, ledId);
        const data = {
            ledBranchId: saveAccountLedgerMasterDto.ledBranchId,
            ledGroupId: nextGroupId,
            ledName: normalizedName,
            ledModifiedOn: new Date(),
            ledModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveAccountLedgerMasterDto);
        const updated = await tx.accLedgerMaster.update({
            where: {
                ledId,
            },
            data,
            include: ACCOUNT_LEDGER_MASTER_RELATIONS,
        });
        await this.syncBankAccounts(tx, ledId, updated.ledCompanyId, saveAccountLedgerMasterDto.ledgerBankAccount);
        const bankAccounts = await this.loadBankAccounts(tx, ledId);
        const payload = this.toPayload({ ...updated, bankAccounts });
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: ACCOUNT_LEDGER_MASTER_TABLE_NAME,
            screenName: ACCOUNT_LEDGER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ledId,
            displayName: payload.ledName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            notes: 'Account ledger updated',
        }, tx);
        return payload;
    }
    async ensureGroupExists(groupId, tx) {
        const group = await tx.accountGroup.findFirst({
            where: {
                accGroupId: groupId,
                accGroupIsDeleted: false,
            },
            select: {
                accGroupId: true,
            },
        });
        if (!group) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Account group does not exist', [
                {
                    field: 'ledGroupId',
                    message: `No active account group found with id ${groupId}`,
                },
            ]);
        }
    }
    async ensureNameIsUnique(tx, ledgerName, companyId, excludeId) {
        const existing = await tx.accLedgerMaster.findFirst({
            where: {
                ledIsDeleted: false,
                ledCompanyId: companyId,
                ledName: {
                    equals: ledgerName,
                    mode: 'insensitive',
                },
                ...(excludeId
                    ? {
                        ledId: {
                            not: excludeId,
                        },
                    }
                    : {}),
            },
            select: {
                ledId: true,
            },
        });
        if (existing) {
            (0, module_service_utils_1.throwAccountsConflict)('Account ledger name already exists for this company', [{ field: 'ledName', message: 'Duplicate ledName is not allowed for this company' }]);
        }
    }
    applyOptionalFields(data, saveAccountLedgerMasterDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledCompanyId')) {
            data.ledCompanyId = saveAccountLedgerMasterDto.ledCompanyId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledBranchId')) {
            data.ledBranchId = saveAccountLedgerMasterDto.ledBranchId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAlias')) {
            data.ledAlias = saveAccountLedgerMasterDto.ledAlias;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledShort')) {
            data.ledShort = saveAccountLedgerMasterDto.ledShort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTallyName')) {
            data.ledTallyName = saveAccountLedgerMasterDto.ledTallyName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTallyGroupName')) {
            data.ledTallyGroupName = saveAccountLedgerMasterDto.ledTallyGroupName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTallyGuid')) {
            data.ledTallyGuid = saveAccountLedgerMasterDto.ledTallyGuid;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledCategory')) {
            data.ledCategory = saveAccountLedgerMasterDto.ledCategory;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledLedgerType')) {
            data.ledLedgerType = saveAccountLedgerMasterDto.ledLedgerType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledMailingName')) {
            data.ledMailingName = saveAccountLedgerMasterDto.ledMailingName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsBillByBill')) {
            data.ledIsBillByBill = saveAccountLedgerMasterDto.ledIsBillByBill;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsCostCenterReq')) {
            data.ledIsCostCenterReq = saveAccountLedgerMasterDto.ledIsCostCenterReq;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsInterestApplicable')) {
            data.ledIsInterestApplicable = saveAccountLedgerMasterDto.ledIsInterestApplicable;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledInterestRate')) {
            data.ledInterestRate = saveAccountLedgerMasterDto.ledInterestRate;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledContactPerson')) {
            data.ledContactPerson = saveAccountLedgerMasterDto.ledContactPerson;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledEmail')) {
            data.ledEmail = saveAccountLedgerMasterDto.ledEmail;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTel')) {
            data.ledTel = saveAccountLedgerMasterDto.ledTel;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledPhone1')) {
            data.ledPhone1 = saveAccountLedgerMasterDto.ledPhone1;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledPhone2')) {
            data.ledPhone2 = saveAccountLedgerMasterDto.ledPhone2;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledWhatsappNo')) {
            data.ledWhatsappNo = saveAccountLedgerMasterDto.ledWhatsappNo;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAddr1')) {
            data.ledAddr1 = saveAccountLedgerMasterDto.ledAddr1;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAddr2')) {
            data.ledAddr2 = saveAccountLedgerMasterDto.ledAddr2;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAddr3')) {
            data.ledAddr3 = saveAccountLedgerMasterDto.ledAddr3;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledCity')) {
            data.ledCity = saveAccountLedgerMasterDto.ledCity;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledDistrict')) {
            data.ledDistrict = saveAccountLedgerMasterDto.ledDistrict;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledStateName')) {
            data.ledStateName = saveAccountLedgerMasterDto.ledStateName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledStateCode')) {
            data.ledStateCode = saveAccountLedgerMasterDto.ledStateCode;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledPin')) {
            data.ledPin = saveAccountLedgerMasterDto.ledPin;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledCountry')) {
            data.ledCountry = saveAccountLedgerMasterDto.ledCountry;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionName')) {
            data.ledRegionName = saveAccountLedgerMasterDto.ledRegionName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionAddr1')) {
            data.ledRegionAddr1 = saveAccountLedgerMasterDto.ledRegionAddr1;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionAddr2')) {
            data.ledRegionAddr2 = saveAccountLedgerMasterDto.ledRegionAddr2;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionAddr3')) {
            data.ledRegionAddr3 = saveAccountLedgerMasterDto.ledRegionAddr3;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionCity')) {
            data.ledRegionCity = saveAccountLedgerMasterDto.ledRegionCity;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionDistrict')) {
            data.ledRegionDistrict = saveAccountLedgerMasterDto.ledRegionDistrict;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionStateName')) {
            data.ledRegionStateName = saveAccountLedgerMasterDto.ledRegionStateName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRegionCountry')) {
            data.ledRegionCountry = saveAccountLedgerMasterDto.ledRegionCountry;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledGstPartyRegType')) {
            data.ledGstPartyRegType = saveAccountLedgerMasterDto.ledGstPartyRegType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledGstinNo')) {
            data.ledGstinNo = saveAccountLedgerMasterDto.ledGstinNo;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledPanNo')) {
            data.ledPanNo = saveAccountLedgerMasterDto.ledPanNo;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAadharNo')) {
            data.ledAadharNo = saveAccountLedgerMasterDto.ledAadharNo;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledEcommerceGstin')) {
            data.ledEcommerceGstin = saveAccountLedgerMasterDto.ledEcommerceGstin;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsSez')) {
            data.ledIsSez = saveAccountLedgerMasterDto.ledIsSez;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTypeOfSupply')) {
            data.ledTypeOfSupply = saveAccountLedgerMasterDto.ledTypeOfSupply;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledHsnSac')) {
            data.ledHsnSac = saveAccountLedgerMasterDto.ledHsnSac;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledGstRate')) {
            data.ledGstRate = saveAccountLedgerMasterDto.ledGstRate;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTaxability')) {
            data.ledTaxability = saveAccountLedgerMasterDto.ledTaxability;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledGstPartyType')) {
            data.ledGstPartyType = saveAccountLedgerMasterDto.ledGstPartyType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTanNo')) {
            data.ledTanNo = saveAccountLedgerMasterDto.ledTanNo;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledCin')) {
            data.ledCin = saveAccountLedgerMasterDto.ledCin;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledUdyamNo')) {
            data.ledUdyamNo = saveAccountLedgerMasterDto.ledUdyamNo;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledMsmeType')) {
            data.ledMsmeType = saveAccountLedgerMasterDto.ledMsmeType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledGstDutyHead')) {
            data.ledGstDutyHead = saveAccountLedgerMasterDto.ledGstDutyHead;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTaxRate')) {
            data.ledTaxRate = saveAccountLedgerMasterDto.ledTaxRate;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRoundingMethod')) {
            data.ledRoundingMethod = saveAccountLedgerMasterDto.ledRoundingMethod;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRoundingLimit')) {
            data.ledRoundingLimit = saveAccountLedgerMasterDto.ledRoundingLimit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsTdsApplicable')) {
            data.ledIsTdsApplicable = saveAccountLedgerMasterDto.ledIsTdsApplicable;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTdsDeducteeType')) {
            data.ledTdsDeducteeType = saveAccountLedgerMasterDto.ledTdsDeducteeType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTdsNatureOfPayment')) {
            data.ledTdsNatureOfPayment = saveAccountLedgerMasterDto.ledTdsNatureOfPayment;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsTcsApplicable')) {
            data.ledIsTcsApplicable = saveAccountLedgerMasterDto.ledIsTcsApplicable;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledObAmount')) {
            data.ledObAmount = saveAccountLedgerMasterDto.ledObAmount;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledObType')) {
            data.ledObType = saveAccountLedgerMasterDto.ledObType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledObAsOn')) {
            data.ledObAsOn = saveAccountLedgerMasterDto.ledObAsOn;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTotalDr')) {
            data.ledTotalDr = saveAccountLedgerMasterDto.ledTotalDr;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTotalCr')) {
            data.ledTotalCr = saveAccountLedgerMasterDto.ledTotalCr;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledTotalBalance')) {
            data.ledTotalBalance = saveAccountLedgerMasterDto.ledTotalBalance;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledSortOrder')) {
            data.ledSortOrder = saveAccountLedgerMasterDto.ledSortOrder;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsActive')) {
            data.ledIsActive = saveAccountLedgerMasterDto.ledIsActive;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAllowEdit')) {
            data.ledAllowEdit = saveAccountLedgerMasterDto.ledAllowEdit;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledIsEntry')) {
            data.ledIsEntry = saveAccountLedgerMasterDto.ledIsEntry;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledAllowSms')) {
            data.ledAllowSms = saveAccountLedgerMasterDto.ledAllowSms;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveAccountLedgerMasterDto, 'ledRemarks')) {
            data.ledRemarks = saveAccountLedgerMasterDto.ledRemarks;
        }
    }
    toPayload(record) {
        return {
            ledId: record.ledId,
            ledCompanyId: record.ledCompanyId,
            ledCompanyName: record.company?.compName ?? null,
            ledBranchId: record.ledBranchId,
            ledBranchName: record.branches?.brName ?? null,
            ledGroupId: record.ledGroupId,
            ledGroupName: record.accountGroup?.accGroupName ?? null,
            ledGroupLedgerProfile: record.accountGroup?.accLedgerProfile ?? null,
            ledName: record.ledName,
            ledAlias: record.ledAlias,
            ledShort: record.ledShort,
            ledTallyName: record.ledTallyName,
            ledTallyGroupName: record.ledTallyGroupName,
            ledTallyGuid: record.ledTallyGuid,
            ledTallyMasterId: record.ledTallyMasterId?.toString() ?? null,
            ledTallyAlterId: record.ledTallyAlterId?.toString() ?? null,
            ledCategory: record.ledCategory,
            ledLedgerType: record.ledLedgerType,
            ledMailingName: record.ledMailingName,
            ledIsBillByBill: record.ledIsBillByBill,
            ledIsCostCenterReq: record.ledIsCostCenterReq,
            ledIsInterestApplicable: record.ledIsInterestApplicable,
            ledInterestRate: (0, module_service_utils_1.toNullableNumber)(record.ledInterestRate),
            ledContactPerson: record.ledContactPerson,
            ledEmail: record.ledEmail,
            ledTel: record.ledTel,
            ledPhone1: record.ledPhone1,
            ledPhone2: record.ledPhone2,
            ledWhatsappNo: record.ledWhatsappNo,
            ledAddr1: record.ledAddr1,
            ledAddr2: record.ledAddr2,
            ledAddr3: record.ledAddr3,
            ledCity: record.ledCity,
            ledDistrict: record.ledDistrict,
            ledStateName: record.ledStateName,
            ledStateCode: record.ledStateCode,
            ledPin: record.ledPin,
            ledCountry: record.ledCountry,
            ledRegionName: record.ledRegionName,
            ledRegionAddr1: record.ledRegionAddr1,
            ledRegionAddr2: record.ledRegionAddr2,
            ledRegionAddr3: record.ledRegionAddr3,
            ledRegionCity: record.ledRegionCity,
            ledRegionDistrict: record.ledRegionDistrict,
            ledRegionStateName: record.ledRegionStateName,
            ledRegionCountry: record.ledRegionCountry,
            ledGstPartyRegType: record.ledGstPartyRegType,
            ledGstinNo: record.ledGstinNo,
            ledPanNo: record.ledPanNo,
            ledAadharNo: record.ledAadharNo,
            ledEcommerceGstin: record.ledEcommerceGstin,
            ledIsSez: record.ledIsSez,
            ledTypeOfSupply: record.ledTypeOfSupply,
            ledHsnSac: record.ledHsnSac,
            ledGstRate: (0, module_service_utils_1.toNullableNumber)(record.ledGstRate),
            ledTaxability: record.ledTaxability,
            ledGstPartyType: record.ledGstPartyType,
            ledTanNo: record.ledTanNo,
            ledCin: record.ledCin,
            ledUdyamNo: record.ledUdyamNo,
            ledMsmeType: record.ledMsmeType,
            ledGstDutyHead: record.ledGstDutyHead,
            ledTaxRate: (0, module_service_utils_1.toNullableNumber)(record.ledTaxRate),
            ledRoundingMethod: record.ledRoundingMethod,
            ledRoundingLimit: (0, module_service_utils_1.toNullableNumber)(record.ledRoundingLimit),
            ledIsTdsApplicable: record.ledIsTdsApplicable,
            ledTdsDeducteeType: record.ledTdsDeducteeType,
            ledTdsNatureOfPayment: record.ledTdsNatureOfPayment,
            ledIsTcsApplicable: record.ledIsTcsApplicable,
            ledObAmount: (0, module_service_utils_1.toNumber)(record.ledObAmount),
            ledObType: record.ledObType,
            ledObAsOn: record.ledObAsOn ? record.ledObAsOn.toISOString() : null,
            ledTotalDr: (0, module_service_utils_1.toNumber)(record.ledTotalDr),
            ledTotalCr: (0, module_service_utils_1.toNumber)(record.ledTotalCr),
            ledTotalBalance: (0, module_service_utils_1.toNumber)(record.ledTotalBalance),
            ledSortOrder: record.ledSortOrder,
            ledIsActive: record.ledIsActive,
            ledIsDeleted: record.ledIsDeleted,
            ledAllowEdit: record.ledAllowEdit,
            ledIsEntry: record.ledIsEntry,
            ledAllowSms: record.ledAllowSms,
            ledRemarks: record.ledRemarks,
            ledSyncDate: record.ledSyncDate ? record.ledSyncDate.toISOString() : null,
            ledCreatedOn: record.ledCreatedOn.toISOString(),
            ledCreatedBy: record.ledCreatedBy,
            ledModifiedOn: record.ledModifiedOn.toISOString(),
            ledModifiedBy: record.ledModifiedBy,
            ledgerBankAccount: record.bankAccounts.map((account) => this.toBankAccountPayload(account)),
        };
    }
    async getBankAccounts(params) {
        const { lbaId, ledId } = params;
        if (lbaId) {
            const record = await this.prisma.accLedgerBankAccount.findFirst({
                where: { lbaId, lbaIsDeleted: false },
            });
            if (!record) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
            }
            return this.toBankAccountPayload(record);
        }
        if (ledId) {
            const ledger = await this.prisma.accLedgerMaster.findFirst({
                where: { ledId, ledIsDeleted: false },
                select: { ledId: true },
            });
            if (!ledger) {
                (0, module_service_utils_1.throwAccountsNotFound)('Account ledger not found', 'ledId', `No active account ledger found with id ${ledId}`);
            }
            const where = {
                lbaLedgerId: ledId,
                lbaIsDeleted: false,
            };
            const [records, total] = await Promise.all([
                this.prisma.accLedgerBankAccount.findMany({
                    where,
                    orderBy: LEDGER_BANK_ACCOUNT_ORDER_BY,
                }),
                this.prisma.accLedgerBankAccount.count({ where }),
            ]);
            return { data: records.map((r) => this.toBankAccountPayload(r)), total };
        }
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field: 'ledId', message: 'Provide either lbaId or ledId' },
        ]);
    }
    async deleteBankAccountById(lbaId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accLedgerBankAccount.findFirst({
                where: { lbaId, lbaIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
            }
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.accLedgerBankAccount.updateMany({
                where: { lbaId, lbaIsDeleted: false },
                data: {
                    lbaIsDeleted: true,
                    lbaIsActive: false,
                    lbaModifiedOn: modifiedOn,
                    lbaModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger bank account not found', 'lbaId', `No active ledger bank account found with id ${lbaId}`);
            }
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LEDGER_BANK_ACCOUNT_TABLE_NAME,
                screenName: LEDGER_BANK_ACCOUNT_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: lbaId,
                displayName: existing.lbaAccountHolder,
                originalRecord: this.toBankAccountPayload(existing),
                modifiedRecord: this.toBankAccountPayload({
                    ...existing,
                    lbaIsDeleted: true,
                    lbaIsActive: false,
                    lbaIsDefault: false,
                    lbaModifiedOn: modifiedOn,
                    lbaModifiedBy: actor,
                }),
                userId: actor,
                notes: 'Ledger bank account soft deleted',
            }, tx);
            return { lbaId, deleted: true };
        });
    }
    async syncBankAccounts(tx, ledId, ledCompanyId, items) {
        if (!items || items.length === 0) {
            return;
        }
        this.assertSingleDefault(items);
        const now = new Date();
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        if (items.some((item) => item.lbaIsDefault === true)) {
            await this.clearDefaultBankAccounts(tx, ledId);
        }
        for (const item of items) {
            const accountHolder = (0, module_service_utils_1.normalizeRequiredText)(item.lbaAccountHolder, 'lbaAccountHolder');
            const bankName = (0, module_service_utils_1.normalizeRequiredText)(item.lbaBankName, 'lbaBankName');
            const accountNo = (0, module_service_utils_1.normalizeRequiredText)(item.lbaAccountNo, 'lbaAccountNo');
            if (item.lbaId) {
                const existing = await tx.accLedgerBankAccount.findFirst({
                    where: { lbaId: item.lbaId, lbaLedgerId: ledId, lbaIsDeleted: false },
                    select: { lbaId: true },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Ledger bank account does not exist', [
                        {
                            field: 'lbaId',
                            message: `No active bank account ${item.lbaId} found for this ledger`,
                        },
                    ]);
                }
                await this.ensureBankAccountNumberIsUnique(tx, ledId, accountNo, item.lbaId);
                const data = {
                    lbaCompanyId: ledCompanyId,
                    lbaLedgerId: ledId,
                    lbaAccountHolder: accountHolder,
                    lbaBankName: bankName,
                    lbaAccountNo: accountNo,
                    lbaModifiedOn: now,
                    lbaModifiedBy: actor,
                };
                this.applyBankAccountOptionalFields(data, item);
                await tx.accLedgerBankAccount.update({ where: { lbaId: item.lbaId }, data });
            }
            else {
                await this.ensureBankAccountNumberIsUnique(tx, ledId, accountNo);
                const data = {
                    lbaCompanyId: ledCompanyId,
                    lbaLedgerId: ledId,
                    lbaAccountHolder: accountHolder,
                    lbaBankName: bankName,
                    lbaAccountNo: accountNo,
                    lbaCreatedOn: now,
                    lbaCreatedBy: actor,
                };
                this.applyBankAccountOptionalFields(data, item);
                await tx.accLedgerBankAccount.create({ data });
            }
        }
    }
    assertSingleDefault(items) {
        const defaults = items.filter((item) => item.lbaIsDefault === true);
        if (defaults.length > 1) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'lbaIsDefault',
                    message: 'Only one bank account can be marked as default per ledger',
                },
            ]);
        }
    }
    async clearDefaultBankAccounts(tx, ledId) {
        await tx.accLedgerBankAccount.updateMany({
            where: { lbaLedgerId: ledId, lbaIsDeleted: false, lbaIsDefault: true },
            data: {
                lbaIsDefault: false,
                lbaModifiedOn: new Date(),
                lbaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            },
        });
    }
    async ensureBankAccountNumberIsUnique(tx, ledId, accountNo, excludeLbaId) {
        const existing = await tx.accLedgerBankAccount.findFirst({
            where: {
                lbaIsDeleted: false,
                lbaLedgerId: ledId,
                lbaAccountNo: { equals: accountNo, mode: 'insensitive' },
                ...(excludeLbaId ? { lbaId: { not: excludeLbaId } } : {}),
            },
            select: { lbaId: true },
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
    applyBankAccountOptionalFields(data, item) {
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaBranchName')) {
            data.lbaBranchName = item.lbaBranchName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaIfscCode')) {
            data.lbaIfscCode = item.lbaIfscCode;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaMicrCode')) {
            data.lbaMicrCode = item.lbaMicrCode;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaAccountType')) {
            data.lbaAccountType = item.lbaAccountType;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaUpiId')) {
            data.lbaUpiId = item.lbaUpiId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaChequeName')) {
            data.lbaChequeName = item.lbaChequeName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaIsDefault')) {
            data.lbaIsDefault = item.lbaIsDefault;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaIsActive')) {
            data.lbaIsActive = item.lbaIsActive;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(item, 'lbaRemarks')) {
            data.lbaRemarks = item.lbaRemarks;
        }
    }
    loadBankAccounts(tx, ledId) {
        return tx.accLedgerBankAccount.findMany({
            where: { lbaLedgerId: ledId, lbaIsDeleted: false },
            orderBy: LEDGER_BANK_ACCOUNT_ORDER_BY,
        });
    }
    async listBankAccountPayloads(ledId, client = this.prisma) {
        const records = await this.loadBankAccounts(client, ledId);
        return records.map((record) => this.toBankAccountPayload(record));
    }
    toBankAccountPayload(record) {
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
exports.AccountLedgerMastersService = AccountLedgerMastersService;
exports.AccountLedgerMastersService = AccountLedgerMastersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], AccountLedgerMastersService);
//# sourceMappingURL=account-ledger-masters.service.js.map