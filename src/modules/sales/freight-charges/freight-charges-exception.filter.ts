import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { FreightChargesErrorDetail, FreightChargesErrorResponse } from './types/freight-charges-api.types';

@Catch()
export class FreightChargesExceptionFilter extends SalesExceptionFilter<
  FreightChargesErrorDetail,
  FreightChargesErrorResponse
> {
  constructor() {
    super(/\b(fr[A-Za-z0-9]+)\b/);
  }
}
