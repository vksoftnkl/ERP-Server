import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemSectionErrorDetail, ItemSectionErrorResponse } from './types/item-section-api.types';

@Catch()
export class ItemSectionExceptionFilter extends InventoryExceptionFilter<ItemSectionErrorDetail, ItemSectionErrorResponse> {
  constructor() { super(/\b(sec_[a-z0-9_]+)\b/i); }
}
