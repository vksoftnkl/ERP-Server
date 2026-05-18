import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { LedgerShippingAddressErrorDetail, LedgerShippingAddressErrorResponse } from './types/ledger-shipping-address-api.types';
@Catch()
export class LedgerShippingAddressExceptionFilter extends AccountsExceptionFilter<
  LedgerShippingAddressErrorDetail,
  LedgerShippingAddressErrorResponse
> {
  constructor() { super(/\b(saa[A-Za-z0-9]+)\b/); }
}