import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemGstUnitErrorDetail, ItemGstUnitErrorResponse } from './types/item-gst-unit-api.types';

@Catch()
export class ItemGstUnitExceptionFilter extends InventoryExceptionFilter<
  ItemGstUnitErrorDetail,
  ItemGstUnitErrorResponse
> {
  constructor() {
    super(/\b(item_gst_unit_[a-z0-9_]+)\b/i);
  }
}
