import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import type { AppThemeErrorDetail, AppThemeErrorResponse } from './types/app-theme.types';

@Catch()
export class AppThemeExceptionFilter extends SettingsExceptionFilter<
  AppThemeErrorDetail,
  AppThemeErrorResponse
> {
  constructor() {
    super(/\b(thm[A-Za-z0-9]+|tokens(?:\.[A-Za-z.]+)?|companyId)\b/);
  }
}
