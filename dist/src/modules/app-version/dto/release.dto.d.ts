import { type ClientPlatform } from '../../../common/client-info/client-info';
import { type ReleaseSeverity } from '../app-version.constants';
export declare class CreateReleaseDto {
    platform: ClientPlatform;
    build: number;
    version: string;
    commit?: string | null;
    severity?: ReleaseSeverity;
    notes?: string | null;
    downloadUrl?: string | null;
    releasedAt?: string;
}
export declare class UpdateReleaseDto {
    version?: string;
    commit?: string | null;
    severity?: ReleaseSeverity;
    notes?: string | null;
    downloadUrl?: string | null;
    releasedAt?: string;
    isActive?: boolean;
    isDeleted?: boolean;
}
export declare class ReleaseKeyParamsDto {
    platform: ClientPlatform;
    build: number;
}
export declare class ListReleasesQueryDto {
    platform?: ClientPlatform;
}
export declare class ReleaseResponseDto {
    id: string;
    platform: string;
    build: number;
    version: string;
    commit: string | null;
    severity: string;
    notes: string | null;
    downloadUrl: string | null;
    releasedAt: string;
    isActive: boolean;
    isDeleted: boolean;
    createdOn: string;
    createdBy: string | null;
    modifiedOn: string | null;
    modifiedBy: string | null;
}
