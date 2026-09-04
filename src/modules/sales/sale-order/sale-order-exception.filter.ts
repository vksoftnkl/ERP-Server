import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { SaleOrderErrorDetail, SaleOrderErrorResponse } from './types/sale-order-api.types';
// Field prefixes reachable from an order request: the header (so*), its line
// items (soi*, reported by class-validator as `items.0.soiX`), the advance
// allocations (soa*, reported as `advances.0.soaX`), the applied charge lines
// (cd*, reported as `charges.0.cdX`) and the tendered amounts (td*, reported as
// `tenders.0.tdX`). so[A-Za-z0-9]+ already covers soi* and soa*, so the
// alternation only needs the three roots.
@Catch()
export class SaleOrderExceptionFilter extends SalesExceptionFilter<
  SaleOrderErrorDetail,
  SaleOrderErrorResponse
> {
  constructor() {
    super(/\b((?:so|cd|td)[A-Za-z0-9]+)\b/);
  }
}