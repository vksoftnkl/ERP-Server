import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { BillErrorDetail, BillErrorResponse } from './types/bill-api.types';

// Field prefixes reachable from a bill request: the header (sb*), its line
// items (sbi*, reported by class-validator as `items.0.sbiX`) and the applied
// charge lines (cd*, reported as `charges.0.cdX`). sb[A-Za-z0-9]+ already
// covers sbi*, so the alternation only needs the two roots.
@Catch()
export class BillExceptionFilter extends SalesExceptionFilter<BillErrorDetail, BillErrorResponse> {
  constructor() {
    super(/\b((?:sb|cd)[A-Za-z0-9]+)\b/);
  }
}
