import { ModuleExceptionFilter } from "../../../common/utils/module-shared.utils";
import { ChargeMasterErrorDetail, ChargeMasterErrorResponse } from './types/charge-master-api.types';
export declare class ChargeMasterExceptionFilter extends ModuleExceptionFilter<ChargeMasterErrorDetail, ChargeMasterErrorResponse> {
    constructor();
}
