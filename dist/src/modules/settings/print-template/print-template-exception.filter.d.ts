import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { PrintTemplateErrorDetail, PrintTemplateErrorResponse } from './types/print-template-api.types';
export declare class PrintTemplateExceptionFilter extends SettingsExceptionFilter<PrintTemplateErrorDetail, PrintTemplateErrorResponse> {
    constructor();
}
