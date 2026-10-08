import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { TxnHoldErrorDetail, TxnHoldErrorResponse } from './types/txn-hold-api.types';

@Catch()
export class TxnHoldExceptionFilter extends SalesExceptionFilter<
  TxnHoldErrorDetail,
  TxnHoldErrorResponse
> {
  constructor() {
    super(/\b(txh[A-Za-z0-9]+)\b/);
  }
}
