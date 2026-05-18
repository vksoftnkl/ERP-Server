import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { BankListErrorDetail, BankListErrorResponse } from './types/bank-list-api.types';

@Catch()
export class BankListExceptionFilter extends FixedExceptionFilter<
  BankListErrorDetail,
  BankListErrorResponse
> {
  constructor() {
    super(/\b(bnk[A-Za-z0-9]+)\b/);
  }
}
