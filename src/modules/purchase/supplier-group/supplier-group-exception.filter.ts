import { Catch } from '@nestjs/common';
import { PurchaseExceptionFilter } from '../utils/purchase-exception-filter.utils';
import { SupplierGroupErrorDetail, SupplierGroupErrorResponse } from './types/supplier-group-api.types';

@Catch()
export class SupplierGroupExceptionFilter extends PurchaseExceptionFilter<
  SupplierGroupErrorDetail,
  SupplierGroupErrorResponse
> {
  constructor() {
    super(/\b(spg[A-Za-z0-9]+)\b/);
  }
}
