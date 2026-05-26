import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  ItemQtywiseRateErrorDetail,
  ItemQtywiseRateErrorResponse,
} from './types/item-qtywise-rate-api.types';

@Catch()
export class ItemQtywiseRateExceptionFilter extends InventoryExceptionFilter<
  ItemQtywiseRateErrorDetail,
  ItemQtywiseRateErrorResponse
> {
  constructor() {
    super(/\b(iqr_[a-z0-9_]+)\b/i);
  }
}
