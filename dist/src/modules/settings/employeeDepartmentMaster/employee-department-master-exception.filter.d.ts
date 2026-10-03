import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { EmployeeDepartmentMasterErrorDetail, EmployeeDepartmentMasterErrorResponse } from './types/employee-department-master-api.types';
export declare class EmployeeDepartmentMasterExceptionFilter extends SettingsExceptionFilter<EmployeeDepartmentMasterErrorDetail, EmployeeDepartmentMasterErrorResponse> {
    constructor();
}
