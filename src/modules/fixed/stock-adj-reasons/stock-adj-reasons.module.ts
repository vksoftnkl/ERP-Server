import { Module } from '@nestjs/common';
import { StockAdjReasonsController } from './stock-adj-reasons.controller';
import { StockAdjReasonsService } from './stock-adj-reasons.service';

@Module({
  controllers: [StockAdjReasonsController],
  providers: [StockAdjReasonsService],
})
export class StockAdjReasonsModule {}
