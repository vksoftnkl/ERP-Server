import {
  buildErrorResponse,
  type ModuleErrorDetail,
  type ModuleErrorResponse,
} from '../../../common/utils/module-shared.utils';

/**
 * Every refusal /app-version raises (notes 119: the code is what a caller switches on).
 * Only admins, CI and support tooling call the release, policy and support
 * routes, so these codes have no fixed.error_message wording rows. A code with
 * no row simply goes out without a `user` block. UPDATE_REQUIRED (426) is the
 * one a cashier sees; its body carries its own `message` (update-required.exception.ts).
 */
export enum AppVersionErrorCode {
  /** 403: the caller is signed in but is not an ADMIN / SUPER ADMIN (decision D5). */
  ADMIN_ONLY = 'APP_VERSION_ADMIN_ONLY',
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
  /** 400: a policy change would leave enforce = true with no expected build. */
  POLICY_BUILD_REQUIRED = 'APP_POLICY_BUILD_REQUIRED',
  /** 409: use-manifest was asked, but this server has no valid compat manifest. */
  POLICY_NO_MANIFEST = 'APP_POLICY_NO_MANIFEST',
  /**
   * 426: the platform's build policy is enforced and the client's X-App-Build
   * is missing, invalid or not exactly the expected build. Raised by login and
   * refresh, before the password is checked.
   */
  UPDATE_REQUIRED = 'UPDATE_REQUIRED',
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
