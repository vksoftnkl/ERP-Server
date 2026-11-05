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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const queue_constants_1 = require("./queue.constants");
let QueueService = class QueueService {
    auditLogArchivalQueue;
    stockReconciliationQueue;
    constructor(auditLogArchivalQueue, stockReconciliationQueue) {
        this.auditLogArchivalQueue = auditLogArchivalQueue;
        this.stockReconciliationQueue = stockReconciliationQueue;
    }
    async scheduleAuditLogArchival(olderThanDays = 365, batchSize = 1000) {
        const job = await this.auditLogArchivalQueue.add('archival', { olderThanDays, batchSize }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
        return job.id ?? '';
    }
    async scheduleStockReconciliation(data) {
        const job = await this.stockReconciliationQueue.add('reconcile', data, {
            attempts: 2,
            backoff: { type: 'fixed', delay: 10000 },
        });
        return job.id ?? '';
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_NAMES.AUDIT_LOG_ARCHIVAL)),
    __param(1, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUE_NAMES.STOCK_RECONCILIATION)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        bullmq_2.Queue])
], QueueService);
//# sourceMappingURL=queue.service.js.map