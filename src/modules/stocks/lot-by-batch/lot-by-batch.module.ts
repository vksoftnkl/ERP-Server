import { Module } from '@nestjs/common';
import { LotByBatchController } from './lot-by-batch.controller';
import { LotByBatchService } from './lot-by-batch.service';

/** Textile plan D5 — `GET /stock/lots/by-batch`, the sale bill's batch scan. */
@Module({
  controllers: [LotByBatchController],
  providers: [LotByBatchService],
})
export class LotByBatchModule {}
