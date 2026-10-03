import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemBrandErrorDetail, ItemBrandErrorResponse } from './types/item-brand-api.types';

@Catch()
export class ItemBrandExceptionFilter extends InventoryExceptionFilter<
  ItemBrandErrorDetail,
  ItemBrandErrorResponse
> {
  constructor() {
    super(/\b(brand_[a-z0-9_]+)\b/i);
  }
}
