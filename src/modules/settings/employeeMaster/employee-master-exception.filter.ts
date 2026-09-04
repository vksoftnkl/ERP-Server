import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  EmployeeMasterErrorDetail,
  EmployeeMasterErrorResponse,
} from './types/employee-master-api.types';

@Catch()
export class EmployeeMasterExceptionFilter extends SettingsExceptionFilter<
  EmployeeMasterErrorDetail,
  EmployeeMasterErrorResponse
> {
  constructor() {
    super(/\b(emp[A-Za-z0-9]+)\b/);
  }
}
