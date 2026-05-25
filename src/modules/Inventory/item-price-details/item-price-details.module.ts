import { Module } from '@nestjs/common';
import { ItemPriceDetailExceptionFilter } from './item-price-detail-exception.filter';
import { ItemPriceDetailsController } from './item-price-details.controller';
import { ItemPriceDetailsService } from './item-price-details.service';
@Module({
  controllers: [ItemPriceDetailsController],
  providers: [ItemPriceDetailsService, ItemPriceDetailExceptionFilter],
})
export class ItemPriceDetailsModule {}
