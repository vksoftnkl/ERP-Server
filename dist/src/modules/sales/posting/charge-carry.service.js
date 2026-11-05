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
exports.ChargeCarryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const posting_types_1 = require("./types/posting.types");
const sales_errors_1 = require("./sales.errors");
let ChargeCarryService = class ChargeCarryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async propose(tx, order, billLines, opts = {}) {
        const charges = await tx.$queryRaw `
      SELECT cd_id, cd_acc_year, cd_chg_id, cd_chg_name,
             cd_amount, cd_carried_amt, cd_carry_basis
        FROM public.txn_charge_detail
       WHERE cd_doc_type  = 'ORDER'
         AND cd_doc_id    = ${order.orderId}::uuid
         AND cd_acc_year  = ${order.accYear}::char(9)
         AND cd_is_deleted = false
       ORDER BY cd_slno`;
        if (charges.length === 0) {
            return [];
        }
        const [totals] = await tx.$queryRaw `
      SELECT SUM(soi_taxable_amt) AS order_taxable
        FROM sales.sale_order_item
       WHERE soi_order_id  = ${order.orderId}::uuid
         AND soi_acc_year  = ${order.accYear}::char(9)
         AND soi_is_deleted = false`;
        const orderTaxable = Number(totals?.order_taxable ?? 0);
        const billTaxable = billLines.reduce((s, l) => s + l.taxableAmt, 0);
        const takenLineIds = billLines.map((l) => l.srcLineId);
        const [open] = await tx.$queryRaw `
      SELECT COUNT(*) AS n
        FROM sales.sale_order_item
       WHERE soi_order_id   = ${order.orderId}::uuid
         AND soi_acc_year   = ${order.accYear}::char(9)
         AND soi_is_deleted = false
         AND NOT (soi_id = ANY(${takenLineIds}::uuid[]))`;
        const completesOrder = Number(open?.n ?? 0) === 0;
        return charges.map((c) => {
            const amount = Number(c.cd_amount);
            const carried = Number(c.cd_carried_amt ?? 0);
            const remaining = round2(amount - carried);
            const basis = (c.cd_carry_basis ?? opts.defaultBasis ?? 'PRORATA');
            let proposed = 0;
            switch (basis) {
                case 'FULL':
                    proposed = remaining;
                    break;
                case 'NONE':
                case 'MANUAL':
                    proposed = 0;
                    break;
                default:
                    proposed = completesOrder
                        ? remaining
                        : Math.min(remaining, orderTaxable > 0 ? round2((amount * billTaxable) / orderTaxable) : 0);
            }
            return {
                srcChargeId: c.cd_id,
                srcAccYear: c.cd_acc_year,
                chargeId: c.cd_chg_id,
                chargeName: c.cd_chg_name,
                amount,
                alreadyCarried: carried,
                remaining,
                basis,
                proposed: Math.max(0, proposed),
                completesOrder,
            };
        });
    }
    async consume(tx, rows, opts = {}) {
        const carrying = rows.filter((r) => r.srcChargeId && r.amount !== 0);
        if (carrying.length === 0) {
            return 0;
        }
        return this.move(tx, carrying, +1, opts.canOverride ?? false);
    }
    async release(tx, rows) {
        const carrying = rows.filter((r) => r.srcChargeId && r.amount !== 0);
        if (carrying.length === 0) {
            return 0;
        }
        return this.move(tx, carrying, -1, true);
    }
    async move(tx, rows, sign, canOverride) {
        const ids = [...new Set(rows.map((r) => r.srcChargeId))].sort();
        const locked = await tx.$queryRaw `
      SELECT cd_id, cd_amount, cd_carried_amt
        FROM public.txn_charge_detail
       WHERE cd_id = ANY(${ids}::uuid[])
       ORDER BY cd_id
         FOR UPDATE`;
        const byId = new Map(locked.map((l) => [l.cd_id, l]));
        const delta = new Map();
        for (const r of rows) {
            delta.set(r.srcChargeId, round2((delta.get(r.srcChargeId) ?? 0) + sign * r.amount));
        }
        if (sign > 0 && !canOverride) {
            for (const [id, d] of delta) {
                const src = byId.get(id);
                if (!src) {
                    continue;
                }
                const after = round2(Number(src.cd_carried_amt ?? 0) + d);
                if (after > Number(src.cd_amount) + 1e-9) {
                    (0, sales_errors_1.throwSalesRefused)(`Charge ${id} carries ${after} of an order charge of ${Number(src.cd_amount)} — ` +
                        `the difference would be collected twice`, posting_types_1.SALES_ERROR_CODES.CHARGE_OVER_CARRY, 'charges');
                }
            }
        }
        let touched = 0;
        for (const [id, d] of delta) {
            touched += await tx.$executeRaw `
        UPDATE public.txn_charge_detail
           SET cd_carried_amt = COALESCE(cd_carried_amt, 0) + ${d.toFixed(2)}::numeric,
               cd_modified_on = now()
         WHERE cd_id = ${id}::uuid`;
        }
        return touched;
    }
};
exports.ChargeCarryService = ChargeCarryService;
exports.ChargeCarryService = ChargeCarryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChargeCarryService);
function round2(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
//# sourceMappingURL=charge-carry.service.js.map