import { Module } from '@nestjs/common';
import { PhysicalStockService } from './physical-stock.service';
import { PhysicalStockController } from './physical-stock.controller';
import { PhysicalStockExceptionFilter } from './physical-stock-exception.filter';
@Module({
  controllers: [PhysicalStockController],
  providers: [PhysicalStockService, PhysicalStockExceptionFilter],
})
export class PhysicalStockModule {}
