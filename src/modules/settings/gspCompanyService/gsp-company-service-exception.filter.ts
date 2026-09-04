import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  GspCompanyServiceErrorDetail,
  GspCompanyServiceErrorResponse,
} from './types/gsp-company-service-api.types';

@Catch()
export class GspCompanyServiceExceptionFilter extends SettingsExceptionFilter<
  GspCompanyServiceErrorDetail,
  GspCompanyServiceErrorResponse
> {
  constructor() {
    super(/\b(csg[A-Za-z0-9]+)\b/);
  }
}
