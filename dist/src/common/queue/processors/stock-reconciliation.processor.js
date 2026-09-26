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
var StockReconciliationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockReconciliationProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const queue_constants_1 = require("../queue.constants");
let StockReconciliationProcessor = StockReconciliationProcessor_1 = class StockReconciliationProcessor extends bullmq_1.WorkerHost {
    prisma;
    logger = new common_1.Logger(StockReconciliationProcessor_1.name);
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        const { accYear, companyId, branchId, itemId } = job.data;
        this.logger.log(`Starting stock reconciliation — year: ${accYear}, company: ${companyId}` +
            (branchId ? `, branch: ${branchId}` : '') +
            (itemId ? `, item: ${itemId}` : ''));
        const batchStocks = await this.prisma.itemBatchStock.findMany({
            where: {
                ibsAccYear: accYear,
                ibsCompanyId: companyId,
                ...(branchId ? { ibsBranchId: branchId } : {}),
                ...(itemId ? { ibsItemId: itemId } : {}),
            },
            select: {
                ibsId: true,
                ibsItemId: true,
                ibsBranchId: true,
                ibsGodownId: true,
                ibsBatchId: true,
                ibsBatchNo: true,
                ibsStockBucket: true,
                ibsClosingQty: true,
            },
        });
        const mismatches = [];
        for (let i = 0; i < batchStocks.length; i++) {
            const stock = batchStocks[i];
            const ledgerAgg = await this.prisma.itemStockLedger.aggregate({
                where: {
                    stlAccYear: accYear,
                    stlCompanyId: companyId,
                    stlBranchId: stock.ibsBranchId,
                    stlGodownId: stock.ibsGodownId,
                    stlItemId: stock.ibsItemId,
                    stlBatchId: stock.ibsBatchId,
                },
                _sum: { stlBaseQty: true },
            });
            const ledgerNetQty = Number(ledgerAgg._sum?.stlBaseQty ?? 0);
            const batchClosingQty = Number(stock.ibsClosingQty ?? 0);
            const delta = batchClosingQty - ledgerNetQty;
            if (Math.abs(delta) > 0.000001) {
                mismatches.push({
                    ibsId: stock.ibsId,
                    itemId: stock.ibsItemId,
                    batchId: stock.ibsBatchId,
                    branchId: stock.ibsBranchId,
                    godownId: stock.ibsGodownId,
                    stockBucket: stock.ibsStockBucket,
                    batchClosingQty,
                    ledgerNetQty,
                    delta,
                });
            }
            if (i % 100 === 0) {
                await job.updateProgress(Math.round((i / batchStocks.length) * 100));
            }
        }
        if (mismatches.length > 0) {
            this.logger.warn(`Reconciliation found ${mismatches.length} mismatch(es) out of ${batchStocks.length} records`);
        }
        else {
            this.logger.log(`Reconciliation complete. All ${batchStocks.length} records match.`);
        }
        return { checked: batchStocks.length, mismatches };
    }
};
exports.StockReconciliationProcessor = StockReconciliationProcessor;
exports.StockReconciliationProcessor = StockReconciliationProcessor = StockReconciliationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_NAMES.STOCK_RECONCILIATION),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockReconciliationProcessor);
//# sourceMappingURL=stock-reconciliation.processor.js.map