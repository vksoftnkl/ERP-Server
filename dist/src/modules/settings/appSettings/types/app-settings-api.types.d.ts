import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export type AppSettingsErrorDetail = ModuleApiErrorDetail;
export type AppSettingsErrorResponse = ModuleApiErrorResponse<AppSettingsErrorDetail>;
export type AppSettingsSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export declare enum AppSettingDataType {
    BOOL = "BOOL",
    INT = "INT",
    DECIMAL = "DECIMAL",
    TEXT = "TEXT",
    UUID = "UUID",
    DATE = "DATE",
    JSON = "JSON"
}
export declare enum AppSettingScope {
    GLOBAL = "GLOBAL",
    COMPANY = "COMPANY",
    BRANCH = "BRANCH",
    DEVICE = "DEVICE",
    USER = "USER"
}
export declare const APP_SETTING_SCOPE_RANK: Record<AppSettingScope, number>;
export declare const APP_SETTING_SCOPE_ID_FIELDS: readonly ["asvCompanyId", "asvBranchId", "asvDeviceId", "asvUserId"];
export type AppSettingScopeIdField = (typeof APP_SETTING_SCOPE_ID_FIELDS)[number];
export declare const APP_SETTING_SCOPE_ID_FIELD: Record<AppSettingScope, AppSettingScopeIdField | null>;
export type AppSettingScopeTarget = Record<AppSettingScopeIdField, string | null>;
export interface AppSettingValuePayload {
    asvId: string;
    asvSettingKey: string;
    asvScope: AppSettingScope;
    asvCompanyId: string | null;
    asvBranchId: string | null;
    asvDeviceId: string | null;
    asvUserId: string | null;
    asvValue: string | null;
    asvRemarks: string | null;
    asvIsDeleted: boolean;
    asvSyncDate: string | null;
    asvCreatedOn: string;
    asvCreatedBy: string;
    asvModifiedOn: string | null;
    asvModifiedBy: string | null;
}
export interface AppSettingValueDeleteResult {
    asvId: string;
    asvSettingKey: string;
    deleted: true;
}
export interface AppSettingResolveScope {
    companyId?: string | null;
    branchId?: string | null;
    deviceId?: string | null;
    userId?: string | null;
}
export declare enum AppSettingSource {
    OVERRIDE = "OVERRIDE",
    DEFAULT = "DEFAULT"
}
export interface AppSettingEffectiveItem {
    asdId: string;
    asdKey: string;
    asdModule: string;
    asdGroup: string;
    asdLabel: string;
    asdDescription: string | null;
    asdDataType: AppSettingDataType;
    asdDefaultValue: string | null;
    asdAllowedValues: string[] | null;
    asdMinValue: number | null;
    asdMaxValue: number | null;
    asdMaxScope: AppSettingScope;
    asdSortOrder: number;
    asdNeedsRelogin: boolean;
    source: AppSettingSource;
    value: string | null;
    override: AppSettingEffectiveOverride | null;
}
export interface AppSettingEffectiveOverride {
    asvId: string;
    asvScope: AppSettingScope;
    asvCompanyId: string | null;
    asvBranchId: string | null;
    asvDeviceId: string | null;
    asvUserId: string | null;
    asvValue: string | null;
    asvRemarks: string | null;
    asvSyncDate: string | null;
    asvCreatedOn: string;
    asvCreatedBy: string;
    asvModifiedOn: string | null;
    asvModifiedBy: string | null;
}
