import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  LedgerBankAccountErrorDetail,
  LedgerBankAccountErrorResponse,
} from './types/ledger-bank-account-api.types';
@Catch()
export class LedgerBankAccountExceptionFilter extends AccountsExceptionFilter<
  LedgerBankAccountErrorDetail,
  LedgerBankAccountErrorResponse
> {
  constructor() {
    super(/\b(lba[A-Za-z0-9]+)\b/);
  }
}
