import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from '../utils/sales-exception-filter.utils';
import { CustomerErrorDetail, CustomerErrorResponse } from './types/customer-api.types';

@Catch()
export class CustomerExceptionFilter extends SalesExceptionFilter<
  CustomerErrorDetail,
  CustomerErrorResponse
> {
  constructor() {
    super(/\b(cus[A-Za-z0-9]+)\b/);
  }
}
