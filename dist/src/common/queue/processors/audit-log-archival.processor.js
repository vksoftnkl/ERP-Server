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
var AuditLogArchivalProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogArchivalProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const queue_constants_1 = require("../queue.constants");
let AuditLogArchivalProcessor = AuditLogArchivalProcessor_1 = class AuditLogArchivalProcessor extends bullmq_1.WorkerHost {
    prisma;
    logger = new common_1.Logger(AuditLogArchivalProcessor_1.name);
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        const { olderThanDays, batchSize = 1000 } = job.data;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        this.logger.log(`Archiving audit logs older than ${olderThanDays} days (before ${cutoff.toISOString()})`);
        let totalDeleted = 0;
        let batch;
        do {
            const rows = await this.prisma.auditLog.findMany({
                where: { logDate: { lt: cutoff } },
                select: { logId: true },
                take: batchSize,
            });
            if (rows.length === 0)
                break;
            const ids = rows.map((r) => r.logId);
            const result = await this.prisma.auditLog.deleteMany({
                where: { logId: { in: ids } },
            });
            batch = result.count;
            totalDeleted += batch;
            await job.updateProgress(totalDeleted);
            this.logger.log(`Deleted batch of ${batch} records (total: ${totalDeleted})`);
        } while (batch === batchSize);
        this.logger.log(`Audit log archival complete. Total deleted: ${totalDeleted}`);
        return { deleted: totalDeleted };
    }
};
exports.AuditLogArchivalProcessor = AuditLogArchivalProcessor;
exports.AuditLogArchivalProcessor = AuditLogArchivalProcessor = AuditLogArchivalProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUE_NAMES.AUDIT_LOG_ARCHIVAL),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogArchivalProcessor);
//# sourceMappingURL=audit-log-archival.processor.js.map