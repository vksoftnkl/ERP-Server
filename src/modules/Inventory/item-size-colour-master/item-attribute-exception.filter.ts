import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { InventoryErrorResponse } from 'src/common/types/module-api.types';
import type { ItemAttributeErrorDetail } from './types/item-attribute-master.types';

@Catch()
export class ItemAttributeExceptionFilter extends InventoryExceptionFilter<
  ItemAttributeErrorDetail,
  InventoryErrorResponse<ItemAttributeErrorDetail>
> {
  constructor() {
    super(/\b((?:isz|icl)_[a-z0-9_]+)\b/i);
  }
}
