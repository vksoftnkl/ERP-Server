import { HttpException } from '@nestjs/common';
import type { ClientPlatform } from '../../../common/client-info/client-info';
import { AppVersionErrorCode, type AppVersionErrorDetail } from './app-version-error-codes';

/** 426 Upgrade Required. Nest's HttpStatus enum has no member for it. */
export const UPDATE_REQUIRED_STATUS = 426;

/**
 * The 426 body (Rev 2 §5.3). The spec's flat fields come first; `success` and
 * `errors[]` are the house shape (notes 119), so AllExceptionsFilter passes the
 * body through untouched (adding statusCode, path, timestamp) and today's Qt
 * client, which words any refusal from `message` + `errors[]`, shows the
 * message instead of a bare "426".
 */
export interface UpdateRequiredBody {
  success: false;
  statusCode: typeof UPDATE_REQUIRED_STATUS;
  code: AppVersionErrorCode.UPDATE_REQUIRED;
  platform: ClientPlatform;
  /** null when X-App-Build was missing or not a positive integer. */
  clientBuild: number | null;
  expectedBuild: number;
  message: string;
  downloadUrl: string | null;
  errors: AppVersionErrorDetail[];
}

const PLATFORM_LABEL: Readonly<Record<ClientPlatform, string>> = {
  web: 'Web',
  desktop: 'Desktop',
  mobile: 'Mobile',
};

/** The words shown when the policy row has no abp_message. */
export function defaultUpdateMessage(platform: ClientPlatform): string {
  return `Please update VK Nex ${PLATFORM_LABEL[platform]} to continue.`;
}

export class UpdateRequiredException extends HttpException {
  constructor(input: {
    platform: ClientPlatform;
    clientBuild: number | null;
    expectedBuild: number;
    message: string | null;
    downloadUrl: string | null;
  }) {
    const message = input.message?.trim() || defaultUpdateMessage(input.platform);
    const body: UpdateRequiredBody = {
      success: false,
      statusCode: UPDATE_REQUIRED_STATUS,
      code: AppVersionErrorCode.UPDATE_REQUIRED,
      platform: input.platform,
      clientBuild: input.clientBuild,
      expectedBuild: input.expectedBuild,
      message,
      downloadUrl: input.downloadUrl,
      errors: [{ field: 'x-app-build', code: AppVersionErrorCode.UPDATE_REQUIRED, message }],
    };
    super(body, UPDATE_REQUIRED_STATUS);
  }
}
