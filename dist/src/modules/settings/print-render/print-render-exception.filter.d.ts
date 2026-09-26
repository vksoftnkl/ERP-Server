import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { PrintRenderErrorDetail, PrintRenderErrorResponse } from './types/print-render-api.types';
export declare class PrintRenderExceptionFilter extends SettingsExceptionFilter<PrintRenderErrorDetail, PrintRenderErrorResponse> {
    constructor();
}
