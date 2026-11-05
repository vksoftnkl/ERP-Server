import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { CompanyMasterErrorDetail, CompanyMasterErrorResponse } from './types/company-master-api.types';
export declare class CompanyMasterExceptionFilter extends SettingsExceptionFilter<CompanyMasterErrorDetail, CompanyMasterErrorResponse> {
    constructor();
}
