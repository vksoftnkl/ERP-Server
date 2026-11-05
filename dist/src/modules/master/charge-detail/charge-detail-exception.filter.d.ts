import { ModuleExceptionFilter } from "../../../common/utils/module-shared.utils";
import { ChargeDetailErrorDetail, ChargeDetailErrorResponse } from './types/charge-detail-api.types';
export declare class ChargeDetailExceptionFilter extends ModuleExceptionFilter<ChargeDetailErrorDetail, ChargeDetailErrorResponse> {
    constructor();
}
