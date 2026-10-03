import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { GstinLookupErrorDetail, GstinLookupErrorResponse } from './types/gstin-lookup.types';
export declare class GstinLookupExceptionFilter extends SettingsExceptionFilter<GstinLookupErrorDetail, GstinLookupErrorResponse> {
    constructor();
}
