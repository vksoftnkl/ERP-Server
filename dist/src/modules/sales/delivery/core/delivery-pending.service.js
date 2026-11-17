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
exports.DeliveryPendingService = void 0;
exports.dec = dec;
exports.ymd = ymd;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const delivery_pending_sql_1 = require("./delivery-pending.sql");
const D0 = new client_1.Prisma.Decimal(0);
let DeliveryPendingService = class DeliveryPendingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async linesByKeys(client, keys) {
        if (keys.length === 0) {
            return [];
        }
        const ids = keys.map((k) => k.billItemId);
        const years = keys.map((k) => k.billAccYear.trim());
        return this.facts(client, client_1.Prisma.sql `JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[]) AS yr) k
                   ON i.sbi_id = k.id AND i.sbi_acc_year = k.yr::bpchar`, client_1.Prisma.empty);
    }
    async linesOfBills(client, bills) {
        if (bills.length === 0) {
            return [];
        }
        const ids = bills.map((k) => k.billId);
        const years = bills.map((k) => k.billAccYear.trim());
        return this.facts(client, client_1.Prisma.sql `JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[]) AS yr) k
                   ON i.sbi_bill_id = k.id AND i.sbi_acc_year = k.yr::bpchar`, client_1.Prisma.sql `AND i.sbi_is_deleted = false`);
    }
    async facts(client, keyJoin, extra) {
        const c = client ?? this.prisma;
        const rows = await c.$queryRaw `
      SELECT i.sbi_id, i.sbi_acc_year, b.sb_id, b.sb_bill_refno, b.sb_bill_date,
             b.sb_company_id, b.sb_branch_id, b.sb_status, b.sb_is_deleted, b.sb_bill_mode,
             b.sb_delivery_mode, b.sb_delivery_status, b.sb_cust_id, b.sb_cust_name,
             i.sbi_line_no, i.sbi_split_no, i.sbi_is_deleted, i.sbi_is_service,
             i.sbi_src_doc_type, i.sbi_src_doc_refno,
             i.sbi_item_id, i.sbi_item_unit_id, i.sbi_godown_id, i.sbi_lot_id,
             COALESCE(i.sbi_bucket, 'SALEABLE') AS bucket,
             i.sbi_bill_qty AS billed_qty,
             ${(0, delivery_pending_sql_1.lineFactorSql)()} AS factor,
             ${(0, delivery_pending_sql_1.lineUnitKgSql)()} AS unit_kg,
             COALESCE(ev.settled_qty, 0)  AS settled_qty,
             COALESCE(ev.given_qty, 0)    AS given_qty,
             COALESCE(ev.settled_base, 0) AS settled_base,
             COALESCE(ev.given_base, 0)   AS given_base,
             ${(0, delivery_pending_sql_1.eligibleLineExpr)()} AS eligible
        FROM sales.sale_bill_item i
        ${keyJoin}
        JOIN sales.sale_bill b ON b.sb_id = i.sbi_bill_id AND b.sb_acc_year = i.sbi_acc_year
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = i.sbi_item_unit_id
        LEFT JOIN LATERAL ${(0, delivery_pending_sql_1.lineEventSumsLateral)()} ev ON true
       WHERE true ${extra}
       ORDER BY b.sb_acc_year, b.sb_id, i.sbi_line_no, i.sbi_split_no`;
        return rows.map(toFacts);
    }
    async bndByHolding(client, scope) {
        const c = client ?? this.prisma;
        const rows = await c.$queryRaw `
      WITH op AS (${(0, delivery_pending_sql_1.pendingLinesCte)(scope.companyId, scope.branchId, narrow(scope))})
      SELECT op.godown_id, op.item_id, op.lot_id, op.bucket, SUM(op.pending_base) AS bnd_base
        FROM op
       GROUP BY op.godown_id, op.item_id, op.lot_id, op.bucket
      HAVING SUM(op.pending_base) <> 0`;
        return rows.map((r) => ({
            godownId: r.godown_id,
            itemId: r.item_id,
            lotId: r.lot_id,
            bucket: r.bucket,
            bndBase: dec(r.bnd_base),
        }));
    }
    async bndBills(client, scope) {
        const c = client ?? this.prisma;
        const rows = await c.$queryRaw `
      WITH op AS (${(0, delivery_pending_sql_1.pendingLinesCte)(scope.companyId, scope.branchId, narrow(scope))})
      SELECT op.* FROM op
       ORDER BY op.bill_date, op.bill_refno, op.line_no`;
        return rows.map((r) => ({
            billId: r.bill_id,
            billAccYear: r.bill_acc_year.trim(),
            billRefno: r.bill_refno,
            billDate: ymd(r.bill_date),
            custId: r.cust_id,
            custName: r.cust_name,
            deliveryMode: r.delivery_mode,
            billItemId: r.line_id,
            lineNo: r.line_no,
            godownId: r.godown_id,
            itemId: r.item_id,
            lotId: r.lot_id,
            bucket: r.bucket,
            unitId: r.unit_id,
            billedQty: dec(r.billed_qty),
            givenQty: dec(r.given_qty),
            pendingQty: dec(r.pending_qty),
            pendingBase: dec(r.pending_base),
            factor: dec(r.factor),
            unitKg: dec(r.unit_kg),
        }));
    }
};
exports.DeliveryPendingService = DeliveryPendingService;
exports.DeliveryPendingService = DeliveryPendingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DeliveryPendingService);
function narrow(scope) {
    const parts = [];
    if (scope.godownIds && scope.godownIds.length > 0) {
        parts.push(client_1.Prisma.sql `AND i.sbi_godown_id = ANY(${[...scope.godownIds]}::uuid[])`);
    }
    if (scope.itemIds && scope.itemIds.length > 0) {
        parts.push(client_1.Prisma.sql `AND i.sbi_item_id = ANY(${[...scope.itemIds]}::uuid[])`);
    }
    if (scope.lotIds && scope.lotIds.length > 0) {
        parts.push(client_1.Prisma.sql `AND i.sbi_lot_id = ANY(${[...scope.lotIds]}::uuid[])`);
    }
    if (scope.bucket) {
        parts.push(client_1.Prisma.sql `AND COALESCE(i.sbi_bucket, 'SALEABLE') = ${scope.bucket}`);
    }
    return parts.length > 0 ? client_1.Prisma.join(parts, ' ') : client_1.Prisma.empty;
}
function toFacts(r) {
    const billed = dec(r.billed_qty);
    const settled = dec(r.settled_qty);
    const factor = dec(r.factor);
    const pending = billed.minus(settled);
    return {
        billItemId: r.sbi_id,
        billAccYear: r.sbi_acc_year.trim(),
        billId: r.sb_id,
        billRefno: r.sb_bill_refno,
        billDate: ymd(r.sb_bill_date),
        companyId: r.sb_company_id,
        branchId: r.sb_branch_id,
        billStatus: r.sb_status,
        billDeleted: r.sb_is_deleted,
        billMode: r.sb_bill_mode,
        deliveryMode: r.sb_delivery_mode,
        deliveryStatus: r.sb_delivery_status,
        custId: r.sb_cust_id,
        custName: r.sb_cust_name,
        lineNo: r.sbi_line_no,
        splitNo: r.sbi_split_no ?? 1,
        lineDeleted: r.sbi_is_deleted,
        isService: r.sbi_is_service,
        srcDocType: r.sbi_src_doc_type,
        srcDocRefno: r.sbi_src_doc_refno,
        itemId: r.sbi_item_id,
        unitId: r.sbi_item_unit_id,
        godownId: r.sbi_godown_id,
        lotId: r.sbi_lot_id,
        bucket: r.bucket,
        billedQty: billed,
        factor,
        unitKg: dec(r.unit_kg),
        settledQty: settled,
        givenQty: dec(r.given_qty),
        pendingQty: pending,
        settledBase: dec(r.settled_base),
        givenBase: dec(r.given_base),
        pendingBase: pending.times(factor),
        eligible: r.eligible === true,
    };
}
function dec(v) {
    if (v === null || v === undefined || v === '') {
        return D0;
    }
    return v instanceof client_1.Prisma.Decimal ? v : new client_1.Prisma.Decimal(v);
}
function ymd(d) {
    if (!d) {
        return null;
    }
    if (typeof d === 'string') {
        return d.slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=delivery-pending.service.js.map