import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from '../utils/inventory-exception-filter.utils';
import { ItemTaxHistoryErrorDetail, ItemTaxHistoryErrorResponse } from './types/item-tax-history-api.types';

@Catch()
export class ItemTaxHistoryExceptionFilter extends InventoryExceptionFilter<ItemTaxHistoryErrorDetail, ItemTaxHistoryErrorResponse> {
  constructor() { super(/\b(ith_[a-z0-9_]+)\b/i); }
}
