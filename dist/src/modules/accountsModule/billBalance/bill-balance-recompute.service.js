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
            else if (row.abjAdjType === 'DISCOUNT') {
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
            select: { ablId: true, ablAccYear: true, ablBillAmount: true },
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
            await client.accBillBalance.update({
                where: { ablId_ablAccYear: { ablId: bill.ablId, ablAccYear: bill.ablAccYear } },
                data: {
                    ablAllocAmount: bucket.alloc.toDecimalPlaces(2),
                    ablDiscAmount: bucket.disc.toDecimalPlaces(2),
                    ablWriteoffAmount: bucket.writeoff.toDecimalPlaces(2),
                    ablSettledOn: settledOn,
                    ablModifiedOn: now,
                },
            });
            results.push({
                billId: bill.ablId,
                accYear: bill.ablAccYear,
                billAmount: bill.ablBillAmount,
                allocAmount: bucket.alloc.toDecimalPlaces(2),
                discAmount: bucket.disc.toDecimalPlaces(2),
                writeoffAmount: bucket.writeoff.toDecimalPlaces(2),
                pendingAmount: pending,
                settledOn,
            });
        }
        return results;
    }
    async regularisePostDated(asOf = new Date(), batchSize = 500) {
        const asOfDate = startOfDayUtc(asOf);
        const due = await this.prisma.accBillAdjustment.findMany({
            where: {
                abjIsPostDated: true,
                abjIsDeleted: false,
                abjAdjDate: { lte: asOfDate },
            },
            select: { abjBillId: true, abjBillAccYear: true },
            distinct: ['abjBillId', 'abjBillAccYear'],
        });
        const bills = due.map((row) => ({ billId: row.abjBillId, accYear: row.abjBillAccYear }));
        let count = 0;
        for (let offset = 0; offset < bills.length; offset += batchSize) {
            const batch = bills.slice(offset, offset + batchSize);
            await this.prisma.$transaction(async (tx) => {
                await this.recomputeBills(tx, batch, asOfDate);
            }, { maxWait: 10_000, timeout: 60_000 });
            count += batch.length;
        }
        this.logger.log(`Regularised ${count} bill(s) holding matured post-dated settlements as at ${asOfDate
            .toISOString()
            .slice(0, 10)}`);
        return { asOf: asOfDate.toISOString().slice(0, 10), billsRegularised: count };
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
function startOfDayUtc(value) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}
//# sourceMappingURL=bill-balance-recompute.service.js.map