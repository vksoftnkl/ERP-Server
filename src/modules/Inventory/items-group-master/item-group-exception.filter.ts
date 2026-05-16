import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from '../utils/inventory-exception-filter.utils';
import { ItemGroupErrorDetail, ItemGroupErrorResponse } from './types/item-group-api.types';

@Catch()
export class ItemGroupExceptionFilter extends InventoryExceptionFilter<ItemGroupErrorDetail, ItemGroupErrorResponse> {
  constructor() { super(/\b(itg_[a-z0-9_]+)\b/i); }
}
