import { SetMetadata } from '@nestjs/common';

export const PASSWORD_CHANGE_ALLOWED_KEY = 'passwordChangeAllowed';

/**
 * Review step 6 (U8): a guarded route a session may still call while its password must be
 * changed (an administrator reset it; the access token carries `pwc: true`). Every other
 * guarded route answers 403 AUTH_PASSWORD_CHANGE_REQUIRED until the user has changed it.
 * Today only POST /auth/change-password carries it (the server has no logout route: logging
 * out is the client dropping its tokens). @Public routes (login, refresh) never reach the check.
 */
export const AllowWhilePasswordChangeRequired = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PASSWORD_CHANGE_ALLOWED_KEY, true);
