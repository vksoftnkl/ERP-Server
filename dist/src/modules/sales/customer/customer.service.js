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
exports.CustomerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const account_ledger_masters_service_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.service");
const account_ledger_master_error_codes_1 = require("../../accountsModule/accountLedgerMasters/types/account-ledger-master-error-codes");
const rights_1 = require("../../../common/posting/rights");
const party_balance_service_1 = require("../../../common/party/party-balance.service");
const party_sync_service_1 = require("../../../common/party/party-sync.service");
const party_detail_map_1 = require("../../../common/party/party-detail.map");
const party_gst_type_1 = require("../../../common/party/party-gst-type");
const party_billed_1 = require("../../../common/party/party-billed");
const customer_error_codes_1 = require("./types/customer-error-codes");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';
const CUSTOMER_MENU_ID = 10;
const CUSTOMER_ZERO_WHEN_CLEARED_FIELDS = [
    'cusCreditBillLimit',
    'cusCreditAmtLimit',
    'cusCreditDays',
    'cusDebitBalance',
    'cusDiscPerc',
    'cusDebitGraceDays',
    'cusSortOrder',
];
const zeroWhenCleared = (value) => (value === null ? 0 : value);
function rethrowLedgerNameClash(error) {
    if (!(error instanceof common_1.ConflictException)) {
        return;
    }
    const body = error.getResponse();
    const errors = typeof body === 'object' && Array.isArray(body.errors) ? body.errors : [];
    if (!errors.some((detail) => detail.code === account_ledger_master_error_codes_1.AccountLedgerErrorCode.NAME_TAKEN)) {
        return;
    }
    (0, module_service_utils_1.throwSalesConflict)('Customer name already exists for this company', [CUSTOMER_NAME_EXISTS_DETAIL]);
}
function isLedgerNameUniqueViolation(error) {
    if (!(0, module_service_utils_1.isUniqueConstraintError)(error)) {
        return false;
    }
    const rawMessage = error.meta?.message;
    const target = [(0, module_service_utils_1.violatedConstraintOf)(error), typeof rawMessage === 'string' ? rawMessage : '']
        .filter(Boolean)
        .join(' ');
    return /uq_led_name|led_name/i.test(target);
}
const CUSTOMER_NAME_EXISTS_DETAIL = {
    field: 'cusName',
    message: 'Duplicate customer name is not allowed for this company',
    code: customer_error_codes_1.CustomerErrorCode.NAME_EXISTS,
};
const CUSTOMER_OPTIONAL_FIELDS = [
    'cusTitle',
    'cusShort',
    'cusCode',
    'cusName',
    'cusAddr1',
    'cusAddr2',
    'cusAddr3',
    'cusCity',
    'cusDistrict',
    'cusCountry',
    'cusLandmark',
    'cusPin',
    'cusTel',
    'cusPhone1',
    'cusPhone2',
    'cusWhatsappNo',
    'cusEmail',
    'cusAadharNo',
    'cusContactPerson',
    'cusDistanceKm',
    'cusCreditAllowed',
    'cusCreditBillLimit',
    'cusCreditAmtLimit',
    'cusCreditDays',
    'cusDebitBalance',
    'cusDiscPerc',
    'cusDebitGraceDays',
    'cusEnableSms',
    'cusOverdueSms',
    'cusOverdueBilling',
    'cusAllowPromotion',
    'cusAllowLoyalty',
    'cusAllowDiscount',
    'cusSortOrder',
    'cusRegionName',
    'cusRegionAddr1',
    'cusRegionAddr2',
    'cusRegionAddr3',
    'cusRegionCity',
    'cusRegionDistrict',
    'cusRegionStateName',
    'cusRegionCountry',
    'cusBirthDate',
    'cusMarriageDate',
    'cusTransportName',
    'cusFreightCharge',
    'cusLoadingCharge',
    'cusUnloadingCharge',
    'cusGstNo',
    'cusPanNo',
    'cusGstType',
    'cusEcommerceGstin',
    'cusTcsApplicable',
    'cusItcollExempted',
    'cusItcollType',
    'cusGeoLocation',
    'cusCollectionDays',
    'cusDefaultSalesman',
    'cusNotes',
    'cusBranchId',
    'cusCompanyId',
    'cusIsActive',
];
const CUSTOMER_TO_LEDGER_FIELD_MAP = [
    ['cusNotes', 'ledRemarks'],
    ['cusEnableSms', 'ledAllowSms'],
    ['cusSortOrder', 'ledSortOrder'],
    ['cusIsActive', 'ledIsActive'],
];
const CUSTOMER_FIELDS_FROM_LINKED_LEDGER = [
    ['cusName', 'ledName'],
    ['cusStateName', 'ledStateName'],
    ['cusStateCode', 'ledStateCode'],
    ...party_detail_map_1.PARTY_DETAIL_FIELDS.filter((field) => field.cus !== null).map((field) => [field.cus, field.led]),
];
const CUSTOMER_LINK_MAX_LENGTH = {
    cusEmail: 120,
    cusAadharNo: 12,
    cusRegionName: 200,
};
function toLedgerItCollectionFlags(saveCustomerDto) {
    const hasTcsFlag = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusTcsApplicable');
    const hasItcollType = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusItcollType');
    const hasItcollExempted = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusItcollExempted');
    if (!hasTcsFlag && !hasItcollType && !hasItcollExempted) {
        return {};
    }
    if (saveCustomerDto.cusItcollExempted === true) {
        return { tcs: false, tds: false };
    }
    const itcollType = typeof saveCustomerDto.cusItcollType === 'string'
        ? saveCustomerDto.cusItcollType.trim().toUpperCase()
        : null;
    const flags = {};
    if (hasTcsFlag || hasItcollType) {
        flags.tcs = saveCustomerDto.cusTcsApplicable === true || itcollType === 'TCS';
    }
    if (hasItcollType) {
        flags.tds = itcollType === 'TDS';
    }
    return flags;
}
let CustomerService = class CustomerService {
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
    async save(saveCustomerDto) {
        if (saveCustomerDto.cusId) {
            if (saveCustomerDto.cusLinkLedId && saveCustomerDto.cusLinkLedId !== saveCustomerDto.cusId) {
                (0, module_service_utils_1.throwSalesBadRequest)('Validation failed', [
                    {
                        field: 'cusLinkLedId',
                        message: 'cusLinkLedId applies to a create only',
                        code: customer_error_codes_1.CustomerErrorCode.LINK_LEDGER_ON_UPDATE,
                    },
                ]);
            }
            return this.updateCustomer(saveCustomerDto);
        }
        return this.createCustomer(saveCustomerDto);
    }
    async getById(cusId) {
        const record = await this.prisma.customer.findFirst({
            where: {
                cusId,
                cusIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`, customer_error_codes_1.CustomerErrorCode.NOT_FOUND);
        }
        const payload = await this.withLastBilled(this.prisma, this.toPayload(record));
        const relatedNames = await this.resolveRelatedNames(this.prisma, record);
        return { ...payload, ...relatedNames };
    }
    async withLastBilled(client, payload) {
        const billed = await (0, party_billed_1.lastBilledOf)(client, payload.cusId);
        return {
            ...payload,
            cusBilledDate: billed.date ? billed.date.toISOString() : null,
            cusBilledCount: billed.count,
        };
    }
    async deleteCheck(cusId) {
        return this.prisma.$transaction(async (tx) => {
            await this.assertDeleteRight(tx);
            await this.loadLiveCustomer(tx, cusId);
            return this.partyBalanceService.deleteCheck(tx, {
                partyId: cusId,
                role: 'CUSTOMER',
                otherRoleLive: (await this.findSupplierRole(tx, cusId)) !== null,
                codes: {
                    hasBalance: customer_error_codes_1.CustomerErrorCode.HAS_BALANCE,
                    hasChequeInHand: customer_error_codes_1.CustomerErrorCode.HAS_CHEQUE_IN_HAND,
                },
            });
        });
    }
    assertDeleteRight(tx) {
        return (0, rights_1.assertMenuRight)(tx, {
            userId: this.requestContextService.getUserId() ?? null,
            menuId: CUSTOMER_MENU_ID,
            right: 'delete',
            codePrefix: 'CUSTOMER',
            action: 'delete customers',
        });
    }
    async loadLiveCustomer(tx, cusId) {
        const existing = await tx.customer.findFirst({ where: { cusId, cusIsDeleted: false } });
        if (!existing) {
            (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`, customer_error_codes_1.CustomerErrorCode.NOT_FOUND);
        }
        return existing;
    }
    async softDelete(cusId) {
        return this.prisma.$transaction(async (tx) => {
            await this.assertDeleteRight(tx);
            const existing = await this.loadLiveCustomer(tx, cusId);
            const ledger = await this.partyBalanceService.lockLedger(tx, cusId);
            const otherRoleLive = (await this.findSupplierRole(tx, cusId)) !== null;
            if (ledger && !ledger.ledIsDeleted && !otherRoleLive) {
                const check = await this.partyBalanceService.deleteCheck(tx, {
                    partyId: cusId,
                    role: 'CUSTOMER',
                    otherRoleLive,
                    codes: {
                        hasBalance: customer_error_codes_1.CustomerErrorCode.HAS_BALANCE,
                        hasChequeInHand: customer_error_codes_1.CustomerErrorCode.HAS_CHEQUE_IN_HAND,
                    },
                });
                if (!check.canDelete) {
                    (0, module_service_utils_1.throwConflict)('Customer cannot be deleted', check.refusals);
                }
            }
            const modifiedOn = new Date();
            const result = await tx.customer.updateMany({
                where: {
                    cusId,
                    cusIsDeleted: false,
                },
                data: {
                    cusIsDeleted: true,
                    cusIsActive: false,
                    cusModifiedOn: modifiedOn,
                    cusModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`, customer_error_codes_1.CustomerErrorCode.NOT_FOUND);
            }
            const supplierRole = await this.findSupplierRole(tx, cusId);
            await tx.accLedgerMaster.updateMany({
                where: { ledId: cusId, ledIsDeleted: false },
                data: supplierRole
                    ? {
                        ledIsActive: supplierRole.supIsActive,
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
                cusIsDeleted: true,
                cusIsActive: false,
                cusModifiedOn: modifiedOn,
                cusModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: CUSTOMER_TABLE_NAME,
                screenName: CUSTOMER_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: cusId,
                displayName: existing.cusName || cusId,
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: supplierRole
                    ? 'Customer soft deleted; its ledger stays with the supplier'
                    : 'Customer soft deleted',
            }, tx);
            return {
                cusId,
                deleted: true,
            };
        });
    }
    async createCustomer(saveCustomerDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const linkLedger = saveCustomerDto.cusLinkLedId
                    ? await this.loadLedgerToLink(tx, saveCustomerDto.cusLinkLedId)
                    : null;
                const dto = linkLedger
                    ? await this.withLinkedLedgerDefaults(tx, saveCustomerDto, linkLedger)
                    : saveCustomerDto;
                const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(dto.cusName ?? '', 'cusName', undefined, customer_error_codes_1.CustomerErrorCode.NAME_REQUIRED);
                const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(dto.cusStateName, 'cusStateName', undefined, customer_error_codes_1.CustomerErrorCode.STATE_NAME_REQUIRED);
                const normalizedStateCode = this.normalizeStateCode(dto.cusStateCode);
                const now = new Date();
                const createdBy = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
                const data = {
                    cusStateName: normalizedStateName,
                    cusStateCode: normalizedStateCode,
                    cusCompanyId: (0, module_service_utils_1.isPresentField)(dto, 'cusCompanyId') ? (dto.cusCompanyId ?? null) : null,
                    cusAreaId: dto.cusAreaId,
                    cusGroupId: dto.cusGroupId,
                    cusPriceLevelId: dto.cusPriceLevelId,
                    cusCollectionDays: (0, module_service_utils_1.isPresentField)(dto, 'cusCollectionDays')
                        ? (dto.cusCollectionDays ?? [])
                        : [],
                    cusCreatedOn: now,
                    cusCreatedBy: createdBy,
                };
                this.applyOptionalFields(data, dto);
                data.cusName = normalizedName;
                await this.ensureCompanyExists(tx, data.cusCompanyId ?? null);
                await this.ensureAreaExists(tx, data.cusAreaId);
                await this.ensureCustomerGroupExists(tx, data.cusGroupId);
                await this.ensureStateCodeExists(tx, normalizedStateCode);
                await this.ensurePriceLevelExists(tx, data.cusPriceLevelId);
                await this.ensureBranchExists(tx, saveCustomerDto.cusBranchId);
                const gstType = this.resolveGstType(dto.cusGstType, dto.cusGstNo, normalizedStateCode);
                data.cusGstType = gstType;
                if (linkLedger) {
                    const linked = await this.createCustomerOnLedger(tx, data, linkLedger);
                    const supplierLive = (await this.findSupplierRole(tx, linkLedger.ledId)) !== null;
                    return {
                        ...(await this.withLastBilled(tx, linked)),
                        partySync: { otherRole: supplierLive ? 'SUPPLIER' : null, otherRoleUpdated: false, fields: [] },
                    };
                }
                const ledgerDto = this.buildLinkedLedgerDto(dto, { name: normalizedName, stateName: normalizedStateName, stateCode: normalizedStateCode }, { gstType, shared: false });
                let ledger;
                try {
                    ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
                }
                catch (error) {
                    rethrowLedgerNameClash(error);
                    throw error;
                }
                data.cusId = ledger.ledId;
                const created = await tx.customer.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: CUSTOMER_TABLE_NAME,
                    screenName: CUSTOMER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.cusId,
                    displayName: payload.cusName || payload.cusId,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Customer created',
                }, tx);
                return { ...payload, partySync: { ...party_sync_service_1.NO_PARTY_SYNC, fields: [] } };
            });
        }
        catch (error) {
            if (isLedgerNameUniqueViolation(error)) {
                (0, module_service_utils_1.throwSalesConflict)('Customer name already exists for this company', [CUSTOMER_NAME_EXISTS_DETAIL]);
            }
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Customer already exists', [
                {
                    field: 'cusName',
                    message: 'Duplicate customer details are not allowed',
                    code: customer_error_codes_1.CustomerErrorCode.DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async createCustomerOnLedger(tx, data, ledger) {
        const cusId = ledger.ledId;
        const previous = await tx.customer.findUnique({ where: { cusId } });
        if (previous && !previous.cusIsDeleted) {
            (0, module_service_utils_1.throwSalesConflict)('Customer already exists', [
                {
                    field: 'cusLinkLedId',
                    message: `Ledger "${ledger.ledName}" is already a customer`,
                    code: customer_error_codes_1.CustomerErrorCode.LINK_LEDGER_ALREADY_CUSTOMER,
                },
            ]);
        }
        let saved;
        if (previous) {
            const { cusCreatedOn, cusCreatedBy, ...revived } = data;
            saved = await tx.customer.update({
                where: { cusId },
                data: {
                    ...revived,
                    cusIsDeleted: false,
                    cusIsActive: data.cusIsActive ?? true,
                    cusModifiedOn: cusCreatedOn,
                    cusModifiedBy: cusCreatedBy,
                },
            });
        }
        else {
            saved = await tx.customer.create({ data: { ...data, cusId } });
        }
        const payload = this.toPayload(saved);
        await this.auditLogService.logEntityChange({
            action: previous ? 'update' : 'New',
            tableName: CUSTOMER_TABLE_NAME,
            screenName: CUSTOMER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: cusId,
            displayName: payload.cusName || payload.cusId,
            originalRecord: previous ? this.toPayload(previous) : null,
            modifiedRecord: payload,
            userId: saved.cusModifiedBy,
            notes: previous
                ? 'Customer restored on its existing ledger'
                : 'Customer created on an existing ledger',
        }, tx);
        return payload;
    }
    async loadLedgerToLink(tx, ledId) {
        const ledger = await tx.accLedgerMaster.findFirst({ where: { ledId, ledIsDeleted: false } });
        if (!ledger) {
            (0, module_service_utils_1.throwSalesBadRequest)('Ledger does not exist', [
                {
                    field: 'cusLinkLedId',
                    message: `No active account ledger found with id ${ledId}`,
                    code: customer_error_codes_1.CustomerErrorCode.LINK_LEDGER_NOT_FOUND,
                },
            ]);
        }
        if (ledger.ledLedgerType !== 'PARTY' && !(await this.findSupplierRole(tx, ledId))) {
            (0, module_service_utils_1.throwSalesBadRequest)('Ledger is not a party ledger', [
                {
                    field: 'cusLinkLedId',
                    message: `Ledger "${ledger.ledName}" is a ${ledger.ledLedgerType ?? 'untyped'} ledger; only a PARTY ledger can be a customer`,
                    code: customer_error_codes_1.CustomerErrorCode.LINK_LEDGER_NOT_PARTY,
                },
            ]);
        }
        return ledger;
    }
    findSupplierRole(tx, ledId) {
        return tx.supplier.findFirst({
            where: { supId: ledId, supIsDeleted: false },
            select: { supIsActive: true },
        });
    }
    async withLinkedLedgerDefaults(tx, saveCustomerDto, ledger) {
        const dto = { ...saveCustomerDto };
        if (dto.cusGstType === undefined || dto.cusGstType === null || dto.cusGstType === '') {
            const supplier = await tx.supplier.findFirst({
                where: { supId: ledger.ledId, supIsDeleted: false },
                select: { supGstType: true },
            });
            if (supplier?.supGstType) {
                dto.cusGstType = supplier.supGstType;
            }
        }
        const ledgerRecord = ledger;
        for (const [cusField, ledField] of CUSTOMER_FIELDS_FROM_LINKED_LEDGER) {
            const current = dto[cusField];
            const fallback = ledgerRecord[ledField];
            const maxLength = CUSTOMER_LINK_MAX_LENGTH[cusField];
            if ((current === undefined || current === null || current === '') &&
                fallback !== null &&
                fallback !== undefined &&
                !(maxLength !== undefined && typeof fallback === 'string' && fallback.length > maxLength)) {
                dto[cusField] = fallback;
            }
        }
        return dto;
    }
    async updateCustomer(saveCustomerDto) {
        const cusId = saveCustomerDto.cusId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const lockedLedger = await this.partyBalanceService.lockLedger(tx, cusId);
                const existing = await this.loadLiveCustomer(tx, cusId);
                const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(saveCustomerDto.cusStateName, 'cusStateName', undefined, customer_error_codes_1.CustomerErrorCode.STATE_NAME_REQUIRED);
                const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
                const normalizedName = saveCustomerDto.cusName !== undefined
                    ? (0, module_service_utils_1.normalizeRequiredText)(saveCustomerDto.cusName ?? '', 'cusName', undefined, customer_error_codes_1.CustomerErrorCode.NAME_REQUIRED)
                    : undefined;
                const nextAreaId = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusAreaId')
                    ? saveCustomerDto.cusAreaId
                    : existing.cusAreaId;
                const nextGroupId = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusGroupId')
                    ? saveCustomerDto.cusGroupId
                    : existing.cusGroupId;
                const companySent = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusCompanyId');
                const nextCompanyId = companySent
                    ? (saveCustomerDto.cusCompanyId ?? null)
                    : existing.cusCompanyId;
                const nextPriceLevelId = (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusPriceLevelId')
                    ? saveCustomerDto.cusPriceLevelId
                    : existing.cusPriceLevelId;
                await this.ensureCompanyExists(tx, nextCompanyId);
                await this.ensureAreaExists(tx, nextAreaId);
                await this.ensureCustomerGroupExists(tx, nextGroupId);
                await this.ensureStateCodeExists(tx, normalizedStateCode);
                await this.ensurePriceLevelExists(tx, nextPriceLevelId);
                await this.ensureBranchExists(tx, saveCustomerDto.cusBranchId);
                const gstType = this.resolveGstType((0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusGstType')
                    ? saveCustomerDto.cusGstType
                    : existing.cusGstType, (0, module_service_utils_1.isPresentField)(saveCustomerDto, 'cusGstNo') ? saveCustomerDto.cusGstNo : existing.cusGstNo, normalizedStateCode);
                const linkedLedger = lockedLedger && !lockedLedger.ledIsDeleted
                    ? await tx.accLedgerMaster.findFirst({
                        where: { ledId: cusId, ledIsDeleted: false },
                        select: { ledId: true, ledName: true, ledGroupId: true, ledCompanyId: true },
                    })
                    : null;
                if (linkedLedger && companySent && nextCompanyId !== linkedLedger.ledCompanyId) {
                    await this.ensureCompanyChangeAllowed(tx, cusId, linkedLedger.ledCompanyId, nextCompanyId);
                }
                const supplierRole = await this.findSupplierRole(tx, cusId);
                const now = new Date();
                const modifiedBy = (0, module_service_utils_1.resolveActor)(null, this.requestContextService.getUserId());
                const data = {
                    cusStateName: normalizedStateName,
                    cusStateCode: normalizedStateCode,
                    cusCompanyId: nextCompanyId,
                    cusAreaId: nextAreaId,
                    cusGroupId: nextGroupId,
                    cusPriceLevelId: nextPriceLevelId,
                    cusModifiedOn: now,
                    cusModifiedBy: modifiedBy,
                };
                this.applyOptionalFields(data, saveCustomerDto);
                data.cusGstType = gstType;
                if (normalizedName !== undefined) {
                    data.cusName = normalizedName;
                }
                const updated = await tx.customer.update({
                    where: {
                        cusId,
                    },
                    data,
                });
                if (linkedLedger) {
                    const ledgerDto = this.buildLinkedLedgerDto(saveCustomerDto, {
                        name: updated.cusName || linkedLedger.ledName,
                        stateName: normalizedStateName,
                        stateCode: normalizedStateCode,
                    }, { gstType, shared: supplierRole !== null });
                    ledgerDto.ledId = cusId;
                    ledgerDto.ledGroupId = supplierRole ? linkedLedger.ledGroupId : nextAreaId;
                    if (supplierRole) {
                        ledgerDto.ledIsActive = updated.cusIsActive || supplierRole.supIsActive;
                    }
                    try {
                        await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
                    }
                    catch (error) {
                        rethrowLedgerNameClash(error);
                        throw error;
                    }
                }
                const partySync = supplierRole
                    ? await this.partySyncService.syncOtherRole(tx, {
                        role: 'CUSTOMER',
                        partyId: cusId,
                        details: this.partySyncService.detailsOf('CUSTOMER', saveCustomerDto, {
                            ...(normalizedName !== undefined ? { ledName: normalizedName } : {}),
                            ledStateName: normalizedStateName,
                            ledStateCode: normalizedStateCode,
                            ...(companySent ? { ledCompanyId: nextCompanyId } : {}),
                        }),
                        gstType,
                        actor: modifiedBy,
                        assertOtherNameFree: (name, companyId) => this.ensureSupplierNameFree(tx, name, companyId, cusId),
                    })
                    : { ...party_sync_service_1.NO_PARTY_SYNC, fields: [] };
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: CUSTOMER_TABLE_NAME,
                    screenName: CUSTOMER_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: cusId,
                    displayName: payload.cusName || payload.cusId,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: modifiedBy,
                    notes: 'Customer updated',
                }, tx);
                return { ...(await this.withLastBilled(tx, payload)), partySync };
            });
        }
        catch (error) {
            if (isLedgerNameUniqueViolation(error)) {
                (0, module_service_utils_1.throwSalesConflict)('Customer name already exists for this company', [CUSTOMER_NAME_EXISTS_DETAIL]);
            }
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Customer already exists', [
                {
                    field: 'cusName',
                    message: 'Duplicate customer details are not allowed',
                    code: customer_error_codes_1.CustomerErrorCode.DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async resolveRelatedNames(client, record) {
        const [company, branch, area, group, priceLevel] = await Promise.all([
            record.cusCompanyId
                ? client.company.findFirst({
                    where: { compId: record.cusCompanyId },
                    select: { compName: true },
                })
                : null,
            record.cusBranchId
                ? client.branchMaster.findFirst({
                    where: { brId: record.cusBranchId },
                    select: { brName: true },
                })
                : null,
            record.cusAreaId
                ? client.areaMaster.findFirst({
                    where: { armId: record.cusAreaId },
                    select: { armName: true },
                })
                : null,
            record.cusGroupId
                ? client.custGroup.findFirst({
                    where: { cgrId: record.cusGroupId },
                    select: { cgrName: true },
                })
                : null,
            record.cusPriceLevelId
                ? client.itemPriceLevel.findFirst({
                    where: { iplId: record.cusPriceLevelId },
                    select: { iplName: true },
                })
                : null,
        ]);
        return {
            cusCompanyName: company?.compName ?? null,
            cusBranchName: branch?.brName ?? null,
            cusAreaName: area?.armName ?? null,
            cusGroupName: group?.cgrName ?? null,
            cusPriceLevelName: priceLevel?.iplName ?? null,
        };
    }
    async ensureAreaExists(tx, areaId) {
        const area = await tx.areaMaster.findFirst({
            where: {
                armId: areaId,
                armIsDeleted: false,
            },
            select: {
                armId: true,
            },
        });
        if (!area) {
            (0, module_service_utils_1.throwSalesBadRequest)('Area does not exist', [
                {
                    field: 'cusAreaId',
                    message: `No active area found with id ${areaId}`,
                    code: customer_error_codes_1.CustomerErrorCode.AREA_NOT_FOUND,
                },
            ]);
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
                    field: 'cusCompanyId',
                    message: `No active company found with id ${companyId}`,
                    code: customer_error_codes_1.CustomerErrorCode.COMPANY_NOT_FOUND,
                },
            ]);
        }
    }
    async ensureCustomerGroupExists(tx, groupId) {
        const group = await tx.custGroup.findFirst({
            where: {
                cgrId: groupId,
                cgrIsDeleted: false,
            },
            select: {
                cgrId: true,
            },
        });
        if (!group) {
            (0, module_service_utils_1.throwSalesBadRequest)('Customer group does not exist', [
                {
                    field: 'cusGroupId',
                    message: `No active customer group found with id ${groupId}`,
                    code: customer_error_codes_1.CustomerErrorCode.GROUP_NOT_FOUND,
                },
            ]);
        }
    }
    async ensurePriceLevelExists(tx, priceLevelId) {
        const level = await tx.itemPriceLevel.findFirst({
            where: { iplId: priceLevelId, iplIsDeleted: false },
            select: { iplId: true },
        });
        if (!level) {
            (0, module_service_utils_1.throwSalesBadRequest)('Price level does not exist', [
                {
                    field: 'cusPriceLevelId',
                    message: `No active price level found with id ${priceLevelId}`,
                    code: customer_error_codes_1.CustomerErrorCode.PRICE_LEVEL_NOT_FOUND,
                },
            ]);
        }
    }
    async ensureBranchExists(tx, branchId) {
        if (branchId === undefined || branchId === null) {
            return;
        }
        const branch = await tx.branchMaster.findFirst({
            where: { brId: branchId, brIsDeleted: false },
            select: { brId: true },
        });
        if (!branch) {
            (0, module_service_utils_1.throwSalesBadRequest)('Branch does not exist', [
                {
                    field: 'cusBranchId',
                    message: `No active branch found with id ${branchId}`,
                    code: customer_error_codes_1.CustomerErrorCode.BRANCH_NOT_FOUND,
                },
            ]);
        }
    }
    resolveGstType(rawType, gstin, stateCode) {
        const result = (0, party_gst_type_1.resolvePartyGstType)({ rawType, gstin, stateCode });
        if ('type' in result) {
            return result.type;
        }
        const detail = customerGstRefusal(result.refusal);
        (0, module_service_utils_1.throwSalesBadRequest)('Validation failed', [detail]);
    }
    async ensureCompanyChangeAllowed(tx, ledId, currentCompanyId, nextCompanyId) {
        const books = await this.partyBalanceService.companyWithBooks(tx, ledId, currentCompanyId, nextCompanyId);
        if (books) {
            (0, module_service_utils_1.throwConflict)('Customer company cannot change', [
                (0, party_balance_service_1.withFigures)({
                    field: 'cusCompanyId',
                    code: customer_error_codes_1.CustomerErrorCode.COMPANY_HAS_BOOKS,
                    message: `The party has entries in company ${books.companyId}; its company cannot change`,
                }, `This party has entries in ${books.companyName ?? 'its company'}.`),
            ]);
        }
    }
    async ensureSupplierNameFree(tx, name, companyId, ownId) {
        const clash = await tx.supplier.findFirst({
            where: {
                supIsDeleted: false,
                supCompanyId: companyId,
                supName: { equals: name, mode: 'insensitive' },
                supId: { not: ownId },
            },
            select: { supId: true },
        });
        if (clash) {
            (0, module_service_utils_1.throwSalesConflict)('Customer name already exists for this company', [
                {
                    ...CUSTOMER_NAME_EXISTS_DETAIL,
                    message: 'Another supplier of this company has this name; the shared supplier would clash',
                },
            ]);
        }
    }
    async ensureStateCodeExists(tx, stateCode) {
        const state = await tx.stateCode.findFirst({
            where: {
                stateCode,
                isDeleted: false,
            },
            select: {
                stateCode: true,
            },
        });
        if (!state) {
            (0, module_service_utils_1.throwSalesBadRequest)('State does not exist', [
                {
                    field: 'cusStateCode',
                    message: `No active state found with code ${stateCode}`,
                    code: customer_error_codes_1.CustomerErrorCode.STATE_NOT_FOUND,
                },
            ]);
        }
    }
    buildLinkedLedgerDto(saveCustomerDto, normalized, party) {
        const ledgerDto = {
            ledGroupId: saveCustomerDto.cusAreaId,
            ledName: normalized.name,
            ledStateName: normalized.stateName,
            ledStateCode: normalized.stateCode,
            ledIsBillByBill: true,
            ...(0, party_gst_type_1.ledgerGstFieldsOf)(party.gstType),
        };
        const ledgerDtoRecord = ledgerDto;
        Object.assign(ledgerDtoRecord, this.partySyncService.detailsOf('CUSTOMER', saveCustomerDto));
        const customerRecord = saveCustomerDto;
        for (const [cusField, ledField] of CUSTOMER_TO_LEDGER_FIELD_MAP) {
            if (cusField === 'cusNotes' && party.shared) {
                continue;
            }
            if ((0, module_service_utils_1.isPresentField)(saveCustomerDto, cusField)) {
                ledgerDtoRecord[ledField] =
                    cusField === 'cusSortOrder'
                        ? zeroWhenCleared(customerRecord[cusField])
                        : customerRecord[cusField];
            }
        }
        const itCollectionFlags = toLedgerItCollectionFlags(saveCustomerDto);
        if (itCollectionFlags.tcs !== undefined) {
            ledgerDto.ledIsTcsApplicable = itCollectionFlags.tcs;
        }
        if (itCollectionFlags.tds !== undefined) {
            ledgerDto.ledIsTdsApplicable = itCollectionFlags.tds;
        }
        return ledgerDto;
    }
    applyOptionalFields(data, saveCustomerDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveCustomerDto, CUSTOMER_OPTIONAL_FIELDS, {
            cusBirthDate: (value) => this.toDateOrNull(value, 'cusBirthDate'),
            cusMarriageDate: (value) => this.toDateOrNull(value, 'cusMarriageDate'),
            cusCollectionDays: (value) => value ?? [],
            ...Object.fromEntries(CUSTOMER_ZERO_WHEN_CLEARED_FIELDS.map((field) => [field, zeroWhenCleared])),
        });
    }
    normalizeStateCode(value) {
        const normalized = (value ?? '').trim().toUpperCase();
        if (normalized.length !== 2) {
            (0, module_service_utils_1.throwSalesBadRequest)('Validation failed', [
                {
                    field: 'cusStateCode',
                    message: 'cusStateCode must be exactly 2 characters',
                    code: customer_error_codes_1.CustomerErrorCode.STATE_CODE_INVALID,
                },
            ]);
        }
        return normalized;
    }
    toDateOrNull(value, field) {
        if (value === undefined) {
            return undefined;
        }
        if (value === null) {
            return null;
        }
        const dateValue = new Date(value);
        if (Number.isNaN(dateValue.getTime())) {
            (0, module_service_utils_1.throwSalesBadRequest)('Validation failed', [
                {
                    field,
                    message: `${field} must be a valid ISO date`,
                    code: customer_error_codes_1.CustomerErrorCode.INVALID_DATE,
                },
            ]);
        }
        return dateValue;
    }
    toPayload(record) {
        return {
            cusId: record.cusId,
            cusTitle: record.cusTitle,
            cusShort: record.cusShort,
            cusCode: record.cusCode,
            cusName: record.cusName,
            cusAddr1: record.cusAddr1,
            cusAddr2: record.cusAddr2,
            cusAddr3: record.cusAddr3,
            cusCity: record.cusCity,
            cusDistrict: record.cusDistrict,
            cusStateName: record.cusStateName,
            cusCountry: record.cusCountry,
            cusStateCode: record.cusStateCode,
            cusLandmark: record.cusLandmark,
            cusPin: record.cusPin,
            cusTel: record.cusTel,
            cusPhone1: record.cusPhone1,
            cusPhone2: record.cusPhone2,
            cusWhatsappNo: record.cusWhatsappNo,
            cusEmail: record.cusEmail,
            cusAadharNo: record.cusAadharNo,
            cusContactPerson: record.cusContactPerson,
            cusDistanceKm: record.cusDistanceKm,
            cusCreditAllowed: record.cusCreditAllowed,
            cusCreditBillLimit: record.cusCreditBillLimit,
            cusCreditAmtLimit: (0, module_service_utils_1.toNumber)(record.cusCreditAmtLimit),
            cusCreditDays: record.cusCreditDays,
            cusDebitBalance: (0, module_service_utils_1.toNumber)(record.cusDebitBalance),
            cusDiscPerc: (0, module_service_utils_1.toNumber)(record.cusDiscPerc),
            cusDebitGraceDays: record.cusDebitGraceDays,
            cusEnableSms: record.cusEnableSms,
            cusOverdueSms: record.cusOverdueSms,
            cusOverdueBilling: record.cusOverdueBilling,
            cusAllowPromotion: record.cusAllowPromotion,
            cusAllowLoyalty: record.cusAllowLoyalty,
            cusAllowDiscount: record.cusAllowDiscount,
            cusSortOrder: record.cusSortOrder,
            cusRegionName: record.cusRegionName,
            cusRegionAddr1: record.cusRegionAddr1,
            cusRegionAddr2: record.cusRegionAddr2,
            cusRegionAddr3: record.cusRegionAddr3,
            cusRegionCity: record.cusRegionCity,
            cusRegionDistrict: record.cusRegionDistrict,
            cusRegionStateName: record.cusRegionStateName,
            cusRegionCountry: record.cusRegionCountry,
            cusBirthDate: record.cusBirthDate ? record.cusBirthDate.toISOString() : null,
            cusMarriageDate: record.cusMarriageDate ? record.cusMarriageDate.toISOString() : null,
            cusTransportName: record.cusTransportName,
            cusFreightCharge: record.cusFreightCharge,
            cusLoadingCharge: record.cusLoadingCharge,
            cusUnloadingCharge: record.cusUnloadingCharge,
            cusGstNo: record.cusGstNo,
            cusPanNo: record.cusPanNo,
            cusGstType: record.cusGstType,
            cusEcommerceGstin: record.cusEcommerceGstin,
            cusTcsApplicable: record.cusTcsApplicable,
            cusItcollExempted: record.cusItcollExempted,
            cusItcollType: record.cusItcollType,
            cusGeoLocation: record.cusGeoLocation,
            cusCollectionDays: record.cusCollectionDays,
            cusDefaultSalesman: record.cusDefaultSalesman,
            cusPriceLevelId: record.cusPriceLevelId,
            cusBilledDate: record.cusBilledDate ? record.cusBilledDate.toISOString() : null,
            cusBilledCount: record.cusBilledCount,
            cusNotes: record.cusNotes,
            cusCompanyId: record.cusCompanyId,
            cusBranchId: record.cusBranchId,
            cusAreaId: record.cusAreaId,
            cusGroupId: record.cusGroupId,
            cusIsActive: record.cusIsActive,
            cusIsDeleted: record.cusIsDeleted,
            cusSyncDate: record.cusSyncDate ? record.cusSyncDate.toISOString() : null,
            cusCreatedOn: record.cusCreatedOn.toISOString(),
            cusCreatedBy: record.cusCreatedBy,
            cusModifiedOn: record.cusModifiedOn.toISOString(),
            cusModifiedBy: record.cusModifiedBy,
        };
    }
};
exports.CustomerService = CustomerService;
exports.CustomerService = CustomerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        account_ledger_masters_service_1.AccountLedgerMastersService,
        party_balance_service_1.PartyBalanceService,
        party_sync_service_1.PartySyncService])
], CustomerService);
function customerGstRefusal(refusal) {
    switch (refusal.kind) {
        case 'TYPE_INVALID':
            return {
                field: 'cusGstType',
                message: `cusGstType "${refusal.sent}" is not one of REGULAR, COMPOSITION, SEZ, OVERSEAS, UNREGISTERED`,
                code: customer_error_codes_1.CustomerErrorCode.GST_TYPE_INVALID,
            };
        case 'TYPE_REQUIRED':
            return {
                field: 'cusGstType',
                message: 'cusGstType is required when cusGstNo is given',
                code: customer_error_codes_1.CustomerErrorCode.GST_TYPE_REQUIRED,
            };
        case 'GSTIN_REQUIRED':
            return {
                field: 'cusGstNo',
                message: `A ${(0, party_gst_type_1.partyGstTypeWord)(refusal.type)} customer must have a GSTIN`,
                code: customer_error_codes_1.CustomerErrorCode.GSTIN_REQUIRED,
            };
        case 'GSTIN_NOT_ALLOWED':
            return {
                field: 'cusGstNo',
                message: `An ${(0, party_gst_type_1.partyGstTypeWord)(refusal.type)} customer has no GSTIN; clear cusGstNo`,
                code: customer_error_codes_1.CustomerErrorCode.GSTIN_NOT_ALLOWED,
            };
        case 'OVERSEAS_STATE':
            return {
                field: 'cusStateCode',
                message: `An Overseas customer's state must be 96 (Other Country), not ${refusal.stateCode}`,
                code: customer_error_codes_1.CustomerErrorCode.OVERSEAS_STATE,
            };
        case 'GSTIN_STATE_MISMATCH':
            return {
                field: 'cusGstNo',
                message: `GSTIN ${refusal.gstin} is registered in state ${refusal.gstinState}, but cusStateCode is ${refusal.stateCode}`,
                code: customer_error_codes_1.CustomerErrorCode.GSTIN_STATE_MISMATCH,
            };
    }
}
//# sourceMappingURL=customer.service.js.map