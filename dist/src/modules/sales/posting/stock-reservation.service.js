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
exports.netOrderLineMoves = netOrderLineMoves;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const stock_voucher_posting_helper_1 = require("../../stocks/stock-voucher/stock-voucher-posting.helper");
const sales_doc_utils_1 = require("./sales-doc.utils");
function netOrderLineMoves(entries) {
    const byLine = new Map();
    for (const e of entries) {
        const key = `${e.docId}|${e.lineNo}`;
        const seen = byLine.get(key);
        if (seen) {
            seen.baseQty = seen.baseQty.plus(e.baseQty);
        }
        else {
            byLine.set(key, { docId: e.docId, lineNo: e.lineNo, baseQty: e.baseQty });
        }
    }
    return [...byLine.values()].filter((m) => !m.baseQty.toDecimalPlaces(4).isZero());
}
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
            await (0, stock_voucher_posting_helper_1.refreshReserved)(tx, (0, stock_voucher_posting_helper_1.reservationHoldingsOf)(doc.docType, doc.docId), actor, now);
            const holdings = await tx.$queryRaw `
        SELECT b.sbl_lot_id, b.sbl_available_qty AS free
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
            await (0, stock_voucher_posting_helper_1.ensureBalanceRows)(tx, (0, stock_voucher_posting_helper_1.reservationHoldingsOf)(doc.docType, doc.docId), actor);
            await (0, stock_voucher_posting_helper_1.refreshReserved)(tx, (0, stock_voucher_posting_helper_1.reservationHoldingsOf)(doc.docType, doc.docId), actor, now);
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
        const released = await tx.$executeRaw `
      UPDATE stock.stock_reservation
         SET srv_released_qty = srv_reserved_qty - srv_consumed_qty, srv_status = 'RELEASED',
             srv_closed_on = ${now}, srv_close_reason = ${reason}, srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_src_doc_type = ${doc.docType} AND srv_src_doc_id = ${doc.docId}::uuid
         AND srv_status IN ('OPEN', 'PARTIAL') AND srv_is_deleted = false`;
        if (released > 0) {
            await (0, stock_voucher_posting_helper_1.refreshReserved)(tx, (0, stock_voucher_posting_helper_1.reservationHoldingsOf)(doc.docType, doc.docId), actor, now);
        }
        return released;
    }
    async consume(tx, order, baseQty, actor, now) {
        let left = new client_1.Prisma.Decimal(baseQty).toDecimalPlaces(4);
        if (left.isZero()) {
            return;
        }
        const giveBack = left.isNegative();
        const found = await tx.$queryRaw `
      SELECT r.srv_id, r.srv_acc_year, r.srv_src_module, r.srv_lot_id, r.srv_godown_id, r.srv_bucket,
             r.srv_status, r.srv_reserved_qty, r.srv_consumed_qty, r.srv_released_qty
        FROM stock.stock_reservation r
        JOIN stock.stock_lot l ON l.slt_id = r.srv_lot_id
       WHERE r.srv_src_doc_type = 'SALES_ORDER' AND r.srv_src_doc_id = ${order.docId}::uuid AND r.srv_line_no = ${order.lineNo}
         AND r.srv_is_deleted = false
         AND (r.srv_status IN ('OPEN', 'PARTIAL', 'CONSUMED')
              OR (${giveBack}::boolean AND r.srv_status = 'RELEASED' AND r.srv_consumed_qty > 0))
       ORDER BY (r.srv_status = 'RELEASED'), l.slt_expiry_date NULLS LAST, r.srv_reserved_on
       FOR UPDATE OF r`;
        const rows = found.map((r) => ({
            id: r.srv_id,
            accYear: r.srv_acc_year,
            key: [r.srv_acc_year, r.srv_src_module, r.srv_lot_id, r.srv_godown_id, r.srv_bucket].join('|'),
            status: r.srv_status,
            reserved: new client_1.Prisma.Decimal(r.srv_reserved_qty),
            consumed: new client_1.Prisma.Decimal(r.srv_consumed_qty),
            released: new client_1.Prisma.Decimal(r.srv_released_qty),
        }));
        const liveOn = (row) => rows.find((o) => o !== row && o.key === row.key && LIVE.has(o.status));
        for (const r of rows) {
            if (left.isZero()) {
                break;
            }
            if (!giveBack) {
                const room = r.reserved.minus(r.consumed).minus(r.released);
                if (room.lte(0)) {
                    continue;
                }
                const take = client_1.Prisma.Decimal.min(room, left);
                left = left.minus(take);
                await this.writeConsumed(tx, r, r.consumed.plus(take), actor, now);
                continue;
            }
            if (r.consumed.lte(0)) {
                continue;
            }
            const give = client_1.Prisma.Decimal.min(r.consumed, left.negated());
            const live = LIVE.has(r.status) ? undefined : liveOn(r);
            if (live) {
                left = left.plus(give);
                await this.releaseGiveBack(tx, r, give, HANDED_OVER_REASON, actor, now);
                await this.holdMore(tx, live, give, actor, now);
                continue;
            }
            if (r.status === 'RELEASED') {
                left = left.plus(give);
                await this.releaseGiveBack(tx, r, give, RELEASED_GIVE_BACK_REASON, actor, now);
                continue;
            }
            left = left.plus(give);
            await this.writeConsumed(tx, r, r.consumed.minus(give), actor, now);
        }
        if (rows.length > 0) {
            await (0, stock_voucher_posting_helper_1.refreshReserved)(tx, (0, stock_voucher_posting_helper_1.reservationHoldingsOf)('SALES_ORDER', order.docId), actor, now);
        }
    }
    async writeConsumed(tx, r, next, actor, now) {
        const status = reservationStatus(r.reserved, next, r.released);
        await tx.$executeRaw `
      UPDATE stock.stock_reservation
         SET srv_consumed_qty = ${next}::numeric, srv_status = ${status},
             srv_closed_on = CASE WHEN ${status} IN ('CONSUMED', 'RELEASED') THEN ${now} ELSE NULL END,
             srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_id = ${r.id}::uuid AND srv_acc_year = ${r.accYear}::char(9)`;
        r.consumed = next;
        r.status = status;
    }
    async releaseGiveBack(tx, from, give, reason, actor, now) {
        const consumed = from.consumed.minus(give);
        const released = from.released.plus(give);
        const status = reservationStatus(from.reserved, consumed, released);
        await tx.$executeRaw `
      UPDATE stock.stock_reservation
         SET srv_consumed_qty = ${consumed}::numeric, srv_released_qty = ${released}::numeric,
             srv_status = ${status}, srv_closed_on = COALESCE(srv_closed_on, ${now}),
             srv_close_reason = COALESCE(srv_close_reason, ${reason}),
             srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_id = ${from.id}::uuid AND srv_acc_year = ${from.accYear}::char(9)`;
        from.consumed = consumed;
        from.released = released;
        from.status = status;
    }
    async holdMore(tx, to, give, actor, now) {
        const reserved = to.reserved.plus(give);
        const toStatus = reservationStatus(reserved, to.consumed, to.released);
        await tx.$executeRaw `
      UPDATE stock.stock_reservation
         SET srv_reserved_qty = ${reserved}::numeric, srv_status = ${toStatus},
             srv_modified_on = ${now}, srv_modified_by = ${actor}
       WHERE srv_id = ${to.id}::uuid AND srv_acc_year = ${to.accYear}::char(9)`;
        to.reserved = reserved;
        to.status = toStatus;
    }
};
exports.StockReservationService = StockReservationService;
exports.StockReservationService = StockReservationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockReservationService);
const LIVE = new Set(['OPEN', 'PARTIAL']);
const HANDED_OVER_REASON = 'Bill cancelled: quantity returned to the newer hold';
const RELEASED_GIVE_BACK_REASON = 'Bill quantity given back after the hold was released';
function reservationStatus(reserved, consumed, released) {
    if (consumed.plus(released).gte(reserved)) {
        return released.gt(0) ? 'RELEASED' : 'CONSUMED';
    }
    return consumed.gt(0) ? 'PARTIAL' : 'OPEN';
}
//# sourceMappingURL=stock-reservation.service.js.map