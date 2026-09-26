import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  CompanyMasterErrorDetail,
  CompanyMasterErrorResponse,
} from './types/company-master-api.types';

@Catch()
export class CompanyMasterExceptionFilter extends SettingsExceptionFilter<
  CompanyMasterErrorDetail,
  CompanyMasterErrorResponse
> {
  constructor() {
    super(/\b(comp[A-Za-z0-9]+)\b/);
  }
}
