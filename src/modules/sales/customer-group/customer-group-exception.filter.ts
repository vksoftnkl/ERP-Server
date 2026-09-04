import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  CustomerGroupErrorDetail,
  CustomerGroupErrorResponse,
} from './types/customer-group-api.types';

@Catch()
export class CustomerGroupExceptionFilter extends SalesExceptionFilter<
  CustomerGroupErrorDetail,
  CustomerGroupErrorResponse
> {
  constructor() {
    super(/\b(cgr[A-Za-z0-9]+)\b/);
  }
}
