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
exports.SaleOrderDeskService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const sales_context_service_1 = require("../posting/sales-context.service");
const stock_reservation_service_1 = require("../posting/stock-reservation.service");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const sale_order_desk_helpers_1 = require("./sale-order-desk.helpers");
const sale_order_desk_types_1 = require("./types/sale-order-desk.types");
const sale_order_tx_options_1 = require("../sale-order/sale-order-tx.options");
const ZERO = new client_1.Prisma.Decimal(0);
let SaleOrderDeskService = class SaleOrderDeskService {
    prisma;
    orders;
    salesContext;
    reservations;
    audit;
    constructor(prisma, orders, salesContext, reservations, audit) {
        this.prisma = prisma;
        this.orders = orders;
        this.salesContext = salesContext;
        this.reservations = reservations;
        this.audit = audit;
    }
    async deliveryHold(dto) {
        const reason = (0, sale_order_desk_helpers_1.requireReason)(dto.reason);
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const order = await (0, sale_order_desk_helpers_1.lockDeskOrder)(tx, dto);
            const ctx = await this.salesContext.resolve({ companyId: order.soCompanyId, branchId: order.soBranchId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
            if (!ctx.rights.edit) {
                (0, sales_errors_1.throwSalesRight)('This user may not change orders on the Sales Order menu', posting_types_1.SALES_ERROR_CODES.RIGHT_EDIT);
            }
            (0, sale_order_desk_helpers_1.assertDeskOrderOpen)(order, await (0, sale_order_desk_helpers_1.countOpenLines)(tx, order));
            if (order.soDeliveryHold === dto.soDeliveryHold) {
                const [last] = await tx.$queryRaw `
          SELECT COALESCE(u.usr_login_name, so.so_delivery_hold_by) AS by_name,
                 to_char(so.so_delivery_hold_on AT TIME ZONE 'Asia/Kolkata',
                         'DD-MM-YYYY HH12:MI AM') AS on_text
            FROM sales.sale_order so
            LEFT JOIN public.user_master u ON u.usr_id::text = lower(so.so_delivery_hold_by)
           WHERE so.so_id = ${order.soId}::uuid AND so.so_acc_year = ${order.soAccYear}::char(9)`;
                const parts = [
                    last?.by_name ? `by ${last.by_name}` : null,
                    last?.on_text ? `on ${last.on_text}` : null,
                ].filter(Boolean);
                const why = order.soDeliveryHoldReason ? `: ${order.soDeliveryHoldReason}` : '';
                const who = parts.length > 0 ? ` (${parts.join(' ')}${why})` : '';
                (0, sales_errors_1.throwSalesLocked)(order.soDeliveryHold
                    ? `Order ${order.soOrderRefno} is already on delivery hold${who}`
                    : `Order ${order.soOrderRefno} is not on delivery hold${who}`, posting_types_1.SALES_ERROR_CODES.ORDER_HOLD_UNCHANGED, 'soDeliveryHold');
            }
            const updated = await tx.saleOrder.update({
                where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
                data: {
                    soDeliveryHold: dto.soDeliveryHold,
                    soDeliveryHoldReason: reason,
                    soDeliveryHoldBy: ctx.actor,
                    soDeliveryHoldOn: now,
                    soModifiedOn: now,
                    soModifiedBy: ctx.actor,
                },
            });
            await (0, sale_order_desk_helpers_1.appendDeskStep)(tx, order, {
                event: dto.soDeliveryHold
                    ? txn_status_log_helper_1.TxnStatusEvent.DELIVERY_HOLD
                    : txn_status_log_helper_1.TxnStatusEvent.DELIVERY_RELEASED,
                fromStatus: order.soStatus,
                toStatus: order.soStatus,
                remarks: reason,
            }, ctx.actor, now);
            const holdFields = (o) => ({
                soDeliveryHold: o.soDeliveryHold,
                soDeliveryHoldReason: o.soDeliveryHoldReason,
                soDeliveryHoldBy: o.soDeliveryHoldBy,
                soDeliveryHoldOn: o.soDeliveryHoldOn?.toISOString() ?? null,
            });
            await this.audit.logEntityChange({
                action: 'update',
                tableName: 'sale_order',
                screenName: sale_order_desk_types_1.SALE_ORDER_DESK_AUDIT_SCREEN,
                screenType: 'transaction',
                pk: order.soId,
                displayName: order.soOrderRefno,
                originalRecord: holdFields(order),
                modifiedRecord: holdFields(updated),
                userId: ctx.actor,
                notes: dto.soDeliveryHold
                    ? `Order put on delivery hold: ${reason}`
                    : `Order released from delivery hold: ${reason}`,
            }, tx);
            return {
                soId: updated.soId,
                soAccYear: updated.soAccYear,
                soOrderRefno: updated.soOrderRefno,
                soStatus: updated.soStatus,
                soDeliveryHold: updated.soDeliveryHold,
                soDeliveryHoldReason: updated.soDeliveryHoldReason,
                soDeliveryHoldBy: updated.soDeliveryHoldBy,
                soDeliveryHoldByName: ctx.actorName,
                soDeliveryHoldOn: updated.soDeliveryHoldOn?.toISOString() ?? null,
            };
        }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
    }
    async priority(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const order = await (0, sale_order_desk_helpers_1.lockDeskOrder)(tx, dto);
            const ctx = await this.salesContext.resolve({ companyId: order.soCompanyId, branchId: order.soBranchId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
            if (!ctx.rights.edit) {
                (0, sales_errors_1.throwSalesRight)('This user may not change orders on the Sales Order menu', posting_types_1.SALES_ERROR_CODES.RIGHT_EDIT);
            }
            (0, sale_order_desk_helpers_1.assertDeskOrderOpen)(order, await (0, sale_order_desk_helpers_1.countOpenLines)(tx, order));
            if (order.soPriority === dto.soPriority) {
                (0, sales_errors_1.throwSalesLocked)(`Order ${order.soOrderRefno} is already ${dto.soPriority}`, posting_types_1.SALES_ERROR_CODES.ORDER_PRIORITY_UNCHANGED, 'soPriority');
            }
            await tx.saleOrder.update({
                where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
                data: { soPriority: dto.soPriority, soModifiedOn: now, soModifiedBy: ctx.actor },
            });
            const remarks = dto.soPriority === 'URGENT'
                ? `Quick delivery on: ${order.soPriority} → URGENT`
                : order.soPriority === 'URGENT'
                    ? `Quick delivery off: URGENT → ${dto.soPriority}`
                    : `Priority: ${order.soPriority} → ${dto.soPriority}`;
            await (0, sale_order_desk_helpers_1.appendDeskStep)(tx, order, {
                event: txn_status_log_helper_1.TxnStatusEvent.PRIORITY_CHANGED,
                fromStatus: order.soStatus,
                toStatus: order.soStatus,
                remarks,
            }, ctx.actor, now);
            await this.audit.logEntityChange({
                action: 'update',
                tableName: 'sale_order',
                screenName: sale_order_desk_types_1.SALE_ORDER_DESK_AUDIT_SCREEN,
                screenType: 'transaction',
                pk: order.soId,
                displayName: order.soOrderRefno,
                originalRecord: { soPriority: order.soPriority },
                modifiedRecord: { soPriority: dto.soPriority },
                userId: ctx.actor,
                notes: remarks,
            }, tx);
            return {
                soId: order.soId,
                soAccYear: order.soAccYear,
                soOrderRefno: order.soOrderRefno,
                soPriority: dto.soPriority,
            };
        }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
    }
    async closeOpenLines(dto) {
        const reason = (0, sale_order_desk_helpers_1.requireReason)(dto.reason);
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const order = await (0, sale_order_desk_helpers_1.lockDeskOrder)(tx, dto);
            const ctx = await this.salesContext.resolve({ companyId: order.soCompanyId, branchId: order.soBranchId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on the Sales Order menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            (0, sale_order_desk_helpers_1.assertDeskOrderOpen)(order, await (0, sale_order_desk_helpers_1.countOpenLines)(tx, order));
            const closeReason = (0, sale_order_desk_helpers_1.clip)(`Open lines closed: ${reason}`, 250);
            const releasedReservations = await this.reservations.release(tx, { docType: 'SALES_ORDER', docId: order.soId }, closeReason, ctx.actor, now);
            const result = await this.orders.cancelOrderOpenLines(tx, {
                order,
                srcAccYear: order.soAccYear,
                targetLineId: null,
                cancelReason: closeReason,
                actor: ctx.actor,
                now,
            });
            const { soCancelledAmt, soPendingAmt, ...rest } = result;
            const seesMoney = await this.canSeeMoney(tx);
            return {
                ...rest,
                ...(seesMoney ? { soCancelledAmt, soPendingAmt } : {}),
                releasedReservations,
            };
        }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
    }
    async stockCover(dto) {
        await this.assertRight(sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, 'view');
        const ids = dto.orders.map((o) => o.soId);
        const years = dto.orders.map((o) => o.soAccYear);
        const itemId = dto.itemId ?? null;
        const { found, rows } = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            const found = await tx.$queryRaw `
        SELECT so.so_id
          FROM sales.sale_order so
          JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
            ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
         WHERE so.so_company_id = ${dto.soCompanyId}::uuid
           AND so.so_branch_id = ${dto.soBranchId}::uuid
           AND so.so_is_deleted = false`;
            const rows = await tx.$queryRaw `
        WITH h AS (
          SELECT so.so_id, so.so_acc_year
            FROM sales.sale_order so
            JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
              ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
           WHERE so.so_company_id = ${dto.soCompanyId}::uuid
             AND so.so_branch_id = ${dto.soBranchId}::uuid
             AND so.so_is_deleted = false
        ),
        l AS (
          SELECT d.soi_item_id,
                 SUM(d.soi_pending_qty
                     * CASE WHEN d.soi_to_base_factor > 0 THEN d.soi_to_base_factor
                            ELSE COALESCE(NULLIF(u.iuc_to_base_factor, 0), 1) END) AS pending_base,
                 SUM(d.soi_pending_qty * COALESCE(u.iuc_uom_weight, 0)) AS order_kg
            FROM sales.sale_order_item d
            JOIN h ON h.so_id = d.soi_order_id AND h.so_acc_year = d.soi_acc_year
            JOIN inventory.item_master im ON im.item_id = d.soi_item_id
            LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = d.soi_item_unit_id
           WHERE d.soi_is_deleted = false
             AND d.soi_pending_qty > 0
             AND d.soi_is_service = false
             AND im.item_is_service = false
             AND (${itemId}::uuid IS NULL OR d.soi_item_id = ${itemId}::uuid)
           GROUP BY d.soi_item_id
        ),
        f AS (
          SELECT b.sbl_item_id, SUM(b.sbl_available_qty) AS free_base
            FROM stock.stock_balance b
           WHERE b.sbl_company_id = ${dto.soCompanyId}::uuid
             AND b.sbl_branch_id = ${dto.soBranchId}::uuid
             AND b.sbl_bucket = 'SALEABLE'
             AND b.sbl_is_deleted = false
             AND b.sbl_item_id IN (SELECT soi_item_id FROM l)
           GROUP BY b.sbl_item_id
        ),
        o AS (
          SELECT r.srv_item_id, SUM(r.srv_open_qty) AS own_base
            FROM stock.stock_reservation r
            JOIN h ON h.so_id = r.srv_src_doc_id
           WHERE r.srv_src_doc_type = 'SALES_ORDER'
             AND r.srv_status IN ('OPEN', 'PARTIAL')
             AND r.srv_is_deleted = false
             AND r.srv_item_id IN (SELECT soi_item_id FROM l)
           GROUP BY r.srv_item_id
        )
        SELECT l.soi_item_id AS item_id, im.item_name_en AS item_name,
               l.pending_base, l.order_kg,
               COALESCE(f.free_base, 0) AS free_base, COALESCE(o.own_base, 0) AS own_base
          FROM l
          JOIN inventory.item_master im ON im.item_id = l.soi_item_id
          LEFT JOIN f ON f.sbl_item_id = l.soi_item_id
          LEFT JOIN o ON o.srv_item_id = l.soi_item_id
         ORDER BY im.item_name_en, l.soi_item_id`;
            return { found, rows };
        }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
        const foundIds = new Set(found.map((f) => f.so_id));
        let orderKg = ZERO;
        let coverKg = ZERO;
        const items = rows.map((r) => {
            const pending = (0, sale_order_desk_helpers_1.dec)(r.pending_base);
            const free = (0, sale_order_desk_helpers_1.dec)(r.free_base).plus((0, sale_order_desk_helpers_1.dec)(r.own_base));
            const freeNonNeg = free.isNegative() ? ZERO : free;
            const cover = client_1.Prisma.Decimal.min(pending, freeNonNeg);
            const kg = (0, sale_order_desk_helpers_1.dec)(r.order_kg);
            const itemCoverKg = pending.greaterThan(0) ? kg.times(cover).div(pending) : ZERO;
            orderKg = orderKg.plus(kg);
            coverKg = coverKg.plus(itemCoverKg);
            return {
                itemId: r.item_id,
                itemName: r.item_name,
                pendingBaseQty: (0, sale_order_desk_helpers_1.qty)(pending),
                freeBaseQty: (0, sale_order_desk_helpers_1.qty)(free),
                coverBaseQty: (0, sale_order_desk_helpers_1.qty)(cover),
                orderKg: (0, sale_order_desk_helpers_1.qty)(kg),
                coverKg: (0, sale_order_desk_helpers_1.qty)(itemCoverKg),
            };
        });
        const orderKgR = orderKg.toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP);
        const coverKgR = coverKg.toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP);
        return {
            orderKg: orderKgR.toNumber(),
            coverKg: coverKgR.toNumber(),
            shortKg: orderKgR.minus(coverKgR).toNumber(),
            coverPerc: orderKgR.greaterThan(0)
                ? coverKgR
                    .times(100)
                    .div(orderKgR)
                    .toDecimalPlaces(1, client_1.Prisma.Decimal.ROUND_HALF_UP)
                    .toNumber()
                : 0,
            items,
            missing: [...new Set(ids.filter((id) => !foundIds.has(id)))],
        };
    }
    async figures(dto) {
        await this.assertRight(sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, 'view');
        if (!(await this.canSeeMoney(this.prisma))) {
            (0, sales_errors_1.throwSalesRight)('Amounts and dues on the order desk need the Receipt (menu 99) View right', posting_types_1.SALES_ERROR_CODES.ORDER_MONEY_RIGHT);
        }
        const ids = dto.orders.map((o) => o.soId);
        const years = dto.orders.map((o) => o.soAccYear);
        const itemId = dto.itemId ?? null;
        const custIds = dto.custIds ?? [];
        const { orders, customers } = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            const orders = await tx.$queryRaw `
        SELECT so.so_id, so.so_acc_year, so.so_cust_id, so.so_order_amt,
               round(COALESCE(SUM(CASE WHEN d.soi_net_qty > 0 THEN d.soi_net_amt * d.soi_pending_qty / d.soi_net_qty ELSE 0 END)
                     FILTER (WHERE d.soi_pending_qty > 0
                               AND (${itemId}::uuid IS NULL OR d.soi_item_id = ${itemId}::uuid)), 0), 2) AS open_value,
               round(COALESCE(SUM(CASE WHEN d.soi_net_qty > 0 THEN d.soi_net_amt * d.soi_pending_qty / d.soi_net_qty ELSE 0 END)
                     FILTER (WHERE d.soi_pending_qty > 0), 0), 2) AS order_open_value
          FROM sales.sale_order so
          JOIN unnest(${ids}::uuid[], ${years}::text[]) AS r(so_id, acc_year)
            ON r.so_id = so.so_id AND so.so_acc_year = r.acc_year::char(9)
          LEFT JOIN sales.sale_order_item d
                 ON d.soi_order_id = so.so_id AND d.soi_acc_year = so.so_acc_year AND d.soi_is_deleted = false
         WHERE so.so_company_id = ${dto.soCompanyId}::uuid
           AND so.so_branch_id = ${dto.soBranchId}::uuid
           AND so.so_is_deleted = false
         GROUP BY so.so_id, so.so_acc_year, so.so_cust_id, so.so_order_amt`;
            const partyIds = [...new Set([...orders.map((o) => o.so_cust_id), ...custIds])];
            const customers = await tx.$queryRaw `
        SELECT c.cus_id, c.cus_credit_amt_limit,
               du.pending, du.open_bills, du.overdue, du.overdue_bills
          FROM sales.customers c
          LEFT JOIN LATERAL (
            SELECT SUM(b.abl_pending_amount) AS pending,
                   COUNT(*) AS open_bills,
                   COALESCE(SUM(b.abl_pending_amount) FILTER (WHERE b.abl_due_date <= CURRENT_DATE), 0) AS overdue,
                   COUNT(*) FILTER (WHERE b.abl_due_date <= CURRENT_DATE) AS overdue_bills
              FROM accounts.acc_bill_balance b
             WHERE b.abl_company_id = ${dto.soCompanyId}::uuid
               AND b.abl_party_id = c.cus_id
               AND b.abl_dr_cr = 'DR'
               AND b.abl_is_deleted = false
               AND b.abl_is_active = true
               AND b.abl_pending_amount > 0
          ) du ON true
         WHERE c.cus_id = ANY(${partyIds}::uuid[])
         ORDER BY c.cus_name, c.cus_id`;
            return { orders, customers };
        }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
        let listValue = ZERO;
        for (const o of orders) {
            listValue = listValue.plus((0, sale_order_desk_helpers_1.dec)(o.open_value));
        }
        return {
            orders: orders.map((o) => ({
                soId: o.so_id,
                soAccYear: o.so_acc_year,
                openValue: (0, sale_order_desk_helpers_1.money)(o.open_value),
                orderOpenValue: (0, sale_order_desk_helpers_1.money)(o.order_open_value),
                orderAmt: (0, sale_order_desk_helpers_1.money)(o.so_order_amt),
            })),
            customers: customers.map((c) => {
                const pending = (0, sale_order_desk_helpers_1.dec)(c.pending);
                const limit = (0, sale_order_desk_helpers_1.dec)(c.cus_credit_amt_limit);
                return {
                    custId: c.cus_id,
                    pending: (0, sale_order_desk_helpers_1.money)(pending),
                    openBills: Number(c.open_bills ?? 0),
                    overdue: (0, sale_order_desk_helpers_1.money)(c.overdue),
                    overdueBills: Number(c.overdue_bills ?? 0),
                    creditAmtLimit: (0, sale_order_desk_helpers_1.money)(limit),
                    availCredit: limit.greaterThan(0) ? (0, sale_order_desk_helpers_1.money)(limit.minus(pending)) : null,
                };
            }),
            listValue: (0, sale_order_desk_helpers_1.money)(listValue),
        };
    }
    async canSeeMoney(client) {
        return (await this.salesContext.rights(sale_order_desk_types_1.SALE_ORDER_DESK_RECEIPT_MENU_ID, client)).view;
    }
    async assertRight(menuId, right) {
        const rights = await this.salesContext.rights(menuId);
        if (!rights[right]) {
            (0, sales_errors_1.throwSalesRight)('This user may not view orders on the Sales Order menu', posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW);
        }
    }
};
exports.SaleOrderDeskService = SaleOrderDeskService;
exports.SaleOrderDeskService = SaleOrderDeskService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_order_service_1.SaleOrderService,
        sales_context_service_1.SalesContextService,
        stock_reservation_service_1.StockReservationService,
        audit_log_service_1.AuditLogService])
], SaleOrderDeskService);
//# sourceMappingURL=sale-order-desk.service.js.map