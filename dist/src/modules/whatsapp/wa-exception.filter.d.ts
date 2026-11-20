import { SettingsExceptionFilter } from "../../common/utils/module-exception-filter.utils";
import type { ModuleErrorDetail, ModuleErrorResponse } from "../../common/utils/module-shared.utils";
export declare class WaExceptionFilter extends SettingsExceptionFilter<ModuleErrorDetail, ModuleErrorResponse<ModuleErrorDetail>> {
    constructor();
}
