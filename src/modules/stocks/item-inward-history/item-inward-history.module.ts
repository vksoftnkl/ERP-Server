import { Module } from '@nestjs/common';
import { ItemInwardHistoryController } from './item-inward-history.controller';
import { ItemInwardHistoryService } from './item-inward-history.service';

/** Plan 2026-10-23 §3.2 — `GET /stock/item-inward-history`, the quick rate popup's "Recent inward". */
@Module({
  controllers: [ItemInwardHistoryController],
  providers: [ItemInwardHistoryService],
})
export class ItemInwardHistoryModule {}
