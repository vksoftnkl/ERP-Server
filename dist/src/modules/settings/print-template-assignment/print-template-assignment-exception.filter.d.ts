import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { PrintTemplateAssignmentErrorDetail, PrintTemplateAssignmentErrorResponse } from './types/print-template-assignment-api.types';
export declare class PrintTemplateAssignmentExceptionFilter extends SettingsExceptionFilter<PrintTemplateAssignmentErrorDetail, PrintTemplateAssignmentErrorResponse> {
    constructor();
}
