import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from '../utils/settings-exception-filter.utils';
import {
  EmployeeDesignationMasterErrorDetail,
  EmployeeDesignationMasterErrorResponse,
} from './types/employee-designation-master-api.types';

@Catch()
export class EmployeeDesignationMasterExceptionFilter extends SettingsExceptionFilter<
  EmployeeDesignationMasterErrorDetail,
  EmployeeDesignationMasterErrorResponse
> {
  constructor() {
    super(/\b(ed[A-Za-z0-9]+)\b/);
  }
}
