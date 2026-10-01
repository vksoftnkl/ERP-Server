import { ModuleExceptionFilter } from "../../../common/utils/module-shared.utils";
import { TenderDetailErrorDetail, TenderDetailErrorResponse } from './types/tender-detail-api.types';
export declare class TenderDetailExceptionFilter extends ModuleExceptionFilter<TenderDetailErrorDetail, TenderDetailErrorResponse> {
    constructor();
}
