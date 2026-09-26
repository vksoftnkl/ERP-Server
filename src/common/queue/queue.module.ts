import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuditLogArchivalProcessor } from './processors/audit-log-archival.processor';
import { StockReconciliationProcessor } from './processors/stock-reconciliation.processor';
import { QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = process.env.REDIS_URL?.trim();
        if (redisUrl) {
          return { connection: { url: redisUrl } };
        }
        return {
          connection: {
            host: process.env.REDIS_HOST ?? config.get<string>('redis.host', '127.0.0.1'),
            port: Number(process.env.REDIS_PORT ?? config.get<number>('redis.port', 6379)),
            username: process.env.REDIS_USERNAME ?? config.get<string>('redis.username', ''),
            password: process.env.REDIS_PASSWORD ?? config.get<string>('redis.password', ''),
            db: Number(process.env.REDIS_DB ?? config.get<number>('redis.db', 0)),
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AUDIT_LOG_ARCHIVAL },
      { name: QUEUE_NAMES.STOCK_RECONCILIATION },
    ),
    PrismaModule,
  ],
  providers: [QueueService, AuditLogArchivalProcessor, StockReconciliationProcessor],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
