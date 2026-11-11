import { HttpException } from '@nestjs/common';
import type { ClientPlatform } from '../../../common/client-info/client-info';
import { AppVersionErrorCode, type AppVersionErrorDetail } from './app-version-error-codes';
export declare const UPDATE_REQUIRED_STATUS = 426;
export interface UpdateRequiredBody {
    success: false;
    statusCode: typeof UPDATE_REQUIRED_STATUS;
    code: AppVersionErrorCode.UPDATE_REQUIRED;
    platform: ClientPlatform;
    clientBuild: number | null;
    expectedBuild: number;
    message: string;
    downloadUrl: string | null;
    errors: AppVersionErrorDetail[];
}
export declare function defaultUpdateMessage(platform: ClientPlatform): string;
export declare class UpdateRequiredException extends HttpException {
    constructor(input: {
        platform: ClientPlatform;
        clientBuild: number | null;
        expectedBuild: number;
        message: string | null;
        downloadUrl: string | null;
    });
}
