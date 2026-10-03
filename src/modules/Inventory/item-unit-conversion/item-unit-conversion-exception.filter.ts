import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  ItemUnitConversionErrorDetail,
  ItemUnitConversionErrorResponse,
} from './types/item-unit-conversion-api.types';

@Catch()
export class ItemUnitConversionExceptionFilter extends InventoryExceptionFilter<
  ItemUnitConversionErrorDetail,
  ItemUnitConversionErrorResponse
> {
  constructor() {
    super(/\b(iuc_[a-z0-9_]+)\b/i);
  }
}
