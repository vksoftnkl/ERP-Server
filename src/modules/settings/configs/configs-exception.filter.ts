import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ConfigsErrorDetail, ConfigsErrorResponse } from './types/configs-api.types';

@Catch()
export class ConfigsExceptionFilter extends SettingsExceptionFilter<
  ConfigsErrorDetail,
  ConfigsErrorResponse
> {
  constructor() {
    super(/\b(config[A-Za-z0-9]+)\b/);
  }
}
