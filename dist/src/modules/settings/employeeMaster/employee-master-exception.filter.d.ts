import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { EmployeeMasterErrorDetail, EmployeeMasterErrorResponse } from './types/employee-master-api.types';
export declare class EmployeeMasterExceptionFilter extends SettingsExceptionFilter<EmployeeMasterErrorDetail, EmployeeMasterErrorResponse> {
    constructor();
}
