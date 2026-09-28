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
const stock_balance_assertion_1 = require("../../../modules/stocks/posting/stock-balance-assertion");
const queue_constants_1 = require("../queue.constants");
let StockReconciliationProcessor = StockReconciliationProcessor_1 = class StockReconciliationProcessor extends bullmq_1.WorkerHost {
    prisma;
    logger = new common_1.Logger(StockReconciliationProcessor_1.name);
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        const { companyId, branchId, itemId } = job.data;
        this.logger.log(`Stock balance assertion — company: ${companyId}` +
            (branchId ? `, branch: ${branchId}` : '') +
            (itemId ? `, item: ${itemId}` : ''));
        const findings = await (0, stock_balance_assertion_1.assertStockBalances)(this.prisma, { companyId, branchId, itemId });
        const byKind = {};
        for (const f of findings) {
            byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
        }
        if (findings.length > 0) {
            this.logger.warn(`Stock balance assertion found ${findings.length} disagreement(s): ` +
                Object.entries(byKind)
                    .map(([kind, n]) => `${kind}=${n}`)
                    .join(', '));
            for (const f of findings.slice(0, 50)) {
                this.logger.warn(`  ${f.kind} item ${f.itemId} lot ${f.lotId ?? '-'} godown ${f.godownId ?? '-'} ${f.bucket ?? ''}: stored ${f.stored}, derived ${f.derived}`);
            }
        }
        else {
            this.logger.log('Stock balance assertion: every derived figure agrees with its source.');
        }
        await job.updateProgress(100);
        return { findings, byKind };
    }
};
exports.StockReconciliationProcessor = StockReconciliationProcessor;
exports.StockReconciliationProcessor = StockReconciliationProcessor = StockReconciliationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_NAMES.STOCK_RECONCILIATION),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockReconciliationProcessor);
//# sourceMappingURL=stock-reconciliation.processor.js.map