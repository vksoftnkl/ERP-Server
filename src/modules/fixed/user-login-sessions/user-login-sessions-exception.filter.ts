import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  UserLoginSessionsErrorDetail,
  UserLoginSessionsErrorResponse,
} from './types/user-login-sessions-api.types';

@Catch()
export class UserLoginSessionsExceptionFilter extends FixedExceptionFilter<
  UserLoginSessionsErrorDetail,
  UserLoginSessionsErrorResponse
> {
  constructor() {
    super(/\b(uls[A-Za-z0-9]+)\b/);
  }
}
