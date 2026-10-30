import { Module } from '@nestjs/common';
import { ItemBatchStockController } from './itemBatchStockController';
import { ItemBatchStockExceptionFilter } from './itemBatchStockExceptionFilter';
import { ItemBatchStockService } from './itemBatchStockService';
@Module({
  controllers: [ItemBatchStockController],
  providers: [ItemBatchStockService, ItemBatchStockExceptionFilter],
})
export class ItemBatchStockModule {}
