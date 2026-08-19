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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const account_ledger_masters_service_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const SUPPLIER_TABLE_NAME = 'suppliers';
const SUPPLIER_AUDIT_SCREEN_NAME = 'Supplier Master';
const SUPPLIER_LINKED_LEDGER_GROUP_ID = '019f081c-98cc-757a-9346-4cfba810c47f';
const SUPPLIER_TO_LEDGER_FIELD_MAP = [
    ['supCompanyId', 'ledCompanyId'],
    ['supBranchId', 'ledBranchId'],
    ['supShort', 'ledShort'],
    ['supMailId', 'ledEmail'],
    ['supTel', 'ledTel'],
    ['supPhone', 'ledPhone1'],
    ['supWhatsappNo', 'ledWhatsappNo'],
    ['supAddr1', 'ledAddr1'],
    ['supAddr2', 'ledAddr2'],
    ['supAddr3', 'ledAddr3'],
    ['supCity', 'ledCity'],
    ['supDistrict', 'ledDistrict'],
    ['supPincode', 'ledPin'],
    ['supCountry', 'ledCountry'],
    ['supRegionName', 'ledRegionName'],
    ['supRegionAddr1', 'ledRegionAddr1'],
    ['supRegionAddr2', 'ledRegionAddr2'],
    ['supRegionAddr3', 'ledRegionAddr3'],
    ['supRegionCity', 'ledRegionCity'],
    ['supRegionDistrict', 'ledRegionDistrict'],
    ['supRegionStateName', 'ledRegionStateName'],
    ['supRegionCountry', 'ledRegionCountry'],
    ['supGstNo', 'ledGstinNo'],
    ['supPanNo', 'ledPanNo'],
    ['supNotes', 'ledRemarks'],
    ['supIsActive', 'ledIsActive'],
];
let SuppliersService = class SuppliersService {
    prisma;
    auditLogService;
    requestContextService;
    accountLedgerMastersService;
    constructor(prisma, auditLogService, requestContextService, accountLedgerMastersService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.accountLedgerMastersService = accountLedgerMastersService;
    }
    async save(saveSupplierDto) {
        if (saveSupplierDto.supId) {
            return this.updateSupplier(saveSupplierDto);
        }
        return this.createSupplier(saveSupplierDto);
    }
    async getById(supId) {
        const record = await this.prisma.supplier.findFirst({
            where: { supId, supIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
        }
        const [relatedNames, ledgerBankAccount] = await Promise.all([
            this.resolveRelatedNames(this.prisma, record),
            this.accountLedgerMastersService.listBankAccountPayloads(record.supId),
        ]);
        const payload = this.toPayload(record, ledgerBankAccount);
        return { ...payload, ...relatedNames };
    }
    async softDelete(supId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.supplier.findFirst({
                where: { supId, supIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.supplier.updateMany({
                where: { supId, supIsDeleted: false },
                data: { supIsDeleted: true, supIsActive: false, supModifiedOn: modifiedOn, supModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
            }
            await tx.accLedgerMaster.updateMany({
                where: { ledId: supId, ledIsDeleted: false },
                data: {
                    ledIsDeleted: true,
                    ledIsActive: false,
                    ledModifiedOn: modifiedOn,
                    ledModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                supIsDeleted: true,
                supIsActive: false,
                supModifiedOn: modifiedOn,
                supModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SUPPLIER_TABLE_NAME,
                screenName: SUPPLIER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: supId,
                displayName: existing.supName,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Supplier soft deleted',
            }, tx);
            return { supId, deleted: true };
        });
    }
    async createSupplier(saveSupplierDto) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supName, 'supName');
        const normalizedPurchaseType = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supPurchaseType, 'supPurchaseType');
        const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supStateName, 'supStateName');
        const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
        const normalizedGstType = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supGstType, 'supGstType');
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveSupplierDto.supCreatedBy, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveSupplierDto.supModifiedBy, createdBy);
        const data = {
            supGroupId: saveSupplierDto.supGroupId,
            supPurchaseType: normalizedPurchaseType,
            supName: normalizedName,
            supStateName: normalizedStateName,
            supStateCode: normalizedStateCode,
            supGstType: normalizedGstType,
            supBilledDate: now,
            supCreatedOn: now,
            supCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveSupplierDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureSupplierGroupExists(tx, data.supGroupId);
                const companyId = (0, module_service_utils_1.hasOwnProperty)(saveSupplierDto, 'supCompanyId')
                    ? (saveSupplierDto.supCompanyId ?? null)
                    : null;
                await this.ensureNameIsUnique(tx, normalizedName, companyId);
                const ledgerDto = this.buildLinkedLedgerDto(saveSupplierDto, {
                    name: normalizedName,
                    stateName: normalizedStateName,
                    stateCode: normalizedStateCode,
                });
                const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
                data.supId = ledger.ledId;
                const created = await tx.supplier.create({ data });
                const payload = this.toPayload(created, ledger.ledgerBankAccount);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: SUPPLIER_TABLE_NAME,
                    screenName: SUPPLIER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.supId,
                    displayName: payload.supName,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Supplier created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Supplier already exists', [
                { field: 'supName', message: 'Duplicate supplier name is not allowed' },
            ]);
            throw error;
        }
    }
    async updateSupplier(saveSupplierDto) {
        const supId = saveSupplierDto.supId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.supplier.findFirst({
                    where: { supId, supIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`);
                }
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supName, 'supName');
                const normalizedPurchaseType = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supPurchaseType, 'supPurchaseType');
                const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supStateName, 'supStateName');
                const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
                const normalizedGstType = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supGstType, 'supGstType');
                await this.ensureSupplierGroupExists(tx, saveSupplierDto.supGroupId);
                const nextCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveSupplierDto, 'supCompanyId')
                    ? (saveSupplierDto.supCompanyId ?? null)
                    : existing.supCompanyId;
                await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, supId);
                const now = new Date();
                const data = {
                    supGroupId: saveSupplierDto.supGroupId,
                    supPurchaseType: normalizedPurchaseType,
                    supName: normalizedName,
                    supStateName: normalizedStateName,
                    supStateCode: normalizedStateCode,
                    supGstType: normalizedGstType,
                    supBilledDate: now,
                    supModifiedOn: now,
                    supModifiedBy: (0, module_service_utils_1.resolveActor)(saveSupplierDto.supModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveSupplierDto);
                const updated = await tx.supplier.update({ where: { supId }, data });
                const linkedLedger = await tx.accLedgerMaster.findFirst({
                    where: { ledId: supId, ledIsDeleted: false },
                    select: { ledId: true },
                });
                let ledgerBankAccount = [];
                if (linkedLedger) {
                    const ledgerDto = this.buildLinkedLedgerDto(saveSupplierDto, {
                        name: normalizedName,
                        stateName: normalizedStateName,
                        stateCode: normalizedStateCode,
                    });
                    ledgerDto.ledId = supId;
                    const ledger = await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
                    ledgerBankAccount = ledger.ledgerBankAccount;
                }
                const payload = this.toPayload(updated, ledgerBankAccount);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SUPPLIER_TABLE_NAME,
                    screenName: SUPPLIER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: supId,
                    displayName: payload.supName,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.supModifiedBy,
                    notes: 'Supplier updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Supplier already exists', [
                { field: 'supName', message: 'Duplicate supplier name is not allowed' },
            ]);
            throw error;
        }
    }
    async resolveRelatedNames(client, record) {
        const [company, branch, group] = await Promise.all([
            record.supCompanyId
                ? client.company.findFirst({
                    where: { compId: record.supCompanyId },
                    select: { compName: true },
                })
                : null,
            record.supBranchId
                ? client.branchMaster.findFirst({
                    where: { brId: record.supBranchId },
                    select: { brName: true },
                })
                : null,
            record.supGroupId
                ? client.supplierGroup.findFirst({
                    where: { spgId: record.supGroupId },
                    select: { spgName: true },
                })
                : null,
        ]);
        return {
            supCompanyName: company?.compName ?? null,
            supBranchName: branch?.brName ?? null,
            supGroupName: group?.spgName ?? null,
        };
    }
    async ensureSupplierGroupExists(tx, supGroupId) {
        const record = await tx.supplierGroup.findFirst({
            where: { spgId: supGroupId, spgIsDeleted: false },
            select: { spgId: true },
        });
        if (!record) {
            (0, module_service_utils_1.throwPurchaseBadRequest)('Supplier group does not exist', [
                { field: 'supGroupId', message: `No active supplier group found with id ${supGroupId}` },
            ]);
        }
    }
    async ensureNameIsUnique(tx, supName, companyId, excludeId) {
        const existing = await tx.supplier.findFirst({
            where: {
                supIsDeleted: false,
                supCompanyId: companyId,
                supName: { equals: supName, mode: 'insensitive' },
                ...(excludeId ? { supId: { not: excludeId } } : {}),
            },
            select: { supId: true },
        });
        if (existing) {
            (0, module_service_utils_1.throwPurchaseConflict)('Supplier name already exists for this company', [
                { field: 'supName', message: 'Duplicate supplier name is not allowed for this company' },
            ]);
        }
    }
    buildLinkedLedgerDto(saveSupplierDto, normalized) {
        const ledgerDto = {
            ledGroupId: SUPPLIER_LINKED_LEDGER_GROUP_ID,
            ledName: normalized.name,
            ledStateName: normalized.stateName,
            ledStateCode: normalized.stateCode,
        };
        const ledgerDtoRecord = ledgerDto;
        const supplierRecord = saveSupplierDto;
        for (const [supField, ledField] of SUPPLIER_TO_LEDGER_FIELD_MAP) {
            if ((0, module_service_utils_1.hasOwnProperty)(saveSupplierDto, supField)) {
                ledgerDtoRecord[ledField] = supplierRecord[supField];
            }
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveSupplierDto, 'ledgerBankAccount')) {
            ledgerDto.ledgerBankAccount = saveSupplierDto.ledgerBankAccount;
        }
        return ledgerDto;
    }
    applyOptionalFields(data, saveSupplierDto) {
        const optionalFields = [
            'supCompanyId', 'supBranchId', 'supShort', 'supAddr1', 'supAddr2', 'supAddr3',
            'supCity', 'supDistrict', 'supCountry', 'supPincode', 'supTel', 'supPhone',
            'supMailId', 'supWhatsappNo', 'supWebsiteAddress', 'supChequePreName', 'supNotes',
            'supCreditDays', 'supCashDiscPerc', 'supGstNo', 'supPanNo', 'supSupCst',
            'supDrugLiscenceNo', 'supRegionName', 'supRegionAddr1', 'supRegionAddr2',
            'supRegionAddr3', 'supRegionCity', 'supRegionDistrict', 'supRegionStateName',
            'supRegionCountry', 'supSortOrder', 'supIsActive',
        ];
        for (const field of optionalFields) {
            if ((0, module_service_utils_1.hasOwnProperty)(saveSupplierDto, field)) {
                data[field] = saveSupplierDto[field];
            }
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveSupplierDto, 'supCollectionDays')) {
            data.supCollectionDays = saveSupplierDto.supCollectionDays ?? [];
        }
    }
    normalizeStateCode(value) {
        const normalized = value.trim().toUpperCase();
        if (normalized.length !== 2) {
            (0, module_service_utils_1.throwPurchaseBadRequest)('Validation failed', [
                { field: 'supStateCode', message: 'supStateCode must be exactly 2 characters' },
            ]);
        }
        return normalized;
    }
    toPayload(record, ledgerBankAccount = []) {
        return {
            supId: record.supId,
            supCompanyId: record.supCompanyId,
            supBranchId: record.supBranchId,
            supGroupId: record.supGroupId,
            supPurchaseType: record.supPurchaseType,
            supName: record.supName,
            supShort: record.supShort,
            supAddr1: record.supAddr1,
            supAddr2: record.supAddr2,
            supAddr3: record.supAddr3,
            supCity: record.supCity,
            supDistrict: record.supDistrict,
            supStateName: record.supStateName,
            supCountry: record.supCountry,
            supPincode: record.supPincode,
            supTel: record.supTel,
            supPhone: record.supPhone,
            supMailId: record.supMailId,
            supWhatsappNo: record.supWhatsappNo,
            supWebsiteAddress: record.supWebsiteAddress,
            supChequePreName: record.supChequePreName,
            supNotes: record.supNotes,
            supCreditDays: record.supCreditDays,
            supCashDiscPerc: (0, module_service_utils_1.toNumber)(record.supCashDiscPerc),
            supCollectionDays: record.supCollectionDays,
            supGstNo: record.supGstNo,
            supStateCode: record.supStateCode,
            supPanNo: record.supPanNo,
            supGstType: record.supGstType,
            supSupCst: record.supSupCst,
            supDrugLiscenceNo: record.supDrugLiscenceNo,
            supRegionName: record.supRegionName,
            supRegionAddr1: record.supRegionAddr1,
            supRegionAddr2: record.supRegionAddr2,
            supRegionAddr3: record.supRegionAddr3,
            supRegionCity: record.supRegionCity,
            supRegionDistrict: record.supRegionDistrict,
            supRegionStateName: record.supRegionStateName,
            supRegionCountry: record.supRegionCountry,
            supBilledDate: record.supBilledDate ? record.supBilledDate.toISOString() : null,
            supSortOrder: record.supSortOrder,
            supIsActive: record.supIsActive,
            supIsDeleted: record.supIsDeleted,
            supSyncDate: record.supSyncDate ? record.supSyncDate.toISOString() : null,
            supCreatedOn: record.supCreatedOn.toISOString(),
            supCreatedBy: record.supCreatedBy,
            supModifiedOn: record.supModifiedOn.toISOString(),
            supModifiedBy: record.supModifiedBy,
            ledgerBankAccount,
        };
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        account_ledger_masters_service_1.AccountLedgerMastersService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map