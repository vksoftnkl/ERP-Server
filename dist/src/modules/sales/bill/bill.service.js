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
exports.flatTransportOf = flatTransportOf;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const bill_api_types_1 = require("./types/bill-api.types");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const sale_order_api_types_1 = require("../sale-order/types/sale-order-api.types");
const quotation_service_1 = require("../quotation/quotation.service");
const quotation_api_types_1 = require("../quotation/types/quotation-api.types");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_blocks_service_1 = require("../posting/sales-doc-blocks.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_read_service_1 = require("./bill-read.service");
const bill_temp_credit_1 = require("./bill-temp-credit");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const BILL_VCHR_TYPE_ID = 3;
const BILL_TABLE_NAME = 'sale_bill';
const BILL_ITEM_TABLE_NAME = 'sale_bill_item';
const BILL_AUDIT_SCREEN_NAME = 'Sale Bill';
const BILL_DOC_TYPES = ['TAX_INVOICE', 'BILL_OF_SUPPLY'];
const BILL_TYPES = ['CASH', 'CREDIT'];
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
    'sbBillMode',
    'sbUsrRefdate',
    'sbCustPan',
    'sbForm60Ref',
    'sbLoyaltyMemberId',
    'sbTcsPerc',
    'sbTcsAmt',
    'sbHasDc',
    'sbApprovedOn',
    'sbApprovedBy',
    'sbVersionNo',
    'sbPrintCount',
];
const BILL_ITEM_OPTIONAL_FIELDS = [
    'sbiSrcItemId',
    'sbiBucket',
    'sbiLotId',
    'sbiPromoUsageId',
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
    'sbUsrRefdate',
    'sbBillDate',
    'sbBillDatetime',
    'sbDueDate',
    'sbSrcDocDate',
    'sbApprovedOn',
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
const EMPTY_LINE_CONTEXT = {
    godownById: new Map(),
    companyAllowsNegStock: null,
};
let BillService = class BillService {
    prisma;
    auditLogService;
    requestContextService;
    chargeDetailService;
    tenderDetailService;
    saleOrderService;
    quotationService;
    transportBand;
    salesContext;
    docBlocks;
    billRead;
    constructor(prisma, auditLogService, requestContextService, chargeDetailService, tenderDetailService, saleOrderService, quotationService, transportBand, salesContext, docBlocks, billRead) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.chargeDetailService = chargeDetailService;
        this.tenderDetailService = tenderDetailService;
        this.saleOrderService = saleOrderService;
        this.quotationService = quotationService;
        this.transportBand = transportBand;
        this.salesContext = salesContext;
        this.docBlocks = docBlocks;
        this.billRead = billRead;
    }
    async save(saveBillDto) {
        this.ensureBillValuesAreAllowed(saveBillDto);
        stripServerOwned(saveBillDto);
        const saved = saveBillDto.sbId
            ? await this.updateBill(saveBillDto)
            : await this.createBill(saveBillDto);
        return this.getById(saved.sbId, saved.sbCompanyId, saved.sbBranchId, saved.sbAccYear);
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
                                itemIsService: true,
                                itemAllowNegStock: true,
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
        const [godownById, companyAllowsNegStock] = await Promise.all([
            this.resolveGodowns(record.items),
            this.resolveCompanyNegStock(record.sbCompanyId),
        ]);
        const payload = this.toPayload({ ...record, charges, tenders }, { godownById, companyAllowsNegStock });
        return this.billRead.decorate(record, payload);
    }
    async lockHeader(tx, keys) {
        const rows = await tx.$queryRaw `
      SELECT sb_id FROM sales.sale_bill
       WHERE sb_id = ${keys.sbId}::uuid AND sb_acc_year = ${keys.sbAccYear}::char(9)
         AND sb_company_id = ${keys.sbCompanyId}::uuid AND sb_branch_id = ${keys.sbBranchId}::uuid
         AND sb_is_deleted = false
       FOR UPDATE`;
        if (rows.length === 0) {
            (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${keys.sbId}`);
        }
        const record = await tx.saleBill.findFirst({
            where: { sbId: keys.sbId, sbAccYear: keys.sbAccYear, sbIsDeleted: false },
        });
        return record;
    }
    async loadParts(tx, bill) {
        const [items, charges, tenders] = await Promise.all([
            tx.saleBillItem.findMany({
                where: { sbiBillId: bill.sbId, sbiAccYear: bill.sbAccYear, sbiIsDeleted: false },
                orderBy: [{ sbiLineNo: 'asc' }, { sbiSplitNo: 'asc' }],
            }),
            this.chargeDetailService.getByDocument(bill_api_types_1.BILL_CHARGE_DOC_TYPE, bill.sbId),
            this.tenderDetailService.getByDocument(bill_api_types_1.BILL_TENDER_SRC_MODULE, bill_api_types_1.BILL_TENDER_SRC_DOC_TYPE, bill.sbId),
        ]);
        return { items, charges, tenders };
    }
    async deleteDraft(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.lockHeader(tx, dto);
            if (existing.sbStatus === bill_api_types_1.BILL_STATUS_POSTED) {
                (0, sales_errors_1.throwSalesLocked)('This bill is POSTED — use /bills/cancel', posting_types_1.SALES_ERROR_CODES.BILL_POSTED, 'sbId');
            }
            if (existing.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED) {
                (0, sales_errors_1.throwSalesLocked)('This bill is CANCELLED and stays on record', posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
            }
            const items = await tx.saleBillItem.findMany({
                where: { sbiBillId: existing.sbId, sbiAccYear: existing.sbAccYear, sbiIsDeleted: false },
            });
            await this.softDeleteItems(tx, items, actor, now);
            const scope = this.toScope(existing);
            await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), [], actor, bill_api_types_1.BILL_CHARGE_AUDIT);
            await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope, []), [], actor, bill_api_types_1.BILL_TENDER_AUDIT);
            await this.transportBand.remove(tx, { docType: 'SALE_BILL', docId: existing.sbId, accYear: existing.sbAccYear }, actor);
            await tx.saleBill.update({
                where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
                data: { sbIsDeleted: true, sbModifiedOn: now, sbModifiedBy: actor },
            });
            await this.saleOrderService.syncOrderFulfilment(tx, { refs: [...this.toOrderHeaderRefs(existing), ...this.toOrderLineRefs(items)] }, actor, now);
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: existing.sbCompanyId,
                branchId: existing.sbBranchId,
                tenantId: existing.sbTenantId,
                accYear: existing.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: existing.sbId,
                srcDocRefno: existing.sbBillRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.DELETED,
                fromStatus: existing.sbStatus,
                toStatus: existing.sbStatus,
                changedOn: now,
                changedBy: actor,
                deviceId: existing.sbDeviceId,
                sessionId: existing.sbSessionId,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: BILL_TABLE_NAME,
                screenName: BILL_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: existing.sbId,
                displayName: existing.sbBillRefno || existing.sbId,
                originalRecord: this.toPayload(existing),
                modifiedRecord: null,
                userId: actor,
                notes: 'Draft bill deleted',
            }, tx);
            return { sbId: existing.sbId, deleted: true };
        });
    }
    toScope(bill) {
        return {
            sbId: bill.sbId,
            sbCompanyId: bill.sbCompanyId,
            sbBranchId: bill.sbBranchId,
            sbTenantId: bill.sbTenantId,
            sbAccYear: bill.sbAccYear,
            sbPriceLevel: bill.sbPriceLevel,
            sbBillSlno: bill.sbBillSlno,
            sbBillDate: bill.sbBillDate,
            sbCustId: bill.sbCustId,
            sbUserId: bill.sbUserId,
            sbSessionId: bill.sbSessionId,
            sbDeviceId: bill.sbDeviceId,
        };
    }
    async createBill(saveBillDto) {
        const normalizedCustName = (0, module_service_utils_1.normalizeRequiredText)(saveBillDto.sbCustName ?? '', 'sbCustName');
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveBillDto.sbCreatedBy, this.requestContextService.getUserId());
        const billDate = saveBillDto.sbBillDate ? new Date(saveBillDto.sbBillDate) : now;
        try {
            return await this.prisma.$transaction(async (tx) => {
                await this.ensurePosStateExists(tx, saveBillDto);
                const settings = await this.salesContext.settings(saveBillDto.sbCompanyId, saveBillDto.sbBranchId);
                const posSeries = (saveBillDto.sbBillMode ?? 'WHOLESALE') === 'POS' && settings.posSeriesPerDevice;
                const billNumber = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
                    vchrTypeId: BILL_VCHR_TYPE_ID,
                    companyId: saveBillDto.sbCompanyId,
                    branchId: saveBillDto.sbBranchId,
                    accYear: saveBillDto.sbAccYear,
                    deviceCode: posSeries ? saveBillDto.sbDeviceId : null,
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
                    sbStatus: bill_api_types_1.BILL_STATUS_DRAFT,
                    sbRevisionNo: 1,
                };
                this.applyOptionalFields(data, saveBillDto);
                data.sbCustName = normalizedCustName;
                data.sbBillDate = billDate;
                await this.applyCustomerSnapshot(tx, data, saveBillDto, settings.defaultCustomerId);
                const created = await tx.saleBill.create({ data });
                const scope = this.toScope(created);
                const items = await this.syncItems(tx, scope, saveBillDto.items, createdBy);
                const charges = await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), saveBillDto.charges, createdBy, bill_api_types_1.BILL_CHARGE_AUDIT);
                const tenders = await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope, saveBillDto.tenders), (0, bill_temp_credit_1.encodeTempCreditTenders)(saveBillDto.tenders), createdBy, bill_api_types_1.BILL_TENDER_AUDIT);
                await this.validateDraftAdjustments(tx, created, saveBillDto.adjustments);
                await this.writeTransportBand(tx, created, saveBillDto, createdBy, now);
                await this.saleOrderService.syncOrderFulfilment(tx, { refs: [...this.toOrderHeaderRefs(created), ...this.toOrderLineRefs(items)] }, createdBy, now);
                await this.quotationService.syncQuotationConversion(tx, { refs: this.toQuotationRefs(created) }, createdBy, now);
                await this.logStatusChange(tx, created, null, createdBy, now, null);
                const payload = this.toPayload({ ...created, items, charges, tenders });
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
                return created;
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
                    where: { sbId, sbIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No active bill found with id ${sbId}`);
                }
                if (existing.sbStatus === bill_api_types_1.BILL_STATUS_POSTED) {
                    (0, sales_errors_1.throwSalesLocked)('This bill is POSTED — use /bills/amend', posting_types_1.SALES_ERROR_CODES.BILL_POSTED, 'sbId');
                }
                if (existing.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED) {
                    (0, sales_errors_1.throwSalesLocked)('This bill is CANCELLED and cannot be edited', posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
                }
                const now = new Date();
                const modifiedBy = (0, module_service_utils_1.resolveActor)(saveBillDto.sbModifiedBy, this.requestContextService.getUserId());
                const { updated } = await this.applySaveInTx(tx, existing, saveBillDto, modifiedBy, now);
                return updated;
            });
        }
        catch (error) {
            const duplicate = this.describeDuplicate(error);
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, duplicate.message, duplicate.errors);
            throw error;
        }
    }
    async applySaveInTx(tx, existing, saveBillDto, modifiedBy, now, opts = {}) {
        const settings = await this.salesContext.settings(existing.sbCompanyId, existing.sbBranchId);
        const data = {
            sbModifiedOn: now,
            sbModifiedBy: modifiedBy,
        };
        this.applyOptionalFields(data, saveBillDto);
        await this.ensurePosStateExists(tx, saveBillDto);
        await this.applyCustomerSnapshot(tx, data, saveBillDto, settings.defaultCustomerId);
        const updated = await tx.saleBill.update({
            where: { sbId_sbAccYear: { sbId: existing.sbId, sbAccYear: existing.sbAccYear } },
            data,
        });
        const scope = this.toScope(updated);
        const priorItems = await tx.saleBillItem.findMany({
            where: { sbiBillId: existing.sbId, sbiIsDeleted: false },
        });
        const items = await this.syncItems(tx, scope, saveBillDto.items, modifiedBy);
        const charges = await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), saveBillDto.charges, modifiedBy, bill_api_types_1.BILL_CHARGE_AUDIT);
        const tenders = await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope, saveBillDto.tenders), (0, bill_temp_credit_1.encodeTempCreditTenders)(saveBillDto.tenders), modifiedBy, bill_api_types_1.BILL_TENDER_AUDIT);
        await this.validateDraftAdjustments(tx, updated, saveBillDto.adjustments);
        await this.writeTransportBand(tx, updated, saveBillDto, modifiedBy, now);
        await this.saleOrderService.syncOrderFulfilment(tx, {
            refs: [
                ...this.toOrderHeaderRefs(existing),
                ...this.toOrderHeaderRefs(updated),
                ...this.toOrderLineRefs(priorItems),
                ...this.toOrderLineRefs(items),
            ],
        }, modifiedBy, now);
        await this.quotationService.syncQuotationConversion(tx, { refs: [...this.toQuotationRefs(existing), ...this.toQuotationRefs(updated)] }, modifiedBy, now);
        const payload = this.toPayload({ ...updated, items, charges, tenders });
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: BILL_TABLE_NAME,
            screenName: BILL_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: existing.sbId,
            displayName: payload.sbBillRefno || payload.sbId,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: modifiedBy,
            notes: opts.notes ?? 'Bill updated',
        }, tx);
        return { updated, items };
    }
    async applyCustomerSnapshot(tx, data, dto, walkInCustomerId) {
        const custId = dto.sbCustId;
        if (!custId || dto.custOverride || custId === walkInCustomerId) {
            return;
        }
        const cus = await tx.customer.findFirst({
            where: { cusId: custId },
            select: {
                cusName: true,
                cusAddr1: true,
                cusAddr2: true,
                cusAddr3: true,
                cusCity: true,
                cusPin: true,
                cusPhone1: true,
                cusGstNo: true,
                cusGstType: true,
                cusStateCode: true,
                cusStateName: true,
                cusPanNo: true,
            },
        });
        if (!cus) {
            (0, module_service_utils_1.throwSalesBadRequest)('Customer does not exist', [
                { field: 'sbCustId', message: `No customer found with id ${custId}` },
            ]);
        }
        const addr = [cus.cusAddr1, cus.cusAddr2, cus.cusAddr3].filter((a) => a?.trim()).join(', ');
        const d = data;
        d.sbCustName = cus.cusName ?? d.sbCustName;
        d.sbCustAddr = addr || null;
        d.sbCustPlace = cus.cusCity ?? null;
        d.sbCustPin = cus.cusPin ?? null;
        d.sbCustPhone = cus.cusPhone1 ?? null;
        d.sbCustGstin = cus.cusGstNo ?? null;
        d.sbCustGstType = cus.cusGstType ?? null;
        d.sbCustStcd = cus.cusStateCode ?? null;
        d.sbStateName = cus.cusStateName ?? null;
        if (dto.sbCustPan === undefined && cus.cusPanNo) {
            d.sbCustPan = cus.cusPanNo;
        }
    }
    async writeTransportBand(tx, bill, dto, actor, now) {
        const input = flatTransportOf(dto);
        if (!transport_band_service_1.TransportBandService.hasContent(input)) {
            return;
        }
        await this.transportBand.write(tx, {
            docType: 'SALE_BILL',
            docId: bill.sbId,
            accYear: bill.sbAccYear,
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            docRefno: bill.sbBillRefno,
        }, input, actor, { gdrId: bill.sbDocRegisterId, now });
    }
    async validateDraftAdjustments(tx, bill, adjustments) {
        if (adjustments === undefined || adjustments.length === 0) {
            return;
        }
        const partyId = this.requireCustomerLedgerId(bill.sbCustId, 'adjustments');
        let total = 0;
        for (const [index, adj] of adjustments.entries()) {
            const [credit] = await tx.$queryRaw `
        SELECT abl_party_id, abl_dr_cr, abl_pending_amount
          FROM accounts.acc_bill_balance
         WHERE abl_id = ${adj.againstBillId}::uuid AND abl_acc_year = ${adj.againstBillAccYear}::bpchar
           AND abl_company_id = ${bill.sbCompanyId}::uuid AND abl_is_deleted = false AND abl_is_active = true`;
            if (!credit || credit.abl_party_id !== partyId || credit.abl_dr_cr.trim() !== 'CR') {
                (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                    {
                        field: `adjustments[${index}].againstBillId`,
                        message: `No open credit ${adj.againstBillId} belongs to this customer`,
                    },
                ]);
            }
            if ((0, sales_doc_utils_1.num)(credit.abl_pending_amount) + 0.005 < (0, sales_doc_utils_1.num)(adj.amount)) {
                (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                    {
                        field: `adjustments[${index}].amount`,
                        message: `Credit has only ${(0, sales_doc_utils_1.num)(credit.abl_pending_amount)} pending`,
                    },
                ]);
            }
            total += (0, sales_doc_utils_1.num)(adj.amount);
        }
        const declared = (0, sales_doc_utils_1.num)(bill.sbAdvanceAmt);
        if (Math.abs(declared - total) > 0.01) {
            (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                {
                    field: 'sbAdvanceAmt',
                    message: `adjustments total ${total.toFixed(2)} but sbAdvanceAmt says ${declared.toFixed(2)}`,
                },
            ]);
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
    orderRefsOf(bill, items) {
        return [...this.toOrderHeaderRefs(bill), ...this.toOrderLineRefs(items)];
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
    toQuotationRefs(bill) {
        if (!bill || bill.sbSrcDocType !== quotation_api_types_1.QUOTATION_SRC_DOC_TYPE) {
            return [];
        }
        if (!bill.sbSrcDocId || !bill.sbSrcDocYear) {
            return [];
        }
        return [
            {
                srcDocId: bill.sbSrcDocId,
                srcAccYear: bill.sbSrcDocYear.trim(),
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
    toTenderScope(scope, tenders) {
        return {
            tdSrcModule: bill_api_types_1.BILL_TENDER_SRC_MODULE,
            tdSrcDocType: bill_api_types_1.BILL_TENDER_SRC_DOC_TYPE,
            tdSrcDocId: scope.sbId,
            tdCompanyId: scope.sbCompanyId,
            tdBranchId: scope.sbBranchId,
            tdTenantId: scope.sbTenantId,
            tdAccYear: scope.sbAccYear,
            tdDocDate: scope.sbBillDate,
            tdPartyLedgerId: tenders === undefined || tenders.length === 0
                ? scope.sbCustId
                : this.requireCustomerLedgerId(scope.sbCustId, 'tenders'),
            tdUserId: scope.sbUserId,
            tdSessionId: scope.sbSessionId,
            tdDeviceId: scope.sbDeviceId,
            tdDrCr: bill_api_types_1.BILL_TENDER_DR_CR,
        };
    }
    requireCustomerLedgerId(sbCustId, field) {
        if (sbCustId === null) {
            (0, module_service_utils_1.throwSalesBadRequest)('Bill cannot be saved', [
                {
                    field,
                    message: 'This bill names no customer (sbCustId), so there is no account ledger to raise ' +
                        'these rows against. Pick a customer, or drop them from the payload.',
                },
            ]);
        }
        return sbCustId;
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
            remarks,
            deviceId: bill.sbDeviceId,
            sessionId: bill.sbSessionId,
        });
    }
    toStatusEvent(fromStatus, toStatus) {
        if (fromStatus === null) {
            return txn_status_log_helper_1.TxnStatusEvent.CREATED;
        }
        if (toStatus === bill_api_types_1.BILL_STATUS_CANCELLED) {
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
    async resolveGodowns(items = []) {
        const godownIds = [...new Set(items.map((item) => item.sbiGodownId))];
        if (godownIds.length === 0) {
            return new Map();
        }
        const godowns = await this.prisma.godownLocation.findMany({
            where: { gdlId: { in: godownIds } },
            select: { gdlId: true, gdlName: true, gdlNegativeStock: true },
        });
        return new Map(godowns.map((godown) => [
            godown.gdlId,
            { gdlName: godown.gdlName, gdlNegativeStock: godown.gdlNegativeStock },
        ]));
    }
    async resolveCompanyNegStock(companyId) {
        const company = await this.prisma.company.findFirst({
            where: { compId: companyId, compIsDeleted: false },
            select: { compNegStkApl: true },
        });
        return company?.compNegStkApl ?? null;
    }
    toPayload(record, lineContext = EMPTY_LINE_CONTEXT) {
        const { sbCreatedOn, sbModifiedOn, sbBillDatetime, sbSyncDate, sbBillSlno, items, charges, tenders, ...rest } = record;
        return {
            ...rest,
            sbCreatedOn: sbCreatedOn?.toISOString(),
            sbModifiedOn: sbModifiedOn?.toISOString() ?? null,
            sbBillDatetime: sbBillDatetime?.toISOString(),
            sbSyncDate: sbSyncDate?.toISOString() ?? null,
            sbBillSlno: sbBillSlno?.toString() ?? null,
            items: items ? items.map((item) => this.toItemPayload(item, lineContext)) : [],
            charges: charges ?? [],
            tenders: tenders ?? [],
        };
    }
    toItemPayload(record, lineContext = EMPTY_LINE_CONTEXT) {
        const { godownById, companyAllowsNegStock } = lineContext;
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
            sbiGodownName: godownById.get(record.sbiGodownId)?.gdlName ?? null,
            sbiAllowNegativeStock: item
                ? item.itemIsService ||
                    !(godownById.get(record.sbiGodownId)?.gdlNegativeStock === false &&
                        companyAllowsNegStock === false &&
                        item.itemAllowNegStock === false)
                : null,
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
        sale_order_service_1.SaleOrderService,
        quotation_service_1.QuotationService,
        transport_band_service_1.TransportBandService,
        sales_context_service_1.SalesContextService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        bill_read_service_1.BillReadService])
], BillService);
function stripServerOwned(dto) {
    const d = dto;
    for (const key of [
        'sbStatus',
        'sbPostedVoucherId',
        'sbDocRegisterId',
        'sbRevisionNo',
        'sbCogsAmt',
        'sbDeliveryStatus',
        'sbLoyaltyEarned',
        'sbLoyaltyRedeemed',
        'sbReturnedAmt',
        'sbReturnStatus',
        'sbBillSlno',
        'sbBillRefno',
    ]) {
        delete d[key];
    }
    for (const item of dto.items ?? []) {
        delete item.sbiCogsAmt;
    }
}
function flatTransportOf(dto) {
    return {
        direction: 'OUTWARD',
        from: {
            godownId: dto.sbDispatchGodownId ?? null,
            branchId: dto.sbDispatchBranchId ?? null,
        },
        to: {
            addrId: dto.sbShipAddrId ?? null,
            name: dto.sbShipName ?? null,
            addr: dto.sbShipAddr ?? null,
            place: dto.sbShipPlace ?? null,
            pin: dto.sbShipPin ?? null,
            phone: dto.sbShipPhone ?? null,
            stcd: dto.sbShipStcd ?? null,
            gstin: dto.sbShipGstin ?? null,
        },
        mode: dto.sbTransportMode ?? null,
        transporterId: dto.sbTransporterId ?? null,
        transporterName: dto.sbTransporterName ?? null,
        transporterGstin: dto.sbTransporterGstin ?? null,
        lrNo: dto.sbLrNo ?? null,
        lrDate: dto.sbLrDate ?? null,
        distanceKm: dto.sbDistanceKm ?? null,
    };
}
//# sourceMappingURL=bill.service.js.map