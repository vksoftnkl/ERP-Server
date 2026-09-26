import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { BillErrorDetail, BillErrorResponse } from './types/bill-api.types';

// Field prefixes reachable from a bill request: the header (sb*), its line
// items (sbi*, reported by class-validator as `items.0.sbiX`), the applied
// charge lines (cd*, reported as `charges.0.cdX`) and the tendered amounts
// (td*, reported as `tenders.0.tdX`). sb[A-Za-z0-9]+ already covers sbi*, so
// the alternation only needs the three roots.
//
// `remarks` and `username` are named outright: POST /bills/delete takes them
// under those exact names — they are what the cancelling screen sends, not
// columns of sale_bill — so without them here a missing one came back as a 400
// with no `field` attached, which is the one thing the client needs to know.
@Catch()
export class BillExceptionFilter extends SalesExceptionFilter<BillErrorDetail, BillErrorResponse> {
  constructor() {
    super(/\b((?:sb|cd|td)[A-Za-z0-9]+|remarks|username)\b/);
  }
}
