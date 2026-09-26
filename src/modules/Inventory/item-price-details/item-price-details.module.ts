import { Module } from '@nestjs/common';
import { ItemPriceDetailExceptionFilter } from './item-price-detail-exception.filter';
import { ItemPriceDetailsController } from './item-price-details.controller';
import { ItemPriceDetailsService } from './item-price-details.service';
import { ItemUnitConversionModule } from '../item-unit-conversion/item-unit-conversion.module';
@Module({
  // The response embeds the item's unit conversions: a price row points at one
  // and carries none of its shape (see ItemPriceDetailPayload).
  imports: [ItemUnitConversionModule],
  controllers: [ItemPriceDetailsController],
  providers: [ItemPriceDetailsService, ItemPriceDetailExceptionFilter],
})
export class ItemPriceDetailsModule {}
