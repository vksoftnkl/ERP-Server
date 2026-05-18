import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from '../utils/accounts-exception-filter.utils';
import { TenderTypeMasterErrorDetail, TenderTypeMasterErrorResponse } from './types/tender-type-master-api.types';
@Catch()
export class TenderTypeMasterExceptionFilter extends AccountsExceptionFilter<
  TenderTypeMasterErrorDetail,
  TenderTypeMasterErrorResponse
> {
  constructor() { super(/\b(ttm[A-Za-z0-9]+)\b/); }
}