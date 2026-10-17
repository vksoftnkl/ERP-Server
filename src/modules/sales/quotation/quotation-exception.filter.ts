import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { QuotationErrorDetail, QuotationErrorResponse } from './types/quotation-api.types';

// Field prefixes reachable from a quotation request: the header (sq*), its line
// items (sqi*, reported by class-validator as `items.0.sqiX`) and the applied
// charge lines (cd*, reported as `charges.0.cdX`). sq[A-Za-z0-9]+ already covers
// sqi*, so the alternation only needs the two roots.
@Catch()
export class QuotationExceptionFilter extends SalesExceptionFilter<
  QuotationErrorDetail,
  QuotationErrorResponse
> {
  constructor() {
    super(/\b((?:sq|cd)[A-Za-z0-9]+)\b/);
  }
}
