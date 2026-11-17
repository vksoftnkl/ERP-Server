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
exports.DeliveryStatusService = void 0;
exports.deliveryStatusOf = deliveryStatusOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const delivery_pending_sql_1 = require("./delivery-pending.sql");
let DeliveryStatusService = class DeliveryStatusService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async recompute(tx, bills) {
        const uniq = new Map();
        for (const b of bills) {
            uniq.set(`${b.billId}|${b.billAccYear.trim()}`, {
                billId: b.billId,
                billAccYear: b.billAccYear.trim(),
            });
        }
        if (uniq.size === 0) {
            return [];
        }
        const ids = [...uniq.values()].map((b) => b.billId);
        const years = [...uniq.values()].map((b) => b.billAccYear);
        const rows = await tx.$queryRaw `
      WITH k AS (
        SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[])::bpchar AS yr
      ),
      agg AS (
        SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, b.sb_delivery_status AS cur,
               b.sb_delivered_on AS cur_on, b.sb_status, b.sb_is_deleted, b.sb_delivery_mode,
               COALESCE(l.lines, 0) AS lines, COALESCE(l.open_lines, 0) AS open_lines,
               COALESCE(l.any_settled, false) AS any_settled, COALESCE(l.given, 0) AS given,
               g.last_at
          FROM k
          JOIN sales.sale_bill b ON b.sb_id = k.id AND b.sb_acc_year = k.yr
          LEFT JOIN LATERAL (
            SELECT count(*) AS lines,
                   count(*) FILTER (WHERE i.sbi_bill_qty - COALESCE(ev.settled_qty, 0) <> 0) AS open_lines,
                   bool_or(COALESCE(ev.settled_qty, 0) <> 0) AS any_settled,
                   SUM(COALESCE(ev.given_qty, 0)) AS given
              FROM sales.sale_bill_item i
              LEFT JOIN LATERAL ${(0, delivery_pending_sql_1.lineEventSumsLateral)()} ev ON true
             WHERE i.sbi_bill_id = b.sb_id AND i.sbi_acc_year = b.sb_acc_year
               AND i.sbi_is_deleted = false
               AND i.sbi_is_service = false
               AND COALESCE(i.sbi_src_doc_type, '') <> 'DELIVERY_CHALLAN'
               AND i.sbi_bill_qty > 0
          ) l ON true
          LEFT JOIN LATERAL (
            SELECT MAX(e.sde_event_datetime) AS last_at
              FROM sales.sale_delivery_event e
             WHERE e.sde_bill_id = b.sb_id AND e.sde_bill_acc_year = b.sb_acc_year
               AND e.sde_kind IN ('GIVEN', 'CLEANUP')
               AND e.sde_is_deleted = false
               AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event x
                                WHERE x.sde_reverses_id = e.sde_id AND x.sde_kind = 'CANCEL')
          ) g ON true
      )
      SELECT a.sb_id, a.sb_acc_year, a.sb_bill_refno, a.cur, a.cur_on, a.sb_status, a.sb_is_deleted,
             a.sb_delivery_mode, a.lines::int AS lines, a.open_lines::int AS open_lines, a.any_settled,
             a.given, a.last_at
        FROM agg a`;
        const out = [];
        for (const row of rows) {
            const want = deliveryStatusOf({
                billStatus: row.sb_status,
                deleted: row.sb_is_deleted,
                mode: row.sb_delivery_mode,
                lines: Number(row.lines),
                openLines: Number(row.open_lines),
                anySettled: row.any_settled === true,
                given: new client_1.Prisma.Decimal(String(row.given ?? 0)),
            });
            const r = { ...row, want, want_on: want === 'DELIVERED' ? row.last_at : null };
            const statusChanged = r.cur !== r.want;
            const onChanged = r.want === 'DELIVERED'
                ? (r.cur_on?.getTime() ?? null) !== (r.want_on?.getTime() ?? null)
                : statusChanged && r.cur_on !== null;
            if (statusChanged || onChanged) {
                await tx.$executeRaw `
          UPDATE sales.sale_bill
             SET sb_delivery_status = ${r.want},
                 sb_delivered_on    = ${r.want === 'DELIVERED' ? r.want_on : null}::timestamptz
           WHERE sb_id = ${r.sb_id}::uuid AND sb_acc_year = ${r.sb_acc_year}::bpchar`;
            }
            out.push({
                billId: r.sb_id,
                billAccYear: r.sb_acc_year.trim(),
                billRefno: r.sb_bill_refno,
                statusBefore: r.cur,
                statusAfter: r.want,
                changed: statusChanged,
            });
        }
        return out;
    }
    async preview(client, bills) {
        const c = client ?? this.prisma;
        const out = new Map();
        if (bills.length === 0) {
            return out;
        }
        const rows = await c.$queryRaw `
      SELECT sb_id, sb_delivery_status FROM sales.sale_bill
       WHERE sb_id = ANY(${bills.map((b) => b.billId)}::uuid[])`;
        for (const r of rows) {
            out.set(r.sb_id, r.sb_delivery_status);
        }
        return out;
    }
};
exports.DeliveryStatusService = DeliveryStatusService;
exports.DeliveryStatusService = DeliveryStatusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DeliveryStatusService);
function deliveryStatusOf(a) {
    if (a.billStatus !== 'POSTED' || a.deleted || (a.mode !== 'PICKUP' && a.mode !== 'DISPATCH') || a.lines === 0) {
        return 'NA';
    }
    if (a.openLines > 0) {
        return a.anySettled ? 'PART' : 'PENDING';
    }
    return a.given.greaterThan(0) ? 'DELIVERED' : 'RETURNED';
}
//# sourceMappingURL=delivery-status.service.js.map