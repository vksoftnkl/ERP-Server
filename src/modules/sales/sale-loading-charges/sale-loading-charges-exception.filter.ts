import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  SaleLoadingChargeErrorDetail,
  SaleLoadingChargeErrorResponse,
} from './types/sale-loading-charges-api.types';

@Catch()
export class SaleLoadingChargeExceptionFilter extends SalesExceptionFilter<
  SaleLoadingChargeErrorDetail,
  SaleLoadingChargeErrorResponse
> {
  constructor() {
    super(/\b(ilc[A-Za-z0-9]+)\b/);
  }
}
