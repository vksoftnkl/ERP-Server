import { type ClientPlatform } from '../../../common/client-info/client-info';
import { type ReleaseSeverity } from '../app-version.constants';
export declare const lowerTrim: ({ value }: {
    value: unknown;
}) => unknown;
export declare class CheckUpdateQueryDto {
    platform?: ClientPlatform;
    build?: number;
}
export declare class AppUpdateInfoDto {
    platform: ClientPlatform;
    currentBuild: number;
    updateAvailable: boolean;
    severity: ReleaseSeverity | null;
    latestBuild: number | null;
    latestVersion: string | null;
    downloadUrl: string | null;
    notes: string | null;
    releasedAt: string | null;
    missedBuilds: number;
}
