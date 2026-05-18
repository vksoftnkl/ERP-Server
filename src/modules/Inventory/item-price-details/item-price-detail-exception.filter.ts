import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemPriceDetailErrorDetail, ItemPriceDetailErrorResponse } from './types/item-price-detail-api.types';

@Catch()
export class ItemPriceDetailExceptionFilter extends InventoryExceptionFilter<ItemPriceDetailErrorDetail, ItemPriceDetailErrorResponse> {
  constructor() { super(/\b(item_id)\b/i); }
}
