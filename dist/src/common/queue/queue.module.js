"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../../database/prisma/prisma.module");
const audit_log_archival_processor_1 = require("./processors/audit-log-archival.processor");
const stock_reconciliation_processor_1 = require("./processors/stock-reconciliation.processor");
const queue_constants_1 = require("./queue.constants");
const queue_service_1 = require("./queue.service");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const redisUrl = process.env.REDIS_URL?.trim();
                    if (redisUrl) {
                        return { connection: { url: redisUrl } };
                    }
                    return {
                        connection: {
                            host: process.env.REDIS_HOST ?? config.get('redis.host', '127.0.0.1'),
                            port: Number(process.env.REDIS_PORT ?? config.get('redis.port', 6379)),
                            username: process.env.REDIS_USERNAME ?? config.get('redis.username', ''),
                            password: process.env.REDIS_PASSWORD ?? config.get('redis.password', ''),
                            db: Number(process.env.REDIS_DB ?? config.get('redis.db', 0)),
                        },
                    };
                },
            }),
            bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUE_NAMES.AUDIT_LOG_ARCHIVAL }, { name: queue_constants_1.QUEUE_NAMES.STOCK_RECONCILIATION }),
            prisma_module_1.PrismaModule,
        ],
        providers: [queue_service_1.QueueService, audit_log_archival_processor_1.AuditLogArchivalProcessor, stock_reconciliation_processor_1.StockReconciliationProcessor],
        exports: [bullmq_1.BullModule, queue_service_1.QueueService],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map