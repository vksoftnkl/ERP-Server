import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from '../utils/accounts-exception-filter.utils';
import { GspProviderMasterErrorDetail, GspProviderMasterErrorResponse } from './types/gsp-provider-master-api.types';
@Catch()
export class GspProviderMasterExceptionFilter extends AccountsExceptionFilter<
  GspProviderMasterErrorDetail,
  GspProviderMasterErrorResponse
> {
  constructor() { super(/\b(gsp[A-Za-z0-9]+)\b/); }
}
