import { Module } from '@nestjs/common';
import { ItemPriceLookupExceptionFilter } from './item-price-lookup-exception.filter';
import { ItemPriceLookupController } from './item-price-lookup.controller';
import { ItemPriceLookupService } from './item-price-lookup.service';
@Module({
  controllers: [ItemPriceLookupController],
  providers: [ItemPriceLookupService, ItemPriceLookupExceptionFilter],
})
export class ItemPriceLookupModule {}
