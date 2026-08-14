import { AppSettingDataType, AppSettingScope, AppSettingsErrorDetail } from './types/app-settings-api.types';
export interface AppSettingValueRules {
    asdKey: string;
    asdDataType: AppSettingDataType;
    asdAllowedValues: string[] | null;
    asdMinValue: number | null;
    asdMaxValue: number | null;
}
export declare function isCastableToDataType(value: string, dataType: AppSettingDataType): boolean;
export declare function validateSettingValue(value: string | null | undefined, rules: AppSettingValueRules, field: string): AppSettingsErrorDetail[];
export declare function toAllowedValues(raw: unknown): string[] | null;
export declare function isScopeWithinMax(scope: AppSettingScope, maxScope: AppSettingScope): boolean;
