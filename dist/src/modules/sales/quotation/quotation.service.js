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
exports.QuotationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const quotation_api_types_1 = require("./types/quotation-api.types");
const charge_master_api_types_1 = require("../../master/charge-master/types/charge-master-api.types");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const QUOTATION_VCHR_TYPE_ID = 2;
const QUOTATION_TABLE_NAME = 'sale_quotation';
const QUOTATION_ITEM_TABLE_NAME = 'sale_quotation_item';
const QUOTATION_CHARGE_TABLE_NAME = 'txn_charge_detail';
const QUOTATION_AUDIT_SCREEN_NAME = 'Sale Quotation';
const QUOTATION_STATUS_EVENTS = {
    DRAFT: txn_status_log_helper_1.TxnStatusEvent.REOPENED,
    SENT: txn_status_log_helper_1.TxnStatusEvent.SENT,
    ACCEPTED: txn_status_log_helper_1.TxnStatusEvent.ACCEPTED,
    REJECTED: txn_status_log_helper_1.TxnStatusEvent.REJECTED,
    EXPIRED: txn_status_log_helper_1.TxnStatusEvent.EXPIRED,
    CONVERTED: txn_status_log_helper_1.TxnStatusEvent.CONVERTED,
    CANCELLED: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
};
const QUOTATION_DELETED_STATUS = 'DELETED';
const QUOTATION_DELETE_REASON = 'Quotation deleted';
const QUOTATION_OPTIONAL_FIELDS = [
    'sqSessionId',
    'sqCategoryId',
    'sqDocType',
    'sqUsrRefno',
    'sqQuoteDate',
    'sqQuoteDatetime',
    'sqValidUntil',
    'sqValidityDays',
    'sqRevisionNo',
    'sqSrcDocType',
    'sqSrcDocId',
    'sqSrcDocRefno',
    'sqSrcDocDate',
    'sqCustId',
    'sqCustAreaId',
    'sqCustAddr',
    'sqCustPlace',
    'sqCustPhone',
    'sqCustEmail',
    'sqCustGstin',
    'sqCustGstType',
    'sqCustStcd',
    'sqPosStcd',
    'sqStateName',
    'sqContactPerson',
    'sqContactPhone',
    'sqHasLoad',
    'sqHasUnload',
    'sqHasFreight',
    'sqHasPromo',
    'sqHasComm',
    'sqSalesmanId',
    'sqAgentId',
    'sqTotItems',
    'sqTotWeight',
    'sqTotBags',
    'sqGrossAmt',
    'sqItemDisc',
    'sqSplDisc',
    'sqSchDisc',
    'sqBillSchDisc',
    'sqAddlDisc1',
    'sqAddlDisc2',
    'sqTaxableAmt',
    'sqCgstAmt',
    'sqSgstAmt',
    'sqIgstAmt',
    'sqCessAmt',
    'sqTaxAmt',
    'sqFreightAmt',
    'sqLoadAmt',
    'sqUnloadAmt',
    'sqOtherAmt1',
    'sqOtherAmt2',
    'sqRoundOff',
    'sqQuoteAmt',
    'sqTotalCost',
    'sqMarginAmt',
    'sqMarginPerc',
    'sqPaymentTerms',
    'sqDeliveryTerms',
    'sqTermsConditions',
    'sqStatus',
    'sqSentOn',
    'sqAcceptedOn',
    'sqRejectedOn',
    'sqRejectReason',
    'sqConvertedDocType',
    'sqConvertedDocId',
    'sqConvertedOn',
    'sqApprovedOn',
    'sqApprovedBy',
    'sqCancelledOn',
    'sqCancelledBy',
    'sqCancelReason',
    'sqMrpSavings',
    'sqMrpSavingsPerc',
    'sqPrintCount',
    'sqDeviceType',
    'sqDeviceId',
    'sqRemarks',
    'sqFreightCalcType',
    'sqLoadingCalcType',
    'sqDiscAlterBase',
];
const QUOTATION_ITEM_OPTIONAL_FIELDS = [
    'sqiSrcDocType',
    'sqiSrcItemId',
    'sqiSrcUnitId',
    'sqiSrcDocRefno',
    'sqiSrcItemQty',
    'sqiHsnCode',
    'sqiEanCode',
    'sqiBatchNo',
    'sqiBatchDate',
    'sqiExpiryDate',
    'sqiIsTaxIncl',
    'sqiIsPromo',
    'sqiIsFree',
    'sqiFreeType',
    'sqiIsService',
    'sqiCaseQty',
    'sqiBillQty',
    'sqiLengthQty',
    'sqiNetQty',
    'sqiWeightQty',
    'sqiAvailableStock',
    'sqiRate',
    'sqiRatePreTax',
    'sqiItemDiscPerc',
    'sqiItemDiscQty',
    'sqiItemDiscAmt',
    'sqiSplDiscPerc',
    'sqiSplDiscQty',
    'sqiSplDiscAmt',
    'sqiSchDiscPerc',
    'sqiSchDiscQty',
    'sqiSchDiscAmt',
    'sqiBillSchPerc',
    'sqiBillSchQty',
    'sqiBillSchAmt',
    'sqiAddlDisc1Perc',
    'sqiAddlDisc1Amt',
    'sqiAddlDisc2Perc',
    'sqiAddlDisc2Amt',
    'sqiCashDiscPerc',
    'sqiCashDiscAmt',
    'sqiGrossAmt',
    'sqiTaxableAmt',
    'sqiTaxPerc',
    'sqiTaxAmt',
    'sqiCgstPerc',
    'sqiCgstAmt',
    'sqiSgstPerc',
    'sqiSgstAmt',
    'sqiIgstPerc',
    'sqiIgstAmt',
    'sqiCessPerc',
    'sqiCessPerUnit',
    'sqiCessAmt',
    'sqiAcessPerc',
    'sqiAcessPerUnit',
    'sqiAcessAmt',
    'sqiFreightQty',
    'sqiFreightAmt',
    'sqiLoadQty',
    'sqiLoadAmt',
    'sqiUnloadQty',
    'sqiUnloadAmt',
    'sqiRoundOff',
    'sqiNetAmt',
    'sqiCostPrice',
    'sqiMaxPrice',
    'sqiMinPrice',
    'sqiActPrice',
    'sqiQuotePrice',
    'sqiItemProfit',
    'sqiCostPreTax',
    'sqiQuotePreTax',
    'sqiProfitPreTax',
    'sqiMrpSavings',
    'sqiMrpSavingsPerc',
    'sqiSchemeId',
    'sqiSchemeName',
    'sqiRemarks',
    'sqiNetGross',
    'sqiChrgBeforeTax',
    'sqiChrgAfterTax',
    'sqiToBaseFactor',
    'sqiRateDiff',
    'sqiHasFreight',
    'sqiSize',
    'sqiSizeUom',
];
const QUOTATION_CHARGE_OPTIONAL_FIELDS = [
    'cdChgName',
    'cdRole',
    'cdMethod',
    'cdType',
    'cdApplyOn',
    'cdLandingCost',
    'cdCostAlloc',
    'cdBeforeTax',
    'cdTaxApl',
    'cdSepPost',
    'cdUnit',
    'cdQtyVal',
    'cdWeight',
    'cdRate',
    'cdAmount',
    'cdTaxCode',
    'cdHsn',
    'cdTaxPerc',
    'cdTaxAmt',
    'cdSgstPerc',
    'cdSgstAmt',
    'cdCgstPerc',
    'cdCgstAmt',
    'cdIgstPerc',
    'cdIgstAmt',
    'cdCessPerc',
    'cdCessAmt',
    'cdNetAmt',
    'cdRemarks',
    'cdIsActive',
];
const QUOTATION_DATE_FIELDS = [
    'sqQuoteDate',
    'sqQuoteDatetime',
    'sqValidUntil',
    'sqSrcDocDate',
    'sqSentOn',
    'sqAcceptedOn',
    'sqRejectedOn',
    'sqConvertedOn',
    'sqApprovedOn',
    'sqCancelledOn',
];
const QUOTATION_ITEM_DATE_FIELDS = ['sqiBatchDate', 'sqiExpiryDate'];
function toDateOrNull(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === '') {
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
function buildDateTransforms(fields) {
    return Object.fromEntries(fields.map((field) => [field, (value) => toDateOrNull(value, field)]));
}
const QUOTATION_DATE_TRANSFORMS = buildDateTransforms(QUOTATION_DATE_FIELDS);
const QUOTATION_ITEM_DATE_TRANSFORMS = buildDateTransforms(QUOTATION_ITEM_DATE_FIELDS);
const QUOTATION_SLNO_INDEX = 'ux_sq_slno';
const QUOTATION_ITEM_LINE_INDEX = 'ux_sqi_quote_line';
function uniqueConstraintTarget(error) {
    const target = error?.meta?.target;
    if (Array.isArray(target)) {
        return target.join(',');
    }
    return typeof target === 'string' ? target : '';
}
let QuotationService = class QuotationService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveQuotationDto) {
        if (saveQuotationDto.sqId) {
            return this.updateQuotation(saveQuotationDto);
        }
        return this.createQuotation(saveQuotationDto);
    }
    async getById(sqId, sqCompanyId, sqBranchId, sqAccYear) {
        const record = await this.prisma.saleQuotation.findFirst({
            where: {
                sqId,
                sqCompanyId,
                sqBranchId,
                sqAccYear,
                sqIsDeleted: false,
            },
            include: {
                items: {
                    where: { sqiIsDeleted: false },
                    orderBy: { sqiLineNo: 'asc' },
                    include: {
                        item: {
                            select: {
                                itemNameEn: true,
                                itemBatchConfig: true,
                                itemGroupId: true,
                                itemBrandId: true,
                                itemSectionId: true,
                                itemCategoryId: true,
                            },
                        },
                        itemUnitConversion: {
                            select: { unit: { select: { unit_name: true, unit_decimal_count: true } } },
                        },
                    },
                },
                custArea: { select: { armName: true, armDistanceKm: true } },
                salesman: { select: { empName: true } },
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Quotation not found', 'sqId', `No active quotation found with id ${sqId}`);
        }
        const charges = await this.findCharges(this.prisma, sqId);
        const agent = await this.findAgent(record.sqAgentId);
        return this.toPayload({ ...record, charges, agent });
    }
    async softDelete(sqId, sqCompanyId, sqBranchId, sqAccYear) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.saleQuotation.findFirst({
                where: {
                    sqId,
                    sqCompanyId,
                    sqBranchId,
                    sqAccYear,
                    sqIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Quotation not found', 'sqId', `No active quotation found with id ${sqId}`);
            }
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.saleQuotation.updateMany({
                where: {
                    sqId,
                    sqCompanyId,
                    sqBranchId,
                    sqAccYear,
                    sqIsDeleted: false,
                },
                data: {
                    sqIsDeleted: true,
                    sqModifiedOn: modifiedOn,
                    sqModifiedBy: actor,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Quotation not found', 'sqId', `No active quotation found with id ${sqId}`);
            }
            await tx.saleQuotationItem.updateMany({
                where: {
                    sqiQuoteId: sqId,
                    sqiAccYear: sqAccYear,
                    sqiIsDeleted: false,
                },
                data: {
                    sqiIsDeleted: true,
                    sqiModifiedOn: modifiedOn,
                    sqiModifiedBy: actor,
                },
            });
            await tx.transactionChargeDetail.updateMany({
                where: {
                    cdDocType: quotation_api_types_1.QUOTATION_CHARGE_DOC_TYPE,
                    cdDocId: sqId,
                    cdIsDeleted: false,
                },
                data: {
                    cdIsDeleted: true,
                    cdModifiedOn: modifiedOn,
                    cdModifiedBy: actor,
                },
            });
            await this.logStatusStep(tx, existing, {
                event: txn_status_log_helper_1.TxnStatusEvent.DELETED,
                fromStatus: existing.sqStatus,
                toStatus: QUOTATION_DELETED_STATUS,
                remarks: existing.sqCancelReason ?? QUOTATION_DELETE_REASON,
            }, actor, modifiedOn);
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                sqIsDeleted: true,
                sqModifiedOn: modifiedOn,
                sqModifiedBy: actor,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: QUOTATION_TABLE_NAME,
                screenName: QUOTATION_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: sqId,
                displayName: existing.sqQuoteRefno || sqId,
                originalRecord,
                modifiedRecord,
                userId: actor,
                notes: 'Quotation soft deleted',
            }, tx);
            return {
                sqId,
                deleted: true,
            };
        });
    }
    async createQuotation(saveQuotationDto) {
        const normalizedCustName = (0, module_service_utils_1.normalizeRequiredText)(saveQuotationDto.sqCustName ?? '', 'sqCustName');
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveQuotationDto.sqCreatedBy, this.requestContextService.getUserId());
        const quoteDate = saveQuotationDto.sqQuoteDate ? new Date(saveQuotationDto.sqQuoteDate) : now;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const quoteNumber = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
                    vchrTypeId: QUOTATION_VCHR_TYPE_ID,
                    companyId: saveQuotationDto.sqCompanyId,
                    branchId: saveQuotationDto.sqBranchId,
                    accYear: saveQuotationDto.sqAccYear,
                    documentDate: quoteDate,
                });
                const data = {
                    sqCompanyId: saveQuotationDto.sqCompanyId,
                    sqBranchId: saveQuotationDto.sqBranchId,
                    sqTenantId: saveQuotationDto.sqTenantId,
                    sqAccYear: saveQuotationDto.sqAccYear,
                    sqPriceLevel: saveQuotationDto.sqPriceLevel,
                    sqQuoteSlno: quoteNumber.lastNo,
                    sqQuoteRefno: quoteNumber.refno,
                    sqQuoteDate: quoteDate,
                    sqCustName: normalizedCustName,
                    sqUserId: saveQuotationDto.sqUserId,
                    sqCreatedOn: now,
                    sqCreatedBy: createdBy,
                    sqStatus: saveQuotationDto.sqStatus || 'DRAFT',
                };
                this.applyOptionalFields(data, saveQuotationDto);
                this.applyParentRevision(data, saveQuotationDto, saveQuotationDto.sqAccYear);
                data.sqCustName = normalizedCustName;
                data.sqQuoteDate = quoteDate;
                const created = await tx.saleQuotation.create({ data });
                const scope = {
                    sqId: created.sqId,
                    sqCompanyId: created.sqCompanyId,
                    sqBranchId: created.sqBranchId,
                    sqTenantId: created.sqTenantId,
                    sqAccYear: created.sqAccYear,
                    sqPriceLevel: created.sqPriceLevel,
                    sqQuoteSlno: created.sqQuoteSlno,
                };
                const items = await this.syncItems(tx, scope, saveQuotationDto.items, createdBy);
                const charges = await this.syncCharges(tx, scope, saveQuotationDto.charges, createdBy);
                await this.logStatusStep(tx, created, {
                    event: this.toStatusEvent(null, created.sqStatus),
                    fromStatus: null,
                    toStatus: created.sqStatus,
                }, createdBy, now);
                const payload = this.toPayload({ ...created, items, charges });
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: QUOTATION_TABLE_NAME,
                    screenName: QUOTATION_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: payload.sqId,
                    displayName: payload.sqQuoteRefno || payload.sqId,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Quotation created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            const duplicate = await this.describeDuplicate(error);
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, duplicate.message, duplicate.errors);
            throw error;
        }
    }
    async updateQuotation(saveQuotationDto) {
        const sqId = saveQuotationDto.sqId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.saleQuotation.findFirst({
                    where: {
                        sqId,
                        sqIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Quotation not found', 'sqId', `No active quotation found with id ${sqId}`);
                }
                const now = new Date();
                const modifiedBy = (0, module_service_utils_1.resolveActor)(saveQuotationDto.sqModifiedBy, this.requestContextService.getUserId());
                const data = {
                    sqModifiedOn: now,
                    sqModifiedBy: modifiedBy,
                };
                this.applyOptionalFields(data, saveQuotationDto);
                this.applyParentRevision(data, saveQuotationDto, existing.sqAccYear);
                if (saveQuotationDto.sqCustName !== undefined) {
                    data.sqCustName = (0, module_service_utils_1.normalizeRequiredText)(saveQuotationDto.sqCustName, 'sqCustName');
                }
                const updated = await tx.saleQuotation.update({
                    where: { sqId_sqAccYear: { sqId, sqAccYear: existing.sqAccYear } },
                    data,
                });
                const scope = {
                    sqId: updated.sqId,
                    sqCompanyId: updated.sqCompanyId,
                    sqBranchId: updated.sqBranchId,
                    sqTenantId: updated.sqTenantId,
                    sqAccYear: updated.sqAccYear,
                    sqPriceLevel: updated.sqPriceLevel,
                    sqQuoteSlno: updated.sqQuoteSlno,
                };
                const items = await this.syncItems(tx, scope, saveQuotationDto.items, modifiedBy);
                const charges = await this.syncCharges(tx, scope, saveQuotationDto.charges, modifiedBy);
                if (updated.sqStatus !== existing.sqStatus) {
                    await this.logStatusStep(tx, updated, {
                        event: this.toStatusEvent(existing.sqStatus, updated.sqStatus),
                        fromStatus: existing.sqStatus,
                        toStatus: updated.sqStatus,
                    }, modifiedBy, now);
                }
                const payload = this.toPayload({ ...updated, items, charges });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: QUOTATION_TABLE_NAME,
                    screenName: QUOTATION_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: sqId,
                    displayName: payload.sqQuoteRefno || payload.sqId,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.sqModifiedBy || payload.sqCreatedBy,
                    notes: 'Quotation updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            const duplicate = await this.describeDuplicate(error);
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, duplicate.message, duplicate.errors);
            throw error;
        }
    }
    async syncItems(tx, scope, inputItems, actorId) {
        const existing = await tx.saleQuotationItem.findMany({
            where: { sqiQuoteId: scope.sqId, sqiAccYear: scope.sqAccYear, sqiIsDeleted: false },
            orderBy: { sqiLineNo: 'asc' },
        });
        if (inputItems === undefined) {
            return existing;
        }
        const existingMap = new Map(existing.map((item) => [item.sqiId, item]));
        const now = new Date();
        const resolvedItems = inputItems.map((inputItem, index) => ({
            inputItem,
            lineNo: inputItem.sqiLineNo ?? index + 1,
        }));
        const seenLineNos = new Set();
        const keptIds = new Set();
        for (const { inputItem, lineNo } of resolvedItems) {
            if (seenLineNos.has(lineNo)) {
                (0, module_service_utils_1.throwSalesConflict)('Duplicate quotation line number is not allowed', [
                    {
                        field: 'sqiLineNo',
                        message: `A quotation line already exists with line number ${lineNo}`,
                    },
                ]);
            }
            seenLineNos.add(lineNo);
            if (inputItem.sqiId) {
                if (!existingMap.has(inputItem.sqiId)) {
                    (0, module_service_utils_1.throwSalesNotFound)('Quotation item not found', 'sqiId', `No active quotation line found with id ${inputItem.sqiId} on this quotation`);
                }
                keptIds.add(inputItem.sqiId);
            }
        }
        await this.softDeleteItems(tx, existing.filter((item) => !keptIds.has(item.sqiId)), actorId, now);
        const reordersItems = resolvedItems.some(({ inputItem, lineNo }) => inputItem.sqiId !== undefined && existingMap.get(inputItem.sqiId)?.sqiLineNo !== lineNo);
        if (reordersItems && keptIds.size > 0) {
            await tx.saleQuotationItem.updateMany({
                where: { sqiId: { in: [...keptIds] }, sqiAccYear: scope.sqAccYear },
                data: { sqiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
            });
        }
        const persisted = [];
        for (const { inputItem, lineNo } of resolvedItems) {
            if (inputItem.sqiId) {
                const existingItem = existingMap.get(inputItem.sqiId);
                const updateData = {
                    sqiLineNo: lineNo,
                    sqiItemId: inputItem.sqiItemId ?? existingItem.sqiItemId,
                    sqiItemUnitId: inputItem.sqiItemUnitId ?? existingItem.sqiItemUnitId,
                    sqiPriceLevel: inputItem.sqiPriceLevel ?? scope.sqPriceLevel,
                    sqiModifiedOn: now,
                    sqiModifiedBy: (0, module_service_utils_1.resolveActor)(inputItem.sqiModifiedBy, actorId),
                };
                (0, module_service_utils_1.applyPresentFields)(updateData, inputItem, QUOTATION_ITEM_OPTIONAL_FIELDS, QUOTATION_ITEM_DATE_TRANSFORMS);
                const updated = await tx.saleQuotationItem.update({
                    where: {
                        sqiId_sqiAccYear: { sqiId: inputItem.sqiId, sqiAccYear: existingItem.sqiAccYear },
                    },
                    data: updateData,
                });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: QUOTATION_ITEM_TABLE_NAME,
                    screenName: QUOTATION_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: updated.sqiId,
                    displayName: `Line ${updated.sqiLineNo}`,
                    originalRecord: this.toItemPayload(existingItem),
                    modifiedRecord: this.toItemPayload(updated),
                    userId: (0, module_service_utils_1.resolveActor)(inputItem.sqiModifiedBy, actorId),
                    notes: 'Quotation item updated',
                }, tx);
                persisted.push(updated);
                continue;
            }
            const createData = {
                sqiQuoteId: scope.sqId,
                sqiCompanyId: inputItem.sqiCompanyId ?? scope.sqCompanyId,
                sqiBranchId: inputItem.sqiBranchId ?? scope.sqBranchId,
                sqiTenantId: inputItem.sqiTenantId ?? scope.sqTenantId,
                sqiAccYear: scope.sqAccYear,
                sqiLineNo: lineNo,
                sqiItemId: this.requireItemField(inputItem.sqiItemId, 'sqiItemId'),
                sqiItemUnitId: this.requireItemField(inputItem.sqiItemUnitId, 'sqiItemUnitId'),
                sqiPriceLevel: inputItem.sqiPriceLevel ?? scope.sqPriceLevel,
                sqiCreatedOn: now,
                sqiCreatedBy: (0, module_service_utils_1.resolveActor)(inputItem.sqiCreatedBy, actorId),
            };
            (0, module_service_utils_1.applyPresentFields)(createData, inputItem, QUOTATION_ITEM_OPTIONAL_FIELDS, QUOTATION_ITEM_DATE_TRANSFORMS);
            const created = await tx.saleQuotationItem.create({ data: createData });
            await this.auditLogService.logEntityChange({
                action: 'New',
                tableName: QUOTATION_ITEM_TABLE_NAME,
                screenName: QUOTATION_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: created.sqiId,
                displayName: `Line ${created.sqiLineNo}`,
                originalRecord: null,
                modifiedRecord: this.toItemPayload(created),
                userId: created.sqiCreatedBy,
                notes: 'Quotation item created',
            }, tx);
            persisted.push(created);
        }
        return persisted.sort((left, right) => left.sqiLineNo - right.sqiLineNo);
    }
    async softDeleteItems(tx, removed, actorId, now) {
        for (const removedItem of removed) {
            const deleted = await tx.saleQuotationItem.update({
                where: {
                    sqiId_sqiAccYear: { sqiId: removedItem.sqiId, sqiAccYear: removedItem.sqiAccYear },
                },
                data: {
                    sqiIsDeleted: true,
                    sqiModifiedOn: now,
                    sqiModifiedBy: actorId,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: QUOTATION_ITEM_TABLE_NAME,
                screenName: QUOTATION_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: deleted.sqiId,
                displayName: `Line ${removedItem.sqiLineNo}`,
                originalRecord: this.toItemPayload(removedItem),
                modifiedRecord: this.toItemPayload(deleted),
                userId: actorId,
                notes: 'Quotation item soft deleted',
            }, tx);
        }
    }
    async resolveDuplicateIndex(error) {
        const reported = uniqueConstraintTarget(error);
        if (!reported) {
            return '';
        }
        try {
            const rows = await this.prisma.$queryRaw `
        SELECT parent.relname AS "parentIndex"
        FROM pg_class child
        JOIN pg_inherits inh ON inh.inhrelid = child.oid
        JOIN pg_class parent ON parent.oid = inh.inhparent
        WHERE child.relname = ${reported}
      `;
            return rows[0]?.parentIndex ?? reported;
        }
        catch {
            return reported;
        }
    }
    async describeDuplicate(error) {
        const target = await this.resolveDuplicateIndex(error);
        if (target.includes(QUOTATION_ITEM_LINE_INDEX)) {
            return {
                message: 'Duplicate quotation line number is not allowed',
                errors: [
                    {
                        field: 'sqiLineNo',
                        message: 'Another active line on this quotation already uses this line number',
                    },
                ],
            };
        }
        if (target.includes(QUOTATION_SLNO_INDEX)) {
            return {
                message: 'Quotation already exists',
                errors: [
                    {
                        field: 'sqQuoteSlno',
                        message: 'Duplicate quotation serial number is not allowed',
                    },
                ],
            };
        }
        return {
            message: 'Quotation already exists',
            errors: [
                {
                    field: 'sqQuoteRefno',
                    message: 'Duplicate quotation reference number is not allowed',
                },
            ],
        };
    }
    requireItemField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwSalesNotFound)(`${field} is required for a new quotation line`, field, `${field} must be provided when creating a quotation line`);
        }
        return value;
    }
    findCharges(client, sqId) {
        return client.transactionChargeDetail.findMany({
            where: {
                cdDocType: quotation_api_types_1.QUOTATION_CHARGE_DOC_TYPE,
                cdDocId: sqId,
                cdIsDeleted: false,
            },
            orderBy: { cdSlno: 'asc' },
        });
    }
    async findAgent(saId) {
        if (!saId) {
            return null;
        }
        return this.prisma.saleAgent.findUnique({
            where: { saId },
            select: { saName: true },
        });
    }
    async syncCharges(tx, scope, inputCharges, actorId) {
        const existing = await this.findCharges(tx, scope.sqId);
        if (inputCharges === undefined) {
            return existing;
        }
        const existingMap = new Map(existing.map((charge) => [charge.cdId, charge]));
        const keptIds = new Set();
        const seenSlnos = new Set();
        const now = new Date();
        const persisted = [];
        for (const [index, inputCharge] of inputCharges.entries()) {
            const slno = inputCharge.cdSlno ?? index + 1;
            if (seenSlnos.has(slno)) {
                (0, module_service_utils_1.throwSalesConflict)('Duplicate quotation charge line number is not allowed', [
                    {
                        field: 'cdSlno',
                        message: `A quotation charge already exists with line number ${slno}`,
                    },
                ]);
            }
            seenSlnos.add(slno);
            const existingCharge = inputCharge.cdId ? existingMap.get(inputCharge.cdId) : undefined;
            if (inputCharge.cdId && !existingCharge) {
                (0, module_service_utils_1.throwSalesNotFound)('Quotation charge not found', 'cdId', `No active quotation charge found with id ${inputCharge.cdId} on this quotation`);
            }
            this.ensureChargeValuesAreAllowed(inputCharge, existingCharge);
            if (existingCharge) {
                const updateData = {
                    cdSlno: slno,
                    cdChgId: inputCharge.cdChgId ?? existingCharge.cdChgId,
                    cdLedgerCode: inputCharge.cdLedgerCode ?? existingCharge.cdLedgerCode,
                    cdModifiedOn: now,
                    cdModifiedBy: (0, module_service_utils_1.resolveActor)(inputCharge.cdModifiedBy, actorId),
                };
                (0, module_service_utils_1.applyPresentFields)(updateData, inputCharge, QUOTATION_CHARGE_OPTIONAL_FIELDS);
                if (inputCharge.cdVoucherNo !== undefined) {
                    updateData.cdVoucherNo = this.toVoucherNo(inputCharge.cdVoucherNo);
                }
                const updated = await tx.transactionChargeDetail.update({
                    where: {
                        cdId_cdAccYear: { cdId: existingCharge.cdId, cdAccYear: existingCharge.cdAccYear },
                    },
                    data: updateData,
                });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: QUOTATION_CHARGE_TABLE_NAME,
                    screenName: QUOTATION_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: updated.cdId,
                    displayName: updated.cdChgName || `Charge ${updated.cdSlno ?? slno}`,
                    originalRecord: this.toChargePayload(existingCharge),
                    modifiedRecord: this.toChargePayload(updated),
                    userId: (0, module_service_utils_1.resolveActor)(inputCharge.cdModifiedBy, actorId),
                    notes: 'Quotation charge updated',
                }, tx);
                keptIds.add(updated.cdId);
                persisted.push(updated);
                continue;
            }
            const createData = {
                cdDocType: quotation_api_types_1.QUOTATION_CHARGE_DOC_TYPE,
                cdDocId: scope.sqId,
                cdSlno: slno,
                cdCompId: inputCharge.cdCompId ?? scope.sqCompanyId,
                cdBranchId: inputCharge.cdBranchId ?? scope.sqBranchId,
                cdAccYear: inputCharge.cdAccYear ?? scope.sqAccYear,
                cdVoucherNo: inputCharge.cdVoucherNo === undefined
                    ? scope.sqQuoteSlno
                    : this.toVoucherNo(inputCharge.cdVoucherNo),
                cdChgId: this.requireChargeField(inputCharge.cdChgId, 'cdChgId'),
                cdLedgerCode: this.requireChargeField(inputCharge.cdLedgerCode, 'cdLedgerCode'),
                cdCreatedOn: now,
                cdCreatedBy: (0, module_service_utils_1.resolveActor)(inputCharge.cdCreatedBy, actorId),
            };
            (0, module_service_utils_1.applyPresentFields)(createData, inputCharge, QUOTATION_CHARGE_OPTIONAL_FIELDS);
            const created = await tx.transactionChargeDetail.create({ data: createData });
            await this.auditLogService.logEntityChange({
                action: 'New',
                tableName: QUOTATION_CHARGE_TABLE_NAME,
                screenName: QUOTATION_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: created.cdId,
                displayName: created.cdChgName || `Charge ${created.cdSlno ?? slno}`,
                originalRecord: null,
                modifiedRecord: this.toChargePayload(created),
                userId: created.cdCreatedBy ?? actorId,
                notes: 'Quotation charge created',
            }, tx);
            keptIds.add(created.cdId);
            persisted.push(created);
        }
        const removed = existing.filter((charge) => !keptIds.has(charge.cdId));
        for (const removedCharge of removed) {
            const deleted = await tx.transactionChargeDetail.update({
                where: {
                    cdId_cdAccYear: { cdId: removedCharge.cdId, cdAccYear: removedCharge.cdAccYear },
                },
                data: {
                    cdIsDeleted: true,
                    cdModifiedOn: now,
                    cdModifiedBy: actorId,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: QUOTATION_CHARGE_TABLE_NAME,
                screenName: QUOTATION_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: deleted.cdId,
                displayName: removedCharge.cdChgName || `Charge ${removedCharge.cdSlno ?? ''}`.trim(),
                originalRecord: this.toChargePayload(removedCharge),
                modifiedRecord: this.toChargePayload(deleted),
                userId: actorId,
                notes: 'Quotation charge soft deleted',
            }, tx);
        }
        return persisted.sort((left, right) => (left.cdSlno ?? 0) - (right.cdSlno ?? 0));
    }
    requireChargeField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwSalesNotFound)(`${field} is required for a new quotation charge`, field, `${field} must be provided when creating a quotation charge`);
        }
        return value;
    }
    toVoucherNo(value) {
        if (value === null || value === '') {
            return null;
        }
        return BigInt(value);
    }
    ensureChargeValuesAreAllowed(inputCharge, existingCharge) {
        const values = {
            cdDocType: quotation_api_types_1.QUOTATION_CHARGE_DOC_TYPE,
            cdRole: inputCharge.cdRole,
            cdMethod: inputCharge.cdMethod,
            cdType: inputCharge.cdType,
            cdApplyOn: inputCharge.cdApplyOn,
            cdCostAlloc: inputCharge.cdCostAlloc,
        };
        const details = [];
        for (const guard of charge_master_api_types_1.CHARGE_DETAIL_VALUE_GUARDS) {
            const value = values[guard.field];
            if (value === undefined) {
                continue;
            }
            if (value === null) {
                if (!guard.nullable) {
                    details.push({ field: guard.field, message: `${guard.field} is required` });
                }
                continue;
            }
            if (!guard.allowed.includes(value)) {
                details.push({
                    field: guard.field,
                    message: `${guard.field} must be one of: ${guard.allowed.join(', ')}`,
                });
            }
        }
        const taxApl = inputCharge.cdTaxApl ?? existingCharge?.cdTaxApl ?? false;
        const beforeTax = inputCharge.cdBeforeTax ?? existingCharge?.cdBeforeTax ?? false;
        if (taxApl && beforeTax) {
            details.push({
                field: 'cdTaxApl',
                message: 'cdTaxApl and cdBeforeTax are mutually exclusive: a charge is either taxed at the item rate or carries its own GST',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid quotation charge value', details);
        }
    }
    async logStatusStep(tx, quotation, step, actor, changedOn) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: quotation.sqCompanyId,
            branchId: quotation.sqBranchId,
            tenantId: quotation.sqTenantId,
            accYear: quotation.sqAccYear,
            srcModule: quotation_api_types_1.QUOTATION_STATUS_SRC_MODULE,
            srcDocType: quotation_api_types_1.QUOTATION_STATUS_SRC_DOC_TYPE,
            srcDocId: quotation.sqId,
            srcDocRefno: quotation.sqQuoteRefno,
            event: step.event,
            fromStatus: step.fromStatus,
            toStatus: step.toStatus,
            changedOn,
            changedBy: actor,
            remarks: step.remarks ?? quotation.sqCancelReason,
            deviceId: quotation.sqDeviceId,
            sessionId: quotation.sqSessionId,
        });
    }
    toStatusEvent(fromStatus, toStatus) {
        if (fromStatus === null) {
            return txn_status_log_helper_1.TxnStatusEvent.CREATED;
        }
        return QUOTATION_STATUS_EVENTS[toStatus] ?? txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED;
    }
    applyOptionalFields(data, dto) {
        (0, module_service_utils_1.applyPresentFields)(data, dto, QUOTATION_OPTIONAL_FIELDS, QUOTATION_DATE_TRANSFORMS);
    }
    applyParentRevision(data, dto, accYear) {
        if (dto.sqParentQuoteId === undefined) {
            return;
        }
        if (dto.sqParentQuoteId === null) {
            data.sqParentQuoteId = null;
            data.sqParentAccYear = null;
            return;
        }
        data.sqParentQuoteId = dto.sqParentQuoteId;
        data.sqParentAccYear = dto.sqParentAccYear ?? accYear;
    }
    toPayload(record) {
        const { sqCreatedOn, sqModifiedOn, sqQuoteDatetime, sqSyncDate, sqQuoteSlno, items, charges, custArea, salesman, agent, ...rest } = record;
        return {
            ...rest,
            sqCustAreaName: custArea?.armName ?? null,
            sqCustAreaDistanceKm: custArea?.armDistanceKm ?? null,
            sqSalesmanName: salesman?.empName ?? null,
            sqAgentName: agent?.saName ?? null,
            sqCreatedOn: sqCreatedOn?.toISOString(),
            sqModifiedOn: sqModifiedOn?.toISOString() ?? null,
            sqQuoteDatetime: sqQuoteDatetime?.toISOString(),
            sqSyncDate: sqSyncDate?.toISOString() ?? null,
            sqQuoteSlno: sqQuoteSlno.toString(),
            items: items ? items.map((item) => this.toItemPayload(item)) : [],
            charges: charges ? charges.map((charge) => this.toChargePayload(charge)) : [],
        };
    }
    toChargePayload(record) {
        const { cdCreatedOn, cdModifiedOn, cdSyncDate, cdVoucherNo, ...rest } = record;
        return {
            ...rest,
            cdCreatedOn: cdCreatedOn?.toISOString(),
            cdModifiedOn: cdModifiedOn?.toISOString() ?? null,
            cdSyncDate: cdSyncDate?.toISOString() ?? null,
            cdVoucherNo: cdVoucherNo?.toString() ?? null,
        };
    }
    toItemPayload(record) {
        const { sqiCreatedOn, sqiModifiedOn, sqiSyncDate, item, itemUnitConversion, ...rest } = record;
        return {
            ...rest,
            sqiCreatedOn: sqiCreatedOn?.toISOString(),
            sqiModifiedOn: sqiModifiedOn?.toISOString() ?? null,
            sqiSyncDate: sqiSyncDate?.toISOString() ?? null,
            sqiItemName: item?.itemNameEn ?? null,
            sqiUnitName: itemUnitConversion?.unit.unit_name ?? null,
            sqiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
            sqiBatchConfig: item?.itemBatchConfig ?? null,
            sqiGroupId: item?.itemGroupId ?? null,
            sqiBrandId: item?.itemBrandId ?? null,
            sqiSectionId: item?.itemSectionId ?? null,
            sqiCategoryId: item?.itemCategoryId ?? null,
        };
    }
};
exports.QuotationService = QuotationService;
exports.QuotationService = QuotationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], QuotationService);
//# sourceMappingURL=quotation.service.js.map