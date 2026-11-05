import { ModuleExceptionFilter } from "../../../common/utils/module-shared.utils";
import { TransactionErrorDetail, TransactionErrorResponse } from './types/transaction-api.types';
export declare class TransactionExceptionFilter extends ModuleExceptionFilter<TransactionErrorDetail, TransactionErrorResponse> {
    constructor();
}
