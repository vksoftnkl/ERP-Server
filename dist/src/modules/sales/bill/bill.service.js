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
exports.BillService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const bill_api_types_1 = require("./types/bill-api.types");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const sale_order_api_types_1 = require("../sale-order/types/sale-order-api.types");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const bill_posting_helper_1 = require("./bill-posting.helper");
const bill_adjustment_helper_1 = require("./bill-adjustment.helper");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const BILL_VCHR_TYPE_ID = 3;
const BILL_TABLE_NAME = 'sale_bill';
const BILL_ITEM_TABLE_NAME = 'sale_bill_item';
const BILL_AUDIT_SCREEN_NAME = 'Sale Bill';
const BILL_DOC_TYPES = ['TAX_INVOICE', 'BILL_OF_SUPPLY'];
const BILL_TYPES = ['CASH', 'CREDIT'];
const BILL_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'];
const BILL_STATUS_CANCELLED = 'CANCELLED';
const BILL_PAY_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'];
const BILL_RETURN_STATUSES = ['PARTIAL', 'FULL'];
const BILL_ITEM_FREE_TYPES = ['SCHEME', 'SAMPLE', 'REPLACEMENT'];
const BILL_ITEM_SRC_DOC_FIELDS = {
    docId: 'sbiSrcDocId',
    accYear: 'sbiSrcDocYear',
    lineNo: 'sbiSrcDocLineNo',
};
const BILL_SRC_DOC_FIELDS = {
    docId: 'sbSrcDocId',
    accYear: 'sbSrcDocYear',
};
const BILL_VALUE_GUARDS = [
    { field: 'sbDocType', allowed: BILL_DOC_TYPES, nullable: false },
    { field: 'sbBillType', allowed: BILL_TYPES, nullable: false },
    { field: 'sbStatus', allowed: BILL_STATUSES, nullable: false },
    { field: 'sbPayStatus', allowed: BILL_PAY_STATUSES, nullable: false },
    { field: 'sbReturnStatus', allowed: BILL_RETURN_STATUSES, nullable: true },
];
const BILL_OPTIONAL_FIELDS = [
    'sbSessionId',
    'sbCounterId',
    'sbDeviceType',
    'sbDeviceId',
    'sbDocType',
    'sbBillType',
    'sbCategoryId',
    'sbUsrRefno',
    'sbBillDate',
    'sbBillDatetime',
    'sbDueDays',
    'sbDueDate',
    'sbSrcDocType',
    'sbSrcDocId',
    'sbSrcDocRefno',
    'sbSrcDocDate',
    'sbSrcDocYear',
    'sbCustId',
    'sbCustName',
    'sbCustAddr',
    'sbCustPlace',
    'sbCustPin',
    'sbCustPhone',
    'sbCustGstin',
    'sbCustGstType',
    'sbCustStcd',
    'sbPosStcd',
    'sbStateName',
    'sbHasLoad',
    'sbHasUnload',
    'sbHasFreight',
    'sbHasPromo',
    'sbHasComm',
    'sbHasLoyalty',
    'sbSalesmanId',
    'sbAgentId',
    'sbAgentCommPerc',
    'sbAgentCommAmt',
    'sbDriverId',
    'sbLoadmanId',
    'sbPackedId',
    'sbSupervisorId',
    'sbVehicleId',
    'sbVehicleNo',
    'sbTotItems',
    'sbTotWeight',
    'sbTotBags',
    'sbGrossAmt',
    'sbItemDisc',
    'sbSplDisc',
    'sbSchDisc',
    'sbBillSchDisc',
    'sbAddlDisc1',
    'sbAddlDisc2',
    'sbCashDisc',
    'sbTaxableAmt',
    'sbCgstAmt',
    'sbSgstAmt',
    'sbIgstAmt',
    'sbCessAmt',
    'sbTaxAmt',
    'sbFreightAmt',
    'sbLoadAmt',
    'sbUnloadAmt',
    'sbOtherAmt1',
    'sbOtherAmt2',
    'sbRoundOff',
    'sbBillAmt',
    'sbTotalCost',
    'sbMarginAmt',
    'sbMarginAmtWot',
    'sbMarginPerc',
    'sbMrpSavings',
    'sbMrpSavingsPerc',
    'sbPayMode',
    'sbCreditAmt',
    'sbSurchargeAmt',
    'sbTenderAmt',
    'sbRefundAmt',
    'sbAdvanceAmt',
    'sbPaidAmt',
    'sbBalanceAmt',
    'sbPayStatus',
    'sbReturnedAmt',
    'sbReturnStatus',
    'sbPaymentTerms',
    'sbDeliveryTerms',
    'sbTermsConditions',
    'sbRemarks',
    'sbFreightCalcType',
    'sbLoadingCalcType',
    'sbDiscAlterBase',
    'sbRoundOffStep',
    'sbStatus',
    'sbPostedOn',
    'sbPostedVoucherId',
    'sbApprovedOn',
    'sbApprovedBy',
    'sbCancelledOn',
    'sbCancelledBy',
    'sbCancelReason',
    'sbVersionNo',
    'sbPrintCount',
];
const BILL_ITEM_OPTIONAL_FIELDS = [
    'sbiSrcDocType',
    'sbiSrcDocId',
    'sbiSrcDocYear',
    'sbiSrcDocRefno',
    'sbiSrcDocLineNo',
    'sbiSrcItemQty',
    'sbiSrcFreeQty',
    'sbiToBaseFactor',
    'sbiHsnCode',
    'sbiEanCode',
    'sbiSize',
    'sbiSizeUom',
    'sbiBatchNo',
    'sbiBatchDate',
    'sbiExpiryDate',
    'sbiSerialNo',
    'sbiIsTaxIncl',
    'sbiIsPromo',
    'sbiIsFree',
    'sbiFreeType',
    'sbiIsService',
    'sbiHasFreight',
    'sbiCaseQty',
    'sbiBillQty',
    'sbiLengthQty',
    'sbiNetQty',
    'sbiWeightQty',
    'sbiAvailableStock',
    'sbiReturnQty',
    'sbiRate',
    'sbiRatePreTax',
    'sbiRateDiff',
    'sbiActPrice',
    'sbiMaxPrice',
    'sbiMinPrice',
    'sbiCostPrice',
    'sbiCostPreTax',
    'sbiItemDiscPerc',
    'sbiItemDiscQty',
    'sbiItemDiscAmt',
    'sbiSplDiscPerc',
    'sbiSplDiscQty',
    'sbiSplDiscAmt',
    'sbiSchDiscPerc',
    'sbiSchDiscQty',
    'sbiSchDiscAmt',
    'sbiBillSchPerc',
    'sbiBillSchQty',
    'sbiBillSchAmt',
    'sbiAddlDisc1Perc',
    'sbiAddlDisc1Amt',
    'sbiAddlDisc2Perc',
    'sbiAddlDisc2Amt',
    'sbiCashDiscPerc',
    'sbiCashDiscAmt',
    'sbiGrossAmt',
    'sbiNetGross',
    'sbiChrgBeforeTax',
    'sbiChrgAfterTax',
    'sbiTaxableAmt',
    'sbiTaxPerc',
    'sbiTaxAmt',
    'sbiCgstPerc',
    'sbiCgstAmt',
    'sbiSgstPerc',
    'sbiSgstAmt',
    'sbiIgstPerc',
    'sbiIgstAmt',
    'sbiCessPerc',
    'sbiCessPerUnit',
    'sbiCessAmt',
    'sbiAcessPerc',
    'sbiAcessPerUnit',
    'sbiAcessAmt',
    'sbiBatchConfig',
    'sbiFreightQty',
    'sbiFreightAmt',
    'sbiLoadQty',
    'sbiLoadAmt',
    'sbiUnloadQty',
    'sbiUnloadAmt',
    'sbiRoundOff',
    'sbiNetAmt',
    'sbiSoldPrice',
    'sbiSoldPreTax',
    'sbiItemProfit',
    'sbiProfitPreTax',
    'sbiMrpSavings',
    'sbiMrpSavingsPerc',
    'sbiSalesmanId',
    'sbiSchemeId',
    'sbiSchemeName',
    'sbiRemarks',
];
const BILL_DATE_FIELDS = [
    'sbBillDate',
    'sbBillDatetime',
    'sbDueDate',
    'sbSrcDocDate',
    'sbPostedOn',
    'sbApprovedOn',
    'sbCancelledOn',
];
const BILL_ITEM_DATE_FIELDS = ['sbiBatchDate', 'sbiExpiryDate'];
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
const BILL_DATE_TRANSFORMS = buildDateTransforms(BILL_DATE_FIELDS);
const BILL_ITEM_DATE_TRANSFORMS = buildDateTransforms(BILL_ITEM_DATE_FIELDS);
let BillService = class BillService {
    prisma;
    auditLogService;
    requestContextService;
    chargeDetailService;
    tenderDetailService;
    saleOrderService;
    constructor(prisma, auditLogService, requestContextService, chargeDetailService, tenderDetailService, saleOrderService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.chargeDetailService = chargeDetailService;
        this.tenderDetailService = tenderDetailService;
        this.saleOrderService = saleOrderService;
    }
    async save(saveBillDto) {
        this.ensureBillValuesAreAllowed(saveBillDto);
        if (saveBillDto.sbId) {
            return this.updateBill(saveBillDto);
        }
        return this.createBill(saveBillDto);
    }
    async getById(sbId, sbCompanyId, sbBranchId, sbAccYear) {
        const record = await this.prisma.saleBill.findFirst({
            where: {
                sbId,
                sbCompanyId,
                sbBranchId,
                sbAccYear,
                sbIsDeleted: false,
            },
            include: {
                items: {
                    where: { sbiIsDeleted: false },
                    orderBy: { sbiLineNo: 'asc' },
                    include: {
                        item: {
                            select: {
                                itemNameEn: true,
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
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${sbId}`);
        }
        const charges = await this.chargeDetailService.getByDocument(bill_api_types_1.BILL_CHARGE_DOC_TYPE, sbId);
        const tenders = await this.tenderDetailService.getByDocument(bill_api_types_1.BILL_TENDER_SRC_MODULE, bill_api_types_1.BILL_TENDER_SRC_DOC_TYPE, sbId);
        const godownNameById = await this.resolveGodownNames(record.items);
        return this.toPayload({ ...record, charges, tenders }, godownNameById);
    }
    async cancelSourceOrders(cancelDto) {
        const { sbId, sbCompanyId, sbBranchId, sbAccYear } = cancelDto;
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.saleBill.findFirst({
                where: {
                    sbId,
                    sbCompanyId,
                    sbBranchId,
                    sbAccYear,
                    sbIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${sbId}`);
            }
            const now = new Date();
            const actor = (0, module_service_utils_1.resolveActor)(cancelDto.username, this.requestContextService.getUserId());
            const remarks = cancelDto.remarks.trim();
            const items = await tx.saleBillItem.findMany({
                where: {
                    sbiBillId: sbId,
                    sbiAccYear: sbAccYear,
                    sbiIsDeleted: false,
                },
            });
            const refs = [...this.toOrderHeaderRefs(existing), ...this.toOrderLineRefs(items)];
            if (refs.length === 0) {
                (0, module_service_utils_1.throwSalesBadRequest)('Bill was not raised against a sale order', [
                    {
                        field: 'sbSrcDocId',
                        message: `Bill ${existing.sbBillRefno || sbId} references no sale order, on its header ` +
                            '(sbSrcDocType / sbSrcDocId / sbSrcDocYear) or on any of its lines ' +
                            '(sbiSrcDocType / sbiSrcDocId / sbiSrcDocYear), so there is nothing to cancel',
                    },
                ]);
            }
            const orders = await this.saleOrderService.cancelOpenLinesForRefs(tx, refs, remarks, actor, now);
            const record = this.toPayload(existing);
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: BILL_TABLE_NAME,
                screenName: BILL_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: sbId,
                displayName: existing.sbBillRefno || sbId,
                originalRecord: record,
                modifiedRecord: record,
                userId: actor,
                notes: `Sale order cancelled from bill (${orders.length}): ${remarks}`,
            }, tx);
            return {
                sbId,
                cancelled: true,
                remarks,
                username: actor,
                cancelledOn: now.toISOString(),
                orders,
            };
        });
    }
    async createBill(saveBillDto) {
        const normalizedCustName = (0, module_service_utils_1.normalizeRequiredText)(saveBillDto.sbCustName ?? '', 'sbCustName');
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveBillDto.sbCreatedBy, this.requestContextService.getUserId());
        const billDate = saveBillDto.sbBillDate ? new Date(saveBillDto.sbBillDate) : now;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensurePosStateExists(tx, saveBillDto);
                const billNumber = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
                    vchrTypeId: BILL_VCHR_TYPE_ID,
                    companyId: saveBillDto.sbCompanyId,
                    branchId: saveBillDto.sbBranchId,
                    accYear: saveBillDto.sbAccYear,
                    documentDate: billDate,
                });
                const data = {
                    sbCompanyId: saveBillDto.sbCompanyId,
                    sbBranchId: saveBillDto.sbBranchId,
                    sbTenantId: saveBillDto.sbTenantId,
                    sbAccYear: saveBillDto.sbAccYear,
                    sbCounterId: saveBillDto.sbCounterId,
                    sbDeviceType: saveBillDto.sbDeviceType,
                    sbDeviceId: saveBillDto.sbDeviceId,
                    sbPriceLevel: saveBillDto.sbPriceLevel,
                    sbBillSlno: billNumber.lastNo,
                    sbBillRefno: billNumber.refno,
                    sbBillDate: billDate,
                    sbCustId: saveBillDto.sbCustId,
                    sbCustName: normalizedCustName,
                    sbUserId: saveBillDto.sbUserId,
                    sbCreatedOn: now,
                    sbCreatedBy: createdBy,
                    sbStatus: saveBillDto.sbStatus || 'DRAFT',
                };
                this.applyOptionalFields(data, saveBillDto);
                data.sbCustName = normalizedCustName;
                data.sbBillDate = billDate;
                const created = await tx.saleBill.create({ data });
                const scope = {
                    sbId: created.sbId,
                    sbCompanyId: created.sbCompanyId,
                    sbBranchId: created.sbBranchId,
                    sbTenantId: created.sbTenantId,
                    sbAccYear: created.sbAccYear,
                    sbPriceLevel: created.sbPriceLevel,
                    sbBillSlno: created.sbBillSlno,
                    sbBillDate: created.sbBillDate,
                    sbCustId: created.sbCustId,
                    sbUserId: created.sbUserId,
                    sbSessionId: created.sbSessionId,
                    sbDeviceId: created.sbDeviceId,
                };
                const items = await this.syncItems(tx, scope, saveBillDto.items, createdBy);
                const charges = await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), saveBillDto.charges, createdBy, bill_api_types_1.BILL_CHARGE_AUDIT);
                const tenders = await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope), saveBillDto.tenders, createdBy, bill_api_types_1.BILL_TENDER_AUDIT);
                let posted = created;
                if (created.sbStatus === bill_api_types_1.BILL_STATUS_POSTED) {
                    const postingResult = await (0, bill_posting_helper_1.postBillToAccounts)(tx, created, BILL_VCHR_TYPE_ID, createdBy, now);
                    posted = await tx.saleBill.update({
                        where: { sbId_sbAccYear: { sbId: created.sbId, sbAccYear: created.sbAccYear } },
                        data: {
                            sbPostedVoucherId: postingResult.voucherId,
                            sbPostedOn: postingResult.postedOn,
                        },
                    });
                    await this.syncAdjustments(tx, posted, postingResult.billId, saveBillDto.adjustments, createdBy, now);
                }
                else {
                    await this.syncAdjustments(tx, created, null, saveBillDto.adjustments, createdBy, now);
                }
                await this.saleOrderService.syncOrderFulfilment(tx, { refs: [...this.toOrderHeaderRefs(posted), ...this.toOrderLineRefs(items)] }, createdBy, now);
                await this.logStatusChange(tx, posted, null, createdBy, now);
                const payload = this.toPayload({ ...posted, items, charges, tenders });
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: BILL_TABLE_NAME,
                    screenName: BILL_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: payload.sbId,
                    displayName: payload.sbBillRefno || payload.sbId,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Bill created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            const duplicate = this.describeDuplicate(error);
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, duplicate.message, duplicate.errors);
            throw error;
        }
    }
    async updateBill(saveBillDto) {
        const sbId = saveBillDto.sbId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.saleBill.findFirst({
                    where: {
                        sbId,
                        sbIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${sbId}`);
                }
                const now = new Date();
                const modifiedBy = (0, module_service_utils_1.resolveActor)(saveBillDto.sbModifiedBy, this.requestContextService.getUserId());
                const data = {
                    sbModifiedOn: now,
                    sbModifiedBy: modifiedBy,
                };
                this.applyOptionalFields(data, saveBillDto);
                await this.ensurePosStateExists(tx, saveBillDto);
                const updated = await tx.saleBill.update({
                    where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
                    data,
                });
                const scope = {
                    sbId: updated.sbId,
                    sbCompanyId: updated.sbCompanyId,
                    sbBranchId: updated.sbBranchId,
                    sbTenantId: updated.sbTenantId,
                    sbAccYear: updated.sbAccYear,
                    sbPriceLevel: updated.sbPriceLevel,
                    sbBillSlno: updated.sbBillSlno,
                    sbBillDate: updated.sbBillDate,
                    sbCustId: updated.sbCustId,
                    sbUserId: updated.sbUserId,
                    sbSessionId: updated.sbSessionId,
                    sbDeviceId: updated.sbDeviceId,
                };
                const priorItems = await tx.saleBillItem.findMany({
                    where: { sbiBillId: sbId, sbiIsDeleted: false },
                });
                const items = await this.syncItems(tx, scope, saveBillDto.items, modifiedBy);
                const charges = await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), saveBillDto.charges, modifiedBy, bill_api_types_1.BILL_CHARGE_AUDIT);
                const tenders = await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope), saveBillDto.tenders, modifiedBy, bill_api_types_1.BILL_TENDER_AUDIT);
                const posting = await (0, bill_posting_helper_1.syncBillPosting)(tx, updated, BILL_VCHR_TYPE_ID, modifiedBy, now);
                await this.syncAdjustments(tx, updated, posting.billId, saveBillDto.adjustments, modifiedBy, now);
                let posted = updated;
                if (updated.sbPostedVoucherId !== posting.voucherId ||
                    updated.sbPostedOn?.getTime() !== posting.postedOn?.getTime()) {
                    posted = await tx.saleBill.update({
                        where: { sbId_sbAccYear: { sbId: updated.sbId, sbAccYear: updated.sbAccYear } },
                        data: {
                            sbPostedVoucherId: posting.voucherId,
                            sbPostedOn: posting.postedOn,
                        },
                    });
                }
                await this.saleOrderService.syncOrderFulfilment(tx, {
                    refs: [
                        ...this.toOrderHeaderRefs(existing),
                        ...this.toOrderHeaderRefs(posted),
                        ...this.toOrderLineRefs(priorItems),
                        ...this.toOrderLineRefs(items),
                    ],
                }, modifiedBy, now);
                if (posted.sbStatus !== existing.sbStatus) {
                    await this.logStatusChange(tx, posted, existing.sbStatus, modifiedBy, now);
                }
                const payload = this.toPayload({ ...posted, items, charges, tenders });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: BILL_TABLE_NAME,
                    screenName: BILL_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: sbId,
                    displayName: payload.sbBillRefno || payload.sbId,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.sbModifiedBy || payload.sbCreatedBy,
                    notes: 'Bill updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            const duplicate = this.describeDuplicate(error);
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, duplicate.message, duplicate.errors);
            throw error;
        }
    }
    async syncItems(tx, scope, inputItems, actorId) {
        const existing = await tx.saleBillItem.findMany({
            where: { sbiBillId: scope.sbId, sbiIsDeleted: false },
            orderBy: { sbiLineNo: 'asc' },
        });
        if (inputItems === undefined) {
            return existing;
        }
        const existingMap = new Map(existing.map((item) => [item.sbiId, item]));
        const now = new Date();
        const resolvedItems = inputItems.map((inputItem, index) => ({
            inputItem,
            lineNo: inputItem.sbiLineNo ?? index + 1,
        }));
        const seenLineNos = new Set();
        const keptIds = new Set();
        for (const { inputItem, lineNo } of resolvedItems) {
            if (seenLineNos.has(lineNo)) {
                (0, module_service_utils_1.throwSalesConflict)('Duplicate bill line number is not allowed', [
                    {
                        field: 'sbiLineNo',
                        message: `A bill line already exists with line number ${lineNo}`,
                    },
                ]);
            }
            seenLineNos.add(lineNo);
            if (inputItem.sbiId) {
                if (!existingMap.has(inputItem.sbiId)) {
                    (0, module_service_utils_1.throwSalesNotFound)('Bill item not found', 'sbiId', `No active bill line found with id ${inputItem.sbiId} on this bill`);
                }
                keptIds.add(inputItem.sbiId);
            }
        }
        await this.softDeleteItems(tx, existing.filter((item) => !keptIds.has(item.sbiId)), actorId, now);
        const reordersItems = resolvedItems.some(({ inputItem, lineNo }) => inputItem.sbiId !== undefined && existingMap.get(inputItem.sbiId)?.sbiLineNo !== lineNo);
        if (reordersItems && keptIds.size > 0) {
            await tx.saleBillItem.updateMany({
                where: { sbiId: { in: [...keptIds] } },
                data: { sbiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
            });
        }
        const persisted = [];
        for (const { inputItem, lineNo } of resolvedItems) {
            if (inputItem.sbiId) {
                const existingItem = existingMap.get(inputItem.sbiId);
                this.ensureBillItemValuesAreAllowed(inputItem, existingItem);
                const updateData = {
                    sbiLineNo: lineNo,
                    sbiSplitNo: inputItem.sbiSplitNo ?? existingItem.sbiSplitNo,
                    sbiItemId: inputItem.sbiItemId ?? existingItem.sbiItemId,
                    sbiItemUnitId: inputItem.sbiItemUnitId ?? existingItem.sbiItemUnitId,
                    sbiGodownId: inputItem.sbiGodownId ?? existingItem.sbiGodownId,
                    sbiStockId: inputItem.sbiStockId ?? existingItem.sbiStockId,
                    sbiPriceLevel: inputItem.sbiPriceLevel ?? scope.sbPriceLevel,
                    sbiModifiedOn: now,
                    sbiModifiedBy: (0, module_service_utils_1.resolveActor)(inputItem.sbiModifiedBy, actorId),
                };
                (0, module_service_utils_1.applyPresentFields)(updateData, inputItem, BILL_ITEM_OPTIONAL_FIELDS, BILL_ITEM_DATE_TRANSFORMS);
                const updated = await tx.saleBillItem.update({
                    where: {
                        sbiId_sbiAccYear: { sbiId: inputItem.sbiId, sbiAccYear: existingItem.sbiAccYear },
                    },
                    data: updateData,
                });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: BILL_ITEM_TABLE_NAME,
                    screenName: BILL_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: updated.sbiId,
                    displayName: `Line ${updated.sbiLineNo}`,
                    originalRecord: this.toItemPayload(existingItem),
                    modifiedRecord: this.toItemPayload(updated),
                    userId: (0, module_service_utils_1.resolveActor)(inputItem.sbiModifiedBy, actorId),
                    notes: 'Bill item updated',
                }, tx);
                persisted.push(updated);
                continue;
            }
            this.ensureBillItemValuesAreAllowed(inputItem, undefined);
            const createData = {
                sbiBillId: scope.sbId,
                sbiCompanyId: inputItem.sbiCompanyId ?? scope.sbCompanyId,
                sbiBranchId: inputItem.sbiBranchId ?? scope.sbBranchId,
                sbiTenantId: inputItem.sbiTenantId ?? scope.sbTenantId,
                sbiAccYear: inputItem.sbiAccYear ?? scope.sbAccYear,
                sbiLineNo: lineNo,
                sbiSplitNo: inputItem.sbiSplitNo ?? 1,
                sbiItemId: this.requireItemField(inputItem.sbiItemId, 'sbiItemId'),
                sbiItemUnitId: this.requireItemField(inputItem.sbiItemUnitId, 'sbiItemUnitId'),
                sbiGodownId: this.requireItemField(inputItem.sbiGodownId, 'sbiGodownId'),
                sbiStockId: inputItem.sbiStockId ?? null,
                sbiPriceLevel: inputItem.sbiPriceLevel ?? scope.sbPriceLevel,
                sbiCreatedOn: now,
                sbiCreatedBy: (0, module_service_utils_1.resolveActor)(inputItem.sbiCreatedBy, actorId),
            };
            (0, module_service_utils_1.applyPresentFields)(createData, inputItem, BILL_ITEM_OPTIONAL_FIELDS, BILL_ITEM_DATE_TRANSFORMS);
            const created = await tx.saleBillItem.create({ data: createData });
            await this.auditLogService.logEntityChange({
                action: 'New',
                tableName: BILL_ITEM_TABLE_NAME,
                screenName: BILL_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: created.sbiId,
                displayName: `Line ${created.sbiLineNo}`,
                originalRecord: null,
                modifiedRecord: this.toItemPayload(created),
                userId: created.sbiCreatedBy,
                notes: 'Bill item created',
            }, tx);
            persisted.push(created);
        }
        return persisted.sort((left, right) => left.sbiLineNo - right.sbiLineNo);
    }
    async softDeleteItems(tx, removed, actorId, now) {
        for (const removedItem of removed) {
            const deleted = await tx.saleBillItem.update({
                where: {
                    sbiId_sbiAccYear: { sbiId: removedItem.sbiId, sbiAccYear: removedItem.sbiAccYear },
                },
                data: {
                    sbiIsDeleted: true,
                    sbiModifiedOn: now,
                    sbiModifiedBy: actorId,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: BILL_ITEM_TABLE_NAME,
                screenName: BILL_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: deleted.sbiId,
                displayName: `Line ${removedItem.sbiLineNo}`,
                originalRecord: this.toItemPayload(removedItem),
                modifiedRecord: this.toItemPayload(deleted),
                userId: actorId,
                notes: 'Bill item soft deleted',
            }, tx);
        }
    }
    describeDuplicate(error) {
        void error;
        return {
            message: 'Bill already exists',
            errors: [{ field: 'sbId', message: 'A bill with this id already exists' }],
        };
    }
    ensureBillValuesAreAllowed(dto) {
        const values = {
            sbDocType: dto.sbDocType,
            sbBillType: dto.sbBillType,
            sbStatus: dto.sbStatus,
            sbPayStatus: dto.sbPayStatus,
            sbReturnStatus: dto.sbReturnStatus,
        };
        const details = [];
        for (const guard of BILL_VALUE_GUARDS) {
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
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid bill value', details);
        }
    }
    async ensurePosStateExists(tx, dto) {
        if (!(0, module_service_utils_1.hasOwnProperty)(dto, 'sbPosStcd')) {
            return;
        }
        const posStcd = dto.sbPosStcd;
        if (posStcd === undefined || posStcd === null) {
            return;
        }
        const state = await tx.stateCode.findUnique({
            where: { stateCode: posStcd },
            select: { stateCode: true },
        });
        if (!state) {
            (0, module_service_utils_1.throwSalesBadRequest)('Place of supply does not exist', [
                {
                    field: 'sbPosStcd',
                    message: `No state found with code ${posStcd}`,
                },
            ]);
        }
    }
    ensureBillItemValuesAreAllowed(inputItem, existingItem) {
        const details = [];
        if (inputItem.sbiFreeType !== undefined && inputItem.sbiFreeType !== null) {
            if (!BILL_ITEM_FREE_TYPES.includes(inputItem.sbiFreeType)) {
                details.push({
                    field: 'sbiFreeType',
                    message: `sbiFreeType must be one of: ${BILL_ITEM_FREE_TYPES.join(', ')}`,
                });
            }
        }
        const splitNo = inputItem.sbiSplitNo !== undefined ? inputItem.sbiSplitNo : (existingItem?.sbiSplitNo ?? 1);
        const batchNo = inputItem.sbiBatchNo !== undefined
            ? inputItem.sbiBatchNo
            : (existingItem?.sbiBatchNo ?? null);
        if (splitNo !== 1 && !batchNo) {
            details.push({
                field: 'sbiBatchNo',
                message: 'sbiBatchNo is required when sbiSplitNo is not 1',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid bill item value', details);
        }
    }
    toOrderLineRefs(items) {
        const refs = [];
        for (const item of items) {
            if (item.sbiSrcDocType !== sale_order_api_types_1.SALE_ORDER_SRC_DOC_TYPE ||
                !item.sbiSrcDocId ||
                !item.sbiSrcDocYear) {
                continue;
            }
            refs.push({
                srcDocId: item.sbiSrcDocId,
                srcAccYear: item.sbiSrcDocYear.trim(),
                soLineNo: item.sbiSrcDocLineNo,
                fields: BILL_ITEM_SRC_DOC_FIELDS,
            });
        }
        return refs;
    }
    toOrderHeaderRefs(bill) {
        if (!bill || bill.sbSrcDocType !== sale_order_api_types_1.SALE_ORDER_SRC_DOC_TYPE) {
            return [];
        }
        if (!bill.sbSrcDocId || !bill.sbSrcDocYear) {
            return [];
        }
        return [
            {
                srcDocId: bill.sbSrcDocId,
                srcAccYear: bill.sbSrcDocYear.trim(),
                soLineNo: null,
                fields: BILL_SRC_DOC_FIELDS,
            },
        ];
    }
    requireItemField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwSalesBadRequest)(`${field} is required for a new bill line`, [
                {
                    field,
                    message: `${field} must be provided when creating a bill line`,
                },
            ]);
        }
        return value;
    }
    toChargeScope(scope) {
        return {
            cdDocType: bill_api_types_1.BILL_CHARGE_DOC_TYPE,
            cdDocId: scope.sbId,
            cdCompId: scope.sbCompanyId,
            cdBranchId: scope.sbBranchId,
            cdAccYear: scope.sbAccYear,
            cdVoucherNo: scope.sbBillSlno,
        };
    }
    toTenderScope(scope) {
        return {
            tdSrcModule: bill_api_types_1.BILL_TENDER_SRC_MODULE,
            tdSrcDocType: bill_api_types_1.BILL_TENDER_SRC_DOC_TYPE,
            tdSrcDocId: scope.sbId,
            tdCompanyId: scope.sbCompanyId,
            tdBranchId: scope.sbBranchId,
            tdTenantId: scope.sbTenantId,
            tdAccYear: scope.sbAccYear,
            tdDocDate: scope.sbBillDate,
            tdPartyLedgerId: scope.sbCustId,
            tdUserId: scope.sbUserId,
            tdSessionId: scope.sbSessionId,
            tdDeviceId: scope.sbDeviceId,
            tdDrCr: bill_api_types_1.BILL_TENDER_DR_CR,
        };
    }
    async syncAdjustments(tx, bill, billId, adjustments, actor, now) {
        if (adjustments === undefined) {
            return;
        }
        if (billId === null) {
            if (adjustments.length === 0) {
                return;
            }
            (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                {
                    field: 'adjustments',
                    message: 'This bill carries no receivable in accounts — it is not POSTED, or its value is ' +
                        'zero — so there is nothing for a credit to be adjusted against.',
                },
            ]);
        }
        await (0, bill_adjustment_helper_1.syncBillAdjustments)(tx, {
            billId,
            billAccYear: bill.sbAccYear,
            billAmount: bill.sbBillAmt ?? new client_1.Prisma.Decimal(0),
            paidAmount: bill.sbPaidAmt ?? new client_1.Prisma.Decimal(0),
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            accYear: bill.sbAccYear,
            partyId: bill.sbCustId,
            adjDate: bill.sbBillDate,
            userId: bill.sbUserId,
            sessionId: bill.sbSessionId,
        }, adjustments, actor, now);
    }
    async logStatusChange(tx, bill, fromStatus, actor, changedOn, remarks) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            accYear: bill.sbAccYear,
            srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
            srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
            srcDocId: bill.sbId,
            srcDocRefno: bill.sbBillRefno,
            event: this.toStatusEvent(fromStatus, bill.sbStatus),
            fromStatus,
            toStatus: bill.sbStatus,
            changedOn,
            changedBy: actor,
            remarks: remarks ?? bill.sbCancelReason,
            deviceId: bill.sbDeviceId,
            sessionId: bill.sbSessionId,
        });
    }
    toStatusEvent(fromStatus, toStatus) {
        if (fromStatus === null) {
            return txn_status_log_helper_1.TxnStatusEvent.CREATED;
        }
        if (toStatus === BILL_STATUS_CANCELLED) {
            return txn_status_log_helper_1.TxnStatusEvent.CANCELLED;
        }
        if (toStatus === bill_api_types_1.BILL_STATUS_POSTED) {
            return txn_status_log_helper_1.TxnStatusEvent.POSTED;
        }
        if (fromStatus === bill_api_types_1.BILL_STATUS_POSTED) {
            return txn_status_log_helper_1.TxnStatusEvent.UNPOSTED;
        }
        return txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED;
    }
    applyOptionalFields(data, dto) {
        (0, module_service_utils_1.applyPresentFields)(data, dto, BILL_OPTIONAL_FIELDS, BILL_DATE_TRANSFORMS);
    }
    async resolveGodownNames(items = []) {
        const godownIds = [...new Set(items.map((item) => item.sbiGodownId))];
        if (godownIds.length === 0) {
            return new Map();
        }
        const godowns = await this.prisma.godownLocation.findMany({
            where: { gdlId: { in: godownIds } },
            select: { gdlId: true, gdlName: true },
        });
        return new Map(godowns.map((godown) => [godown.gdlId, godown.gdlName]));
    }
    toPayload(record, godownNameById = new Map()) {
        const { sbCreatedOn, sbModifiedOn, sbBillDatetime, sbSyncDate, sbBillSlno, items, charges, tenders, ...rest } = record;
        return {
            ...rest,
            sbCreatedOn: sbCreatedOn?.toISOString(),
            sbModifiedOn: sbModifiedOn?.toISOString() ?? null,
            sbBillDatetime: sbBillDatetime?.toISOString(),
            sbSyncDate: sbSyncDate?.toISOString() ?? null,
            sbBillSlno: sbBillSlno?.toString() ?? null,
            items: items ? items.map((item) => this.toItemPayload(item, godownNameById)) : [],
            charges: charges ?? [],
            tenders: tenders ?? [],
        };
    }
    toItemPayload(record, godownNameById = new Map()) {
        const { sbiCreatedOn, sbiModifiedOn, sbiSyncDate, item, itemUnitConversion, ...rest } = record;
        return {
            ...rest,
            sbiCreatedOn: sbiCreatedOn?.toISOString(),
            sbiModifiedOn: sbiModifiedOn?.toISOString() ?? null,
            sbiSyncDate: sbiSyncDate?.toISOString() ?? null,
            sbiItemName: item?.itemNameEn ?? null,
            sbiUnitName: itemUnitConversion?.unit.unit_name ?? null,
            sbiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
            sbiGroupId: item?.itemGroupId ?? null,
            sbiBrandId: item?.itemBrandId ?? null,
            sbiSectionId: item?.itemSectionId ?? null,
            sbiCategoryId: item?.itemCategoryId ?? null,
            sbiGodownName: godownNameById.get(record.sbiGodownId) ?? null,
        };
    }
};
exports.BillService = BillService;
exports.BillService = BillService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService,
        sale_order_service_1.SaleOrderService])
], BillService);
//# sourceMappingURL=bill.service.js.map