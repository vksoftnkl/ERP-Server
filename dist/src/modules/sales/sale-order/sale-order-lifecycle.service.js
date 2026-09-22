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
exports.SaleOrderLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const sales_context_service_1 = require("../posting/sales-context.service");
const stock_reservation_service_1 = require("../posting/stock-reservation.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const sale_order_service_1 = require("./sale-order.service");
const sale_order_api_types_1 = require("./types/sale-order-api.types");
const ORDER_STATUS = { DRAFT: 'DRAFT', CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' };
let SaleOrderLifecycleService = class SaleOrderLifecycleService {
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
    async post(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const order = await this.lock(tx, dto);
            if (order.soStatus === ORDER_STATUS.CONFIRMED) {
                return { soStatus: order.soStatus, warnings: [] };
            }
            if (order.soStatus !== ORDER_STATUS.DRAFT) {
                (0, sales_errors_1.throwSalesLocked)(`This order is ${order.soStatus}`, posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'soId');
            }
            const ctx = await this.salesContext.resolve({ companyId: order.soCompanyId, branchId: order.soBranchId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
            if (!ctx.rights.post) {
                (0, sales_errors_1.throwSalesRight)('This user may not post on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_POST);
            }
            await (0, sales_guards_1.assertAccYearWritable)(tx, order.soCompanyId, order.soAccYear, 'soAccYear');
            const docDate = (0, sales_doc_utils_1.isoDate)(order.soOrderDate) ?? (0, sales_doc_utils_1.isoToday)();
            if (await (0, sales_guards_1.loadDayClosed)(tx, order.soCompanyId, order.soBranchId, docDate)) {
                (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'soOrderDate');
            }
            await (0, sales_guards_1.assertSalesmen)(tx, order.soCompanyId, order.soSalesmanId?.length ? order.soSalesmanId : null, { field: 'soSalesmanId' });
            const lines = await tx.saleOrderItem.findMany({
                where: { soiOrderId: order.soId, soiAccYear: order.soAccYear, soiIsDeleted: false },
                orderBy: { soiLineNo: 'asc' },
            });
            const { reserved, warnings } = await this.reserve(tx, order, lines, ctx.actor, now);
            for (const l of lines) {
                const got = reserved.get(l.soiId) ?? 0;
                await tx.saleOrderItem.update({
                    where: { soiId_soiAccYear: { soiId: l.soiId, soiAccYear: l.soiAccYear } },
                    data: {
                        soiIsReserved: got > 0,
                        soiReservedQty: new client_1.Prisma.Decimal(Math.min(got, (0, sales_doc_utils_1.num)(l.soiOrderQty)).toFixed(3)),
                        soiModifiedOn: now,
                        soiModifiedBy: ctx.actor,
                    },
                });
            }
            await tx.saleOrder.update({
                where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
                data: { soStatus: ORDER_STATUS.CONFIRMED, soModifiedOn: now, soModifiedBy: ctx.actor },
            });
            await this.trail(tx, order, txn_status_log_helper_1.TxnStatusEvent.POSTED, order.soStatus, ORDER_STATUS.CONFIRMED, ctx.actor, now, warnings.length ? `${warnings.length} line(s) short on reservation` : null);
            await this.audit.logEntityChange({
                action: 'approve',
                tableName: 'sale_order',
                screenName: 'Sales Order',
                screenType: 'transaction',
                pk: order.soId,
                displayName: order.soOrderRefno,
                originalRecord: { soStatus: order.soStatus },
                modifiedRecord: {
                    soStatus: ORDER_STATUS.CONFIRMED,
                    reservations: [...reserved.values()],
                },
                userId: ctx.actor,
                notes: 'Order confirmed',
            }, tx);
            return { soStatus: ORDER_STATUS.CONFIRMED, warnings };
        });
    }
    async cancel(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const order = await this.lock(tx, dto);
            if (order.soStatus === ORDER_STATUS.CANCELLED) {
                return { soStatus: order.soStatus, cancelledLines: 0 };
            }
            const ctx = await this.salesContext.resolve({ companyId: order.soCompanyId, branchId: order.soBranchId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            const delivered = await tx.saleOrderItem.count({
                where: {
                    soiOrderId: order.soId,
                    soiAccYear: order.soAccYear,
                    soiIsDeleted: false,
                    soiDeliveredQty: { gt: 0 },
                },
            });
            if (delivered > 0) {
                (0, sales_errors_1.throwSalesLocked)(`${delivered} line(s) have been delivered — an order with deliveries is closed by cancelling its open lines, not cancelled whole`, posting_types_1.SALES_ERROR_CODES.ORDER_DELIVERED, 'soId');
            }
            await this.reservations.release(tx, { docType: 'SALES_ORDER', docId: order.soId }, dto.reason, ctx.actor, now);
            const result = await this.orders.cancelOrderOpenLines(tx, {
                order,
                srcAccYear: order.soAccYear,
                targetLineId: null,
                cancelReason: dto.reason,
                actor: ctx.actor,
                now,
            });
            const after = await tx.saleOrder.findFirst({
                where: { soId: order.soId, soAccYear: order.soAccYear },
                select: { soStatus: true },
            });
            if (after?.soStatus !== ORDER_STATUS.CANCELLED) {
                await tx.saleOrder.update({
                    where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
                    data: { soStatus: ORDER_STATUS.CANCELLED, soModifiedOn: now, soModifiedBy: ctx.actor },
                });
                await this.trail(tx, order, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, order.soStatus, ORDER_STATUS.CANCELLED, ctx.actor, now, dto.reason);
            }
            return { soStatus: ORDER_STATUS.CANCELLED, cancelledLines: result.cancelledLines };
        });
    }
    async amend(dto) {
        const now = new Date();
        const { order, ctx } = await this.prisma.$transaction(async (tx) => {
            const order = await this.lock(tx, {
                soId: dto.soId,
                soCompanyId: dto.soCompanyId,
                soBranchId: dto.soBranchId,
                soAccYear: dto.soAccYear,
            });
            if (order.soStatus === ORDER_STATUS.CANCELLED) {
                (0, sales_errors_1.throwSalesLocked)('This order is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'soId');
            }
            const ctx = await this.salesContext.resolve({ companyId: order.soCompanyId, branchId: order.soBranchId }, sales_doc_utils_1.SALES_MENU_ID.SALES_ORDER, tx);
            if (!ctx.rights.amend) {
                (0, sales_errors_1.throwSalesRight)('This user may not amend on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_AMEND);
            }
            if (order.soRevisionNo !== dto.baseRevision) {
                (0, sales_errors_1.throwSalesLocked)(`This order has been amended since you opened it (now revision ${order.soRevisionNo}, you sent ${dto.baseRevision}). Reload it and make the change again.`, posting_types_1.SALES_ERROR_CODES.REVISION_STALE, 'baseRevision');
            }
            const lines = await tx.saleOrderItem.findMany({
                where: { soiOrderId: order.soId, soiAccYear: order.soAccYear, soiIsDeleted: false },
            });
            if (dto.items !== undefined) {
                const byId = new Map((dto.items ?? []).filter((i) => i.soiId).map((i) => [i.soiId, i]));
                for (const l of lines) {
                    const delivered = (0, sales_doc_utils_1.num)(l.soiDeliveredQty);
                    if (delivered <= 0) {
                        continue;
                    }
                    const incoming = byId.get(l.soiId);
                    const changed = !incoming ||
                        (incoming.soiItemId !== undefined && incoming.soiItemId !== l.soiItemId) ||
                        (incoming.soiItemUnitId !== undefined && incoming.soiItemUnitId !== l.soiItemUnitId) ||
                        (incoming.soiOrderQty !== undefined && (0, sales_doc_utils_1.num)(incoming.soiOrderQty) < delivered - 0.0005);
                    if (changed) {
                        (0, sales_errors_1.throwSalesLocked)(`Line ${l.soiLineNo} has ${delivered} delivered and cannot be removed, re-itemed or reduced below that`, posting_types_1.SALES_ERROR_CODES.ORDER_LINE_DELIVERED, `items.${l.soiLineNo}`);
                    }
                }
            }
            return { order, ctx };
        });
        const { baseRevision: _b, editRemark: _e, ...saveDto } = dto;
        void _b;
        void _e;
        const s = saveDto;
        delete s.soStatus;
        const payload = await this.orders.save({ ...s, soId: order.soId });
        await this.prisma.$transaction(async (tx) => {
            const fresh = await this.lock(tx, {
                soId: order.soId,
                soCompanyId: order.soCompanyId,
                soBranchId: order.soBranchId,
                soAccYear: order.soAccYear,
            });
            if (fresh.soStatus === ORDER_STATUS.CONFIRMED || fresh.soStatus === 'PARTIAL') {
                const lines = await tx.saleOrderItem.findMany({
                    where: { soiOrderId: fresh.soId, soiAccYear: fresh.soAccYear, soiIsDeleted: false },
                    orderBy: { soiLineNo: 'asc' },
                });
                const { reserved } = await this.reserve(tx, fresh, lines.filter((l) => (0, sales_doc_utils_1.num)(l.soiPendingQty) > 0), ctx.actor, now);
                for (const l of lines) {
                    const got = reserved.get(l.soiId) ?? 0;
                    await tx.saleOrderItem.update({
                        where: { soiId_soiAccYear: { soiId: l.soiId, soiAccYear: l.soiAccYear } },
                        data: {
                            soiIsReserved: got > 0,
                            soiReservedQty: new client_1.Prisma.Decimal(Math.min(got, (0, sales_doc_utils_1.num)(l.soiPendingQty)).toFixed(3)),
                        },
                    });
                }
            }
            await tx.saleOrder.update({
                where: { soId_soAccYear: { soId: order.soId, soAccYear: order.soAccYear } },
                data: { soRevisionNo: order.soRevisionNo + 1, soModifiedOn: now, soModifiedBy: ctx.actor },
            });
            await this.trail(tx, fresh, txn_status_log_helper_1.TxnStatusEvent.AMENDED, fresh.soStatus, fresh.soStatus, ctx.actor, now, dto.editRemark);
        });
        return { ...payload, soRevisionNo: order.soRevisionNo + 1 };
    }
    async deleteDraft(keys) {
        const order = await this.prisma.saleOrder.findFirst({
            where: {
                soId: keys.soId,
                soCompanyId: keys.soCompanyId,
                soBranchId: keys.soBranchId,
                soAccYear: keys.soAccYear,
                soIsDeleted: false,
            },
            select: { soStatus: true },
        });
        if (!order) {
            (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No active order found with id ${keys.soId}`);
        }
        if (order.soStatus !== ORDER_STATUS.DRAFT) {
            (0, sales_errors_1.throwSalesLocked)(`This order is ${order.soStatus} — cancel it instead of deleting it`, posting_types_1.SALES_ERROR_CODES.ORDER_CONFIRMED, 'soId');
        }
        return this.orders.softDelete(keys.soId, keys.soCompanyId, keys.soBranchId, keys.soAccYear);
    }
    async reserve(tx, order, lines, actor, now) {
        return this.reservations.reserve(tx, {
            docType: 'SALES_ORDER',
            docId: order.soId,
            accYear: order.soAccYear,
            companyId: order.soCompanyId,
            branchId: order.soBranchId,
            tenantId: order.soTenantId,
            refno: order.soOrderRefno,
        }, lines.map((l) => ({
            lineId: l.soiId,
            lineNo: l.soiLineNo,
            itemId: l.soiItemId,
            itemUnitId: l.soiItemUnitId,
            godownId: l.soiGodownId,
            qty: (0, sales_doc_utils_1.num)(l.soiPendingQty) > 0 ? (0, sales_doc_utils_1.num)(l.soiPendingQty) : (0, sales_doc_utils_1.num)(l.soiOrderQty),
            expiresOn: l.soiReserveExpiresOn,
        })), actor, now);
    }
    async lock(tx, keys) {
        const rows = await tx.$queryRaw `
      SELECT so_id FROM sales.sale_order
       WHERE so_id = ${keys.soId}::uuid AND so_acc_year = ${keys.soAccYear}::char(9)
         AND so_company_id = ${keys.soCompanyId}::uuid AND so_branch_id = ${keys.soBranchId}::uuid AND so_is_deleted = false
       FOR UPDATE`;
        if (rows.length === 0) {
            (0, module_service_utils_1.throwSalesNotFound)('Order not found', 'soId', `No active order found with id ${keys.soId}`);
        }
        const order = await tx.saleOrder.findFirst({
            where: { soId: keys.soId, soAccYear: keys.soAccYear },
        });
        return order;
    }
    async trail(tx, order, event, from, to, actor, now, remarks) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: order.soCompanyId,
            branchId: order.soBranchId,
            tenantId: order.soTenantId,
            accYear: order.soAccYear,
            srcModule: sale_order_api_types_1.SALE_ORDER_STATUS_SRC_MODULE,
            srcDocType: sale_order_api_types_1.SALE_ORDER_STATUS_SRC_DOC_TYPE,
            srcDocId: order.soId,
            srcDocRefno: order.soOrderRefno,
            event,
            fromStatus: from,
            toStatus: to,
            changedOn: now,
            changedBy: actor,
            remarks,
            deviceId: order.soDeviceId,
            sessionId: order.soSessionId,
        });
    }
};
exports.SaleOrderLifecycleService = SaleOrderLifecycleService;
exports.SaleOrderLifecycleService = SaleOrderLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sale_order_service_1.SaleOrderService,
        sales_context_service_1.SalesContextService,
        stock_reservation_service_1.StockReservationService,
        audit_log_service_1.AuditLogService])
], SaleOrderLifecycleService);
//# sourceMappingURL=sale-order-lifecycle.service.js.map