import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { AppSettingsErrorDetail, AppSettingsErrorResponse } from './types/app-settings-api.types';
export declare class AppSettingsExceptionFilter extends SettingsExceptionFilter<AppSettingsErrorDetail, AppSettingsErrorResponse> {
    constructor();
}
