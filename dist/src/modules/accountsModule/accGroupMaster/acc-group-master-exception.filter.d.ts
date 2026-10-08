import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { AccGroupMasterErrorDetail, AccGroupMasterErrorResponse } from './types/acc-group-master-api.types';
export declare class AccGroupMasterExceptionFilter extends AccountsExceptionFilter<AccGroupMasterErrorDetail, AccGroupMasterErrorResponse> {
    constructor();
}
