import { Catch } from '@nestjs/common';
import { AccountsExceptionFilter } from '../utils/accounts-exception-filter.utils';
import { CompanyGroupMasterErrorDetail, CompanyGroupMasterErrorResponse } from './types/company-group-master-api.types';
@Catch()
export class CompanyGroupMasterExceptionFilter extends AccountsExceptionFilter<
  CompanyGroupMasterErrorDetail,
  CompanyGroupMasterErrorResponse
> {
  constructor() { super(/\b(cog[A-Za-z0-9]+)\b/); }
}
