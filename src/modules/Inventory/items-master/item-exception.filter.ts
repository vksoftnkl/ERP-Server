import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemErrorDetail, ItemErrorResponse } from './types/item-api.types';

@Catch()
export class ItemExceptionFilter extends InventoryExceptionFilter<
  ItemErrorDetail,
  ItemErrorResponse
> {
  constructor() {
    super(/\b(item_[a-z0-9_]+)\b/i);
  }
}
