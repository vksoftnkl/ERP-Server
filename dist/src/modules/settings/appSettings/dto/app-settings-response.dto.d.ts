import { AppSettingDataType, AppSettingScope, AppSettingSource } from '../types/app-settings-api.types';
export declare class AppSettingsErrorFieldDto {
    field: string;
    message: string;
}
export declare class AppSettingsErrorResponseDto {
    success: false;
    message: string;
    errors: AppSettingsErrorFieldDto[];
}
export declare class AppSettingValuePayloadDto {
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
export declare class AppSettingValueDeleteResultDto {
    asvId: string;
    asvSettingKey: string;
    deleted: true;
}
export declare class AppSettingEffectiveOverrideDto {
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
export declare class AppSettingEffectiveItemDto {
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
    override: AppSettingEffectiveOverrideDto | null;
}
export declare class AppSettingsEffectiveSuccessDto {
    success: true;
    message: string;
    data: AppSettingEffectiveItemDto[];
}
export declare class AppSettingValueSuccessSaveDto {
    success: true;
    message: string;
    data: AppSettingValuePayloadDto[];
}
export declare class AppSettingValueSuccessDeleteDto {
    success: true;
    message: string;
    data: AppSettingValueDeleteResultDto;
}
