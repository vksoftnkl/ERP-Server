import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  OpeningBalanceErrorDetail,
  OpeningBalanceErrorResponse,
} from './types/opening-balance-api.types';

@Catch()
export class OpeningBalanceExceptionFilter extends AccountsExceptionFilter<
  OpeningBalanceErrorDetail,
  OpeningBalanceErrorResponse
> {
  constructor() {
    // The field names this module reports on: the opening's own op*, the bill
    // rows' abl*, and the few scope keys the endpoints take.
    super(/\b(op[A-Z][a-zA-Z0-9]*|abl[A-Z][a-zA-Z0-9]*|companyId|branchId|accYear|partyId|fromAccYear|toAccYear)\b/);
  }
}
