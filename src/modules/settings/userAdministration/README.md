# User Administration

CRUD API for **application users** — their login credentials, profile, login/edit
capabilities and user **type**, together with each user's per-menu **permission**
assignments (view / create / edit / delete / print / export).

- **Base route:** `user-administration` (API-versioned via `API_VERSION`)
- **Swagger tag:** `User Administration`
- **Auth:** Bearer `access-token` (required)
- **Primary table:** `user_master` (`public` schema) — PK `usrId`
- **Nested table:** `user_menus` (`public` schema) — PK `umId`, FK `umUserId → usrId`, unique `(umUserId, umMenuId)` (`uq_user_menus_user_menu`)

## Files

| File | Purpose |
| --- | --- |
| [user-administration.module.ts](user-administration.module.ts) | Module wiring — imports `AuditLogModule`; registers the controller, service, and exception filter (service is **not** exported) |
| [user-administration.controller.ts](user-administration.controller.ts) | HTTP routes + Swagger docs |
| [user-administration.service.ts](user-administration.service.ts) | Business logic, persistence, password hashing, menu replacement, audit logging |
| [user-administration-exception.filter.ts](user-administration-exception.filter.ts) | Maps DB/domain errors to the module's error shape (matches `usr*` / `um*` field names) |
| [dto/save-user-administration.dto.ts](dto/save-user-administration.dto.ts) | Create/update payload (`SaveUserAdministrationDto` + nested `SaveUserMenuDto`) |
| [dto/user-administration-response.dto.ts](dto/user-administration-response.dto.ts) | Swagger response models |
| [types/user-administration-api.types.ts](types/user-administration-api.types.ts) | Payload / response TypeScript contracts |
| [types/user-administration.enum.ts](types/user-administration.enum.ts) | App-layer enum (see below) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/create` | Create **or** update a user (by `usrId` presence) with menu permissions. |
| `GET` | `/get` | Fetch one user by `usrId`, including all active menu permissions and resolved company/branch names. |
| `DELETE` | `/delete` | Soft-delete a user and all their menu assignments by `usrId`. |

`usrId` on `/get` and `/delete` is validated as a **UUID v7** query parameter
(`ParseUUIDPipe({ version: '7' })`). The controller carries `@CacheTTL(1)`.

### Create / update semantics

- **Omit `usrId` → create; include `usrId` → update** the existing user
  ([`save`](user-administration.service.ts) branches to `createUser` / `updateUser`).
- Each write runs in a single `$transaction` (user row + menu replacement + audit entry).
- Optional profile fields are applied only when **present** in the payload
  (`applyOptionalUserFields`); an omitted key leaves the stored value unchanged.
- `usrDisplayName` is nullable in the DTO but the column is `NOT NULL`, so an empty/null
  value collapses to `''`.
- Update requires the target to be an **active** user (`usrIsDeleted = false`); otherwise a
  not-found error is raised.

### Password handling

- `usrPassword` is **plain text** in the payload, **required on create** (a blank value
  raises a validation error) and **optional on update** (omit to keep the existing hash).
- Hashing uses Node's **scrypt** with a random 16-byte salt and a 64-byte derived key, stored
  as `scrypt$<salt-hex>$<derived-hex>` in `usrPasswordHash` (`hashPassword`).
- On update, supplying a new password also sets `usrPasswordChangedOn = now` and clears
  `usrMustChangePassword`.
- The password hash is **never** returned — response payloads omit `usrPasswordHash`.

### Menu permissions (roles)

Menu-level access is managed through the `menus[]` array on the create/update payload
(`replaceUserMenus`):

- The array is a **full replacement set**: all of the user's currently active menus are
  soft-deleted first, then each supplied menu is upserted (on `uq_user_menus_user_menu`,
  reviving any previously soft-deleted row).
- **Omitting `menus` on update leaves existing assignments unchanged**; sending an **empty
  array clears all** of them. On create, an absent array defaults to none.
- Each entry carries CRUD/print/export permission flags (`umCanView` defaults `true`, the rest
  default `false`) plus user preferences (`umVisibility`, `umIsFavourite`, `umIsPinned`,
  `umSortOrder`).
- Every referenced `umMenuId` must exist and be **active** in `menu` (`menuIsActive = true`);
  unknown or inactive ids raise a bad-request error listing them.

### Uniqueness & validation

- **Login name is unique**, case-insensitive, across non-deleted users (`ensureLoginNameUnique`,
  excluding the user itself on update) — it is **not** scoped by company.
- A DB unique-constraint violation is mapped to a conflict on `usrLoginName`
  (`handleWriteError` → `throwOnUniqueConstraintError`).
- `usrType` is validated against the `UserType` enum; empty string coerces to `undefined`,
  explicit `null` is allowed.

### Get semantics

- Returns the active user with active menus ordered by `umMenuId`, and resolves related
  `usrCompanyName` / `usrBranchName` (`resolveRelatedNames`) — these related names are populated
  **only** on the get endpoint, not on create/update responses.

### Soft delete

- **Soft delete only** — rows are never hard-deleted. Deleting flags `usrIsDeleted = true` /
  `usrIsActive = false` on the user and `umIsDeleted = true` on every one of their active menu
  rows, within one transaction.

### Audit logging

- Every mutation is audited via `AuditLogService.logEntityChange` (`New` / `update` / `cancel`)
  against table `user_master`, screen `User Administration` (type `master`), capturing original
  vs. modified records. The acting user comes from `RequestContextService.getUserId()`, falling
  back to `DEFAULT_ACTOR`.

## Enums (app-layer)

Defined in [types/user-administration.enum.ts](types/user-administration.enum.ts):

- `UserType` — `SUPER ADMIN` · `ADMIN` · `MANAGER` · `USER` · `CASHIER` · `VIEWER` · `SYSTEM`
