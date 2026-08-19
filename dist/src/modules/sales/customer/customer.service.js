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
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const CUSTOMER_TABLE_NAME = 'customers';
const CUSTOMER_AUDIT_SCREEN_NAME = 'Customer Master';
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
    ['cusCompanyId', 'ledCompanyId'],
    ['cusBranchId', 'ledBranchId'],
    ['cusShort', 'ledShort'],
    ['cusEmail', 'ledEmail'],
    ['cusTel', 'ledTel'],
    ['cusPhone1', 'ledPhone1'],
    ['cusPhone2', 'ledPhone2'],
    ['cusWhatsappNo', 'ledWhatsappNo'],
    ['cusContactPerson', 'ledContactPerson'],
    ['cusAddr1', 'ledAddr1'],
    ['cusAddr2', 'ledAddr2'],
    ['cusAddr3', 'ledAddr3'],
    ['cusCity', 'ledCity'],
    ['cusDistrict', 'ledDistrict'],
    ['cusPin', 'ledPin'],
    ['cusCountry', 'ledCountry'],
    ['cusRegionName', 'ledRegionName'],
    ['cusRegionAddr1', 'ledRegionAddr1'],
    ['cusRegionAddr2', 'ledRegionAddr2'],
    ['cusRegionAddr3', 'ledRegionAddr3'],
    ['cusRegionCity', 'ledRegionCity'],
    ['cusRegionDistrict', 'ledRegionDistrict'],
    ['cusRegionStateName', 'ledRegionStateName'],
    ['cusRegionCountry', 'ledRegionCountry'],
    ['cusGstNo', 'ledGstinNo'],
    ['cusPanNo', 'ledPanNo'],
    ['cusAadharNo', 'ledAadharNo'],
    ['cusEcommerceGstin', 'ledEcommerceGstin'],
    ['cusNotes', 'ledRemarks'],
    ['cusIsActive', 'ledIsActive'],
];
let CustomerService = class CustomerService {
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
    async save(saveCustomerDto) {
        if (saveCustomerDto.cusId) {
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
            (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`);
        }
        const payload = this.toPayload(record);
        const relatedNames = await this.resolveRelatedNames(this.prisma, record);
        return { ...payload, ...relatedNames };
    }
    async softDelete(cusId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.customer.findFirst({
                where: {
                    cusId,
                    cusIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`);
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
                (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`);
            }
            await tx.accLedgerMaster.updateMany({
                where: { ledId: cusId, ledIsDeleted: false },
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
                notes: 'Customer soft deleted',
            }, tx);
            return {
                cusId,
                deleted: true,
            };
        });
    }
    async createCustomer(saveCustomerDto) {
        const normalizedName = (0, module_service_utils_1.normalizeRequiredText)(saveCustomerDto.cusName ?? '', 'cusName');
        const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(saveCustomerDto.cusStateName, 'cusStateName');
        const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveCustomerDto.cusCreatedBy, this.requestContextService.getUserId());
        const data = {
            cusStateName: normalizedStateName,
            cusStateCode: normalizedStateCode,
            cusCompanyId: (0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, 'cusCompanyId')
                ? (saveCustomerDto.cusCompanyId ?? null)
                : null,
            cusAreaId: saveCustomerDto.cusAreaId,
            cusGroupId: saveCustomerDto.cusGroupId,
            cusPriceLevelId: saveCustomerDto.cusPriceLevelId,
            cusCollectionDays: (0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, 'cusCollectionDays')
                ? (saveCustomerDto.cusCollectionDays ?? [])
                : [],
            cusBilledDate: now,
            cusBilledCount: 1,
            cusCreatedOn: now,
            cusCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveCustomerDto);
        data.cusName = normalizedName;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensureCompanyExists(tx, data.cusCompanyId ?? null);
                await this.ensureAreaExists(tx, data.cusAreaId);
                await this.ensureCustomerGroupExists(tx, data.cusGroupId);
                await this.ensureStateCodeExists(tx, normalizedStateCode);
                const ledgerDto = this.buildLinkedLedgerDto(saveCustomerDto, {
                    name: normalizedName,
                    stateName: normalizedStateName,
                    stateCode: normalizedStateCode,
                });
                const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
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
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Customer already exists', [
                {
                    field: 'cusName',
                    message: 'Duplicate customer details are not allowed',
                },
            ]);
            throw error;
        }
    }
    async updateCustomer(saveCustomerDto) {
        const cusId = saveCustomerDto.cusId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.customer.findFirst({
                    where: {
                        cusId,
                        cusIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Customer not found', 'cusId', `No active customer found with id ${cusId}`);
                }
                const normalizedStateName = (0, module_service_utils_1.normalizeRequiredText)(saveCustomerDto.cusStateName, 'cusStateName');
                const normalizedStateCode = this.normalizeStateCode(saveCustomerDto.cusStateCode);
                const nextAreaId = (0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, 'cusAreaId')
                    ? saveCustomerDto.cusAreaId
                    : existing.cusAreaId;
                const nextGroupId = (0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, 'cusGroupId')
                    ? saveCustomerDto.cusGroupId
                    : existing.cusGroupId;
                const nextCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, 'cusCompanyId')
                    ? (saveCustomerDto.cusCompanyId ?? null)
                    : existing.cusCompanyId;
                const nextPriceLevelId = (0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, 'cusPriceLevelId')
                    ? saveCustomerDto.cusPriceLevelId
                    : existing.cusPriceLevelId;
                await this.ensureCompanyExists(tx, nextCompanyId);
                await this.ensureAreaExists(tx, nextAreaId);
                await this.ensureCustomerGroupExists(tx, nextGroupId);
                await this.ensureStateCodeExists(tx, normalizedStateCode);
                const now = new Date();
                const data = {
                    cusStateName: normalizedStateName,
                    cusStateCode: normalizedStateCode,
                    cusCompanyId: nextCompanyId,
                    cusAreaId: nextAreaId,
                    cusGroupId: nextGroupId,
                    cusPriceLevelId: nextPriceLevelId,
                    cusBilledDate: now,
                    cusBilledCount: {
                        increment: 1,
                    },
                    cusModifiedOn: now,
                    cusModifiedBy: (0, module_service_utils_1.resolveActor)(saveCustomerDto.cusModifiedBy, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveCustomerDto);
                const updated = await tx.customer.update({
                    where: {
                        cusId,
                    },
                    data,
                });
                const linkedLedger = await tx.accLedgerMaster.findFirst({
                    where: { ledId: cusId, ledIsDeleted: false },
                    select: { ledId: true, ledName: true },
                });
                if (linkedLedger) {
                    const ledgerDto = this.buildLinkedLedgerDto(saveCustomerDto, {
                        name: updated.cusName || linkedLedger.ledName,
                        stateName: normalizedStateName,
                        stateCode: normalizedStateCode,
                    });
                    ledgerDto.ledId = cusId;
                    ledgerDto.ledGroupId = nextAreaId;
                    try {
                        await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
                    }
                    catch (error) {
                        if (error instanceof common_1.ConflictException) {
                            (0, module_service_utils_1.throwSalesConflict)('Customer name already exists for this company', [
                                {
                                    field: 'cusName',
                                    message: 'Duplicate customer name is not allowed for this company',
                                },
                            ]);
                        }
                        throw error;
                    }
                }
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
                    userId: payload.cusModifiedBy,
                    notes: 'Customer updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Customer already exists', [
                {
                    field: 'cusName',
                    message: 'Duplicate customer details are not allowed',
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
                },
            ]);
        }
    }
    buildLinkedLedgerDto(saveCustomerDto, normalized) {
        const ledgerDto = {
            ledGroupId: saveCustomerDto.cusAreaId,
            ledName: normalized.name,
            ledStateName: normalized.stateName,
            ledStateCode: normalized.stateCode,
        };
        const ledgerDtoRecord = ledgerDto;
        const customerRecord = saveCustomerDto;
        for (const [cusField, ledField] of CUSTOMER_TO_LEDGER_FIELD_MAP) {
            if ((0, module_service_utils_1.hasOwnProperty)(saveCustomerDto, cusField)) {
                ledgerDtoRecord[ledField] = customerRecord[cusField];
            }
        }
        return ledgerDto;
    }
    applyOptionalFields(data, saveCustomerDto) {
        (0, module_service_utils_1.applyPresentFields)(data, saveCustomerDto, CUSTOMER_OPTIONAL_FIELDS, {
            cusBirthDate: (value) => this.toDateOrNull(value, 'cusBirthDate'),
            cusMarriageDate: (value) => this.toDateOrNull(value, 'cusMarriageDate'),
            cusCollectionDays: (value) => value ?? [],
        });
    }
    normalizeStateCode(value) {
        const normalized = value.trim().toUpperCase();
        if (normalized.length !== 2) {
            (0, module_service_utils_1.throwSalesBadRequest)('Validation failed', [
                {
                    field: 'cusStateCode',
                    message: 'cusStateCode must be exactly 2 characters',
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
        account_ledger_masters_service_1.AccountLedgerMastersService])
], CustomerService);
//# sourceMappingURL=customer.service.js.map