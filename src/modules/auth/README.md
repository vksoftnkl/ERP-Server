# Auth

Authentication for the ERP API — validates user credentials, issues signed access/refresh
tokens, tracks the resulting session in Redis, and persists a login-session audit row. A single
global guard then enforces those tokens on every non-public route.

- **Base route:** `auth` (API-versioned via `API_VERSION`)
- **Swagger tag:** `Auth`
- **Auth scheme:** custom HS256 JWTs (built with `node:crypto`, not `@nestjs/jwt`) presented as
  `Authorization: Bearer <access-token>`. The `login` and `refresh` endpoints themselves are
  `@Public()`.
- **Primary table:** `user_master` (`public` schema) — PK `usrId`. Read for credential
  verification; updated with login timestamps / failed-login counters.
- **Device table:** `device_master` — PK `devId`, unique `devDeviceUid`. Looked up / touched on
  login for web, desktop, and mobile clients.
- **Session table:** `user_login_sessions` (`auditlogs` schema) — PK `ulsId`. One row inserted
  per successful login.
- **Session cache:** Redis keys `auth:session:<sid>` — the live token session used to validate
  and revoke tokens.

## Files

| File | Purpose |
| --- | --- |
| [auth.module.ts](auth.module.ts) | Module wiring — imports `UsersModule` + `ConfigModule`, **exports `TokenService` and `AuthSessionService`** for reuse (e.g. the global guard) |
| [auth.controller.ts](auth.controller.ts) | HTTP routes (`login`, `refresh`) + Swagger docs; pulls `user-agent` / `x-app-version` headers off the request |
| [auth.service.ts](auth.service.ts) | Credential validation, scrypt password check, device resolution, token issuance orchestration, login-session persistence |
| [auth-session.service.ts](auth-session.service.ts) | Redis-backed token session store — create, assert-active, and revoke |
| [token.service.ts](token.service.ts) | Signs and verifies HS256 access/refresh tokens; defines the token claim/payload types |
| [guards/access-token.guard.ts](guards/access-token.guard.ts) | Global `CanActivate` guard — verifies the bearer token and seeds request context |
| [dto/login-auth.dto.ts](dto/login-auth.dto.ts) | Login request body (`usrLoginName`, `usrPassword`, optional device/app/ip metadata) |
| [dto/refresh-token.dto.ts](dto/refresh-token.dto.ts) | Refresh request body (`refresh_token`, min length 16) |
| [dto/login-response.dto.ts](dto/login-response.dto.ts) | Swagger response model returned by both `login` and `refresh` |
| [dto/create-auth.dto.ts](dto/create-auth.dto.ts) | Empty scaffold DTO (Nest CLI stub, unused) |
| [dto/update-auth.dto.ts](dto/update-auth.dto.ts) | Empty scaffold DTO (`PartialType(CreateAuthDto)`, unused) |
| [entities/auth.entity.ts](entities/auth.entity.ts) | Empty scaffold entity (Nest CLI stub, unused) |
| [auth.service.spec.ts](auth.service.spec.ts) | Unit tests for the auth service |
| [auth-session.service.spec.ts](auth-session.service.spec.ts) | Unit tests for the session service |

## Endpoints

