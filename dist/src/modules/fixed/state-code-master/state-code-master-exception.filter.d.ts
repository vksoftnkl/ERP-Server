import { FixedExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { StateCodeMasterErrorDetail, StateCodeMasterErrorResponse } from './types/state-code-master-api.types';
export declare class StateCodeMasterExceptionFilter extends FixedExceptionFilter<StateCodeMasterErrorDetail, StateCodeMasterErrorResponse> {
    constructor();
}
