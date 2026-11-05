import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { CompanyGroupMasterErrorDetail, CompanyGroupMasterErrorResponse } from './types/company-group-master-api.types';
export declare class CompanyGroupMasterExceptionFilter extends AccountsExceptionFilter<CompanyGroupMasterErrorDetail, CompanyGroupMasterErrorResponse> {
    constructor();
}
