import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  ItemQtyPriceErrorDetail,
  ItemQtyPriceErrorResponse,
} from './types/item-qty-price-api.types';

@Catch()
export class ItemQtyPriceExceptionFilter extends InventoryExceptionFilter<
  ItemQtyPriceErrorDetail,
  ItemQtyPriceErrorResponse
> {
  constructor() {
    super(/\b(iqp_[a-z0-9_]+)\b/i);
  }
}
