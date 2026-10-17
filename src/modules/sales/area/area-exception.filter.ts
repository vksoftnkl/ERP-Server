import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { AreaErrorDetail, AreaErrorResponse } from './types/area-api.types';

@Catch()
export class AreaExceptionFilter extends SalesExceptionFilter<AreaErrorDetail, AreaErrorResponse> {
  constructor() {
    super(/\b(arm[A-Za-z0-9]+)\b/);
  }
}
