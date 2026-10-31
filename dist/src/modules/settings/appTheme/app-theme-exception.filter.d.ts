import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { AppThemeErrorDetail, AppThemeErrorResponse } from './types/app-theme.types';
export declare class AppThemeExceptionFilter extends SettingsExceptionFilter<AppThemeErrorDetail, AppThemeErrorResponse> {
    constructor();
}
