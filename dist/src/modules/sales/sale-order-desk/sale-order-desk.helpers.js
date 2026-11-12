"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireReason = requireReason;
exports.clip = clip;
exports.lockDeskOrder = lockDeskOrder;
exports.countOpenLines = countOpenLines;
exports.assertDeskOrderOpen = assertDeskOrderOpen;
exports.appendDeskStep = appendDeskStep;
exports.money = money;
exports.qty = qty;
exports.dec = dec;
const client_1 = require("@prisma/client");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sale_order_api_types_1 = require("../sale-order/types/sale-order-api.types");
const sale_order_desk_types_1 = require("./types/sale-order-desk.types");
function requireReason(reason, field = 'reason') {
    const text = (reason ?? '').trim();
    if (!text) {
        (0, sales_errors_1.throwSalesInvalid)('Say why: a reason is required', posting_types_1.SALES_ERROR_CODES.ORDER_REASON_REQUIRED, field);
    }
    return text;
}
function clip(text, max) {
    return text.length > max ? text.slice(0, max) : text;
}
async function lockDeskOrder(tx, keys) {
    const rows = await tx.$queryRaw `
    SELECT so_id FROM sales.sale_order
     WHERE so_id = ${keys.soId}::uuid AND so_acc_year = ${keys.soAccYear}::char(9)
       AND so_company_id = ${keys.soCompanyId}::uuid AND so_branch_id = ${keys.soBranchId}::uuid
       AND so_is_deleted = false
     FOR UPDATE`;
    const order = rows.length > 0
        ? await tx.saleOrder.findFirst({ where: { soId: keys.soId, soAccYear: keys.soAccYear } })
        : null;
    if (!order) {
        (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No live order ${keys.soId} (${keys.soAccYear}) in this company and branch`, posting_types_1.SALES_ERROR_CODES.NOT_FOUND);
    }
    return order;
}
async function countOpenLines(tx, order) {
    return tx.saleOrderItem.count({
        where: {
            soiOrderId: order.soId,
            soiAccYear: order.soAccYear,
            soiIsDeleted: false,
            soiPendingQty: { gt: 0 },
        },
    });
}
function assertDeskOrderOpen(order, openLines) {
    if (!sale_order_desk_types_1.SALE_ORDER_DESK_OPEN_STATUSES.includes(order.soStatus)) {
        (0, sales_errors_1.throwSalesLocked)(`Order ${order.soOrderRefno} is ${order.soStatus}: nothing is left open on it`, posting_types_1.SALES_ERROR_CODES.ORDER_CLOSED, 'soId', { status: order.soStatus });
    }
    if (openLines <= 0) {
        (0, sales_errors_1.throwSalesLocked)(`Order ${order.soOrderRefno} has no open line left`, posting_types_1.SALES_ERROR_CODES.ORDER_CLOSED, 'soId', { status: order.soStatus });
    }
}
async function appendDeskStep(tx, order, step, actor, now) {
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
        changedOn: now,
        changedBy: actor,
        remarks: step.remarks === null ? null : clip(step.remarks, 500),
        deviceId: order.soDeviceId,
        sessionId: order.soSessionId,
    });
}
function money(value) {
    return (value ?? new client_1.Prisma.Decimal(0))
        .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();
}
function qty(value) {
    return (value ?? new client_1.Prisma.Decimal(0))
        .toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();
}
function dec(value) {
    if (value === null || value === undefined || value === '') {
        return new client_1.Prisma.Decimal(0);
    }
    return value instanceof client_1.Prisma.Decimal ? value : new client_1.Prisma.Decimal(value);
}
//# sourceMappingURL=sale-order-desk.helpers.js.map