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
exports.StockReservationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const sales_doc_utils_1 = require("./sales-doc.utils");
let StockReservationService = class StockReservationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async reserve(tx, doc, lines, actor, now) {
        const reserved = new Map();
        const warnings = [];
        for (const line of lines) {
            const want = (0, sales_doc_utils_1.round4)(line.qty);
            if (want <= 0) {
                continue;
            }
            if (!line.godownId) {
                warnings.push({
                    code: 'SALES_RESERVE_SHORT',
                    line: line.lineNo,
                    short: want,
                    message: `Line ${line.lineNo}: no godown on the line, nothing reserved`,
                });
                continue;
            }
            const [unit] = await tx.$queryRaw `
        SELECT COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id, iuc.iuc_to_base_factor
          FROM inventory.item_unit_conversion iuc
          LEFT JOIN LATERAL (
            SELECT b.iuc_id FROM inventory.item_unit_conversion b
             WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit = true
               AND b.iuc_is_deleted = false
             ORDER BY b.iuc_unit_slno LIMIT 1
          ) base ON true
         WHERE iuc.iuc_id = ${line.itemUnitId}::uuid`;
            const factor = Number(unit?.iuc_to_base_factor ?? 1) || 1;
            let wantBase = (0, sales_doc_utils_1.round4)(want * factor);
            await tx.$executeRaw `
        UPDATE stock.stock_reservation
           SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
               srv_closed_on = ${now}, srv_close_reason = 'Re-reserved', srv_modified_on = ${now}, srv_modified_by = ${actor}
         WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid AND srv_line_no = ${line.lineNo}
           AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
            const holdings = await tx.$queryRaw `
        SELECT b.sbl_lot_id,
               b.sbl_available_qty - COALESCE((SELECT SUM(r.srv_open_qty) FROM stock.stock_reservation r
                                                WHERE r.srv_lot_id = b.sbl_lot_id AND r.srv_godown_id = b.sbl_godown_id
                                                  AND r.srv_status IN ('OPEN', 'PARTIAL') AND r.srv_is_deleted = false), 0) AS free
          FROM stock.stock_balance b
          JOIN stock.stock_lot l ON l.slt_id = b.sbl_lot_id
         WHERE b.sbl_company_id = ${doc.companyId}::uuid AND b.sbl_branch_id = ${doc.branchId}::uuid
           AND b.sbl_godown_id = ${line.godownId}::uuid AND b.sbl_item_id = ${line.itemId}::uuid
           AND b.sbl_bucket = ${line.bucket ?? 'SALEABLE'} AND b.sbl_is_deleted = false
         ORDER BY l.slt_expiry_date NULLS LAST, b.sbl_first_in_date NULLS LAST`;
            let got = 0;
            for (const h of holdings) {
                if (wantBase <= 0) {
                    break;
                }
                const free = (0, sales_doc_utils_1.round4)(Number(h.free ?? 0));
                if (free <= 0) {
                    continue;
                }
                const take = Math.min(free, wantBase);
                await tx.$executeRaw `
          INSERT INTO stock.stock_reservation (
            srv_company_id, srv_branch_id, srv_tenant_id, srv_acc_year, srv_godown_id, srv_item_id, srv_lot_id,
            srv_base_uom_id, srv_bucket, srv_src_module, srv_src_doc_type, srv_src_doc_id, srv_src_acc_year,
            srv_src_refno, srv_line_no, srv_reserved_qty, srv_reserved_on, srv_expires_on, srv_status, srv_created_on, srv_created_by
          ) VALUES (
            ${doc.companyId}::uuid, ${doc.branchId}::uuid, ${doc.tenantId ?? null}::uuid, ${doc.accYear}::char(9),
            ${line.godownId}::uuid, ${line.itemId}::uuid, ${h.sbl_lot_id}::uuid, ${unit.base_iuc_id}::uuid,
            ${line.bucket ?? 'SALEABLE'}, 'SALES', ${doc.docType}, ${doc.docId}::uuid, ${doc.accYear}::char(9),
            ${doc.refno}, ${line.lineNo}, ${take}::numeric, ${now}, ${line.expiresOn ?? null}, 'OPEN', ${now}, ${actor}
          )`;
                wantBase = (0, sales_doc_utils_1.round4)(wantBase - take);
                got = (0, sales_doc_utils_1.round4)(got + take);
            }
            reserved.set(line.lineId, (0, sales_doc_utils_1.round4)(got / factor));
            if (wantBase > 0.0005) {
                const short = (0, sales_doc_utils_1.round4)(wantBase / factor);
                warnings.push({
                    code: 'SALES_RESERVE_SHORT',
                    line: line.lineNo,
                    short,
                    message: `Line ${line.lineNo}: only ${(0, sales_doc_utils_1.round4)(got / factor)} of ${want} could be reserved (${short} short)`,
                });
            }
        }
        return { reserved, warnings };
    }
    async release(tx, doc, reason, actor, now) {
        return tx.$executeRaw `
      UPDATE stock.stock_reservation
         SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
             srv_closed_on = ${now}, srv_close_reason = ${reason}, srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid
         AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
    }
    async consume(tx, order, baseQty, actor, now) {
        let left = (0, sales_doc_utils_1.round4)(baseQty);
        if (left === 0) {
            return;
        }
        const rows = await tx.$queryRaw `
      SELECT r.srv_id, r.srv_acc_year, r.srv_reserved_qty, r.srv_consumed_qty, r.srv_released_qty
        FROM stock.stock_reservation r
        JOIN stock.stock_lot l ON l.slt_id = r.srv_lot_id
       WHERE r.srv_src_doc_type = 'SALES_ORDER' AND r.srv_src_doc_id = ${order.docId}::uuid AND r.srv_line_no = ${order.lineNo}
         AND r.srv_is_deleted = false AND r.srv_status IN ('OPEN', 'PARTIAL', 'CONSUMED')
       ORDER BY l.slt_expiry_date NULLS LAST, r.srv_reserved_on
       FOR UPDATE OF r`;
        for (const r of rows) {
            if (Math.abs(left) < 0.0005) {
                break;
            }
            const reserved = Number(r.srv_reserved_qty);
            const consumed = Number(r.srv_consumed_qty);
            const released = Number(r.srv_released_qty);
            let next;
            if (left > 0) {
                const room = (0, sales_doc_utils_1.round4)(reserved - consumed - released);
                if (room <= 0) {
                    continue;
                }
                const take = Math.min(room, left);
                next = (0, sales_doc_utils_1.round4)(consumed + take);
                left = (0, sales_doc_utils_1.round4)(left - take);
            }
            else {
                if (consumed <= 0) {
                    continue;
                }
                const give = Math.min(consumed, -left);
                next = (0, sales_doc_utils_1.round4)(consumed - give);
                left = (0, sales_doc_utils_1.round4)(left + give);
            }
            const status = (0, sales_doc_utils_1.round4)(next + released) >= reserved - 0.0005
                ? released > 0
                    ? 'RELEASED'
                    : 'CONSUMED'
                : next > 0
                    ? 'PARTIAL'
                    : 'OPEN';
            await tx.$executeRaw `
        UPDATE stock.stock_reservation
           SET srv_consumed_qty = ${next}::numeric, srv_status = ${status},
               srv_closed_on = CASE WHEN ${status} IN ('CONSUMED', 'RELEASED') THEN ${now} ELSE NULL END,
               srv_modified_on = ${now}, srv_modified_by = ${actor}
         WHERE srv_id = ${r.srv_id}::uuid AND srv_acc_year = ${r.srv_acc_year}::char(9)`;
        }
    }
};
exports.StockReservationService = StockReservationService;
exports.StockReservationService = StockReservationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockReservationService);
//# sourceMappingURL=stock-reservation.service.js.map