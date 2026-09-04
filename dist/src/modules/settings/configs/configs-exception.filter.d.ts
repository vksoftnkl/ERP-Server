import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { ConfigsErrorDetail, ConfigsErrorResponse } from './types/configs-api.types';
export declare class ConfigsExceptionFilter extends SettingsExceptionFilter<ConfigsErrorDetail, ConfigsErrorResponse> {
    constructor();
}
