import { type ClientPlatform } from '../../../common/client-info/client-info';
export declare class PolicyPlatformParamsDto {
    platform: ClientPlatform;
}
export declare class UpdateBuildPolicyDto {
    enforce?: boolean;
    expectedBuild?: number | null;
    message?: string | null;
    downloadUrl?: string | null;
}
export declare class BuildPolicyResponseDto {
    platform: ClientPlatform;
    enforce: boolean;
    expectedBuild: number | null;
    message: string | null;
    downloadUrl: string | null;
    source: 'manifest' | 'manual';
    changedOn: string | null;
    changedBy: string | null;
}
