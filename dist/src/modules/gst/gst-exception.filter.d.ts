import { SettingsExceptionFilter } from "../../common/utils/module-exception-filter.utils";
import type { GstErrorDetail, GstErrorResponse } from './types/gst-config.types';
export declare class GstExceptionFilter extends SettingsExceptionFilter<GstErrorDetail, GstErrorResponse> {
    constructor();
}
