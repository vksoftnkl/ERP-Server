import {
  buildErrorResponse,
  type ModuleErrorDetail,
  type ModuleErrorResponse,
} from '../../../common/utils/module-shared.utils';

/**
 * Every refusal /app-version raises (notes 119: the code is what a caller switches on).
 * Only CI and support tooling call the release and support routes, so these
 * codes have no fixed.error_message wording rows. A code with no row simply
 * goes out without a `user` block.
 */
export enum AppVersionErrorCode {
  /** 403: OPS_API_KEY is not set on this server, so the release and support APIs are switched off. */
  OPS_DISABLED = 'APP_VERSION_OPS_DISABLED',
  /** 401: the X-Ops-Key header is missing or does not match OPS_API_KEY. */
  OPS_KEY_INVALID = 'APP_VERSION_OPS_KEY_INVALID',
  /** 400: /check got no platform, neither as ?platform= nor as the X-App-Platform header. */
  PLATFORM_REQUIRED = 'APP_VERSION_PLATFORM_REQUIRED',
  /** 400: /check got no build, neither as ?build= nor as the X-App-Build header. */
  BUILD_REQUIRED = 'APP_VERSION_BUILD_REQUIRED',
  /** 409: this platform + build is already registered (a yanked release keeps its number). */
  RELEASE_BUILD_EXISTS = 'APP_RELEASE_BUILD_EXISTS',
  /** 409: the build is lower than a build clients of this platform already run. */
  RELEASE_BUILD_TOO_LOW = 'APP_RELEASE_BUILD_TOO_LOW',
  /** 404: no release with this platform + build. */
  RELEASE_NOT_FOUND = 'APP_RELEASE_NOT_FOUND',
}

export interface AppVersionErrorDetail extends ModuleErrorDetail {
  code: AppVersionErrorCode;
}

export function appVersionErrorBody(
  message: string,
  field: string,
  code: AppVersionErrorCode,
): ModuleErrorResponse<AppVersionErrorDetail> {
  return buildErrorResponse<AppVersionErrorDetail>(message, [{ field, message, code }]);
}
