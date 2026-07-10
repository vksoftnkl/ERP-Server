import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  ItemPriceLookupErrorDetail,
  ItemPriceLookupErrorResponse,
} from './types/item-price-lookup-api.types';
@Catch()
export class ItemPriceLookupExceptionFilter extends InventoryExceptionFilter<
  ItemPriceLookupErrorDetail,
  ItemPriceLookupErrorResponse
> {
  constructor() {
    super(/\b(item_id|unit_id|branch_id|company_id|customer_id|acccyear|price_level|quantity)\b/i);
  }
}
