import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { LedgerShippingAddressErrorDetail, LedgerShippingAddressErrorResponse } from './types/ledger-shipping-address-api.types';
export declare class LedgerShippingAddressExceptionFilter extends AccountsExceptionFilter<LedgerShippingAddressErrorDetail, LedgerShippingAddressErrorResponse> {
    constructor();
}
