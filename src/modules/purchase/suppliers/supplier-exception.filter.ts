import { Catch } from '@nestjs/common';
import { PurchaseExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { SupplierErrorDetail, SupplierErrorResponse } from './types/supplier-api.types';

@Catch()
export class SupplierExceptionFilter extends PurchaseExceptionFilter<
  SupplierErrorDetail,
  SupplierErrorResponse
> {
  constructor() {
    super(/\b(sup[A-Za-z0-9]+)\b/);
  }
}
