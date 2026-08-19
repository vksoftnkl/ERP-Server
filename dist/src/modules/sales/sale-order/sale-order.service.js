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
exports.SaleOrderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const sale_order_api_types_1 = require("./types/sale-order-api.types");
const bill_api_types_1 = require("../bill/types/bill-api.types");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const voucher_sequence_helper_1 = require("../../../common/Sequence/voucher-sequence.helper");
const order_advance_posting_helper_1 = require("./order-advance-posting.helper");
const SALE_ORDER_VCHR_TYPE_ID = 4;
const SALE_ORDER_TABLE_NAME = 'sale_order';
const SALE_ORDER_ITEM_TABLE_NAME = 'sale_order_item';
const SALE_ORDER_AUDIT_SCREEN_NAME = 'Sale Order';
const SALE_ORDER_TYPES = ['CASH', 'CREDIT'];
const SALE_ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const SALE_ORDER_DELIVERY_MODES = [
    'STORE_PICKUP',
    'HOME_DELIVERY',
    'SHIP_FROM_STORE',
    'COURIER',
    'TRANSPORT',
];
const SALE_ORDER_STATUSES = [
    'DRAFT',
    'CONFIRMED',
    'PARTIAL',
    'COMPLETED',
    'CANCELLED',
    'CLOSED',
    'EXPIRED',
];
const SALE_ORDER_STATUS_CANCELLED = 'CANCELLED';
const SALE_ORDER_FULFIL_STATUSES = ['PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED'];
const SALE_ORDER_PAY_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'];
const SALE_ORDER_ADVANCE_POLICIES = ['NONE', 'FIXED', 'PERC', 'FULL'];
const SALE_ORDER_ADVANCE_STATUSES = [
    'NONE',
    'PENDING',
    'PARTIAL',
    'RECEIVED',
    'ADJUSTED',
    'REFUNDED',
    'FORFEITED',
];
const SALE_ORDER_ITEM_FREE_TYPES = ['SCHEME', 'SAMPLE', 'REPLACEMENT'];
const SALE_ORDER_ITEM_LINE_STATUSES = ['PENDING', 'PARTIAL', 'DELIVERED', 'CANCELLED'];
const SALE_ORDER_LINE_PENDING = 'PENDING';
const SALE_ORDER_LINE_PARTIAL = 'PARTIAL';
const SALE_ORDER_LINE_DELIVERED = 'DELIVERED';
const SALE_ORDER_LINE_CANCELLED = 'CANCELLED';
const SALE_ORDER_FULFIL_PENDING = 'PENDING';
const SALE_ORDER_FULFIL_PARTIAL = 'PARTIAL';
const SALE_ORDER_FULFIL_COMPLETED = 'COMPLETED';
const SALE_ORDER_FULFIL_CANCELLED = 'CANCELLED';
const SALE_ORDER_FULFIL_STATUS_REMARK = 'Order fulfilment recomputed from its sale bills';
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const SALE_ORDER_VALUE_GUARDS = [
    { field: 'soDocType', allowed: sale_order_api_types_1.SALE_ORDER_DOC_TYPES, nullable: false },
    { field: 'soOrderType', allowed: SALE_ORDER_TYPES, nullable: false },
    { field: 'soPriority', allowed: SALE_ORDER_PRIORITIES, nullable: false },
    { field: 'soDeliveryMode', allowed: SALE_ORDER_DELIVERY_MODES, nullable: false },
    { field: 'soStatus', allowed: SALE_ORDER_STATUSES, nullable: false },
    { field: 'soFulfilStatus', allowed: SALE_ORDER_FULFIL_STATUSES, nullable: false },
    { field: 'soPayStatus', allowed: SALE_ORDER_PAY_STATUSES, nullable: false },
    { field: 'soAdvancePolicy', allowed: SALE_ORDER_ADVANCE_POLICIES, nullable: false },
    { field: 'soAdvanceStatus', allowed: SALE_ORDER_ADVANCE_STATUSES, nullable: true },
];
const AMOUNT_EPSILON = 0.005;
const QTY_EPSILON = 0.0005;
const SALE_ORDER_OPTIONAL_FIELDS = [
    'soSessionId',
    'soDeviceId',
    'soDocType',
    'soOrderType',
    'soUsrRefno',
    'soOrderDate',
    'soOrderDatetime',
    'soDeliveryDate',
    'soDeliverySlot',
    'soPriority',
    'soValidUntil',
    'soSrcDocType',
    'soSrcDocId',
    'soSrcDocAccYear',
    'soSrcDocRefno',
    'soSrcDocDate',
    'soDeliveryMode',
    'soCustId',
    'soCustName',
    'soCustAddr',
    'soCustPlace',
    'soCustPin',
    'soCustPhone',
    'soCustEmail',
    'soCustGstin',
    'soCustGstType',
    'soCustStcd',
    'soPosStcd',
    'soStateName',
    'soContactPerson',
    'soContactPhone',
    'soShipName',
    'soShipAddr',
    'soShipPlace',
    'soShipPin',
    'soShipPhone',
    'soShipStcd',
    'soShipLandmark',
    'soShipLat',
    'soShipLng',
    'soHasLoad',
    'soHasUnload',
    'soHasFreight',
    'soHasPromo',
    'soHasComm',
    'soHasLoyalty',
    'soSalesmanId',
    'soAgentId',
    'soAgentCommPerc',
    'soAgentCommAmt',
    'soPackedId',
    'soTotItems',
    'soDeliveredItems',
    'soTotWeight',
    'soTotBags',
    'soGrossAmt',
    'soItemDisc',
    'soSplDisc',
    'soSchDisc',
    'soBillSchDisc',
    'soAddlDisc1',
    'soAddlDisc2',
    'soCashDiscPerc',
    'soCashDisc',
    'soTaxableAmt',
    'soCgstAmt',
    'soSgstAmt',
    'soIgstAmt',
    'soCessAmt',
    'soTaxAmt',
    'soFreightAmt',
    'soLoadAmt',
    'soUnloadAmt',
    'soOtherAmt1',
    'soOtherAmt2',
    'soRoundOff',
    'soOrderAmt',
    'soTotalCost',
    'soMarginAmt',
    'soMarginAmtWot',
    'soMarginPerc',
    'soMarginPercWot',
    'soMrpSavings',
    'soMrpSavingsPerc',
    'soAdvancePolicy',
    'soAdvancePerc',
    'soAdvanceRequired',
    'soAdvanceDueDate',
    'soIsAdvanceMandatory',
    'soAdvanceLedgerId',
    'soAdvanceRecdAmt',
    'soAdvanceAdjustedAmt',
    'soAdvanceRefundAmt',
    'soAdvanceForfeitAmt',
    'soAdvanceBalanceAmt',
    'soAdvanceStatus',
    'soAdvanceRecdOn',
    'soPayMode',
    'soSurchargeAmt',
    'soTenderAmt',
    'soRefundAmt',
    'soPayStatus',
    'soBilledAmt',
    'soCancelledAmt',
    'soPendingAmt',
    'soFulfilStatus',
    'soLastBilledOn',
    'soCompletedOn',
    'soPaymentTerms',
    'soDeliveryTerms',
    'soTermsConditions',
    'soRemarks',
    'soFreightCalcType',
    'soLoadingCalcType',
    'soDiscAlterBase',
    'soRoundOffStep',
    'soStatus',
    'soVersionNo',
    'soPrintCount',
];
const SALE_ORDER_ITEM_OPTIONAL_FIELDS = [
    'soiSrcDocType',
    'soiSrcDocId',
    'soiSrcDocAccYear',
    'soiSrcDocRefno',
    'soiSrcLineNo',
    'soiToBaseFactor',
    'soiHsnCode',
    'soiEanCode',
    'soiSize',
    'soiSizeUom',
    'soiGodownId',
    'soiIsReserved',
    'soiReservedQty',
    'soiReserveExpiresOn',
    'soiIsTaxIncl',
    'soiIsPromo',
    'soiIsFree',
    'soiFreeType',
    'soiIsService',
    'soiHasFreight',
    'soiCaseQty',
    'soiOrderQty',
    'soiLengthQty',
    'soiNetQty',
    'soiWeightQty',
    'soiAvailableStock',
    'soiDeliveredQty',
    'soiCancelledQty',
    'soiBilledAmt',
    'soiRate',
    'soiRatePreTax',
    'soiRateDiff',
    'soiActPrice',
    'soiMaxPrice',
    'soiMinPrice',
    'soiCostPrice',
    'soiCostPreTax',
    'soiIsRateLocked',
    'soiItemDiscPerc',
    'soiItemDiscQty',
    'soiItemDiscAmt',
    'soiSplDiscPerc',
    'soiSplDiscQty',
    'soiSplDiscAmt',
    'soiSchDiscPerc',
    'soiSchDiscQty',
    'soiSchDiscAmt',
    'soiBillSchPerc',
    'soiBillSchQty',
    'soiBillSchAmt',
    'soiAddlDisc1Perc',
    'soiAddlDisc1Amt',
    'soiAddlDisc2Perc',
    'soiAddlDisc2Amt',
    'soiCashDiscPerc',
    'soiCashDiscAmt',
    'soiGrossAmt',
    'soiNetGross',
    'soiChrgBeforeTax',
    'soiChrgAfterTax',
    'soiTaxableAmt',
    'soiTaxPerc',
    'soiTaxAmt',
    'soiCgstPerc',
    'soiCgstAmt',
    'soiSgstPerc',
    'soiSgstAmt',
    'soiIgstPerc',
    'soiIgstAmt',
    'soiCessPerc',
    'soiCessPerUnit',
    'soiCessAmt',
    'soiAcessPerc',
    'soiAcessPerUnit',
    'soiAcessAmt',
    'soiFreightQty',
    'soiFreightAmt',
    'soiLoadQty',
    'soiLoadAmt',
    'soiUnloadQty',
    'soiUnloadAmt',
    'soiRoundOff',
    'soiNetAmt',
    'soiSoldPrice',
    'soiSoldPreTax',
    'soiItemProfit',
    'soiProfitPreTax',
    'soiMrpSavings',
    'soiMrpSavingsPerc',
    'soiDeliveryDate',
    'soiSalesmanId',
    'soiSchemeId',
    'soiSchemeName',
    'soiRemarks',
];
const SALE_ORDER_DATE_FIELDS = [
    'soOrderDate',
    'soOrderDatetime',
    'soDeliveryDate',
    'soValidUntil',
    'soSrcDocDate',
    'soAdvanceDueDate',
    'soAdvanceRecdOn',
    'soLastBilledOn',
    'soCompletedOn',
];
const SALE_ORDER_ITEM_DATE_FIELDS = ['soiReserveExpiresOn', 'soiDeliveryDate'];
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
const SALE_ORDER_DATE_TRANSFORMS = buildDateTransforms(SALE_ORDER_DATE_FIELDS);
const SALE_ORDER_ITEM_DATE_TRANSFORMS = buildDateTransforms(SALE_ORDER_ITEM_DATE_FIELDS);
function asNumber(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
function roundQty(value) {
    return Math.round(value * 1000) / 1000;
}
function roundAmount(value) {
    return Math.round(value * 100) / 100;
}
function merged(inputValue, existingValue) {
    if (inputValue !== undefined) {
        return inputValue;
    }
    return existingValue === undefined ? null : existingValue;
}
const EMPTY_NAME_MAPS = {
    companyNameById: new Map(),
    branchNameById: new Map(),
    employeeNameById: new Map(),
    ledgerNameById: new Map(),
    userNameById: new Map(),
    godownNameById: new Map(),
};
function distinctIds(values) {
    return [...new Set(values.filter((value) => !!value))];
}
let SaleOrderService = class SaleOrderService {
    prisma;
    auditLogService;
    requestContextService;
    chargeDetailService;
    tenderDetailService;
    constructor(prisma, auditLogService, requestContextService, chargeDetailService, tenderDetailService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.chargeDetailService = chargeDetailService;
        this.tenderDetailService = tenderDetailService;
    }
    async save(saveOrderDto) {
        this.ensureOrderValuesAreAllowed(saveOrderDto);
        if (saveOrderDto.soId) {
            return this.updateOrder(saveOrderDto);
        }
        return this.createOrder(saveOrderDto);
    }
    async getById(soId, soCompanyId, soBranchId, soAccYear) {
        const record = await this.prisma.saleOrder.findFirst({
            where: {
                soId,
                soCompanyId,
                soBranchId,
                soAccYear,
                soIsDeleted: false,
            },
            include: {
                items: {
                    where: { soiIsDeleted: false },
                    orderBy: { soiLineNo: 'asc' },
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
            (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No active order found with id ${soId}`);
        }
        const charges = await this.chargeDetailService.getByDocument(sale_order_api_types_1.SALE_ORDER_CHARGE_DOC_TYPE, soId);
        const tenders = await this.tenderDetailService.getByDocument(sale_order_api_types_1.SALE_ORDER_TENDER_SRC_MODULE, sale_order_api_types_1.SALE_ORDER_TENDER_SRC_DOC_TYPE, soId);
        const names = await this.resolveDisplayNames(record, charges, tenders);
        return this.toPayload({
            ...record,
            charges,
            tenders,
        }, names);
    }
    async getSrcDocPendingAmount(ablSrcDocType, ablSrcDocId, ablSrcAccYear) {
        const srcDocType = (ablSrcDocType ?? '')
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_');
        if (!srcDocType) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid source document type', [
                {
                    field: 'ablSrcDocType',
                    message: `ablSrcDocType is required — the document discriminator the bill row carries, e.g. ${sale_order_api_types_1.SALE_ORDER_DOC_TYPES.join(', ')}`,
                },
            ]);
        }
        const srcAccYear = (ablSrcAccYear ?? '').trim();
        if (!ACC_YEAR_PATTERN.test(srcAccYear)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid accounting year', [
                {
                    field: 'ablSrcAccYear',
                    message: 'ablSrcAccYear must be in the YYYY-YYYY form, e.g. 2026-2027',
                },
            ]);
        }
        const totals = await this.prisma.accBillBalance.aggregate({
            _sum: { ablPendingAmount: true },
            where: {
                ablSrcDocType: srcDocType,
                ablSrcDocId,
                ablSrcAccYear: srcAccYear,
                ablIsDeleted: false,
            },
        });
        return { ablPendingAmount: roundAmount(asNumber(totals._sum.ablPendingAmount)) };
    }
    async softDelete(soId, soCompanyId, soBranchId, soAccYear) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.saleOrder.findFirst({
                where: {
                    soId,
                    soCompanyId,
                    soBranchId,
                    soAccYear,
                    soIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No active order found with id ${soId}`);
            }
            if (asNumber(existing.soAdvanceBalanceAmt) > 0) {
                (0, module_service_utils_1.throwSalesBadRequest)('Order holds an unsettled advance', [
                    {
                        field: 'soAdvanceBalanceAmt',
                        message: 'The order still holds an advance balance; refund, forfeit or transfer it before deleting',
                    },
                ]);
            }
            const modifiedOn = new Date();
            const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const headerChanges = {
                soStatus: SALE_ORDER_STATUS_CANCELLED,
                soIsDeleted: true,
                soModifiedOn: modifiedOn,
                soModifiedBy: actor,
            };
            const result = await tx.saleOrder.updateMany({
                where: {
                    soId,
                    soCompanyId,
                    soBranchId,
                    soAccYear,
                    soIsDeleted: false,
                },
                data: headerChanges,
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No active order found with id ${soId}`);
            }
            await tx.saleOrderItem.updateMany({
                where: {
                    soiOrderId: soId,
                    soiAccYear: soAccYear,
                    soiIsDeleted: false,
                },
                data: {
                    soiIsDeleted: true,
                    soiModifiedOn: modifiedOn,
                    soiModifiedBy: actor,
                },
            });
            await this.chargeDetailService.softDeleteDocumentCharges(tx, sale_order_api_types_1.SALE_ORDER_CHARGE_DOC_TYPE, soId, actor, modifiedOn);
            await this.tenderDetailService.softDeleteDocumentTenders(tx, sale_order_api_types_1.SALE_ORDER_TENDER_SRC_MODULE, sale_order_api_types_1.SALE_ORDER_TENDER_SRC_DOC_TYPE, soId, actor, modifiedOn);
            await (0, order_advance_posting_helper_1.deleteOrderAdvancePosting)(tx, { soId, soCompanyId, soAccYear }, actor, modifiedOn);
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({ ...existing, ...headerChanges });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SALE_ORDER_TABLE_NAME,
                screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: soId,
                displayName: existing.soOrderRefno || soId,
                originalRecord,
                modifiedRecord,
                userId: actor,
                notes: 'Order soft deleted',
            }, tx);
            return {
                soId,
                deleted: true,
            };
        });
    }
    async cancelOpenLines(srcModule, srcDocId, srcAccYear, cancelDto) {
        const normalisedModule = (srcModule ?? '')
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, '_');
        if (!sale_order_api_types_1.SALE_ORDER_CANCEL_SRC_MODULES.includes(normalisedModule)) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid source module', [
                {
                    field: 'srcModule',
                    message: `srcModule must be one of ${sale_order_api_types_1.SALE_ORDER_CANCEL_SRC_MODULES.join(', ')} for a sales order`,
                },
            ]);
        }
        return this.prisma.$transaction(async (tx) => {
            let existing = await tx.saleOrder.findFirst({
                where: {
                    soId: srcDocId,
                    soAccYear: srcAccYear,
                    soIsDeleted: false,
                },
            });
            let targetLineId = null;
            if (!existing) {
                const line = await tx.saleOrderItem.findFirst({
                    where: { soiId: srcDocId, soiAccYear: srcAccYear, soiIsDeleted: false },
                    select: { soiId: true, soiOrderId: true },
                });
                if (line) {
                    targetLineId = line.soiId;
                    existing = await tx.saleOrder.findFirst({
                        where: {
                            soId: line.soiOrderId,
                            soAccYear: srcAccYear,
                            soIsDeleted: false,
                        },
                    });
                }
            }
            if (!existing) {
                (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'srcDocId', `No active order or order line found with id ${srcDocId} in accounting year ${srcAccYear}`);
            }
            return this.cancelOrderOpenLines(tx, {
                order: existing,
                srcAccYear,
                targetLineId,
                cancelReason: cancelDto?.soiCancelReason,
                actor: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                now: new Date(),
            });
        });
    }
    async cancelOpenLinesForRefs(tx, refs, cancelReason, actor, now) {
        if (refs.length === 0) {
            return [];
        }
        const targets = await this.resolveOrderRefs(tx, refs);
        const results = [];
        for (const target of targets) {
            const existing = await tx.saleOrder.findFirst({
                where: { soId: target.soId, soAccYear: target.soAccYear, soIsDeleted: false },
            });
            if (!existing) {
                (0, module_service_utils_1.throwSalesBadRequest)('Order not found', [
                    {
                        field: target.fields.docId,
                        message: `No active order found with id ${target.soId} in accounting year ` +
                            `${target.soAccYear}`,
                    },
                ]);
            }
            results.push(await this.cancelOrderOpenLines(tx, {
                order: existing,
                srcAccYear: target.soAccYear,
                targetLineId: null,
                cancelReason,
                actor,
                now,
            }));
        }
        return results;
    }
    async cancelOrderOpenLines(tx, request) {
        const { order: existing, srcAccYear, targetLineId, actor, now } = request;
        const lines = await tx.saleOrderItem.findMany({
            where: {
                soiOrderId: existing.soId,
                soiAccYear: srcAccYear,
                soiIsDeleted: false,
            },
            orderBy: { soiLineNo: 'asc' },
        });
        const settledLines = lines.map((line) => {
            const delivered = asNumber(line.soiDeliveredQty);
            const billedAmt = asNumber(line.soiBilledAmt);
            const pending = asNumber(line.soiPendingQty);
            if (pending <= QTY_EPSILON || (targetLineId !== null && line.soiId !== targetLineId)) {
                return {
                    line,
                    delivered,
                    cancelled: asNumber(line.soiCancelledQty),
                    pending,
                    billedAmt,
                    moved: 0,
                };
            }
            return {
                line,
                delivered,
                cancelled: roundQty(asNumber(line.soiCancelledQty) + pending),
                pending: 0,
                billedAmt,
                moved: roundQty(pending),
            };
        });
        const rollup = this.summariseOrderLines(settledLines);
        if (rollup.fulfilStatus === SALE_ORDER_FULFIL_CANCELLED &&
            asNumber(existing.soAdvanceBalanceAmt) > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Order holds an unsettled advance', [
                {
                    field: 'soAdvanceBalanceAmt',
                    message: 'The order still holds an advance balance; refund, forfeit or transfer it before ' +
                        'cancelling the remaining quantity',
                },
            ]);
        }
        const cancelledLines = [];
        const cancelReason = request.cancelReason;
        for (const settled of settledLines) {
            if (settled.moved <= 0) {
                continue;
            }
            const { line } = settled;
            const lineChanges = {
                soiCancelledQty: settled.cancelled,
                ...(cancelReason !== undefined ? { soiCancelReason: cancelReason } : {}),
                soiModifiedOn: now,
                soiModifiedBy: actor,
            };
            const updated = await tx.saleOrderItem.update({
                where: { soiId_soiAccYear: { soiId: line.soiId, soiAccYear: line.soiAccYear } },
                data: lineChanges,
            });
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: SALE_ORDER_ITEM_TABLE_NAME,
                screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: line.soiId,
                displayName: `${existing.soOrderRefno || existing.soId} #${line.soiLineNo}`,
                originalRecord: this.toItemPayload(line),
                modifiedRecord: this.toItemPayload(updated),
                userId: actor,
                notes: 'Order line cancelled',
            }, tx);
            cancelledLines.push({
                soiId: line.soiId,
                soiLineNo: line.soiLineNo,
                soiCancelledQty: settled.moved,
                soiLineStatus: updated.soiLineStatus,
            });
        }
        const headerChanges = {
            soBilledAmt: rollup.billedAmt,
            soCancelledAmt: rollup.cancelledAmt,
            soPendingAmt: rollup.pendingAmt,
            soTotItems: rollup.totItems,
            soDeliveredItems: rollup.deliveredItems,
            soFulfilStatus: rollup.fulfilStatus,
            soModifiedOn: now,
            soModifiedBy: actor,
        };
        const soStatus = rollup.headerStatus ?? existing.soStatus;
        if (rollup.headerStatus) {
            headerChanges.soStatus = rollup.headerStatus;
        }
        if (rollup.fulfilStatus === SALE_ORDER_FULFIL_COMPLETED && !existing.soCompletedOn) {
            headerChanges.soCompletedOn = now;
        }
        const result = await tx.saleOrder.updateMany({
            where: {
                soId: existing.soId,
                soAccYear: srcAccYear,
                soIsDeleted: false,
            },
            data: headerChanges,
        });
        if (result.count === 0) {
            (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'srcDocId', `No active order found with id ${existing.soId} in accounting year ${srcAccYear}`);
        }
        if (soStatus !== existing.soStatus) {
            await this.logStatusStep(tx, existing, {
                event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                fromStatus: existing.soStatus,
                toStatus: soStatus,
                remarks: cancelReason,
            }, actor, now);
        }
        const originalRecord = this.toPayload(existing);
        const modifiedRecord = this.toPayload({ ...existing, ...headerChanges });
        await this.auditLogService.logEntityChange({
            action: 'cancel',
            tableName: SALE_ORDER_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: existing.soId,
            displayName: existing.soOrderRefno || existing.soId,
            originalRecord,
            modifiedRecord,
            userId: actor,
            notes: targetLineId
                ? `Order line cancelled (${cancelledLines.length})`
                : `Order open lines cancelled (${cancelledLines.length})`,
        }, tx);
        return {
            soId: existing.soId,
            soAccYear: existing.soAccYear,
            soStatus,
            soFulfilStatus: rollup.fulfilStatus,
            cancelledLines: cancelledLines.length,
            cancelledQty: roundQty(cancelledLines.reduce((total, line) => total + line.soiCancelledQty, 0)),
            soCancelledAmt: rollup.cancelledAmt,
            soPendingAmt: rollup.pendingAmt,
            lines: cancelledLines,
        };
    }
    summariseOrderLines(settledLines) {
        let totalBilledAmt = 0;
        let cancelledAmt = 0;
        let pendingAmt = 0;
        let deliveredItems = 0;
        let deliveredQty = 0;
        for (const { line, netQty: settledQty, delivered, cancelled, pending, billedAmt, } of settledLines) {
            const netQty = settledQty ?? asNumber(line.soiNetQty);
            const unitShare = netQty > 0 ? asNumber(line.soiNetAmt) / netQty : 0;
            cancelledAmt += cancelled * unitShare;
            pendingAmt += pending * unitShare;
            totalBilledAmt += billedAmt;
            deliveredQty += delivered;
            const lineStatus = this.deriveLineStatus(netQty, delivered, cancelled);
            if (lineStatus === SALE_ORDER_LINE_DELIVERED || lineStatus === SALE_ORDER_LINE_CANCELLED) {
                deliveredItems += 1;
            }
        }
        return {
            billedAmt: roundAmount(totalBilledAmt),
            cancelledAmt: roundAmount(cancelledAmt),
            pendingAmt: roundAmount(pendingAmt),
            totItems: settledLines.length,
            deliveredItems,
            ...this.deriveOrderStatus(settledLines.length, deliveredItems, deliveredQty),
        };
    }
    deriveLineStatus(netQty, delivered, cancelled) {
        const pending = roundQty(netQty - delivered - cancelled);
        if (roundQty(netQty) <= 0) {
            return SALE_ORDER_LINE_PENDING;
        }
        if (pending <= 0) {
            return roundQty(delivered) <= 0 ? SALE_ORDER_LINE_CANCELLED : SALE_ORDER_LINE_DELIVERED;
        }
        if (roundQty(delivered + cancelled) > 0) {
            return SALE_ORDER_LINE_PARTIAL;
        }
        return SALE_ORDER_LINE_PENDING;
    }
    deriveOrderStatus(totItems, deliveredItems, deliveredQty) {
        const delivered = deliveredQty > QTY_EPSILON;
        if (deliveredItems >= totItems) {
            if (!delivered) {
                return {
                    fulfilStatus: SALE_ORDER_FULFIL_CANCELLED,
                    headerStatus: SALE_ORDER_STATUS_CANCELLED,
                };
            }
            return {
                fulfilStatus: SALE_ORDER_FULFIL_COMPLETED,
                headerStatus: SALE_ORDER_FULFIL_COMPLETED,
            };
        }
        if (deliveredItems > 0 || delivered) {
            return { fulfilStatus: SALE_ORDER_FULFIL_PARTIAL, headerStatus: null };
        }
        return { fulfilStatus: SALE_ORDER_FULFIL_PENDING, headerStatus: null };
    }
    async syncOrderFulfilment(tx, request, actor, now) {
        if (request.refs.length === 0) {
            return [];
        }
        const targets = await this.resolveOrderRefs(tx, request.refs);
        const results = [];
        for (const order of targets) {
            results.push(await this.syncOneOrderFulfilment(tx, order, actor, now));
        }
        return results;
    }
    async resolveOrderRefs(tx, refs) {
        const byYear = new Map();
        for (const ref of refs) {
            const forYear = byYear.get(ref.srcAccYear) ?? [];
            forYear.push(ref);
            byYear.set(ref.srcAccYear, forYear);
        }
        const byOrder = new Map();
        for (const [srcAccYear, yearRefs] of byYear) {
            const srcDocIds = [...new Set(yearRefs.map((ref) => ref.srcDocId))];
            const [orders, orderLines] = await Promise.all([
                tx.saleOrder.findMany({
                    where: { soId: { in: srcDocIds }, soAccYear: srcAccYear, soIsDeleted: false },
                    select: { soId: true },
                }),
                tx.saleOrderItem.findMany({
                    where: { soiId: { in: srcDocIds }, soiAccYear: srcAccYear, soiIsDeleted: false },
                    select: { soiId: true, soiOrderId: true, soiLineNo: true },
                }),
            ]);
            const orderIds = new Set(orders.map((order) => order.soId));
            const lineById = new Map(orderLines.map((line) => [line.soiId, line]));
            for (const ref of yearRefs) {
                const line = lineById.get(ref.srcDocId);
                const soId = line ? line.soiOrderId : orderIds.has(ref.srcDocId) ? ref.srcDocId : null;
                if (soId === null) {
                    (0, module_service_utils_1.throwSalesBadRequest)('Order not found', [
                        {
                            field: ref.fields.docId,
                            message: `No active order or order line found with id ${ref.srcDocId} in accounting ` +
                                `year ${srcAccYear}. ${ref.fields.docId} takes the sale order LINE's soi_id ` +
                                `(or the order's so_id with ${ref.fields.lineNo ?? 'a line number'}), and ` +
                                `${ref.fields.accYear} takes that order's OWN accounting year, not the bill's.`,
                        },
                    ]);
                }
                const soLineNo = line ? line.soiLineNo : ref.soLineNo;
                const key = `${soId}|${srcAccYear}`;
                const entry = byOrder.get(key) ?? {
                    soId,
                    soAccYear: srcAccYear,
                    lineNos: new Set(),
                    fields: ref.fields,
                    lineNoField: null,
                };
                if (soLineNo !== null) {
                    entry.lineNos.add(soLineNo);
                    entry.lineNoField = entry.lineNoField ?? ref.fields.lineNo ?? null;
                }
                byOrder.set(key, entry);
            }
        }
        return [...byOrder.values()];
    }
    async syncOneOrderFulfilment(tx, target, actor, now) {
        const { soId, soAccYear, lineNos, fields } = target;
        await tx.$queryRaw `
      SELECT so_id
        FROM sales.sale_order
       WHERE so_id = ${soId}::uuid
         AND so_acc_year = ${soAccYear}::bpchar
         FOR UPDATE`;
        const order = await tx.saleOrder.findFirst({
            where: { soId, soAccYear, soIsDeleted: false },
        });
        if (!order) {
            (0, module_service_utils_1.throwSalesBadRequest)('Order not found', [
                {
                    field: fields.docId,
                    message: `No active order found with id ${soId} in accounting year ${soAccYear}`,
                },
            ]);
        }
        const lines = await tx.saleOrderItem.findMany({
            where: {
                soiOrderId: soId,
                soiAccYear: soAccYear,
                soiIsDeleted: false,
            },
            orderBy: { soiLineNo: 'asc' },
        });
        const lineByNo = new Map(lines.map((line) => [line.soiLineNo, line]));
        const unknownLineNos = [...lineNos]
            .filter((lineNo) => !lineByNo.has(lineNo))
            .sort((left, right) => left - right);
        if (unknownLineNos.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Unknown order line', [
                {
                    field: target.lineNoField ?? fields.docId,
                    message: `Order ${order.soOrderRefno || soId} has no active line numbered ` +
                        unknownLineNos.join(', '),
                },
            ]);
        }
        const lineIds = lines.map((line) => line.soiId);
        const billedItems = await tx.saleBillItem.findMany({
            where: {
                sbiSrcDocType: sale_order_api_types_1.SALE_ORDER_SRC_DOC_TYPE,
                sbiSrcDocId: { in: [soId, ...lineIds] },
                sbiSrcDocYear: soAccYear,
                sbiIsDeleted: false,
                bill: { sbStatus: bill_api_types_1.BILL_STATUS_POSTED, sbIsDeleted: false },
            },
            select: {
                sbiSrcDocId: true,
                sbiSrcDocLineNo: true,
                sbiNetQty: true,
                sbiNetAmt: true,
            },
        });
        const lineNoById = new Map(lines.map((line) => [line.soiId, line.soiLineNo]));
        const billedByLineNo = new Map();
        for (const item of billedItems) {
            const lineNo = lineNoById.get(item.sbiSrcDocId ?? '') ?? item.sbiSrcDocLineNo;
            if (lineNo === null) {
                continue;
            }
            const total = billedByLineNo.get(lineNo) ?? { qty: 0, amt: 0 };
            total.qty += asNumber(item.sbiNetQty);
            total.amt += asNumber(item.sbiNetAmt);
            billedByLineNo.set(lineNo, total);
        }
        const settledLines = lines.map((line) => {
            const stored = {
                line,
                netQty: asNumber(line.soiNetQty),
                delivered: asNumber(line.soiDeliveredQty),
                cancelled: asNumber(line.soiCancelledQty),
                pending: asNumber(line.soiPendingQty),
                billedAmt: asNumber(line.soiBilledAmt),
                changed: false,
            };
            if (!lineNos.has(line.soiLineNo) && !billedByLineNo.has(line.soiLineNo)) {
                return stored;
            }
            const billed = billedByLineNo.get(line.soiLineNo) ?? { qty: 0, amt: 0 };
            const delivered = roundQty(billed.qty);
            const billedAmt = roundAmount(billed.amt);
            const cancelled = stored.cancelled;
            let netQty = stored.netQty;
            let pending = roundQty(netQty - delivered - cancelled);
            if (pending < -QTY_EPSILON) {
                netQty = roundQty(delivered + cancelled);
                pending = 0;
            }
            const pendingQty = Math.max(pending, 0);
            return {
                line,
                netQty,
                delivered,
                cancelled,
                pending: pendingQty,
                billedAmt,
                changed: Math.abs(netQty - stored.netQty) > QTY_EPSILON ||
                    Math.abs(delivered - stored.delivered) > QTY_EPSILON ||
                    Math.abs(billedAmt - stored.billedAmt) > AMOUNT_EPSILON,
            };
        });
        const fulfilledLines = [];
        for (const settled of settledLines) {
            if (!settled.changed) {
                continue;
            }
            const { line } = settled;
            const updated = await tx.saleOrderItem.update({
                where: { soiId_soiAccYear: { soiId: line.soiId, soiAccYear: line.soiAccYear } },
                data: {
                    soiNetQty: settled.netQty,
                    soiDeliveredQty: settled.delivered,
                    soiBilledAmt: settled.billedAmt,
                    soiModifiedOn: now,
                    soiModifiedBy: actor,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: SALE_ORDER_ITEM_TABLE_NAME,
                screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: line.soiId,
                displayName: `${order.soOrderRefno || order.soId} #${line.soiLineNo}`,
                originalRecord: this.toItemPayload(line),
                modifiedRecord: this.toItemPayload(updated),
                userId: actor,
                notes: 'Order line fulfilment recomputed from its bills',
            }, tx);
            fulfilledLines.push({
                soiId: line.soiId,
                soiLineNo: line.soiLineNo,
                soiNetQty: settled.netQty,
                soiDeliveredQty: settled.delivered,
                soiCancelledQty: settled.cancelled,
                soiPendingQty: asNumber(updated.soiPendingQty),
                soiBilledAmt: settled.billedAmt,
                soiLineStatus: updated.soiLineStatus,
            });
        }
        const rollup = this.summariseOrderLines(settledLines);
        const soStatus = rollup.headerStatus ?? order.soStatus;
        const headerChanged = fulfilledLines.length > 0 ||
            Math.abs(rollup.billedAmt - asNumber(order.soBilledAmt)) > AMOUNT_EPSILON ||
            Math.abs(rollup.cancelledAmt - asNumber(order.soCancelledAmt)) > AMOUNT_EPSILON ||
            Math.abs(rollup.pendingAmt - asNumber(order.soPendingAmt)) > AMOUNT_EPSILON ||
            rollup.totItems !== order.soTotItems ||
            rollup.deliveredItems !== order.soDeliveredItems ||
            rollup.fulfilStatus !== order.soFulfilStatus ||
            soStatus !== order.soStatus;
        if (!headerChanged) {
            return {
                soId,
                soAccYear,
                soStatus: order.soStatus,
                soFulfilStatus: order.soFulfilStatus,
                lines: [],
            };
        }
        const headerChanges = {
            soBilledAmt: rollup.billedAmt,
            soCancelledAmt: rollup.cancelledAmt,
            soPendingAmt: rollup.pendingAmt,
            soTotItems: rollup.totItems,
            soDeliveredItems: rollup.deliveredItems,
            soFulfilStatus: rollup.fulfilStatus,
            soModifiedOn: now,
            soModifiedBy: actor,
        };
        if (rollup.headerStatus) {
            headerChanges.soStatus = rollup.headerStatus;
        }
        if (rollup.fulfilStatus === SALE_ORDER_FULFIL_COMPLETED && !order.soCompletedOn) {
            headerChanges.soCompletedOn = now;
        }
        const result = await tx.saleOrder.updateMany({
            where: {
                soId,
                soAccYear,
                soIsDeleted: false,
            },
            data: headerChanges,
        });
        if (result.count === 0) {
            (0, module_service_utils_1.throwSalesNotFound)('Order not found', fields.docId, `No active order found with id ${soId} in accounting year ${soAccYear}`);
        }
        if (soStatus !== order.soStatus) {
            await this.logStatusStep(tx, order, {
                event: soStatus === SALE_ORDER_STATUS_CANCELLED
                    ? txn_status_log_helper_1.TxnStatusEvent.CANCELLED
                    : txn_status_log_helper_1.TxnStatusEvent.CONVERTED,
                fromStatus: order.soStatus,
                toStatus: soStatus,
                remarks: SALE_ORDER_FULFIL_STATUS_REMARK,
            }, actor, now);
        }
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: SALE_ORDER_TABLE_NAME,
            screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
            screenType: 'transaction',
            pk: order.soId,
            displayName: order.soOrderRefno || order.soId,
            originalRecord: this.toPayload(order),
            modifiedRecord: this.toPayload({ ...order, ...headerChanges }),
            userId: actor,
            notes: `Order fulfilment recomputed from its bills (${fulfilledLines.length} line(s))`,
        }, tx);
        return {
            soId,
            soAccYear,
            soStatus,
            soFulfilStatus: rollup.fulfilStatus,
            lines: fulfilledLines,
        };
    }
    async logStatusStep(tx, order, step, actor, changedOn) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: order.soCompanyId,
            branchId: order.soBranchId,
            tenantId: order.soTenantId,
            accYear: order.soAccYear,
            srcModule: sale_order_api_types_1.SALE_ORDER_STATUS_SRC_MODULE,
            srcDocType: sale_order_api_types_1.SALE_ORDER_STATUS_SRC_DOC_TYPE,
            srcDocId: order.soId,
            srcDocRefno: order.soOrderRefno,
            event: step.event,
            fromStatus: step.fromStatus,
            toStatus: step.toStatus,
            changedOn,
            changedBy: actor,
            remarks: step.remarks,
            deviceId: order.soDeviceId,
            sessionId: order.soSessionId,
        });
    }
    async createOrder(saveOrderDto) {
        const normalizedCustName = (0, module_service_utils_1.normalizeRequiredText)(saveOrderDto.soCustName ?? '', 'soCustName');
        this.ensureAdvanceRollupsAreConsistent(saveOrderDto, undefined);
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveOrderDto.soCreatedBy, this.requestContextService.getUserId());
        const orderDate = saveOrderDto.soOrderDate ? new Date(saveOrderDto.soOrderDate) : now;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const orderNumber = await (0, voucher_sequence_helper_1.allocateVoucherNumber)(tx, {
                    vchrTypeId: SALE_ORDER_VCHR_TYPE_ID,
                    companyId: saveOrderDto.soCompanyId,
                    branchId: saveOrderDto.soBranchId,
                    accYear: saveOrderDto.soAccYear,
                    documentDate: orderDate,
                });
                const data = {
                    soCompanyId: saveOrderDto.soCompanyId,
                    soBranchId: saveOrderDto.soBranchId,
                    soTenantId: saveOrderDto.soTenantId,
                    soAccYear: saveOrderDto.soAccYear,
                    soDeviceId: saveOrderDto.soDeviceId,
                    soPriceLevel: saveOrderDto.soPriceLevel,
                    soOrderSlno: orderNumber.lastNo,
                    soOrderRefno: orderNumber.refno,
                    soOrderDate: orderDate,
                    soCustId: saveOrderDto.soCustId,
                    soCustName: normalizedCustName,
                    soUserId: saveOrderDto.soUserId,
                    soCreatedOn: now,
                    soCreatedBy: createdBy,
                    soStatus: saveOrderDto.soStatus || 'DRAFT',
                };
                this.applyOptionalFields(data, saveOrderDto);
                data.soCustName = normalizedCustName;
                data.soOrderDate = orderDate;
                if (saveOrderDto.soAdvanceBalanceAmt === undefined) {
                    data.soAdvanceBalanceAmt = this.deriveAdvanceBalance(saveOrderDto, undefined);
                }
                const created = await tx.saleOrder.create({ data });
                const scope = {
                    soId: created.soId,
                    soCompanyId: created.soCompanyId,
                    soBranchId: created.soBranchId,
                    soTenantId: created.soTenantId,
                    soAccYear: created.soAccYear,
                    soPriceLevel: created.soPriceLevel,
                    soOrderSlno: created.soOrderSlno,
                    soOrderDate: created.soOrderDate,
                    soCustId: created.soCustId,
                    soUserId: created.soUserId,
                    soSessionId: created.soSessionId,
                    soDeviceId: created.soDeviceId,
                };
                const items = await this.syncItems(tx, scope, saveOrderDto.items, createdBy);
                const charges = await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), saveOrderDto.charges, createdBy, sale_order_api_types_1.SALE_ORDER_CHARGE_AUDIT);
                const tenders = await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope), saveOrderDto.tenders, createdBy, sale_order_api_types_1.SALE_ORDER_TENDER_AUDIT);
                await this.syncAdvanceVoucher(tx, created, createdBy, now);
                const payload = this.toPayload({ ...created, items, charges, tenders });
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: SALE_ORDER_TABLE_NAME,
                    screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: payload.soId,
                    displayName: payload.soOrderRefno || payload.soId,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Order created',
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
    async updateOrder(saveOrderDto) {
        const soId = saveOrderDto.soId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.saleOrder.findFirst({
                    where: {
                        soId,
                        soIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No active order found with id ${soId}`);
                }
                this.ensureAdvanceRollupsAreConsistent(saveOrderDto, existing);
                const now = new Date();
                const modifiedBy = (0, module_service_utils_1.resolveActor)(saveOrderDto.soModifiedBy, this.requestContextService.getUserId());
                const data = {
                    soModifiedOn: now,
                    soModifiedBy: modifiedBy,
                };
                this.applyOptionalFields(data, saveOrderDto);
                if (saveOrderDto.soAdvanceBalanceAmt === undefined &&
                    (saveOrderDto.soAdvanceRecdAmt !== undefined ||
                        saveOrderDto.soAdvanceAdjustedAmt !== undefined ||
                        saveOrderDto.soAdvanceRefundAmt !== undefined ||
                        saveOrderDto.soAdvanceForfeitAmt !== undefined)) {
                    data.soAdvanceBalanceAmt = this.deriveAdvanceBalance(saveOrderDto, existing);
                }
                const updated = await tx.saleOrder.update({
                    where: { soId_soAccYear: { soId: existing.soId, soAccYear: existing.soAccYear } },
                    data,
                });
                const scope = {
                    soId: updated.soId,
                    soCompanyId: updated.soCompanyId,
                    soBranchId: updated.soBranchId,
                    soTenantId: updated.soTenantId,
                    soAccYear: updated.soAccYear,
                    soPriceLevel: updated.soPriceLevel,
                    soOrderSlno: updated.soOrderSlno,
                    soOrderDate: updated.soOrderDate,
                    soCustId: updated.soCustId,
                    soUserId: updated.soUserId,
                    soSessionId: updated.soSessionId,
                    soDeviceId: updated.soDeviceId,
                };
                const items = await this.syncItems(tx, scope, saveOrderDto.items, modifiedBy);
                const charges = await this.chargeDetailService.syncDocumentCharges(tx, this.toChargeScope(scope), saveOrderDto.charges, modifiedBy, sale_order_api_types_1.SALE_ORDER_CHARGE_AUDIT);
                const tenders = await this.tenderDetailService.syncDocumentTenders(tx, this.toTenderScope(scope), saveOrderDto.tenders, modifiedBy, sale_order_api_types_1.SALE_ORDER_TENDER_AUDIT);
                await this.syncAdvanceVoucher(tx, updated, modifiedBy, now);
                const payload = this.toPayload({ ...updated, items, charges, tenders });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SALE_ORDER_TABLE_NAME,
                    screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: soId,
                    displayName: payload.soOrderRefno || payload.soId,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.soModifiedBy || payload.soCreatedBy,
                    notes: 'Order updated',
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
        const existing = await tx.saleOrderItem.findMany({
            where: { soiOrderId: scope.soId, soiIsDeleted: false },
            orderBy: { soiLineNo: 'asc' },
        });
        if (inputItems === undefined) {
            return existing;
        }
        const existingMap = new Map(existing.map((item) => [item.soiId, item]));
        const now = new Date();
        const resolvedItems = inputItems.map((inputItem, index) => ({
            inputItem,
            lineNo: inputItem.soiLineNo ?? index + 1,
        }));
        const seenLineNos = new Set();
        const keptIds = new Set();
        for (const { inputItem, lineNo } of resolvedItems) {
            if (seenLineNos.has(lineNo)) {
                (0, module_service_utils_1.throwSalesConflict)('Duplicate order line number is not allowed', [
                    {
                        field: 'soiLineNo',
                        message: `An order line already exists with line number ${lineNo}`,
                    },
                ]);
            }
            seenLineNos.add(lineNo);
            if (inputItem.soiId) {
                if (!existingMap.has(inputItem.soiId)) {
                    (0, module_service_utils_1.throwSalesNotFound)('Order item not found', 'soiId', `No active order line found with id ${inputItem.soiId} on this order`);
                }
                keptIds.add(inputItem.soiId);
            }
        }
        await this.softDeleteItems(tx, existing.filter((item) => !keptIds.has(item.soiId)), actorId, now);
        const reordersItems = resolvedItems.some(({ inputItem, lineNo }) => inputItem.soiId !== undefined && existingMap.get(inputItem.soiId)?.soiLineNo !== lineNo);
        if (reordersItems && keptIds.size > 0) {
            await tx.saleOrderItem.updateMany({
                where: { soiId: { in: [...keptIds] } },
                data: { soiLineNo: { increment: Math.max(...seenLineNos) + 1 } },
            });
        }
        const persisted = [];
        for (const { inputItem, lineNo } of resolvedItems) {
            if (inputItem.soiId) {
                const existingItem = existingMap.get(inputItem.soiId);
                this.ensureOrderItemValuesAreAllowed(inputItem, existingItem);
                const updateData = {
                    soiLineNo: lineNo,
                    soiItemId: inputItem.soiItemId ?? existingItem.soiItemId,
                    soiItemUnitId: inputItem.soiItemUnitId ?? existingItem.soiItemUnitId,
                    soiPriceLevel: inputItem.soiPriceLevel ?? scope.soPriceLevel,
                    soiModifiedOn: now,
                    soiModifiedBy: (0, module_service_utils_1.resolveActor)(inputItem.soiModifiedBy, actorId),
                };
                (0, module_service_utils_1.applyPresentFields)(updateData, inputItem, SALE_ORDER_ITEM_OPTIONAL_FIELDS, SALE_ORDER_ITEM_DATE_TRANSFORMS);
                this.applyDerivedItemQuantities(updateData, inputItem, existingItem);
                const updated = await tx.saleOrderItem.update({
                    where: {
                        soiId_soiAccYear: { soiId: inputItem.soiId, soiAccYear: existingItem.soiAccYear },
                    },
                    data: updateData,
                });
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: SALE_ORDER_ITEM_TABLE_NAME,
                    screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                    screenType: 'transaction',
                    pk: updated.soiId,
                    displayName: `Line ${updated.soiLineNo}`,
                    originalRecord: this.toItemPayload(existingItem),
                    modifiedRecord: this.toItemPayload(updated),
                    userId: (0, module_service_utils_1.resolveActor)(inputItem.soiModifiedBy, actorId),
                    notes: 'Order item updated',
                }, tx);
                persisted.push(updated);
                continue;
            }
            this.ensureOrderItemValuesAreAllowed(inputItem, undefined);
            const createData = {
                soiOrderId: scope.soId,
                soiCompanyId: inputItem.soiCompanyId ?? scope.soCompanyId,
                soiBranchId: inputItem.soiBranchId ?? scope.soBranchId,
                soiTenantId: inputItem.soiTenantId ?? scope.soTenantId,
                soiAccYear: inputItem.soiAccYear ?? scope.soAccYear,
                soiLineNo: lineNo,
                soiItemId: this.requireItemField(inputItem.soiItemId, 'soiItemId'),
                soiItemUnitId: this.requireItemField(inputItem.soiItemUnitId, 'soiItemUnitId'),
                soiPriceLevel: inputItem.soiPriceLevel ?? scope.soPriceLevel,
                soiCreatedOn: now,
                soiCreatedBy: (0, module_service_utils_1.resolveActor)(inputItem.soiCreatedBy, actorId),
            };
            (0, module_service_utils_1.applyPresentFields)(createData, inputItem, SALE_ORDER_ITEM_OPTIONAL_FIELDS, SALE_ORDER_ITEM_DATE_TRANSFORMS);
            this.applyDerivedItemQuantities(createData, inputItem, undefined);
            const created = await tx.saleOrderItem.create({ data: createData });
            await this.auditLogService.logEntityChange({
                action: 'New',
                tableName: SALE_ORDER_ITEM_TABLE_NAME,
                screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: created.soiId,
                displayName: `Line ${created.soiLineNo}`,
                originalRecord: null,
                modifiedRecord: this.toItemPayload(created),
                userId: created.soiCreatedBy,
                notes: 'Order item created',
            }, tx);
            persisted.push(created);
        }
        return persisted.sort((left, right) => left.soiLineNo - right.soiLineNo);
    }
    async softDeleteItems(tx, removed, actorId, now) {
        for (const removedItem of removed) {
            const deleted = await tx.saleOrderItem.update({
                where: {
                    soiId_soiAccYear: { soiId: removedItem.soiId, soiAccYear: removedItem.soiAccYear },
                },
                data: {
                    soiIsDeleted: true,
                    soiModifiedOn: now,
                    soiModifiedBy: actorId,
                },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: SALE_ORDER_ITEM_TABLE_NAME,
                screenName: SALE_ORDER_AUDIT_SCREEN_NAME,
                screenType: 'transaction',
                pk: deleted.soiId,
                displayName: `Line ${removedItem.soiLineNo}`,
                originalRecord: this.toItemPayload(removedItem),
                modifiedRecord: this.toItemPayload(deleted),
                userId: actorId,
                notes: 'Order item soft deleted',
            }, tx);
        }
    }
    async syncAdvanceVoucher(tx, order, actor, now) {
        const tenders = await this.tenderDetailService.findDocumentTenders(tx, sale_order_api_types_1.SALE_ORDER_TENDER_SRC_MODULE, sale_order_api_types_1.SALE_ORDER_TENDER_SRC_DOC_TYPE, order.soId);
        return (0, order_advance_posting_helper_1.syncOrderAdvancePosting)(tx, order, tenders, actor, now);
    }
    describeDuplicate(error) {
        const target = error?.meta?.target;
        const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (targetText.includes('sale_order_item')) {
            return {
                message: 'Duplicate order line number is not allowed',
                errors: [
                    {
                        field: 'soiLineNo',
                        message: 'An order line already exists with this line number',
                    },
                ],
            };
        }
        return {
            message: 'Order number already exists',
            errors: [
                {
                    field: 'soOrderRefno',
                    message: 'An order already exists with this order number in this company/branch/year scope',
                },
            ],
        };
    }
    ensureOrderValuesAreAllowed(dto) {
        const values = {
            soDocType: dto.soDocType,
            soOrderType: dto.soOrderType,
            soPriority: dto.soPriority,
            soDeliveryMode: dto.soDeliveryMode,
            soStatus: dto.soStatus,
            soFulfilStatus: dto.soFulfilStatus,
            soPayStatus: dto.soPayStatus,
            soAdvancePolicy: dto.soAdvancePolicy,
            soAdvanceStatus: dto.soAdvanceStatus,
        };
        const details = [];
        for (const guard of SALE_ORDER_VALUE_GUARDS) {
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
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid order value', details);
        }
    }
    ensureAdvanceRollupsAreConsistent(dto, existing) {
        const details = [];
        const recd = asNumber(merged(dto.soAdvanceRecdAmt, existing?.soAdvanceRecdAmt));
        const adjusted = asNumber(merged(dto.soAdvanceAdjustedAmt, existing?.soAdvanceAdjustedAmt));
        const refund = asNumber(merged(dto.soAdvanceRefundAmt, existing?.soAdvanceRefundAmt));
        const forfeit = asNumber(merged(dto.soAdvanceForfeitAmt, existing?.soAdvanceForfeitAmt));
        const required = asNumber(merged(dto.soAdvanceRequired, existing?.soAdvanceRequired));
        const amounts = [
            ['soAdvanceRequired', required],
            ['soAdvanceRecdAmt', recd],
            ['soAdvanceAdjustedAmt', adjusted],
            ['soAdvanceRefundAmt', refund],
            ['soAdvanceForfeitAmt', forfeit],
        ];
        for (const [field, amount] of amounts) {
            if (amount < 0) {
                details.push({ field, message: `${field} must not be negative` });
            }
        }
        const expectedBalance = recd - adjusted - refund - forfeit;
        if (dto.soAdvanceBalanceAmt !== undefined) {
            const balance = asNumber(dto.soAdvanceBalanceAmt);
            if (balance < 0) {
                details.push({
                    field: 'soAdvanceBalanceAmt',
                    message: 'soAdvanceBalanceAmt must not be negative',
                });
            }
            if (Math.abs(balance - expectedBalance) > AMOUNT_EPSILON) {
                details.push({
                    field: 'soAdvanceBalanceAmt',
                    message: 'soAdvanceBalanceAmt must equal soAdvanceRecdAmt − soAdvanceAdjustedAmt − ' +
                        'soAdvanceRefundAmt − soAdvanceForfeitAmt (ck_so_advance_balance)',
                });
            }
        }
        else if (expectedBalance < -AMOUNT_EPSILON) {
            details.push({
                field: 'soAdvanceBalanceAmt',
                message: 'The advance roll-ups use more than was received: received − adjusted − refunded − ' +
                    'forfeited must not be negative',
            });
        }
        const policy = merged(dto.soAdvancePolicy, existing?.soAdvancePolicy) ?? 'NONE';
        const perc = asNumber(merged(dto.soAdvancePerc, existing?.soAdvancePerc));
        if (policy === 'PERC' && perc <= 0) {
            details.push({
                field: 'soAdvancePerc',
                message: "soAdvancePerc must be greater than 0 when soAdvancePolicy is 'PERC'",
            });
        }
        if (policy === 'FIXED' && required <= 0) {
            details.push({
                field: 'soAdvanceRequired',
                message: "soAdvanceRequired must be greater than 0 when soAdvancePolicy is 'FIXED'",
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid order value', details);
        }
    }
    deriveAdvanceBalance(dto, existing) {
        const recd = asNumber(merged(dto.soAdvanceRecdAmt, existing?.soAdvanceRecdAmt));
        const adjusted = asNumber(merged(dto.soAdvanceAdjustedAmt, existing?.soAdvanceAdjustedAmt));
        const refund = asNumber(merged(dto.soAdvanceRefundAmt, existing?.soAdvanceRefundAmt));
        const forfeit = asNumber(merged(dto.soAdvanceForfeitAmt, existing?.soAdvanceForfeitAmt));
        return Math.round((recd - adjusted - refund - forfeit) * 100) / 100;
    }
    ensureOrderItemValuesAreAllowed(inputItem, existingItem) {
        const details = [];
        if (inputItem.soiFreeType !== undefined && inputItem.soiFreeType !== null) {
            if (!SALE_ORDER_ITEM_FREE_TYPES.includes(inputItem.soiFreeType)) {
                details.push({
                    field: 'soiFreeType',
                    message: `soiFreeType must be one of: ${SALE_ORDER_ITEM_FREE_TYPES.join(', ')}`,
                });
            }
        }
        if (inputItem.soiLineStatus !== undefined) {
            if (inputItem.soiLineStatus === null ||
                !SALE_ORDER_ITEM_LINE_STATUSES.includes(inputItem.soiLineStatus)) {
                details.push({
                    field: 'soiLineStatus',
                    message: `soiLineStatus must be one of: ${SALE_ORDER_ITEM_LINE_STATUSES.join(', ')}`,
                });
            }
        }
        if (inputItem.soiSize !== undefined && inputItem.soiSize !== null) {
            if (inputItem.soiSize.trim().length === 0) {
                details.push({
                    field: 'soiSize',
                    message: 'soiSize must not be blank; omit it or send null instead',
                });
            }
        }
        const orderQty = asNumber(merged(inputItem.soiOrderQty, existingItem?.soiOrderQty));
        const deliveredQty = asNumber(merged(inputItem.soiDeliveredQty, existingItem?.soiDeliveredQty));
        const cancelledQty = asNumber(merged(inputItem.soiCancelledQty, existingItem?.soiCancelledQty));
        const reservedQty = asNumber(merged(inputItem.soiReservedQty, existingItem?.soiReservedQty));
        for (const [field, qty] of [
            ['soiOrderQty', orderQty],
            ['soiDeliveredQty', deliveredQty],
            ['soiCancelledQty', cancelledQty],
        ]) {
            if (qty < 0) {
                details.push({ field, message: `${field} must not be negative` });
            }
        }
        if (inputItem.soiPendingQty !== undefined && asNumber(inputItem.soiPendingQty) < 0) {
            details.push({ field: 'soiPendingQty', message: 'soiPendingQty must not be negative' });
        }
        if (reservedQty < 0 || reservedQty > orderQty + QTY_EPSILON) {
            details.push({
                field: 'soiReservedQty',
                message: 'soiReservedQty must be between 0 and soiOrderQty (ck_soi_reserved)',
            });
        }
        if (details.length > 0) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid order item value', details);
        }
    }
    applyDerivedItemQuantities(data, inputItem, existingItem) {
        const orderQty = asNumber(merged(inputItem.soiOrderQty, existingItem?.soiOrderQty));
        if (!existingItem && inputItem.soiNetQty === undefined) {
            data.soiNetQty = orderQty;
        }
        const netQty = inputItem.soiNetQty !== undefined
            ? asNumber(inputItem.soiNetQty)
            : existingItem
                ? asNumber(existingItem.soiNetQty)
                : orderQty;
        const deliveredQty = asNumber(merged(inputItem.soiDeliveredQty, existingItem?.soiDeliveredQty));
        const cancelledQty = asNumber(merged(inputItem.soiCancelledQty, existingItem?.soiCancelledQty));
        const derivedPending = Math.round((netQty - deliveredQty - cancelledQty) * 1000) / 1000;
        if (derivedPending < -QTY_EPSILON) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid order item value', [
                {
                    field: 'soiNetQty',
                    message: 'soiDeliveredQty + soiCancelledQty must not exceed soiNetQty ' +
                        '(soi_pending_qty is derived from the three and ck_soi_qty_signs keeps it positive)',
                },
            ]);
        }
        if (inputItem.soiPendingQty !== undefined &&
            Math.abs(asNumber(inputItem.soiPendingQty) - derivedPending) > QTY_EPSILON) {
            (0, module_service_utils_1.throwSalesBadRequest)('Invalid order item value', [
                {
                    field: 'soiPendingQty',
                    message: 'soiPendingQty is derived by the database as soiNetQty − soiDeliveredQty − ' +
                        'soiCancelledQty and cannot be set; omit it or send the derived value',
                },
            ]);
        }
    }
    requireItemField(value, field) {
        if (!value) {
            (0, module_service_utils_1.throwSalesBadRequest)(`${field} is required for a new entry`, [
                {
                    field,
                    message: `${field} must be provided when creating this entry`,
                },
            ]);
        }
        return value;
    }
    toChargeScope(scope) {
        return {
            cdDocType: sale_order_api_types_1.SALE_ORDER_CHARGE_DOC_TYPE,
            cdDocId: scope.soId,
            cdCompId: scope.soCompanyId,
            cdBranchId: scope.soBranchId,
            cdAccYear: scope.soAccYear,
            cdVoucherNo: scope.soOrderSlno,
        };
    }
    toTenderScope(scope) {
        return {
            tdSrcModule: sale_order_api_types_1.SALE_ORDER_TENDER_SRC_MODULE,
            tdSrcDocType: sale_order_api_types_1.SALE_ORDER_TENDER_SRC_DOC_TYPE,
            tdSrcDocId: scope.soId,
            tdCompanyId: scope.soCompanyId,
            tdBranchId: scope.soBranchId,
            tdTenantId: scope.soTenantId,
            tdAccYear: scope.soAccYear,
            tdDocDate: scope.soOrderDate,
            tdPartyLedgerId: scope.soCustId,
            tdUserId: scope.soUserId,
            tdSessionId: scope.soSessionId,
            tdDeviceId: scope.soDeviceId,
            tdDrCr: sale_order_api_types_1.SALE_ORDER_TENDER_DR_CR,
        };
    }
    applyOptionalFields(data, dto) {
        (0, module_service_utils_1.applyPresentFields)(data, dto, SALE_ORDER_OPTIONAL_FIELDS, SALE_ORDER_DATE_TRANSFORMS);
    }
    async resolveGodownNames(items = []) {
        const godownIds = [
            ...new Set(items
                .map((item) => item.soiGodownId)
                .filter((godownId) => godownId !== null)),
        ];
        if (godownIds.length === 0) {
            return new Map();
        }
        const godowns = await this.prisma.godownLocation.findMany({
            where: { gdlId: { in: godownIds } },
            select: { gdlId: true, gdlName: true },
        });
        return new Map(godowns.map((godown) => [godown.gdlId, godown.gdlName]));
    }
    async resolveDisplayNames(record, charges, tenders) {
        const items = record.items ?? [];
        const companyIds = distinctIds([
            record.soCompanyId,
            ...items.map((item) => item.soiCompanyId),
            ...charges.map((charge) => charge.cdCompId),
            ...tenders.map((tender) => tender.tdCompanyId),
        ]);
        const branchIds = distinctIds([
            record.soBranchId,
            ...items.map((item) => item.soiBranchId),
            ...charges.map((charge) => charge.cdBranchId),
        ]);
        const employeeIds = distinctIds([
            ...(record.soSalesmanId ?? []),
            ...items.map((item) => item.soiSalesmanId),
        ]);
        const ledgerIds = distinctIds(tenders.map((tender) => tender.tdPartyLedgerId));
        const userIds = distinctIds(tenders.map((tender) => tender.tdUserId));
        const [companies, branches, employees, ledgers, users, godownNameById] = await Promise.all([
            companyIds.length
                ? this.prisma.company.findMany({
                    where: { compId: { in: companyIds } },
                    select: { compId: true, compName: true },
                })
                : [],
            branchIds.length
                ? this.prisma.branchMaster.findMany({
                    where: { brId: { in: branchIds } },
                    select: { brId: true, brName: true },
                })
                : [],
            employeeIds.length
                ? this.prisma.employeeMaster.findMany({
                    where: { empId: { in: employeeIds } },
                    select: { empId: true, empName: true },
                })
                : [],
            ledgerIds.length
                ? this.prisma.accLedgerMaster.findMany({
                    where: { ledId: { in: ledgerIds } },
                    select: { ledId: true, ledName: true },
                })
                : [],
            userIds.length
                ? this.prisma.userMaster.findMany({
                    where: { usrId: { in: userIds } },
                    select: { usrId: true, usrDisplayName: true },
                })
                : [],
            this.resolveGodownNames(items),
        ]);
        return {
            companyNameById: new Map(companies.map((company) => [company.compId, company.compName])),
            branchNameById: new Map(branches.map((branch) => [branch.brId, branch.brName])),
            employeeNameById: new Map(employees.map((employee) => [employee.empId, employee.empName])),
            ledgerNameById: new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName])),
            userNameById: new Map(users.map((user) => [user.usrId, user.usrDisplayName])),
            godownNameById,
        };
    }
    toPayload(record, names = EMPTY_NAME_MAPS) {
        const { soCreatedOn, soModifiedOn, soOrderDatetime, soSyncDate, soOrderSlno, items, charges, tenders, ...rest } = record;
        return {
            ...rest,
            soCreatedOn: soCreatedOn?.toISOString(),
            soModifiedOn: soModifiedOn?.toISOString() ?? null,
            soOrderDatetime: soOrderDatetime?.toISOString(),
            soSyncDate: soSyncDate?.toISOString() ?? null,
            soOrderSlno: soOrderSlno?.toString() ?? null,
            soCompanyName: names.companyNameById.get(rest.soCompanyId) ?? null,
            soBranchName: names.branchNameById.get(rest.soBranchId) ?? null,
            soSalesmanName: Array.isArray(rest.soSalesmanId)
                ? rest.soSalesmanId.map((salesmanId) => names.employeeNameById.get(salesmanId) ?? null)
                : null,
            items: items ? items.map((item) => this.toItemPayload(item, names)) : [],
            charges: (charges ?? []).map((charge) => this.withChargeNames(charge, names)),
            tenders: (tenders ?? []).map((tender) => this.withTenderNames(tender, names)),
        };
    }
    toItemPayload(record, names = EMPTY_NAME_MAPS) {
        const { soiCreatedOn, soiModifiedOn, soiSyncDate, item, itemUnitConversion, ...rest } = record;
        return {
            ...rest,
            soiCreatedOn: soiCreatedOn?.toISOString(),
            soiModifiedOn: soiModifiedOn?.toISOString() ?? null,
            soiSyncDate: soiSyncDate?.toISOString() ?? null,
            soiItemName: item?.itemNameEn ?? null,
            soiUnitName: itemUnitConversion?.unit.unit_name ?? null,
            soiDecimalCount: itemUnitConversion?.unit.unit_decimal_count ?? null,
            soiGroupId: item?.itemGroupId ?? null,
            soiBrandId: item?.itemBrandId ?? null,
            soiSectionId: item?.itemSectionId ?? null,
            soiCategoryId: item?.itemCategoryId ?? null,
            soiGodownName: record.soiGodownId
                ? (names.godownNameById.get(record.soiGodownId) ?? null)
                : null,
            soiCompanyName: names.companyNameById.get(record.soiCompanyId) ?? null,
            soiBranchName: names.branchNameById.get(record.soiBranchId) ?? null,
            soiSalesmanName: record.soiSalesmanId
                ? (names.employeeNameById.get(record.soiSalesmanId) ?? null)
                : null,
        };
    }
    withChargeNames(payload, names) {
        return {
            ...payload,
            cdCompName: names.companyNameById.get(payload.cdCompId) ?? null,
            cdBranchName: names.branchNameById.get(payload.cdBranchId) ?? null,
        };
    }
    withTenderNames(payload, names) {
        return {
            ...payload,
            tdCompanyName: names.companyNameById.get(payload.tdCompanyId) ?? null,
            tdPartyLedgerName: names.ledgerNameById.get(payload.tdPartyLedgerId) ?? null,
            tdUserName: names.userNameById.get(payload.tdUserId) ?? null,
        };
    }
};
exports.SaleOrderService = SaleOrderService;
exports.SaleOrderService = SaleOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService])
], SaleOrderService);
//# sourceMappingURL=sale-order.service.js.map