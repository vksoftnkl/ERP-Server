import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemPriceErrorDetail, ItemPriceErrorResponse } from './types/item-price-api.types';

@Catch()
export class ItemPriceExceptionFilter extends InventoryExceptionFilter<
  ItemPriceErrorDetail,
  ItemPriceErrorResponse
> {
  constructor() {
    super(/\b(ipm_[a-z0-9_]+)\b/i);
  }
}
