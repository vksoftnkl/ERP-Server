import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * The route answers WITHOUT a token, unlike every other route.
 *
 * Unlike @Public, a token that IS sent is still checked and read by the
 * AccessTokenGuard: a bad or expired one is the usual 401, and a good one sets
 * the user, company, branch and device in the request context. So a logged-in
 * caller keeps everything that hangs off the login (menu rights, company
 * figures, audit names), and a caller with no token runs without them.
 * First used by /mobile/customers/* (2026-11-16).
 */
export const OptionalAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
