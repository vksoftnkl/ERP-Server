import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { TenderTypeMasterErrorDetail, TenderTypeMasterErrorResponse } from './types/tender-type-master-api.types';
export declare class TenderTypeMasterExceptionFilter extends AccountsExceptionFilter<TenderTypeMasterErrorDetail, TenderTypeMasterErrorResponse> {
    constructor();
}
