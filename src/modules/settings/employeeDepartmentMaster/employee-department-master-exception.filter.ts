import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  EmployeeDepartmentMasterErrorDetail,
  EmployeeDepartmentMasterErrorResponse,
} from './types/employee-department-master-api.types';

@Catch()
export class EmployeeDepartmentMasterExceptionFilter extends SettingsExceptionFilter<
  EmployeeDepartmentMasterErrorDetail,
  EmployeeDepartmentMasterErrorResponse
> {
  constructor() {
    super(/\b(edpt[A-Za-z0-9]+)\b/);
  }
}
