# User Login Sessions

CRUD API for **user login session records** — one row per login attempt/session, capturing the
device, tokens, client info, login/logout events and session status. Session rows are created,
updated, listed and soft-deleted independently of the live authentication flow.

- **Base route:** `user-login-sessions` (API-versioned — every route carries `@Version(API_VERSION)`)
- **Swagger tag:** `User Login Sessions`
- **Auth:** Bearer `access-token` (required)
- **Cache:** controller sets `@CacheTTL(60)`
- **Primary table:** `user_login_sessions` (`audit` schema) — PK `ulsId`

## Files

| File | Purpose |
| --- | --- |
| [user-login-sessions.module.ts](user-login-sessions.module.ts) | Module wiring — imports `AuditLogModule`, registers controller, service and exception filter |
| [user-login-sessions.controller.ts](user-login-sessions.controller.ts) | HTTP routes + Swagger docs |
| [user-login-sessions.service.ts](user-login-sessions.service.ts) | Business logic, persistence, audit logging |
| [user-login-sessions-exception.filter.ts](user-login-sessions-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `uls*` field names) |
| [dto/save-user-login-session.dto.ts](dto/save-user-login-session.dto.ts) | Single create/update payload |
| [dto/list-user-login-sessions-query.dto.ts](dto/list-user-login-sessions-query.dto.ts) | List query DTO (search / filters / pagination) |
| [dto/user-login-sessions-response.dto.ts](dto/user-login-sessions-response.dto.ts) | Swagger response models |
| [types/user-login-sessions-api.types.ts](types/user-login-sessions-api.types.ts) | Payload / response / error TypeScript contracts |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a session, chosen by `ulsId` presence in the body. |
| `GET` | `/list` | List sessions via the configured grid (search + pagination). |
| `GET` | `/get` | Fetch one active session by `ulsId` (UUID v7). |
| `DELETE` | `/delete` | Soft-delete a session by `ulsId` (UUID v7). |

### Create / update semantics

- **Omit `ulsId` → create; include `ulsId` → update** the existing row (`save` dispatches on
  `ulsId`). The controller's response message likewise switches on `ulsId`.
- Update loads the row with `ulsIsDeleted = false`; a missing/deleted row returns **not found**.
- On create, `ulsCreatedOn` and (in the payload) timestamps default to the current time. The
  actor for `ulsCreatedBy` / `ulsModifiedBy` is resolved from the payload's own
  `ulsCreatedBy` / `ulsModifiedBy` values, falling back to `RequestContextService.getUserId()`
  and finally `DEFAULT_ACTOR` (`resolveActor`).
- Only the optional fields actually present in the payload are written (`applyPresentFields`
  over `ulsDeviceId`, `ulsSessionId`, `ulsSessionToken`, `ulsRefreshTokenId`, `ulsLoginOn`,
  `ulsLogoutOn`, `ulsLogoutType`, `ulsLoginStatus`, `ulsFailReason`, `ulsIpAddress`,
  `ulsUserAgent`, `ulsAppVersion`, `ulsIsActiveSession`, `ulsIsActive`); `ulsCompanyId`,
  `ulsBranchId` and `ulsUserId` are always mapped from the DTO.
- Both create and update run inside a `$transaction` that persists the row and writes its audit
  entry together.

### Soft delete semantics

- **Soft delete only** — the row is never hard-deleted. `softDelete` runs in a `$transaction`
  and, for a row with `ulsIsDeleted = false`, sets `ulsIsDeleted = true`, `ulsIsActive = false`,
  `ulsIsActiveSession = false`, stamps `ulsLogoutOn` (keeping any existing value, else "now"),
  and updates `ulsModifiedOn` / `ulsModifiedBy`.
- A missing or already-deleted row (or an `updateMany` that affects 0 rows) returns **not found**.

### List semantics

- `/list` is powered by the configured-grid SQL engine (`ConfiguredGridSqlService` via
  `runConfiguredGridQuery`) keyed by table name `user login sessions` (alias
  `user_login_sessions_grid`), passing the query's `search` term and resolved pagination
  (`page` / `limit` / `skip`). If no configured grid is registered, it returns **not found**.
- The query DTO extends `FixedListQueryBaseDto` and additionally declares `ulsCompanyId`,
  `ulsBranchId`, `ulsUserId`, `ulsDeviceId`, `ulsLoginStatus`, `ulsIsActiveSession` and
  `ulsIsActive` filter params.

## Validation rules

- `ulsUserId` is a **required** UUID; `ulsCompanyId`, `ulsBranchId`, `ulsDeviceId` and
  `ulsSessionId` are nullable UUIDs; `ulsId` is an optional UUID.
- `ulsIpAddress` must be a valid IP (`@IsIP`).
- String length caps: `ulsSessionToken` / `ulsRefreshTokenId` 200, `ulsLogoutType` /
  `ulsLoginStatus` 20 (defaults `SUCCESS`), `ulsFailReason` 250, `ulsAppVersion` 40,
  `ulsCreatedBy` / `ulsModifiedBy` 100.
- `/get` and `/delete` validate `ulsId` with `ParseUUIDPipe({ version: '7' })`.
- A unique-constraint violation on save is mapped to a **conflict** on `ulsSessionId`
  ("Duplicate session is not allowed") via `throwOnUniqueConstraintError`.

## Audit logging

Every mutation is audited via `AuditLogService.logEntityChange` inside the same transaction —
actions `New` (create), `update`, and `cancel` (soft delete) — with `screenName`
`User Login Sessions`, `screenType` `master`, `pk` = `ulsId`, and `displayName` = the session's
`ulsSessionId` (falling back to `ulsId`). Create logs `originalRecord: null`; update and delete
capture original vs. modified payloads. The acting `userId` comes from `resolveActor` /
`RequestContextService.getUserId()`, falling back to `DEFAULT_ACTOR`.

## Errors

The module's `UserLoginSessionsExceptionFilter` extends `FixedExceptionFilter` and normalizes
errors to the module's shape, tagging offending fields by the `uls*` naming pattern
(`/\b(uls[A-Za-z0-9]+)\b/`).
