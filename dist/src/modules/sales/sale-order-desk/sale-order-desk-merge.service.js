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
exports.SaleOrderDeskMergeService = void 0;
exports.distinctRefs = distinctRefs;
exports.fingerprintOf = fingerprintOf;
exports.buildMerge = buildMerge;
exports.toSaveDto = toSaveDto;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const sales_context_service_1 = require("../posting/sales-context.service");
const stock_reservation_service_1 = require("../posting/stock-reservation.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const sale_order_lifecycle_service_1 = require("../sale-order/sale-order-lifecycle.service");
const order_advance_posting_helper_1 = require("../sale-order/order-advance-posting.helper");
const sale_order_desk_helpers_1 = require("./sale-order-desk.helpers");
const sale_order_desk_types_1 = require("./types/sale-order-desk.types");
const sale_order_tx_options_1 = require("../sale-order/sale-order-tx.options");
const ZERO = new client_1.Prisma.Decimal(0);
const HALF_UP = client_1.Prisma.Decimal.ROUND_HALF_UP;
const COPY_LINE_FIELDS = [
    'soiToBaseFactor',
    'soiHsnCode',
    'soiPriceLevel',
    'soiEanCode',
    'soiSize',
    'soiSizeUom',
    'soiGodownId',
    'soiIsTaxIncl',
    'soiIsPromo',
    'soiIsFree',
    'soiFreeType',
    'soiIsService',
    'soiHasFreight',
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
    'soiSplDiscPerc',
    'soiSchDiscPerc',
    'soiBillSchPerc',
    'soiAddlDisc1Perc',
    'soiAddlDisc2Perc',
    'soiCashDiscPerc',
    'soiTaxId',
    'soiTaxPerc',
    'soiCgstPerc',
    'soiSgstPerc',
    'soiIgstPerc',
    'soiCessPerc',
    'soiCessPerUnit',
    'soiAcessPerc',
    'soiAcessPerUnit',
    'soiSoldPrice',
    'soiSoldPreTax',
    'soiItemProfit',
    'soiProfitPreTax',
    'soiMrpSavingsPerc',
    'soiDeliveryDate',
    'soiSalesmanId',
    'soiSchemeId',
    'soiSchemeName',
    'soiRemarks',
    'soiQtyPriceId',
];
const SCALE_QTY_FIELDS = [
    'soiLengthQty',
    'soiWeightQty',
    'soiItemDiscQty',
    'soiSplDiscQty',
    'soiSchDiscQty',
    'soiBillSchQty',
    'soiFreightQty',
    'soiLoadQty',
    'soiUnloadQty',
];
const SCALE_AMT_FIELDS = [
    'soiGrossAmt',
    'soiItemDiscAmt',
    'soiSplDiscAmt',
    'soiSchDiscAmt',
    'soiBillSchAmt',
    'soiAddlDisc1Amt',
    'soiAddlDisc2Amt',
    'soiCashDiscAmt',
    'soiNetGross',
    'soiChrgBeforeTax',
    'soiChrgAfterTax',
    'soiTaxableAmt',
    'soiTaxAmt',
    'soiCgstAmt',
    'soiSgstAmt',
    'soiIgstAmt',
    'soiCessAmt',
    'soiAcessAmt',
    'soiFreightAmt',
    'soiLoadAmt',
    'soiUnloadAmt',
    'soiNetAmt',
    'soiMrpSavings',
];
const COPY_HEADER_FIELDS = [
    'soTenantId',
    'soDocType',
    'soOrderType',
    'soPriceLevel',
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
    'soAgentId',
    'soAgentCommPerc',
    'soPaymentTerms',
    'soDeliveryTerms',
    'soTermsConditions',
    'soFreightCalcType',
    'soLoadingCalcType',
    'soDiscAlterBase',
    'soRoundOffStep',
    'soCashDiscPerc',
];
function dtoValue(value) {
    if (value instanceof client_1.Prisma.Decimal) {
        return value.toFixed();
    }
    if (value instanceof Date) {
        return (0, sales_doc_utils_1.isoDate)(value);
    }
    return value;
}
function put(target, key, value) {
    if (value === null || value === undefined) {
        return;
    }
    target[key] = dtoValue(value);
}
function trimmed(value) {
    return (value ?? '').trim();
}
let SaleOrderDeskMergeService = class SaleOrderDeskMergeService {
    prisma;
    orders;
    lifecycle;
    salesContext;
    reservations;
    constructor(prisma, orders, lifecycle, salesContext, reservations) {
        this.prisma = prisma;
        this.orders = orders;
        this.lifecycle = lifecycle;
        this.salesContext = salesContext;
        this.reservations = reservations;
    }
    async preview(dto) {
        const rights = await this.salesContext.rights(sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER);
        if (!rights.view) {
            (0, sales_errors_1.throwSalesRight)('This user may not view orders on the Sales Order menu', posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW);
        }
        const seesMoney = (await this.salesContext.rights(sale_order_desk_types_1.SALE_ORDER_DESK_RECEIPT_MENU_ID)).view;
        return this.prisma.$transaction(async (tx) => {
            const today = await dbToday(tx);
            const refusals = rightsRefusals(rights);
            const evaluation = await this.evaluate(tx, dto, today, false);
            refusals.push(...evaluation.refusals);
            const sources = evaluation.sources;
            const built = sources.length > 0 ? buildMerge(sources) : null;
            return {
                ok: refusals.length === 0,
                refusals: refusals.map((r) => ({
                    code: r.code,
                    message: r.message,
                    ...(r.soId ? { soId: r.soId } : {}),
                })),
                fingerprint: fingerprintOf(sources),
                customer: built
                    ? { custId: built.oldest.soCustId, custName: built.oldest.soCustName }
                    : null,
                orders: built
                    ? built.ordered.map((s) => {
                        const f = built.perSource.get(s.order.soId);
                        return {
                            soId: s.order.soId,
                            soAccYear: s.order.soAccYear,
                            soOrderRefno: s.order.soOrderRefno,
                            soOrderDate: (0, sales_doc_utils_1.isoDate)(s.order.soOrderDate),
                            openLines: f.openLines,
                            openQty: (0, sale_order_desk_helpers_1.qty)(f.openQty),
                            openKg: (0, sale_order_desk_helpers_1.qty)(f.openKg),
                            ...(seesMoney ? { openValue: (0, sale_order_desk_helpers_1.money)(f.openValue) } : {}),
                        };
                    })
                    : [],
                newOrder: built
                    ? {
                        lines: built.items.length,
                        totQty: (0, sale_order_desk_helpers_1.qty)(built.totQty),
                        totKg: (0, sale_order_desk_helpers_1.qty)(built.totKg),
                        ...(seesMoney
                            ? { orderAmt: (0, sale_order_desk_helpers_1.money)(built.orderAmt), roundOff: (0, sale_order_desk_helpers_1.money)(built.roundOff) }
                            : {}),
                        priority: built.priority,
                        deliveryDate: built.deliveryDate,
                    }
                    : null,
            };
        }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
    }
    async merge(dto) {
        const reason = trimmed(dto.reason) || sale_order_desk_types_1.SALE_ORDER_DESK_DEFAULT_MERGE_REASON;
        const now = new Date();
        let out = null;
        try {
            await this.prisma.$transaction(async (tx) => {
                const ctx = await this.salesContext.resolve({ companyId: dto.soCompanyId, branchId: dto.soBranchId, deviceId: dto.soDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
                const missing = rightsRefusals(ctx.rights);
                if (missing.length > 0) {
                    throwMergeRefusal(missing[0]);
                }
                const today = await dbToday(tx);
                const { refusals, sources } = await this.evaluate(tx, dto, today, true);
                if (refusals.length > 0) {
                    throwMergeRefusal(refusals[0]);
                }
                if (fingerprintOf(sources) !== dto.fingerprint) {
                    (0, sales_errors_1.throwSalesLocked)('An order changed after the merge was previewed (a bill or an edit took some of it)', posting_types_1.SALES_ERROR_CODES.ORDER_MERGE_SOURCE_CHANGED, 'fingerprint');
                }
                const built = buildMerge(sources);
                const refnos = built.ordered.map((s) => s.order.soOrderRefno);
                const saveDto = toSaveDto(built, dto, ctx.userId, today, reason);
                this.orders.prepareSave(saveDto);
                const created = await this.orders.createOrderInTx(tx, saveDto);
                const intoReason = (0, sale_order_desk_helpers_1.clip)(`Merged into ${created.soOrderRefno}: ${reason}`, 250);
                const mergedSources = [];
                for (const s of built.ordered) {
                    await this.reservations.release(tx, { docType: 'SALES_ORDER', docId: s.order.soId }, intoReason, ctx.actor, now);
                    await (0, sale_order_desk_helpers_1.appendDeskStep)(tx, s.order, {
                        event: txn_status_log_helper_1.TxnStatusEvent.MERGED,
                        fromStatus: s.order.soStatus,
                        toStatus: s.order.soStatus,
                        remarks: intoReason,
                    }, ctx.actor, now);
                    const closed = await this.orders.cancelOrderOpenLines(tx, {
                        order: s.order,
                        srcAccYear: s.order.soAccYear,
                        targetLineId: null,
                        cancelReason: intoReason,
                        actor: ctx.actor,
                        now,
                    });
                    mergedSources.push({
                        soId: s.order.soId,
                        soAccYear: s.order.soAccYear,
                        soOrderRefno: s.order.soOrderRefno,
                        soStatus: closed.soStatus,
                        soFulfilStatus: closed.soFulfilStatus,
                        cancelledLines: closed.cancelledLines,
                    });
                }
                const keys = {
                    soId: created.soId,
                    soCompanyId: created.soCompanyId,
                    soBranchId: created.soBranchId,
                    soAccYear: created.soAccYear,
                };
                const posted = await this.lifecycle.postInTx(tx, keys, now);
                const fresh = await tx.saleOrder.findFirst({
                    where: { soId: created.soId, soAccYear: created.soAccYear },
                });
                await (0, sale_order_desk_helpers_1.appendDeskStep)(tx, fresh, {
                    event: txn_status_log_helper_1.TxnStatusEvent.MERGED,
                    fromStatus: fresh.soStatus,
                    toStatus: fresh.soStatus,
                    remarks: `Made from ${refnos.join(' + ')}: ${reason}`,
                }, ctx.actor, now);
                const seesMoney = (await this.salesContext.rights(sale_order_desk_types_1.SALE_ORDER_DESK_RECEIPT_MENU_ID, tx))
                    .view;
                out = {
                    message: `${created.soOrderRefno} made from ${refnos.join(' + ')}`,
                    data: {
                        soId: created.soId,
                        soCompanyId: created.soCompanyId,
                        soBranchId: created.soBranchId,
                        soAccYear: created.soAccYear,
                        soOrderRefno: created.soOrderRefno,
                        soStatus: posted.soStatus,
                        soTotItems: built.items.length,
                        soTotBags: (0, sale_order_desk_helpers_1.qty)(built.totQty),
                        soTotWeight: (0, sale_order_desk_helpers_1.qty)(built.totKg),
                        ...(seesMoney ? { soOrderAmt: (0, sale_order_desk_helpers_1.money)(built.orderAmt) } : {}),
                        warnings: posted.warnings,
                        mergedSources,
                    },
                };
            }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
        }
        catch (error) {
            this.orders.throwIfDuplicate(error);
            throw error;
        }
        return out;
    }
    async evaluate(tx, dto, today, lock) {
        const refusals = [];
        const refs = distinctRefs(dto.orders);
        if (refs.length < 2) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.ORDER_MERGE_TOO_FEW,
                message: 'Merge needs 2 or more different orders',
                httpStatus: 400,
                field: 'orders',
            });
        }
        const sources = await this.loadSources(tx, dto, refs, lock);
        const byKey = new Map(sources.map((s) => [keyOf(s.order.soId, s.order.soAccYear), s]));
        for (const r of refs) {
            if (!byKey.has(keyOf(r.soId, r.soAccYear))) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.NOT_FOUND,
                    message: `Order ${r.soId} (${r.soAccYear}) is not a live order of this company and branch`,
                    soId: r.soId,
                    httpStatus: 404,
                    field: 'orders',
                });
            }
        }
        for (const s of sources) {
            const open = s.lines.some((l) => (0, sale_order_desk_helpers_1.dec)(l.soiPendingQty).greaterThan(0));
            if (!sale_order_desk_types_1.SALE_ORDER_DESK_OPEN_STATUSES.includes(s.order.soStatus) || !open) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.ORDER_CLOSED,
                    message: `Order ${s.order.soOrderRefno} is ${s.order.soStatus}${open ? '' : ' with nothing left open'}`,
                    soId: s.order.soId,
                    httpStatus: 409,
                    field: 'orders',
                });
            }
        }
        for (const s of sources) {
            if (s.order.soDeliveryHold) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.ORDER_DELIVERY_HOLD,
                    message: `Order ${s.order.soOrderRefno} is on delivery hold${s.order.soDeliveryHoldReason ? `: ${s.order.soDeliveryHoldReason}` : ''}`,
                    soId: s.order.soId,
                    httpStatus: 409,
                    field: 'orders',
                });
            }
        }
        const first = oldestOf(sources);
        if (first) {
            const otherParty = sources.find((s) => s.order.soCustId !== first.order.soCustId);
            if (otherParty) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.ORDER_MERGE_ONE_PARTY,
                    message: `Order ${otherParty.order.soOrderRefno} is for ${otherParty.order.soCustName}, not ${first.order.soCustName}`,
                    soId: otherParty.order.soId,
                    httpStatus: 400,
                    field: 'orders',
                });
            }
            const otherTerms = sources.find((s) => s.order.soOrderType !== first.order.soOrderType ||
                s.order.soDocType !== first.order.soDocType ||
                trimmed(s.order.soPosStcd) !== trimmed(first.order.soPosStcd));
            if (otherTerms) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.ORDER_MERGE_TERMS_DIFFER,
                    message: `Order ${otherTerms.order.soOrderRefno} (${otherTerms.order.soOrderType}, ${otherTerms.order.soDocType}, place of supply ${trimmed(otherTerms.order.soPosStcd) || '-'}) differs from ${first.order.soOrderRefno} (${first.order.soOrderType}, ${first.order.soDocType}, place of supply ${trimmed(first.order.soPosStcd) || '-'})`,
                    soId: otherTerms.order.soId,
                    httpStatus: 400,
                    field: 'orders',
                });
            }
        }
        for (const s of sources) {
            if (s.advanceHeld.greaterThan(0)) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.ORDER_MERGE_ADVANCE,
                    message: `Order ${s.order.soOrderRefno} holds an advance payment`,
                    soId: s.order.soId,
                    httpStatus: 409,
                    field: 'orders',
                });
            }
        }
        for (const s of sources) {
            if (s.chargeRows > 0 ||
                !(0, sale_order_desk_helpers_1.dec)(s.order.soOtherAmt1).isZero() ||
                !(0, sale_order_desk_helpers_1.dec)(s.order.soOtherAmt2).isZero()) {
                refusals.push({
                    code: posting_types_1.SALES_ERROR_CODES.ORDER_MERGE_CHARGES,
                    message: `Order ${s.order.soOrderRefno} has charges on the whole order`,
                    soId: s.order.soId,
                    httpStatus: 409,
                    field: 'orders',
                });
            }
        }
        if (await (0, sales_guards_1.loadDayClosed)(tx, dto.soCompanyId, dto.soBranchId, today)) {
            refusals.push({
                code: posting_types_1.SALES_ERROR_CODES.DAY_CLOSED,
                message: `The books for ${today} are closed at this branch`,
                httpStatus: 409,
                field: 'soOrderDate',
            });
        }
        return { refusals, sources };
    }
    async loadSources(tx, scope, refs, lock) {
        if (refs.length === 0) {
            return [];
        }
        const ids = refs.map((r) => r.soId);
        const years = refs.map((r) => r.soAccYear);
        if (lock) {
            await tx.$queryRaw `
        SELECT so.so_id
          FROM sales.sale_order so
          JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
            ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
         WHERE so.so_company_id = ${scope.soCompanyId}::uuid
           AND so.so_branch_id = ${scope.soBranchId}::uuid
           AND so.so_is_deleted = false
         ORDER BY so.so_id
           FOR UPDATE OF so`;
        }
        const orders = await tx.saleOrder.findMany({
            where: {
                OR: refs.map((r) => ({ soId: r.soId, soAccYear: r.soAccYear })),
                soCompanyId: scope.soCompanyId,
                soBranchId: scope.soBranchId,
                soIsDeleted: false,
            },
        });
        if (orders.length === 0) {
            return [];
        }
        const lines = (await tx.saleOrderItem.findMany({
            where: {
                OR: orders.map((o) => ({ soiOrderId: o.soId, soiAccYear: o.soAccYear })),
                soiIsDeleted: false,
            },
            orderBy: [{ soiLineNo: 'asc' }],
            include: { itemUnitConversion: { select: { iucUomWeight: true } } },
        }));
        const charges = await tx.$queryRaw `
      SELECT cd_doc_id, COUNT(*) AS n
        FROM public.txn_charge_detail
       WHERE cd_doc_type = 'ORDER'
         AND cd_doc_id = ANY(${orders.map((o) => o.soId)}::uuid[])
         AND cd_is_deleted = false
         AND cd_is_active = true
       GROUP BY cd_doc_id`;
        const chargeCount = new Map(charges.map((c) => [c.cd_doc_id, Number(c.n)]));
        const sources = [];
        for (const order of orders) {
            const live = await (0, order_advance_posting_helper_1.readOrderAdvanceBalance)(tx, order);
            const header = (0, sale_order_desk_helpers_1.dec)(order.soAdvanceBalanceAmt);
            const held = live ? client_1.Prisma.Decimal.max(live.pendingAmount, header) : header;
            sources.push({
                order,
                lines: lines.filter((l) => l.soiOrderId === order.soId && l.soiAccYear === order.soAccYear),
                advanceHeld: held,
                chargeRows: chargeCount.get(order.soId) ?? 0,
            });
        }
        return sources;
    }
};
exports.SaleOrderDeskMergeService = SaleOrderDeskMergeService;
exports.SaleOrderDeskMergeService = SaleOrderDeskMergeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_order_service_1.SaleOrderService,
        sale_order_lifecycle_service_1.SaleOrderLifecycleService,
        sales_context_service_1.SalesContextService,
        stock_reservation_service_1.StockReservationService])
], SaleOrderDeskMergeService);
function keyOf(soId, soAccYear) {
    return `${soId.toLowerCase()}|${soAccYear.trim()}`;
}
function distinctRefs(orders) {
    const seen = new Map();
    for (const o of orders ?? []) {
        const k = keyOf(o.soId, o.soAccYear);
        if (!seen.has(k)) {
            seen.set(k, { soId: o.soId.toLowerCase(), soAccYear: o.soAccYear.trim() });
        }
    }
    return [...seen.values()];
}
function rightsRefusals(rights) {
    const out = [];
    if (!rights.create) {
        out.push({
            code: posting_types_1.SALES_ERROR_CODES.RIGHT_CREATE,
            message: 'This user may not create orders on the Sales Order menu',
            httpStatus: 403,
            field: 'userId',
        });
    }
    if (!rights.post) {
        out.push({
            code: posting_types_1.SALES_ERROR_CODES.RIGHT_POST,
            message: 'This user may not post orders on the Sales Order menu',
            httpStatus: 403,
            field: 'userId',
        });
    }
    if (!rights.cancel) {
        out.push({
            code: posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL,
            message: 'This user may not cancel orders on the Sales Order menu',
            httpStatus: 403,
            field: 'userId',
        });
    }
    return out;
}
function throwMergeRefusal(r) {
    switch (r.httpStatus) {
        case 400:
            return (0, sales_errors_1.throwSalesInvalid)(r.message, r.code, r.field);
        case 403:
            return (0, sales_errors_1.throwSalesRight)(r.message, r.code, r.field);
        case 404:
            return (0, module_service_utils_1.throwSalesNotFound)('Order not found', r.field, r.message, r.code);
        default:
            return (0, sales_errors_1.throwSalesLocked)(r.message, r.code, r.field);
    }
}
async function dbToday(tx) {
    const [row] = await tx.$queryRaw `SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS d`;
    return row.d;
}
function oldestOf(sources) {
    return orderedOldestFirst(sources)[0] ?? null;
}
function orderedOldestFirst(sources) {
    return [...sources].sort((a, b) => {
        const t = a.order.soOrderDatetime.getTime() - b.order.soOrderDatetime.getTime();
        if (t !== 0) {
            return t;
        }
        return a.order.soId < b.order.soId ? -1 : a.order.soId > b.order.soId ? 1 : 0;
    });
}
function fingerprintOf(sources) {
    const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const parts = [...sources]
        .sort((a, b) => byId(a.order.soId, b.order.soId))
        .map((s) => [
        s.order.soId,
        s.order.soRevisionNo,
        s.order.soStatus,
        s.order.soDeliveryHold,
        [...s.lines]
            .sort((a, b) => byId(a.soiId, b.soiId))
            .map((l) => [
            l.soiId,
            (0, sale_order_desk_helpers_1.dec)(l.soiPendingQty).toDecimalPlaces(3, HALF_UP).toFixed(3),
            (0, sale_order_desk_helpers_1.dec)(l.soiNetAmt).toDecimalPlaces(2, HALF_UP).toFixed(2),
        ]),
    ]);
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(parts)).digest('hex');
}
function buildMerge(sources) {
    const ordered = orderedOldestFirst(sources);
    const oldest = ordered[0].order;
    const items = [];
    const sums = {
        gross: ZERO,
        itemDisc: ZERO,
        splDisc: ZERO,
        schDisc: ZERO,
        billSchDisc: ZERO,
        addlDisc1: ZERO,
        addlDisc2: ZERO,
        cashDisc: ZERO,
        taxable: ZERO,
        cgst: ZERO,
        sgst: ZERO,
        igst: ZERO,
        cess: ZERO,
        acess: ZERO,
        freight: ZERO,
        load: ZERO,
        unload: ZERO,
        net: ZERO,
        mrpSavings: ZERO,
        mrpValue: ZERO,
    };
    let totQty = ZERO;
    let totKg = ZERO;
    const perSource = new Map();
    for (const s of ordered) {
        const f = { openLines: 0, openQty: ZERO, openKg: ZERO, openValue: ZERO };
        for (const l of s.lines) {
            const pending = (0, sale_order_desk_helpers_1.dec)(l.soiPendingQty).toDecimalPlaces(3, HALF_UP);
            const net = (0, sale_order_desk_helpers_1.dec)(l.soiNetQty);
            if (!pending.greaterThan(0) || !net.greaterThan(0)) {
                continue;
            }
            const r = pending.div(net);
            const weight = (0, sale_order_desk_helpers_1.dec)(l.itemUnitConversion?.iucUomWeight);
            const line = {
                soiLineNo: items.length + 1,
                soiItemId: l.soiItemId,
                soiItemUnitId: l.soiItemUnitId,
            };
            for (const field of COPY_LINE_FIELDS) {
                put(line, field, l[field]);
            }
            for (const field of SCALE_QTY_FIELDS) {
                const v = l[field];
                if (v !== null && v !== undefined) {
                    line[field] = (0, sale_order_desk_helpers_1.dec)(v).times(r).toDecimalPlaces(3, HALF_UP).toFixed(3);
                }
            }
            const scaled = {};
            for (const field of SCALE_AMT_FIELDS) {
                const v = l[field];
                if (v !== null && v !== undefined) {
                    scaled[field] = (0, sale_order_desk_helpers_1.dec)(v).times(r).toDecimalPlaces(2, HALF_UP);
                    line[field] = scaled[field].toFixed(2);
                }
            }
            line.soiOrderQty = pending.toFixed(3);
            line.soiNetQty = pending.toFixed(3);
            line.soiCaseQty = '0';
            line.soiDeliveredQty = '0';
            line.soiCancelledQty = '0';
            line.soiBilledAmt = '0';
            line.soiReservedQty = '0';
            line.soiIsReserved = false;
            line.soiRoundOff = '0';
            line.soiSrcDocType = 'SALES_ORDER';
            line.soiSrcDocId = s.order.soId;
            line.soiSrcDocAccYear = s.order.soAccYear;
            line.soiSrcDocRefno = s.order.soOrderRefno;
            line.soiSrcLineNo = l.soiLineNo;
            items.push(line);
            const z = (k) => scaled[k] ?? ZERO;
            sums.gross = sums.gross.plus(z('soiGrossAmt'));
            sums.itemDisc = sums.itemDisc.plus(z('soiItemDiscAmt'));
            sums.splDisc = sums.splDisc.plus(z('soiSplDiscAmt'));
            sums.schDisc = sums.schDisc.plus(z('soiSchDiscAmt'));
            sums.billSchDisc = sums.billSchDisc.plus(z('soiBillSchAmt'));
            sums.addlDisc1 = sums.addlDisc1.plus(z('soiAddlDisc1Amt'));
            sums.addlDisc2 = sums.addlDisc2.plus(z('soiAddlDisc2Amt'));
            sums.cashDisc = sums.cashDisc.plus(z('soiCashDiscAmt'));
            sums.taxable = sums.taxable.plus(z('soiTaxableAmt'));
            sums.cgst = sums.cgst.plus(z('soiCgstAmt'));
            sums.sgst = sums.sgst.plus(z('soiSgstAmt'));
            sums.igst = sums.igst.plus(z('soiIgstAmt'));
            sums.cess = sums.cess.plus(z('soiCessAmt'));
            sums.acess = sums.acess.plus(z('soiAcessAmt'));
            sums.freight = sums.freight.plus(z('soiFreightAmt'));
            sums.load = sums.load.plus(z('soiLoadAmt'));
            sums.unload = sums.unload.plus(z('soiUnloadAmt'));
            sums.net = sums.net.plus(z('soiNetAmt'));
            const savings = z('soiMrpSavings');
            sums.mrpSavings = sums.mrpSavings.plus(savings);
            if (savings.greaterThan(0)) {
                sums.mrpValue = sums.mrpValue.plus(savings).plus((0, sale_order_desk_helpers_1.dec)(l.soiSoldPrice).times(pending));
            }
            const kg = pending.times(weight);
            totQty = totQty.plus(pending);
            totKg = totKg.plus(kg);
            f.openLines += 1;
            f.openQty = f.openQty.plus(pending);
            f.openKg = f.openKg.plus(kg);
            f.openValue = f.openValue.plus((0, sale_order_desk_helpers_1.dec)(l.soiNetAmt).times(r));
        }
        f.openValue = f.openValue.toDecimalPlaces(2, HALF_UP);
        perSource.set(s.order.soId, f);
    }
    const step = (0, sale_order_desk_helpers_1.dec)(oldest.soRoundOffStep);
    const rounded = step.greaterThan(0)
        ? sums.net.div(step).plus(0.5).floor().times(step).toDecimalPlaces(2, HALF_UP)
        : sums.net;
    const priority = ordered.some((s) => s.order.soPriority === 'URGENT')
        ? 'URGENT'
        : oldest.soPriority;
    const deliveryDates = ordered
        .map((s) => (0, sales_doc_utils_1.isoDate)(s.order.soDeliveryDate))
        .filter((d) => !!d)
        .sort();
    return {
        ordered,
        oldest,
        items,
        priority,
        deliveryDate: deliveryDates[0] ?? null,
        totQty: totQty.toDecimalPlaces(3, HALF_UP),
        totKg: totKg.toDecimalPlaces(3, HALF_UP),
        sums,
        roundOff: rounded.minus(sums.net).toDecimalPlaces(2, HALF_UP),
        orderAmt: rounded,
        perSource,
    };
}
function toSaveDto(built, req, userId, today, reason) {
    const h = built.oldest;
    const body = {};
    for (const field of COPY_HEADER_FIELDS) {
        put(body, field, h[field]);
    }
    const s = built.sums;
    const tax = s.cgst.plus(s.sgst).plus(s.igst).plus(s.cess).plus(s.acess);
    const savingsPerc = s.mrpValue.greaterThan(0)
        ? s.mrpSavings.div(s.mrpValue).times(100).toDecimalPlaces(2, HALF_UP)
        : ZERO;
    Object.assign(body, {
        soCompanyId: req.soCompanyId,
        soBranchId: req.soBranchId,
        soAccYear: req.soAccYear,
        soDeviceId: req.soDeviceId,
        soSessionId: req.soSessionId ?? null,
        soUserId: userId,
        soSalesmanId: built.oldest.soSalesmanId ?? [],
        soOrderDate: today,
        soPriority: built.priority,
        soRemarks: (0, sale_order_desk_helpers_1.clip)(`Made from ${built.ordered.map((o) => o.order.soOrderRefno).join(' + ')}: ${reason}`, 500),
        soAdvancePolicy: 'NONE',
        soOtherAmt1: '0',
        soOtherAmt2: '0',
        soTotItems: built.items.length,
        soTotBags: built.totQty.toFixed(3),
        soTotWeight: built.totKg.toFixed(3),
        soGrossAmt: s.gross.toFixed(2),
        soItemDisc: s.itemDisc.toFixed(2),
        soSplDisc: s.splDisc.toFixed(2),
        soSchDisc: s.schDisc.toFixed(2),
        soBillSchDisc: s.billSchDisc.toFixed(2),
        soAddlDisc1: s.addlDisc1.toFixed(2),
        soAddlDisc2: s.addlDisc2.toFixed(2),
        soCashDisc: s.cashDisc.toFixed(2),
        soTaxableAmt: s.taxable.toFixed(2),
        soCgstAmt: s.cgst.toFixed(2),
        soSgstAmt: s.sgst.toFixed(2),
        soIgstAmt: s.igst.toFixed(2),
        soCessAmt: s.cess.toFixed(2),
        soTaxAmt: tax.toFixed(2),
        soMrpSavings: s.mrpSavings.toDecimalPlaces(2, HALF_UP).toFixed(2),
        soMrpSavingsPerc: savingsPerc.toFixed(2),
        soFreightAmt: s.freight.toFixed(2),
        soLoadAmt: s.load.toFixed(2),
        soUnloadAmt: s.unload.toFixed(2),
        soRoundOff: built.roundOff.toFixed(2),
        soOrderAmt: built.orderAmt.toFixed(2),
        items: built.items,
    });
    if (built.deliveryDate) {
        body.soDeliveryDate = built.deliveryDate;
    }
    return body;
}
//# sourceMappingURL=sale-order-desk-merge.service.js.map