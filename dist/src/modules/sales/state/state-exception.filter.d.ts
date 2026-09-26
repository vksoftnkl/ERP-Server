import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { StateErrorDetail, StateErrorResponse } from './types/state-api.types';
export declare class StateExceptionFilter extends SalesExceptionFilter<StateErrorDetail, StateErrorResponse> {
    constructor();
}
