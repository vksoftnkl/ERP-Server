import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { CityErrorDetail, CityErrorResponse } from './types/city-api.types';

@Catch()
export class CityExceptionFilter extends SalesExceptionFilter<CityErrorDetail, CityErrorResponse> {
  constructor() {
    super(/\b(ctm[A-Za-z0-9]+)\b/);
  }
}
