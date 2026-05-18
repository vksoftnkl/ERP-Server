import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemEanCodeErrorDetail, ItemEanCodeErrorResponse } from './types/item-ean-code-api.types';

@Catch()
export class ItemEanCodeExceptionFilter extends InventoryExceptionFilter<ItemEanCodeErrorDetail, ItemEanCodeErrorResponse> {
  constructor() { super(/\b(ean_[a-z0-9_]+)\b/i); }
}
