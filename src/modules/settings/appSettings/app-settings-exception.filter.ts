import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { AppSettingsErrorDetail, AppSettingsErrorResponse } from './types/app-settings-api.types';

// Both tables' columns are asd* / asv*, so one pattern names the offending
// field on either side. It is the safety net under the checks the services
// already make: anything that still reaches Postgres — a CHECK the service does
// not restate, or tr_asv_check_scope firing on a race — comes back naming a
// field the caller sent rather than a constraint it has never heard of.
@Catch()
export class AppSettingsExceptionFilter extends SettingsExceptionFilter<
  AppSettingsErrorDetail,
  AppSettingsErrorResponse
> {
  constructor() {
    super(/\b(as[dv][A-Za-z0-9]+)\b/);
  }
}
