import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  UserAdminErrorDetail,
  UserAdminErrorResponse,
} from './types/user-administration-api.types';

@Catch()
export class UserAdministrationExceptionFilter extends SettingsExceptionFilter<
  UserAdminErrorDetail,
  UserAdminErrorResponse
> {
  constructor() {
    super(/\b(usr[A-Za-z0-9]+|um[A-Za-z0-9]+)\b/);
  }
}
