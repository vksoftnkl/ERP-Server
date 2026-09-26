import { Catch } from '@nestjs/common';
import { ModuleExceptionFilter } from 'src/common/utils/module-shared.utils';
import { TransactionErrorDetail, TransactionErrorResponse } from './types/transaction-api.types';

/**
 * The request fields are plain names rather than a column-prefixed set, so the
 * pattern names them literally — anything else infers `request`.
 */
@Catch()
export class TransactionExceptionFilter extends ModuleExceptionFilter<
  TransactionErrorDetail,
  TransactionErrorResponse
> {
  constructor() {
    super(/\b(partyId|companyId)\b/);
  }
}
