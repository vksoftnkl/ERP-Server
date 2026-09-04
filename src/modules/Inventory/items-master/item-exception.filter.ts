import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemErrorDetail, ItemErrorResponse } from './types/item-api.types';

@Catch()
export class ItemExceptionFilter extends InventoryExceptionFilter<
  ItemErrorDetail,
  ItemErrorResponse
> {
  constructor() {
    // Also matches child-collection field prefixes surfaced by POST /items/create
    // when it saves unit conversions (iuc_), prices (ipm_), EAN codes (ean_) and
    // reorders (ir_), so nested validation errors keep their real field name.
    super(/\b((?:item|iuc|ipm|ean|ir)_[a-z0-9_]+)\b/i);
  }
}
