import { type ModuleErrorDetail, type ModuleErrorResponse } from "../../common/utils/module-shared.utils";
import { SalesExceptionFilter } from "../../common/utils/module-exception-filter.utils";
export declare class MobileExceptionFilter extends SalesExceptionFilter<ModuleErrorDetail, ModuleErrorResponse<ModuleErrorDetail>> {
    constructor();
}
