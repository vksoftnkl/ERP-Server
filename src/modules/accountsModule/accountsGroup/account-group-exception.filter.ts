import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from '../utils/accounts-exception-filter.utils';
import { AccountGroupErrorDetail, AccountGroupErrorResponse } from './types/account-group-api.types';
@Catch()
export class AccountGroupExceptionFilter extends AccountsExceptionFilter<
  AccountGroupErrorDetail,
  AccountGroupErrorResponse
> {
  constructor() { super(/\b(accGroup[a-zA-Z0-9]+)\b/); }
}
