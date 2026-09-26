import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { LedgerMapErrorDetail, LedgerMapErrorResponse } from './types/ledger-map-api.types';

/**
 * The field a class-validator message belongs to, recovered from its text.
 * `alm*` for the reserved columns the DTO refuses by name, plus the three
 * fields this API actually accepts.
 */
@Catch()
export class LedgerMapExceptionFilter extends AccountsExceptionFilter<
  LedgerMapErrorDetail,
  LedgerMapErrorResponse
> {
  constructor() {
    super(/\b(alm[A-Za-z0-9]+|ledgerId|role|isActive|remarks)\b/);
  }
}
