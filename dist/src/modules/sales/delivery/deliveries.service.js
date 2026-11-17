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
exports.DeliveriesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const sales_context_service_1 = require("../posting/sales-context.service");
const delivery_constants_1 = require("./core/delivery.constants");
const delivery_pending_service_1 = require("./core/delivery-pending.service");
const delivery_status_service_1 = require("./core/delivery-status.service");
const delivery_pending_sql_1 = require("./core/delivery-pending.sql");
const delivery_errors_1 = require("./delivery.errors");
const delivery_note_read_service_1 = require("./delivery-note-read.service");
const q3 = (d) => d.toDecimalPlaces(3).toString();
let DeliveriesService = class DeliveriesService {
    prisma;
    salesContext;
    pending;
    status;
    constructor(prisma, salesContext, pending, status) {
        this.prisma = prisma;
        this.salesContext = salesContext;
        this.pending = pending;
        this.status = status;
    }
    async mode(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const rights = await this.salesContext.rights(delivery_constants_1.DELIVERY_MENU_ID.SALE_BILL, tx);
            if (!rights.edit) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RIGHT_MODE, "This user may not change a bill's delivery mode (Sales Bill EDIT)", 'userId');
            }
            const [bill] = await tx.$queryRaw `
        SELECT sb_id, sb_acc_year, sb_company_id, sb_branch_id, sb_tenant_id, sb_bill_refno, sb_status,
               sb_delivery_mode, sb_delivery_status, sb_device_id, sb_session_id
          FROM sales.sale_bill
         WHERE sb_id = ${dto.sbId}::uuid AND sb_acc_year = ${dto.accYear}::bpchar
           AND sb_company_id = ${dto.companyId}::uuid AND sb_branch_id = ${dto.branchId}::uuid
           AND sb_is_deleted = false
         FOR UPDATE`;
            if (!bill) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_NOT_POSTED, `No bill ${dto.sbId} in this branch and year`, 'sbId', { bill: '' });
            }
            const refno = bill.sb_bill_refno ?? '';
            if (bill.sb_status !== 'POSTED') {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_BILL_NOT_POSTED, `${refno} is not posted, or is cancelled`, 'sbId', { bill: refno });
            }
            if (bill.sb_delivery_mode !== 'PICKUP' && bill.sb_delivery_mode !== 'DISPATCH') {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_MODE_INSTANT, `${refno} was given at the counter`, 'sbDeliveryMode', { bill: refno });
            }
            const lines = (await this.pending.linesOfBills(tx, [{ billId: bill.sb_id, billAccYear: bill.sb_acc_year }])).filter((l) => l.eligible);
            if (!lines.some((l) => l.pendingQty.greaterThan(0))) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_MODE_GIVEN, `${refno} is fully given already`, 'sbId', { bill: refno });
            }
            const next = (dto.sbDeliveryMode ?? '').trim().toUpperCase();
            if (next !== 'PICKUP' && next !== 'DISPATCH') {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_MODE_INVALID, `A posted bill only switches between PICKUP and DISPATCH; ${next || '(blank)'} was sent`, 'sbDeliveryMode');
            }
            const reason = (dto.reason ?? '').trim();
            if (!reason) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_MODE_REASON_REQUIRED, 'Say why the mode changes', 'reason');
            }
            if (next !== bill.sb_delivery_mode) {
                const actorName = await this.salesContext.actorName(tx);
                await tx.$executeRaw `
          UPDATE sales.sale_bill
             SET sb_delivery_mode = ${next}, sb_modified_on = ${now}, sb_modified_by = ${actorName}
           WHERE sb_id = ${bill.sb_id}::uuid AND sb_acc_year = ${bill.sb_acc_year}::bpchar`;
                await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                    companyId: bill.sb_company_id,
                    branchId: bill.sb_branch_id,
                    tenantId: bill.sb_tenant_id,
                    accYear: bill.sb_acc_year,
                    srcModule: txn_status_log_helper_1.TxnStatusSrcModule.SALES,
                    srcDocType: txn_status_log_helper_1.TxnStatusDocType.SALE_BILL,
                    srcDocId: bill.sb_id,
                    srcDocRefno: bill.sb_bill_refno,
                    event: txn_status_log_helper_1.TxnStatusEvent.DELIVERY_MODE,
                    fromStatus: bill.sb_delivery_mode,
                    toStatus: next,
                    changedOn: now,
                    changedBy: this.salesContext.actor(),
                    remarks: reason.slice(0, 500),
                    deviceId: bill.sb_device_id,
                    sessionId: bill.sb_session_id,
                });
            }
            const [after] = await this.status.recompute(tx, [{ billId: bill.sb_id, billAccYear: bill.sb_acc_year }]);
            return {
                sbId: bill.sb_id,
                sbAccYear: bill.sb_acc_year.trim(),
                sbBillRefno: bill.sb_bill_refno,
                sbDeliveryMode: next,
                sbDeliveryModeBefore: bill.sb_delivery_mode,
                sbDeliveryStatus: after?.statusAfter ?? bill.sb_delivery_status,
                changed: next !== bill.sb_delivery_mode,
            };
        });
    }
    async exceptions(q) {
        const rights = await this.salesContext.rights(delivery_constants_1.DELIVERY_MENU_ID.PENDING_DELIVERIES);
        if (!rights.view) {
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RIGHT_VIEW, 'This user may not open Pending Deliveries (menu 304)', 'userId');
        }
        const rows = await this.prisma.$queryRaw `
      SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, i.sbi_id, i.sbi_line_no,
             im.item_name_en AS item_name, g.gdl_name AS godown_name,
             i.sbi_bill_qty AS billed, COALESCE(ev.settled_qty, 0) AS settled,
             le.sde_kind AS last_kind, le.sde_src_refno AS last_refno, le.sde_event_datetime AS last_at
        FROM sales.sale_bill b
        JOIN sales.sale_bill_item i ON i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
        JOIN inventory.item_master im ON im.item_id = i.sbi_item_id
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = i.sbi_godown_id
        LEFT JOIN LATERAL ${(0, delivery_pending_sql_1.lineEventSumsLateral)()} ev ON true
        LEFT JOIN LATERAL (
          SELECT e.sde_kind, e.sde_src_refno, e.sde_event_datetime
            FROM sales.sale_delivery_event e
           WHERE e.sde_bill_item_id = i.sbi_id AND e.sde_bill_acc_year = i.sbi_acc_year
           ORDER BY e.sde_event_datetime DESC, e.sde_created_on DESC LIMIT 1
        ) le ON true
       WHERE b.sb_company_id = ${q.companyId}::uuid AND b.sb_branch_id = ${q.branchId}::uuid
         AND ${(0, delivery_pending_sql_1.eligibleLineWhere)()}
         AND COALESCE(ev.settled_qty, 0) > i.sbi_bill_qty
       ORDER BY b.sb_bill_date, b.sb_bill_refno, i.sbi_line_no`;
        return {
            rows: rows.map((r) => ({
                billId: r.sb_id,
                billAccYear: r.sb_acc_year.trim(),
                billRefno: r.sb_bill_refno,
                billItemId: r.sbi_id,
                lineNo: r.sbi_line_no,
                itemName: r.item_name ?? '',
                godownName: r.godown_name ?? '',
                billedQty: q3((0, delivery_pending_service_1.dec)(r.billed)),
                settledQty: q3((0, delivery_pending_service_1.dec)(r.settled)),
                overQty: q3((0, delivery_pending_service_1.dec)(r.settled).minus((0, delivery_pending_service_1.dec)(r.billed))),
                lastEvent: r.last_kind
                    ? { kind: r.last_kind, refno: r.last_refno, at: r.last_at ? (0, delivery_note_read_service_1.istClock)(r.last_at) : null }
                    : null,
            })),
            rights: { view: rights.view, print: rights.print, export: rights.export },
        };
    }
};
exports.DeliveriesService = DeliveriesService;
exports.DeliveriesService = DeliveriesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        delivery_pending_service_1.DeliveryPendingService,
        delivery_status_service_1.DeliveryStatusService])
], DeliveriesService);
//# sourceMappingURL=deliveries.service.js.map