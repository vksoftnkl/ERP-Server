import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { TenderMasterErrorDetail, TenderMasterErrorResponse } from './types/tender-master-api.types';
export declare class TenderMasterExceptionFilter extends AccountsExceptionFilter<TenderMasterErrorDetail, TenderMasterErrorResponse> {
    constructor();
}
