import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from '../utils/inventory-exception-filter.utils';
import { ItemTaxErrorDetail, ItemTaxErrorResponse } from './types/item-tax-api.types';

@Catch()
export class ItemTaxExceptionFilter extends InventoryExceptionFilter<ItemTaxErrorDetail, ItemTaxErrorResponse> {
  constructor() { super(/\b(tax_[a-z0-9_]+)\b/i); }
}
