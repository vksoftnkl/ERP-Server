import { FixedExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { BankListErrorDetail, BankListErrorResponse } from './types/bank-list-api.types';
export declare class BankListExceptionFilter extends FixedExceptionFilter<BankListErrorDetail, BankListErrorResponse> {
    constructor();
}
