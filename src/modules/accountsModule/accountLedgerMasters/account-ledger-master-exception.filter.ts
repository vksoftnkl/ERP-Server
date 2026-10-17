import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  AccountLedgerMasterErrorDetail,
  AccountLedgerMasterErrorResponse,
} from './types/account-ledger-master-api.types';
@Catch()
export class AccountLedgerMasterExceptionFilter extends AccountsExceptionFilter<
  AccountLedgerMasterErrorDetail,
  AccountLedgerMasterErrorResponse
> {
  constructor() {
    super(/\b(led[A-Za-z0-9]+)\b/);
  }
}
