import { Module } from '@nestjs/common';
import { PhysicalStockService } from './physical-stock.service';
import { PhysicalStockController } from './physical-stock.controller';

@Module({
  controllers: [PhysicalStockController],
  providers: [PhysicalStockService],
})
export class PhysicalStockModule {}
