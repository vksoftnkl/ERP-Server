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
var BillBalanceRecomputeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillBalanceRecomputeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const ALLOCATING_TYPES = ['ALLOCATION', 'ADVANCE_ADJUST', 'NOTE_ADJUST', 'TRANSFER'];
const DISCOUNTING_TYPES = ['DISCOUNT', 'ROUND_OFF'];
const ZERO = new client_1.Prisma.Decimal(0);
let BillBalanceRecomputeService = BillBalanceRecomputeService_1 = class BillBalanceRecomputeService {
    prisma;
    logger = new common_1.Logger(BillBalanceRecomputeService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async recomputeBills(client, bills, asOf = new Date()) {
        const unique = dedupe(bills);
        if (unique.length === 0) {
            return [];
        }
        const asOfDate = startOfDayUtc(asOf);
        const adjustments = await client.accBillAdjustment.findMany({
            where: {
                abjIsDeleted: false,
                OR: unique.map((bill) => ({
                    abjBillId: bill.billId,
                    abjBillAccYear: bill.accYear,
                })),
            },
            select: {
                abjBillId: true,
                abjBillAccYear: true,
                abjAdjType: true,
                abjAmount: true,
                abjAdjDate: true,
                abjIsPostDated: true,
            },
        });
        const totals = new Map();
        for (const bill of unique) {
            totals.set(keyOf(bill), emptyTotals());
        }
        for (const row of adjustments) {
            if (row.abjIsPostDated && startOfDayUtc(row.abjAdjDate) > asOfDate) {
                continue;
            }
            const bucket = totals.get(keyOf({ billId: row.abjBillId, accYear: row.abjBillAccYear }));
            if (!bucket) {
                continue;
            }
            if (ALLOCATING_TYPES.includes(row.abjAdjType)) {
                bucket.alloc = bucket.alloc.plus(row.abjAmount);
            }
            else if (DISCOUNTING_TYPES.includes(row.abjAdjType)) {
                bucket.disc = bucket.disc.plus(row.abjAmount);
            }
            else if (row.abjAdjType === 'WRITEOFF') {
                bucket.writeoff = bucket.writeoff.plus(row.abjAmount);
            }
            if (bucket.lastOn === null || row.abjAdjDate > bucket.lastOn) {
                bucket.lastOn = row.abjAdjDate;
            }
        }
        const stored = await client.accBillBalance.findMany({
            where: {
                OR: unique.map((bill) => ({ ablId: bill.billId, ablAccYear: bill.accYear })),
            },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillAmount: true,
                ablAllocAmount: true,
                ablDiscAmount: true,
                ablWriteoffAmount: true,
                ablSettledOn: true,
            },
        });
        const now = new Date();
        const results = [];
        for (const bill of stored) {
            const bucket = totals.get(keyOf({ billId: bill.ablId, accYear: bill.ablAccYear }));
            if (!bucket) {
                continue;
            }
            const settled = bucket.alloc.plus(bucket.disc).plus(bucket.writeoff).toDecimalPlaces(2);
            const pending = bill.ablBillAmount.minus(settled).toDecimalPlaces(2);
            const settledOn = pending.lessThanOrEqualTo(0) ? bucket.lastOn : null;
            const alloc = bucket.alloc.toDecimalPlaces(2);
            const disc = bucket.disc.toDecimalPlaces(2);
            const writeoff = bucket.writeoff.toDecimalPlaces(2);
            const changed = !bill.ablAllocAmount.equals(alloc) ||
                !bill.ablDiscAmount.equals(disc) ||
                !bill.ablWriteoffAmount.equals(writeoff) ||
                sameDay(bill.ablSettledOn, settledOn) === false;
            if (changed) {
                await client.accBillBalance.update({
                    where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
                    data: {
                        ablAllocAmount: alloc,
                        ablDiscAmount: disc,
                        ablWriteoffAmount: writeoff,
                        ablSettledOn: settledOn,
                        ablModifiedOn: now,
                    },
                });
            }
            results.push({
                billId: bill.ablId,
                accYear: bill.ablAccYear,
                changed,
                billAmount: bill.ablBillAmount,
                allocAmount: alloc,
                discAmount: disc,
                writeoffAmount: writeoff,
                pendingAmount: pending,
                settledOn,
            });
        }
        if (unique.length > 0) {
            await client.$executeRaw `
        UPDATE accounts.acc_temp_credit t
           SET atc_balance_amount = LEAST(t.atc_credit_amount, GREATEST(0, b.abl_pending_amount)),
               atc_status = CASE
                              WHEN t.atc_status IN ('WRITTEN_OFF', 'CANCELLED') THEN t.atc_status
                              WHEN b.abl_pending_amount <= 0 THEN 'SETTLED'
                              WHEN b.abl_pending_amount < t.atc_credit_amount THEN 'PARTIAL'
                              ELSE 'OPEN' END,
               atc_settled_on = CASE WHEN b.abl_pending_amount <= 0 THEN COALESCE(t.atc_settled_on, ${asOfDate}::date) ELSE NULL END,
               atc_modified_on = ${now}
          FROM accounts.acc_bill_balance b
         WHERE b.abl_id = t.atc_abl_id AND b.abl_acc_year = t.atc_abl_acc_year
           AND t.atc_is_deleted = false
           AND (t.atc_abl_id, t.atc_abl_acc_year) IN (${client_1.Prisma.join(unique.map((u) => client_1.Prisma.sql `(${u.billId}::uuid, ${u.accYear}::char(9))`))})`;
        }
        return results;
    }
    async regularisePostDated(scope, asOf = new Date(), batchSize = 500) {
        const asOfDate = startOfDayUtc(asOf);
        const due = await this.prisma.accBillAdjustment.findMany({
            where: {
                abjCompanyId: scope.companyId,
                ...(scope.branchId ? { abjBranchId: scope.branchId } : {}),
                ...(scope.accYear ? { abjAccYear: scope.accYear } : {}),
                abjIsPostDated: true,
                abjIsDeleted: false,
                abjAdjDate: { lte: asOfDate },
            },
            select: { abjBillId: true, abjBillAccYear: true },
            distinct: ['abjBillId', 'abjBillAccYear'],
        });
        const bills = due.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear }));
        let examined = 0;
        let regularised = 0;
        for (let offset = 0; offset < bills.length; offset += batchSize) {
            const batch = bills.slice(offset, offset + batchSize);
            const moved = await this.prisma.$transaction(async (tx) => {
                const recomputed = await this.recomputeBills(tx, batch, asOfDate);
                return recomputed.filter((bill) => bill.changed).length;
            }, { maxWait: 10_000, timeout: 60_000 });
            examined += batch.length;
            regularised += moved;
        }
        this.logger.log(`Regularised ${regularised} of ${examined} bill(s) holding matured post-dated ` +
            `settlements as at ${asOfDate.toISOString().slice(0, 10)}`);
        return {
            asOf: asOfDate.toISOString().slice(0, 10),
            billsRegularised: regularised,
            billsExamined: examined,
        };
    }
};
exports.BillBalanceRecomputeService = BillBalanceRecomputeService;
exports.BillBalanceRecomputeService = BillBalanceRecomputeService = BillBalanceRecomputeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BillBalanceRecomputeService);
function emptyTotals() {
    return { alloc: ZERO, disc: ZERO, writeoff: ZERO, lastOn: null };
}
function keyOf(bill) {
    return `${bill.billId}|${bill.accYear}`;
}
function dedupe(bills) {
    const seen = new Map();
    for (const bill of bills) {
        seen.set(keyOf(bill), bill);
    }
    return [...seen.values()];
}
function sameDay(left, right) {
    if (left === null || right === null) {
        return left === right;
    }
    return startOfDayUtc(left).getTime() === startOfDayUtc(right).getTime();
}
function startOfDayUtc(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}
//# sourceMappingURL=bill-balance-recompute.service.js.map