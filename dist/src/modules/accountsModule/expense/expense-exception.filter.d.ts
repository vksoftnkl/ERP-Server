import type { ModuleApiErrorDetail, ModuleApiErrorResponse } from "../../../common/types/module-api.types";
import { AccountsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
export declare class ExpenseExceptionFilter extends AccountsExceptionFilter<ModuleApiErrorDetail & {
    code?: string;
}, ModuleApiErrorResponse<ModuleApiErrorDetail & {
    code?: string;
}>> {
    constructor();
}
