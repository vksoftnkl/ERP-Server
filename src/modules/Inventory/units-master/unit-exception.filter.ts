import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { UnitErrorDetail, UnitErrorResponse } from './types/unit-api.types';

@Catch()
export class UnitExceptionFilter extends InventoryExceptionFilter<
  UnitErrorDetail,
  UnitErrorResponse
> {
  constructor() {
    super(/\b(unit_[a-z0-9_]+)\b/i);
  }
}
