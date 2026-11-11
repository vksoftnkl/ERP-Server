import { type ClientPlatform } from '../../../common/client-info/client-info';
import { type LegacyUsagePlatform } from '../app-version.constants';
export declare class ListInstallationsQueryDto {
    platform?: ClientPlatform;
    build?: number;
    companyId?: string;
    userId?: string;
    deviceId?: string;
    limit?: number;
    offset?: number;
}
export declare class InstallationSummaryQueryDto {
    platform?: ClientPlatform;
    activeDays?: number;
}
export declare class LegacyUsageQueryDto {
    name?: string;
    platform?: LegacyUsagePlatform;
    build?: number;
}
