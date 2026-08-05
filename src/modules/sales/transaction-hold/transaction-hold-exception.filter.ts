import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  TransactionHoldErrorDetail,
  TransactionHoldErrorResponse,
} from './types/transaction-hold-api.types';

@Catch()
export class TransactionHoldExceptionFilter extends SalesExceptionFilter<
  TransactionHoldErrorDetail,
  TransactionHoldErrorResponse
> {
  constructor() {
    super(/\b(th[A-Za-z0-9]+)\b/);
  }
}
