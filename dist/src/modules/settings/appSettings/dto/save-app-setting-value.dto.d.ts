import { AppSettingScope } from '../types/app-settings-api.types';
export declare class SaveAppSettingValueDto {
    asvId?: string;
    asvSettingKey?: string;
    asvScope?: AppSettingScope;
    asvCompanyId?: string | null;
    asvBranchId?: string | null;
    asvDeviceId?: string | null;
    asvUserId?: string | null;
    asvValue?: string | null;
    asvRemarks?: string | null;
    asvSyncDate?: Date;
    asvCreatedBy?: string;
    asvModifiedBy?: string;
}
