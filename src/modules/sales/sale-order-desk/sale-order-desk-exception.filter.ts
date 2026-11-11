import { Catch } from '@nestjs/common';
import { SalesExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type {
  SaleOrderErrorDetail,
  SaleOrderErrorResponse,
} from '../sale-order/types/sale-order-api.types';

// The desk's request fields: the order keys (so*), the nested order list
// (reported as `orders.0.soId`), and the plain body keys.
@Catch()
export class SaleOrderDeskExceptionFilter extends SalesExceptionFilter<
  SaleOrderErrorDetail,
  SaleOrderErrorResponse
> {
  constructor() {
    super(/\b((?:so[A-Za-z0-9]+)|orders|custIds|itemId|reason|fingerprint)\b/);
  }
}
