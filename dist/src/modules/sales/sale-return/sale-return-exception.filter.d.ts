import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { ModuleErrorDetail, ModuleErrorResponse } from "../../../common/utils/module-service.utils";
export declare class SaleReturnExceptionFilter extends SalesExceptionFilter<ModuleErrorDetail, ModuleErrorResponse<ModuleErrorDetail>> {
    constructor();
}
