import { Module } from '@nestjs/common';
import { ItemStockBalanceController } from './itemStockBalanceController';
import { ItemStockBalanceExceptionFilter } from './itemStockBalanceExceptionFilter';
import { ItemStockBalanceService } from './itemstockBalanceService';
@Module({
  controllers: [ItemStockBalanceController],
  providers: [ItemStockBalanceService, ItemStockBalanceExceptionFilter],
})
export class ItemStockBalanceModule {}
