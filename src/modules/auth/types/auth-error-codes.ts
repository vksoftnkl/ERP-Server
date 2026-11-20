import {
  buildErrorResponse,
  type ModuleErrorDetail,
  type ModuleErrorResponse,
} from '../../../common/utils/module-shared.utils';

/**
 * Every refusal /auth and the access-token guard raise (notes 119): the client
 * words its box by `errors[0].code` alone. The message text is unchanged and
 * stays deliberately vague where it was (a login never says WHICH of name or
 * password was wrong — both answer AUTH_INVALID_CREDENTIALS).
 */
export enum AuthErrorCode {
  /** Login: no usable user by that login name on this channel, or the password does not match. */
  INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  /**
   * Refresh / change-password: the user was deleted, deactivated or locked since the token was
   * issued. Login (review step 6, U9): the password was RIGHT but the account is inactive or
   * deleted (the message never says "deleted").
   */
  USER_INACTIVE = 'AUTH_USER_INACTIVE',
  /** Login (review step 6, U9): the password was right but the account is locked (Unlock on menu 58). */
  USER_LOCKED = 'AUTH_USER_LOCKED',
  /**
   * Login (review step 6, U9): the password was right but the account may not log in on this
   * channel. The detail carries `channel` (desktop | web | mobile) for the wording variant; a
   * login that named no device type and whose account has every channel off carries none.
   */
  CHANNEL_DISABLED = 'AUTH_CHANNEL_DISABLED',
  /**
   * 403 on every guarded route except POST /auth/change-password (review step 6, U8): the
   * session logged in on a password an administrator reset (usr_must_change_password), and the
   * user has not changed it yet. A 403, never a 401, so a client does not refresh and retry.
   */
  PASSWORD_CHANGE_REQUIRED = 'AUTH_PASSWORD_CHANGE_REQUIRED',
  /** A guarded route was called with no `Authorization: Bearer <token>` header (or a malformed one). */
  AUTHORIZATION_MISSING = 'AUTH_AUTHORIZATION_MISSING',
  /** The access token does not verify: malformed, bad signature, or claims of the wrong shape/type. */
  ACCESS_TOKEN_INVALID = 'AUTH_ACCESS_TOKEN_INVALID',
  /** The access token verified but its expiry has passed — refresh it. */
  ACCESS_TOKEN_EXPIRED = 'AUTH_ACCESS_TOKEN_EXPIRED',
  /** The refresh token does not verify: malformed, bad signature, or claims of the wrong shape/type. */
  REFRESH_TOKEN_INVALID = 'AUTH_REFRESH_TOKEN_INVALID',
  /** The refresh token verified but its expiry has passed — log in again. */
  REFRESH_TOKEN_EXPIRED = 'AUTH_REFRESH_TOKEN_EXPIRED',
  /** The access token's session was logged out or replaced by a newer token (Redis session gone or different). */
  ACCESS_SESSION_ENDED = 'AUTH_ACCESS_SESSION_ENDED',
  /** The access token's stored session could not be read back (corrupt Redis entry). */
  ACCESS_SESSION_INVALID = 'AUTH_ACCESS_SESSION_INVALID',
  /** The refresh token's session was logged out or replaced (Redis session gone or different). */
  REFRESH_SESSION_ENDED = 'AUTH_REFRESH_SESSION_ENDED',
  /** The refresh token's stored session could not be read back (corrupt Redis entry). */
  REFRESH_SESSION_INVALID = 'AUTH_REFRESH_SESSION_INVALID',
  /**
   * Part B Step 2 Rev 2 (401): the token was minted before the backend was
   * updated (its `ep` claim is below the current token epoch). Refreshing will
   * not help; the user must log in again, which also runs the build check.
   * Raised for both token kinds; `field` says which (authorization | refresh_token).
   */
  BACKEND_UPDATED = 'AUTH_BACKEND_UPDATED',
  /** 500 — the server has no JWT secret configured, so it can neither sign nor verify a token. */
  JWT_SECRET_MISSING = 'AUTH_JWT_SECRET_MISSING',
  /** Login device lookup: no device_master row for this device (or no web device for the user). */
  DEVICE_NOT_REGISTERED = 'AUTH_DEVICE_NOT_REGISTERED',
  /** Login device lookup: the device is blocked (the message carries the block reason). */
  DEVICE_BLOCKED = 'AUTH_DEVICE_BLOCKED',
  /** Login device lookup: the device is inactive or deleted. */
  DEVICE_UNAVAILABLE = 'AUTH_DEVICE_UNAVAILABLE',
  /**
   * POST /auth/change-password (400, field `currentPassword`): the current password does not
   * match. A 400, not a 401, so the client does not take it for an expired session.
   */
  CURRENT_PASSWORD_WRONG = 'AUTH_CURRENT_PASSWORD_WRONG',
  /** POST /auth/change-password (400, field `newPassword`): under 4 characters, spaces at the ends not counted (U7). */
  NEW_PASSWORD_TOO_SHORT = 'AUTH_NEW_PASSWORD_TOO_SHORT',
  /** POST /auth/change-password (400, field `newPassword`): the new password is the current one. */
  NEW_PASSWORD_SAME = 'AUTH_NEW_PASSWORD_SAME',
}

export interface AuthErrorDetail extends ModuleErrorDetail {
  code: AuthErrorCode;
  /** AUTH_CHANNEL_DISABLED only: desktop | web | mobile, the wording variant `channel=<value>`. */
  channel?: string;
}

/**
 * The house error body for one auth refusal, for `new UnauthorizedException(…)`
 * and friends: the status stays the exception's, `message` stays the text the
 * route always answered with, and the global filter passes the body through.
 */
export function authErrorBody(
  message: string,
  field: string,
  code: AuthErrorCode,
  extra: Pick<AuthErrorDetail, 'channel'> = {},
): ModuleErrorResponse<AuthErrorDetail> {
  return buildErrorResponse<AuthErrorDetail>(message, [{ field, message, code, ...extra }]);
}
