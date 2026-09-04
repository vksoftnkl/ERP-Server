import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemReorderErrorDetail, ItemReorderErrorResponse } from './types/item-reorder-api.types';

@Catch()
export class ItemReorderExceptionFilter extends InventoryExceptionFilter<
  ItemReorderErrorDetail,
  ItemReorderErrorResponse
> {
  constructor() {
    super(/\b(ir_[a-z0-9_]+)\b/i);
  }
}
