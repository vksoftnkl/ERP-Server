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
const supplier_error_codes_1 = require("./types/supplier-error-codes");
const rights_1 = require("../../../common/posting/rights");
const party_balance_service_1 = require("../../../common/party/party-balance.service");
const party_sync_service_1 = require("../../../common/party/party-sync.service");
const party_detail_map_1 = require("../../../common/party/party-detail.map");
const party_gst_type_1 = require("../../../common/party/party-gst-type");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const SUPPLIER_TABLE_NAME = 'suppliers';
const SUPPLIER_AUDIT_SCREEN_NAME = 'Supplier Master';
const SUPPLIER_MENU_ID = 22;
const SUPPLIER_LINKED_LEDGER_GROUP_ID = '019f081c-98cc-757a-9346-4cfba810c47f';
const SUPPLIER_TO_LEDGER_FIELD_MAP = [
    ['supNotes', 'ledRemarks'],
    ['supIsActive', 'ledIsActive'],
];
const SUPPLIER_FIELDS_FROM_LINKED_LEDGER = [
    ['supName', 'ledName'],
    ['supStateName', 'ledStateName'],
    ['supStateCode', 'ledStateCode'],
    ...party_detail_map_1.PARTY_DETAIL_FIELDS.filter((field) => field.sup !== null).map((field) => [field.sup, field.led]),
];
const SUPPLIER_LINK_MAX_LENGTH = {
    supMailId: 120,
    supRegionName: 200,
};
let SuppliersService = class SuppliersService {
    prisma;
    auditLogService;
    requestContextService;
    accountLedgerMastersService;
    partyBalanceService;
    partySyncService;
    constructor(prisma, auditLogService, requestContextService, accountLedgerMastersService, partyBalanceService, partySyncService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.accountLedgerMastersService = accountLedgerMastersService;
        this.partyBalanceService = partyBalanceService;
        this.partySyncService = partySyncService;
    }
    async save(rawDto) {
        const saveSupplierDto = normalizeSupplierGstin(rawDto);
        if (saveSupplierDto.supId) {
            if (saveSupplierDto.supLinkLedId && saveSupplierDto.supLinkLedId !== saveSupplierDto.supId) {
                (0, module_service_utils_1.throwPurchaseBadRequest)('Validation failed', [
                    {
                        field: 'supLinkLedId',
                        message: 'supLinkLedId applies to a create only',
                        code: supplier_error_codes_1.SupplierErrorCode.LINK_LEDGER_ON_UPDATE,
                    },
                ]);
            }
            return this.updateSupplier(saveSupplierDto);
        }
        return this.createSupplier(saveSupplierDto);
    }
    async getById(supId) {
        const record = await this.prisma.supplier.findFirst({
            where: { supId, supIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`, supplier_error_codes_1.SupplierErrorCode.NOT_FOUND);
        }
        const [relatedNames, ledgerBankAccount] = await Promise.all([
            this.resolveRelatedNames(this.prisma, record),
            this.accountLedgerMastersService.listBankAccountPayloads(record.supId),
        ]);
        const payload = this.toPayload(record, ledgerBankAccount);
        return { ...payload, ...relatedNames };
    }
    async deleteCheck(supId) {
        return this.prisma.$transaction(async (tx) => {
            await this.assertDeleteRight(tx);
            await this.loadLiveSupplier(tx, supId);
            return this.partyBalanceService.deleteCheck(tx, {
                partyId: supId,
                role: 'SUPPLIER',
                otherRoleLive: (await this.findCustomerRole(tx, supId)) !== null,
                codes: {
                    hasBalance: supplier_error_codes_1.SupplierErrorCode.HAS_BALANCE,
                    hasChequeInHand: supplier_error_codes_1.SupplierErrorCode.HAS_CHEQUE_IN_HAND,
                },
            });
        });
    }
    assertDeleteRight(tx) {
        return (0, rights_1.assertMenuRight)(tx, {
            userId: this.requestContextService.getUserId() ?? null,
            menuId: SUPPLIER_MENU_ID,
            right: 'delete',
            codePrefix: 'PURCHASE_SUPPLIER',
            action: 'delete suppliers',
        });
    }
    async loadLiveSupplier(tx, supId) {
        const existing = await tx.supplier.findFirst({ where: { supId, supIsDeleted: false } });
        if (!existing) {
            (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`, supplier_error_codes_1.SupplierErrorCode.NOT_FOUND);
        }
        return existing;
    }
    async softDelete(supId) {
        return this.prisma.$transaction(async (tx) => {
            await this.assertDeleteRight(tx);
            const existing = await this.loadLiveSupplier(tx, supId);
            const ledger = await this.partyBalanceService.lockLedger(tx, supId);
            const otherRoleLive = (await this.findCustomerRole(tx, supId)) !== null;
            if (ledger && !ledger.ledIsDeleted && !otherRoleLive) {
                const check = await this.partyBalanceService.deleteCheck(tx, {
                    partyId: supId,
                    role: 'SUPPLIER',
                    otherRoleLive,
                    codes: {
                        hasBalance: supplier_error_codes_1.SupplierErrorCode.HAS_BALANCE,
                        hasChequeInHand: supplier_error_codes_1.SupplierErrorCode.HAS_CHEQUE_IN_HAND,
                    },
                });
                if (!check.canDelete) {
                    (0, module_service_utils_1.throwConflict)('Supplier cannot be deleted', check.refusals);
                }
            }
            const modifiedOn = new Date();
            const result = await tx.supplier.updateMany({
                where: { supId, supIsDeleted: false },
                data: {
                    supIsDeleted: true,
                    supIsActive: false,
                    supModifiedOn: modifiedOn,
                    supModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwPurchaseNotFound)('Supplier not found', 'supId', `No active supplier found with id ${supId}`, supplier_error_codes_1.SupplierErrorCode.NOT_FOUND);
            }
            const customerRole = await this.findCustomerRole(tx, supId);
            await tx.accLedgerMaster.updateMany({
                where: { ledId: supId, ledIsDeleted: false },
                data: customerRole
                    ? {
                        ledIsActive: customerRole.cusIsActive,
                        ledModifiedOn: modifiedOn,
                        ledModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    }
                    : {
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
                notes: customerRole
                    ? 'Supplier soft deleted; its ledger stays with the customer'
                    : 'Supplier soft deleted',
            }, tx);
            return { supId, deleted: true };
        });
    }
    async createSupplier(saveSupplierDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const linkLedger = saveSupplierDto.supLinkLedId
                    ? await this.loadLedgerToLink(tx, saveSupplierDto.supLinkLedId)
                    : null;
                if (linkLedger && (saveSupplierDto.ledgerBankAccount?.length ?? 0) > 0) {
                    (0, module_service_utils_1.throwPurchaseBadRequest)('Validation failed', [
                        {
                            field: 'ledgerBankAccount',
                            message: 'Bank accounts cannot be sent with supLinkLedId; save them afterwards',
                            code: supplier_error_codes_1.SupplierErrorCode.BANK_WITH_LINK_LEDGER,
                        },
                    ]);
                }
                const dto = linkLedger
                    ? this.withLinkedLedgerDefaults(saveSupplierDto, linkLedger)
                    : saveSupplierDto;
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(dto.supName, 'supName', undefined, supplier_error_codes_1.SupplierErrorCode.NAME_REQUIRED);
                const normalizedPurchaseType = (0, module_service_utils_1.normalizeRequiredText)(dto.supPurchaseType, 'supPurchaseType', undefined, supplier_error_codes_1.SupplierErrorCode.PURCHASE_TYPE_REQUIRED);
                const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(dto.supStateName, 'supStateName', undefined, supplier_error_codes_1.SupplierErrorCode.STATE_NAME_REQUIRED);
                const normalizedStateCode = this.normalizeStateCode(dto.supStateCode);
                (0, module_service_utils_1.normalizeRequiredText)(dto.supGstType, 'supGstType', undefined, supplier_error_codes_1.SupplierErrorCode.GST_TYPE_REQUIRED);
                const normalizedGstType = this.resolveGstType(dto.supGstType, dto.supGstNo, normalizedStateCode);
                const now = new Date();
                const createdBy = (0, module_service_utils_1.resolveActor)(dto.supCreatedBy, this.requestContextService.getUserId());
                const data = {
                    supGroupId: dto.supGroupId,
                    supPurchaseType: normalizedPurchaseType,
                    supName: normalizedName,
                    supStateName: normalizedStateName,
                    supStateCode: normalizedStateCode,
                    supGstType: normalizedGstType,
                    supCreatedOn: now,
                    supCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, dto);
                await this.ensureSupplierGroupExists(tx, data.supGroupId);
                const companyId = (0, module_service_utils_1.isPresentField)(dto, 'supCompanyId') ? (dto.supCompanyId ?? null) : null;
                await this.ensureNameIsUnique(tx, normalizedName, companyId, linkLedger?.ledId);
                if (linkLedger) {
                    const linked = await this.createSupplierOnLedger(tx, data, linkLedger);
                    const customerLive = (await this.findCustomerRole(tx, linkLedger.ledId)) !== null;
                    return {
                        ...linked,
                        partySync: { otherRole: customerLive ? 'CUSTOMER' : null, otherRoleUpdated: false, fields: [] },
                    };
                }
                const ledgerDto = this.buildLinkedLedgerDto(dto, { name: normalizedName, stateName: normalizedStateName, stateCode: normalizedStateCode }, { gstType: normalizedGstType, shared: false });
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
                return { ...payload, partySync: { ...party_sync_service_1.NO_PARTY_SYNC, fields: [] } };
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Supplier already exists', [
                {
                    field: 'supName',
                    message: 'Duplicate supplier name is not allowed',
                    code: supplier_error_codes_1.SupplierErrorCode.NAME_EXISTS,
                },
            ]);
            throw error;
        }
    }
    async createSupplierOnLedger(tx, data, ledger) {
        const supId = ledger.ledId;
        const previous = await tx.supplier.findUnique({ where: { supId } });
        if (previous && !previous.supIsDeleted) {
            (0, module_service_utils_1.throwPurchaseConflict)('Supplier already exists', [
                {
                    field: 'supLinkLedId',
                    message: `Ledger "${ledger.ledName}" is already a supplier`,
                    code: supplier_error_codes_1.SupplierErrorCode.LINK_LEDGER_ALREADY_SUPPLIER,
                },
            ]);
        }
        let saved;
        if (previous) {
            const { supCreatedOn, supCreatedBy, ...revived } = data;
            saved = await tx.supplier.update({
                where: { supId },
                data: {
                    ...revived,
                    supIsDeleted: false,
                    supIsActive: data.supIsActive ?? true,
                    supModifiedOn: supCreatedOn,
                    supModifiedBy: supCreatedBy,
                },
            });
        }
        else {
            saved = await tx.supplier.create({ data: { ...data, supId } });
        }
        const ledgerBankAccount = await this.accountLedgerMastersService.listBankAccountPayloads(supId);
        const payload = this.toPayload(saved, ledgerBankAccount);
        await this.auditLogService.logEntityChange({
            action: previous ? 'update' : 'New',
            tableName: SUPPLIER_TABLE_NAME,
            screenName: SUPPLIER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: supId,
            displayName: payload.supName,
            originalRecord: previous ? this.toPayload(previous) : null,
            modifiedRecord: payload,
            userId: saved.supModifiedBy,
            notes: previous
                ? 'Supplier restored on its existing ledger'
                : 'Supplier created on an existing ledger',
        }, tx);
        return payload;
    }
    async loadLedgerToLink(tx, ledId) {
        const ledger = await tx.accLedgerMaster.findFirst({ where: { ledId, ledIsDeleted: false } });
        if (!ledger) {
            (0, module_service_utils_1.throwPurchaseBadRequest)('Ledger does not exist', [
                {
                    field: 'supLinkLedId',
                    message: `No active account ledger found with id ${ledId}`,
                    code: supplier_error_codes_1.SupplierErrorCode.LINK_LEDGER_NOT_FOUND,
                },
            ]);
        }
        if (ledger.ledLedgerType !== 'PARTY' && !(await this.findCustomerRole(tx, ledId))) {
            (0, module_service_utils_1.throwPurchaseBadRequest)('Ledger is not a party ledger', [
                {
                    field: 'supLinkLedId',
                    message: `Ledger "${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger; only a PARTY ledger can be a supplier`,
                    code: supplier_error_codes_1.SupplierErrorCode.LINK_LEDGER_NOT_PARTY,
                },
            ]);
        }
        return ledger;
    }
    async updateSupplier(saveSupplierDto) {
        const supId = saveSupplierDto.supId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const lockedLedger = await this.partyBalanceService.lockLedger(tx, supId);
                const existing = await this.loadLiveSupplier(tx, supId);
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supName, 'supName', undefined, supplier_error_codes_1.SupplierErrorCode.NAME_REQUIRED);
                const normalizedPurchaseType = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supPurchaseType, 'supPurchaseType', undefined, supplier_error_codes_1.SupplierErrorCode.PURCHASE_TYPE_REQUIRED);
                const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supStateName, 'supStateName', undefined, supplier_error_codes_1.SupplierErrorCode.STATE_NAME_REQUIRED);
                const normalizedStateCode = this.normalizeStateCode(saveSupplierDto.supStateCode);
                (0, module_service_utils_1.normalizeRequiredText)(saveSupplierDto.supGstType, 'supGstType', undefined, supplier_error_codes_1.SupplierErrorCode.GST_TYPE_REQUIRED);
                const normalizedGstType = this.resolveGstType(saveSupplierDto.supGstType, (0, module_service_utils_1.isPresentField)(saveSupplierDto, 'supGstNo') ? saveSupplierDto.supGstNo : existing.supGstNo, normalizedStateCode);
                await this.ensureSupplierGroupExists(tx, saveSupplierDto.supGroupId);
                const companySent = (0, module_service_utils_1.isPresentField)(saveSupplierDto, 'supCompanyId');
                const nextCompanyId = companySent
                    ? (saveSupplierDto.supCompanyId ?? null)
                    : existing.supCompanyId;
                await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, supId);
                const linkedLedger = lockedLedger && !lockedLedger.ledIsDeleted
                    ? await tx.accLedgerMaster.findFirst({
                        where: { ledId: supId, ledIsDeleted: false },
                        select: { ledId: true, ledGroupId: true, ledCompanyId: true },
                    })
                    : null;
                if (linkedLedger && companySent && nextCompanyId !== linkedLedger.ledCompanyId) {
                    await this.ensureCompanyChangeAllowed(tx, supId, linkedLedger.ledCompanyId, nextCompanyId);
                }
                const customerRole = await this.findCustomerRole(tx, supId);
                const now = new Date();
                const modifiedBy = (0, module_service_utils_1.resolveActor)(saveSupplierDto.supModifiedBy, this.requestContextService.getUserId());
                const data = {
                    supGroupId: saveSupplierDto.supGroupId,
                    supPurchaseType: normalizedPurchaseType,
                    supName: normalizedName,
                    supStateName: normalizedStateName,
                    supStateCode: normalizedStateCode,
                    supModifiedOn: now,
                    supModifiedBy: modifiedBy,
                };
                this.applyOptionalFields(data, saveSupplierDto);
                data.supGstType = normalizedGstType;
                const updated = await tx.supplier.update({ where: { supId }, data });
                let ledgerBankAccount = [];
                if (linkedLedger) {
                    const ledgerDto = this.buildLinkedLedgerDto(saveSupplierDto, { name: normalizedName, stateName: normalizedStateName, stateCode: normalizedStateCode }, { gstType: normalizedGstType, shared: customerRole !== null });
                    ledgerDto.ledId = supId;
                    if (customerRole) {
                        ledgerDto.ledGroupId = linkedLedger.ledGroupId;
                        ledgerDto.ledIsActive = updated.supIsActive || customerRole.cusIsActive;
                    }
                    const ledger = await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
                    ledgerBankAccount = ledger.ledgerBankAccount;
                }
                const partySync = customerRole
                    ? await this.partySyncService.syncOtherRole(tx, {
                        role: 'SUPPLIER',
                        partyId: supId,
                        details: this.partySyncService.detailsOf('SUPPLIER', saveSupplierDto, {
                            ledName: normalizedName,
                            ledStateName: normalizedStateName,
                            ledStateCode: normalizedStateCode,
                            ...(companySent ? { ledCompanyId: nextCompanyId } : {}),
                        }),
                        gstType: normalizedGstType,
                        actor: modifiedBy,
                    })
                    : { ...party_sync_service_1.NO_PARTY_SYNC, fields: [] };
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
                return { ...payload, partySync };
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Supplier already exists', [
                {
                    field: 'supName',
                    message: 'Duplicate supplier name is not allowed',
                    code: supplier_error_codes_1.SupplierErrorCode.NAME_EXISTS,
                },
            ]);
            throw error;
        }
    }
    async resolveRelatedNames(client, record) {
        const [company, branch, group, godown] = await Promise.all([
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
            record.supDefaultGodownId
                ? client.godownLocation.findFirst({
                    where: { gdlId: record.supDefaultGodownId },
                    select: { gdlName: true },
                })
                : null,
        ]);
        return {
            supCompanyName: company?.compName ?? null,
            supBranchName: branch?.brName ?? null,
            supGroupName: group?.spgName ?? null,
            supDefaultGodownName: godown?.gdlName ?? null,
        };
    }
    findCustomerRole(tx, ledId) {
        return tx.customer.findFirst({
            where: { cusId: ledId, cusIsDeleted: false },
            select: { cusIsActive: true },
        });
    }
    withLinkedLedgerDefaults(saveSupplierDto, ledger) {
        const dto = { ...saveSupplierDto };
        const ledgerRecord = ledger;
        for (const [supField, ledField] of SUPPLIER_FIELDS_FROM_LINKED_LEDGER) {
            const current = dto[supField];
            const fallback = ledgerRecord[ledField];
            const maxLength = SUPPLIER_LINK_MAX_LENGTH[supField];
            if ((current === undefined || current === null || current === '') &&
                fallback !== null &&
                fallback !== undefined &&
                !(maxLength !== undefined && typeof fallback === 'string' && fallback.length > maxLength)) {
                dto[supField] = fallback;
            }
        }
        return dto;
    }
    async ensureSupplierGroupExists(tx, supGroupId) {
        const record = await tx.supplierGroup.findFirst({
            where: { spgId: supGroupId, spgIsDeleted: false },
            select: { spgId: true },
        });
        if (!record) {
            (0, module_service_utils_1.throwPurchaseBadRequest)('Supplier group does not exist', [
                {
                    field: 'supGroupId',
                    message: `No active supplier group found with id ${supGroupId}`,
                    code: supplier_error_codes_1.SupplierErrorCode.UNKNOWN_GROUP,
                },
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
                {
                    field: 'supName',
                    message: 'Duplicate supplier name is not allowed for this company',
                    code: supplier_error_codes_1.SupplierErrorCode.NAME_EXISTS,
                },
            ]);
        }
    }
    buildLinkedLedgerDto(saveSupplierDto, normalized, party) {
        const ledgerDto = {
            ledGroupId: SUPPLIER_LINKED_LEDGER_GROUP_ID,
            ledName: normalized.name,
            ledStateName: normalized.stateName,
            ledStateCode: normalized.stateCode,
            ledIsBillByBill: true,
            ...(0, party_gst_type_1.ledgerGstFieldsOf)(party.gstType),
        };
        const ledgerDtoRecord = ledgerDto;
        Object.assign(ledgerDtoRecord, this.partySyncService.detailsOf('SUPPLIER', saveSupplierDto));
        const supplierRecord = saveSupplierDto;
        for (const [supField, ledField] of SUPPLIER_TO_LEDGER_FIELD_MAP) {
            if (supField === 'supNotes' && party.shared) {
                continue;
            }
            if ((0, module_service_utils_1.isPresentField)(saveSupplierDto, supField)) {
                ledgerDtoRecord[ledField] = supplierRecord[supField];
            }
        }
        if ((0, module_service_utils_1.isPresentField)(saveSupplierDto, 'ledgerBankAccount')) {
            ledgerDto.ledgerBankAccount = saveSupplierDto.ledgerBankAccount;
        }
        return ledgerDto;
    }
    applyOptionalFields(data, saveSupplierDto) {
        const optionalFields = [
            'supCompanyId',
            'supBranchId',
            'supShort',
            'supAddr1',
            'supAddr2',
            'supAddr3',
            'supCity',
            'supDistrict',
            'supCountry',
            'supPincode',
            'supTel',
            'supPhone',
            'supMailId',
            'supWhatsappNo',
            'supWebsiteAddress',
            'supChequePreName',
            'supNotes',
            'supCreditDays',
            'supCashDiscPerc',
            'supGstNo',
            'supPanNo',
            'supSupCst',
            'supDrugLiscenceNo',
            'supMsmeCategory',
            'supMsmeActivity',
            'supMsmeAgreement',
            'supFssaiNo',
            'supDefaultGodownId',
            'supShowNotesOnEntry',
            'supIsImport',
            'supRegionName',
            'supRegionAddr1',
            'supRegionAddr2',
            'supRegionAddr3',
            'supRegionCity',
            'supRegionDistrict',
            'supRegionStateName',
            'supRegionCountry',
            'supSortOrder',
            'supIsActive',
        ];
        for (const field of optionalFields) {
            if ((0, module_service_utils_1.isPresentField)(saveSupplierDto, field)) {
                data[field] = saveSupplierDto[field];
            }
        }
        if ((0, module_service_utils_1.isPresentField)(saveSupplierDto, 'supMsmeAgreedDays')) {
            data.supMsmeAgreedDays = saveSupplierDto.supMsmeAgreedDays || null;
        }
        if ((0, module_service_utils_1.isPresentField)(saveSupplierDto, 'supCollectionDays')) {
            data.supCollectionDays = saveSupplierDto.supCollectionDays ?? [];
        }
        for (const field of ['supDrugLicenceExpiry', 'supFssaiValidTo']) {
            if ((0, module_service_utils_1.isPresentField)(saveSupplierDto, field)) {
                const v = saveSupplierDto[field];
                data[field] = v ? new Date(`${String(v).slice(0, 10)}T00:00:00Z`) : null;
            }
        }
    }
    resolveGstType(rawType, gstin, stateCode) {
        const result = (0, party_gst_type_1.resolvePartyGstType)({ rawType, gstin, stateCode });
        if ('type' in result) {
            return result.type;
        }
        (0, module_service_utils_1.throwPurchaseBadRequest)('Validation failed', [supplierGstRefusal(result.refusal)]);
    }
    async ensureCompanyChangeAllowed(tx, ledId, currentCompanyId, nextCompanyId) {
        const books = await this.partyBalanceService.companyWithBooks(tx, ledId, currentCompanyId, nextCompanyId);
        if (books) {
            (0, module_service_utils_1.throwConflict)('Supplier company cannot change', [
                (0, party_balance_service_1.withFigures)({
                    field: 'supCompanyId',
                    code: supplier_error_codes_1.SupplierErrorCode.COMPANY_HAS_BOOKS,
                    message: `The party has entries in company ${books.companyId}; its company cannot change`,
                }, `This party has entries in ${books.companyName ?? 'its company'}.`),
            ]);
        }
    }
    normalizeStateCode(value) {
        const normalized = (value ?? '').trim().toUpperCase();
        if (normalized.length !== 2) {
            (0, module_service_utils_1.throwPurchaseBadRequest)('Validation failed', [
                {
                    field: 'supStateCode',
                    message: 'supStateCode must be exactly 2 characters',
                    code: supplier_error_codes_1.SupplierErrorCode.STATE_CODE_INVALID,
                },
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
            supDrugLicenceExpiry: record.supDrugLicenceExpiry ? record.supDrugLicenceExpiry.toISOString().slice(0, 10) : null,
            supMsmeCategory: record.supMsmeCategory,
            supMsmeActivity: record.supMsmeActivity,
            supMsmeAgreement: record.supMsmeAgreement,
            supMsmeAgreedDays: record.supMsmeAgreedDays,
            supFssaiNo: record.supFssaiNo,
            supFssaiValidTo: record.supFssaiValidTo ? record.supFssaiValidTo.toISOString().slice(0, 10) : null,
            supDefaultGodownId: record.supDefaultGodownId,
            supShowNotesOnEntry: record.supShowNotesOnEntry,
            supIsImport: record.supIsImport,
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
        account_ledger_masters_service_1.AccountLedgerMastersService,
        party_balance_service_1.PartyBalanceService,
        party_sync_service_1.PartySyncService])
], SuppliersService);
function normalizeSupplierGstin(dto) {
    if (!(0, module_service_utils_1.isPresentField)(dto, 'supGstNo')) {
        return dto;
    }
    const raw = dto.supGstNo;
    const gstin = typeof raw === 'string' ? raw.trim().toUpperCase() : raw;
    return Object.assign(Object.create(Object.getPrototypeOf(dto)), dto, {
        supGstNo: gstin === '' ? null : gstin,
    });
}
function supplierGstRefusal(refusal) {
    switch (refusal.kind) {
        case 'TYPE_INVALID':
            return {
                field: 'supGstType',
                message: `supGstType "${refusal.sent}" is not one of REGULAR, COMPOSITION, SEZ, OVERSEAS, UNREGISTERED`,
                code: supplier_error_codes_1.SupplierErrorCode.GST_TYPE_INVALID,
            };
        case 'TYPE_REQUIRED':
            return {
                field: 'supGstType',
                message: 'supGstType is required',
                code: supplier_error_codes_1.SupplierErrorCode.GST_TYPE_REQUIRED,
            };
        case 'GSTIN_REQUIRED':
            return {
                field: 'supGstNo',
                message: `A ${(0, party_gst_type_1.partyGstTypeWord)(refusal.type)} supplier must have a GSTIN`,
                code: supplier_error_codes_1.SupplierErrorCode.GSTIN_REQUIRED,
            };
        case 'GSTIN_NOT_ALLOWED':
            return {
                field: 'supGstNo',
                message: `An ${(0, party_gst_type_1.partyGstTypeWord)(refusal.type)} supplier has no GSTIN; clear supGstNo`,
                code: supplier_error_codes_1.SupplierErrorCode.GSTIN_NOT_ALLOWED,
            };
        case 'OVERSEAS_STATE':
            return {
                field: 'supStateCode',
                message: `An Overseas supplier's state must be 96 (Other Country), not ${refusal.stateCode}`,
                code: supplier_error_codes_1.SupplierErrorCode.OVERSEAS_STATE,
            };
        case 'GSTIN_STATE_MISMATCH':
            return {
                field: 'supGstNo',
                message: `GSTIN ${refusal.gstin} is registered in state ${refusal.gstinState}, but supStateCode is ${refusal.stateCode}`,
                code: supplier_error_codes_1.SupplierErrorCode.GSTIN_STATE_MISMATCH,
            };
    }
}
//# sourceMappingURL=suppliers.service.js.map