Both endpoints are marked `@Public()` (they bypass the global access-token guard) and return
HTTP `200` with a [LoginResponseDto](dto/login-response.dto.ts).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/login` | Validate `usrLoginName` + `usrPassword`, issue a fresh access **and** refresh token, resolve/update the device, and record a login session. |
| `POST` | `/refresh` | Exchange a still-active `refresh_token` for a new access token (the same refresh token is returned). |

> There is **no logout endpoint**. Session revocation exists as `revokeAccessTokenSession` on
> [auth-session.service.ts](auth-session.service.ts) (and the service is exported), but no HTTP
> route currently invokes it.

## Login flow

1. **Find the user** ([`findLoginUser`](auth.service.ts)) — case-insensitive match on
   `usrLoginName`, restricted to accounts that are not deleted, active, not locked, and have
   `usrWebLogin = true`. A missing user yields `401 Invalid credentials`.
2. **Verify the password** ([`verifyPassword`](auth.service.ts)) — the stored hash is
   `scrypt$<salt>$<hashHex>`. The candidate is re-derived with `scrypt` and compared with
   `timingSafeEqual`. On failure, `usrFailedLoginCount` is incremented (best-effort) and a `401`
   is thrown.
3. **Resolve the device** ([`findAndUpdateDeviceOnLogin`](auth.service.ts)) — only when a
   `device_id` is supplied or `device_type` is `web`. Web logins look up the user's
   `device_master` row of type `Web`; desktop/mobile look up by `devDeviceUid` and reject blocked
   / inactive / deleted devices. The matched row's last-IP / last-login / modified fields are
   updated. Logins without device context skip this step entirely.
4. **Issue tokens** via [TokenService](token.service.ts) — an access token is signed with a fresh
   session id (`sid = randomUUID()`), and a refresh token is signed reusing that same `sid`. Both
   carry `sub` (user id), `user_name`, `user_type`, and `company_id` claims.
5. **Store the session** ([`storeTokenSession`](auth-session.service.ts)) — a
   `CachedAccessTokenSession` (sid, sub, user_name, SHA-256 hashes of both tokens, iat, exp) is
   written to Redis under `auth:session:<sid>`.
6. **Update the user** ([`updateUserOnLogin`](auth.service.ts)) — sets `usrLastLoginOn` and
   resets `usrFailedLoginCount` (best-effort).
7. **Persist the audit row** ([`saveUserLoginSession`](auth.service.ts)) — inserts a
   `user_login_sessions` record (company/branch/user, `sid`, tokens, IP, user-agent, app version,
   `ulsLoginStatus = 'SUCCESS'`, `ulsIsActiveSession = true`). Best-effort. Tokens longer than 200
   chars are stored as `sha256:<hash>` ([`normalizeSessionToken`](auth.service.ts)).

Steps 3, 6, and 7 are wrapped in try/catch and only logged as warnings, so a device/timestamp/
audit failure never blocks a successful login.

## Refresh flow

[`refresh`](auth.service.ts) verifies the refresh token, then
[`assertRefreshTokenIsActive`](auth-session.service.ts) confirms the cached session still exists
and its `sid` / `sub` / `user_name` / refresh-token hash match. The user is **re-read** from
`user_master` (must be active, not deleted, not locked) so role/company changes and lockouts take
effect on the next refresh rather than lasting the token's whole lifetime. A new access token is
signed with the **same `sid`**, the Redis session is re-stored, and the original refresh token is
returned unchanged.

## Tokens

[TokenService](token.service.ts) implements JWTs directly with `node:crypto` (header
`{ alg: 'HS256', typ: 'JWT' }`, base64url segments, HMAC-SHA256 signature over
`header.payload`). It is configured from `auth.*` config:

| Setting | Env var | Default |
| --- | --- | --- |
| Signing secret | `JWT_SECRET` | *(required in production; empty ⇒ `500`)* |
| Access token TTL | `ACCESS_TOKEN_TTL_SECONDS` | `900` (15 min) |
| Refresh token TTL | `REFRESH_TOKEN_TTL_SECONDS` | `604800` (7 days) |

- **Claims:** `sub`, `user_name`, `sid`, `user_type` (nullable), `company_id` (nullable), plus
  `iat`, `exp`, and `typ` (`access` / `refresh`).
- **Verification** ([`verifyToken`](token.service.ts)) enforces three-segment structure, the
  exact header, a constant-time signature comparison, and a full payload check — rejecting a
  wrong `typ`, a non-future `exp`, or an already-expired token with `401 Invalid access token`.
- `user_type` / `company_id` normalize to `null` when absent, so tokens minted before those
  claims existed still verify.

## Session tracking (Redis)

[AuthSessionService](auth-session.service.ts) is the source of truth for whether a token is still
live. Every operation **no-ops when Redis is disabled** and swallows Redis
`ServiceUnavailableException`s, so cache outages degrade to stateless-JWT behaviour rather than
locking users out.

- `storeTokenSession` — write the session (used by both login and refresh).
- `assertAccessTokenIsActive` / `assertRefreshTokenIsActive` — a missing key, a corrupt value, or
  any mismatch on `sid` / `sub` / `user_name` / token hash throws `401 ... is no longer active`.
- `revokeAccessTokenSession` — delete the `auth:session:<sid>` key, invalidating both tokens for
  that session (defined and exported, not yet wired to a route).

## Guard

[AccessTokenGuard](guards/access-token.guard.ts) is registered as a global `APP_GUARD` in
`app.module.ts`, so it protects **every** route unless the handler/class is marked `@Public()`.

- Requests to `@Public()` handlers and all `OPTIONS` (CORS preflight) requests pass through
  untouched.
- Otherwise it extracts a strict `Authorization: Bearer <token>` header (rejecting a missing or
  malformed header with `401`), then calls [`verifyAccessToken`](token.service.ts) and
  [`assertAccessTokenIsActive`](auth-session.service.ts).
- On success it attaches the verified payload to `request.user` and seeds
  `RequestContextService` with the user id, user type, and company id — the trusted context
  every downstream service reads (never taken from request headers).
