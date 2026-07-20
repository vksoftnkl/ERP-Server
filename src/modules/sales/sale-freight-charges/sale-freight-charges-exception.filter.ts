import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  SaleFreightChargeErrorDetail,
  SaleFreightChargeErrorResponse,
} from './types/sale-freight-charges-api.types';

@Catch()
export class SaleFreightChargeExceptionFilter extends SalesExceptionFilter<
  SaleFreightChargeErrorDetail,
  SaleFreightChargeErrorResponse
> {
  constructor() {
    super(/\b(fr[A-Za-z0-9]+)\b/);
  }
}
