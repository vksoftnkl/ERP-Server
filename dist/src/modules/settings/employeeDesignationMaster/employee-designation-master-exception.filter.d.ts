import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { EmployeeDesignationMasterErrorDetail, EmployeeDesignationMasterErrorResponse } from './types/employee-designation-master-api.types';
export declare class EmployeeDesignationMasterExceptionFilter extends SettingsExceptionFilter<EmployeeDesignationMasterErrorDetail, EmployeeDesignationMasterErrorResponse> {
    constructor();
}
