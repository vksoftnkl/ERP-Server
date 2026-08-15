import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { TxnHoldErrorDetail, TxnHoldErrorResponse } from './types/txn-hold-api.types';
export declare class TxnHoldExceptionFilter extends SalesExceptionFilter<TxnHoldErrorDetail, TxnHoldErrorResponse> {
    constructor();
}
