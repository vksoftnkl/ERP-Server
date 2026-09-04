import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { GspProviderMasterErrorDetail, GspProviderMasterErrorResponse } from './types/gsp-provider-master-api.types';
export declare class GspProviderMasterExceptionFilter extends AccountsExceptionFilter<GspProviderMasterErrorDetail, GspProviderMasterErrorResponse> {
    constructor();
}
