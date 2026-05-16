import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from '../utils/inventory-exception-filter.utils';
import { ItemEanCodeErrorDetail, ItemEanCodeErrorResponse } from './types/item-ean-code-api.types';

@Catch()
export class ItemEanCodeExceptionFilter extends InventoryExceptionFilter<ItemEanCodeErrorDetail, ItemEanCodeErrorResponse> {
  constructor() { super(/\b(ean_[a-z0-9_]+)\b/i); }
}
