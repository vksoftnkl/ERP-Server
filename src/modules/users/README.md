# Users

CRUD API for **application user accounts** — the login identities stored in the
`user_master` table. This module owns basic user-master lifecycle (create, list, fetch,
update, soft-delete) and password hashing only; role/permission administration lives in
`settings/userAdministration` and sign-in/token issuance lives in the `auth` module.

- **Base route:** `users` (API-versioned via `API_VERSION` — every route carries `@Version(API_VERSION)`)
- **Swagger tag:** `Users`
- **Auth:** the whole controller is marked [`@Public()`](users.controller.ts) — **no bearer token is required**. Response caching is disabled via `@CacheTTL(0)`.
- **Primary table:** `user_master` (`public` schema) — PK `usrId` (`usr_id`, uuidv7)

## Files

| File | Purpose |
| --- | --- |
| [users.module.ts](users.module.ts) | Module wiring — **exports `UsersService`** for reuse |
| [users.controller.ts](users.controller.ts) | HTTP routes, Swagger docs, response mapping (`toResponse`) |
| [users.service.ts](users.service.ts) | Business logic, persistence, scrypt password hashing |
| [dto/create-user.dto.ts](dto/create-user.dto.ts) | Create payload (`user_phone`, `user_name`, `user_password`) |
| [dto/update-user.dto.ts](dto/update-user.dto.ts) | `PartialType(CreateUserDto)` — all fields optional |
| [dto/user-response.dto.ts](dto/user-response.dto.ts) | Swagger response model (safe, non-sensitive fields) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/` | Create a user. Returns `201` with the created user. |
| `GET` | `/` | List all non-deleted users. |
| `GET` | `/get` | Fetch one user by `id` (UUID query param, `ParseUUIDPipe`). |
| `PATCH` | `/:id` | Update a user by `id` (UUID route param). |
| `DELETE` | `/delete` | Soft-delete a user by `id` (UUID query param). Returns `204 No Content`. |

All responses are shaped by [`toResponse`](users.controller.ts), which exposes only
`usrId`, `usrLoginName`, `usrMobileNo`, `usrIsActive`, `usrCreatedOn` (ISO string) and
`usrModifiedOn` (ISO string or `null`). The password hash and all other columns are never returned.

### Create semantics

- `user_name` is **trimmed**, then checked for a case-insensitive collision against non-deleted
  users → throws `ConflictException` (`User with this username already exists`) if taken.
- The trimmed username is written to **both** `usrLoginName` and `usrDisplayName`.
- `user_phone` is trimmed and stored in `usrMobileNo`, or `null` if blank/absent.
- `user_password` is hashed (see below) into `usrPasswordHash`.
- All remaining columns take their Prisma/DB defaults.

### Update semantics

- The target must exist and be non-deleted (`getUserOrThrow`) → otherwise `NotFoundException`.
- If `user_name` is supplied **and** differs from the current login name, a case-insensitive
  uniqueness check runs excluding the current row → `ConflictException` on collision.
- **No-op short-circuit:** if no username, `user_phone === undefined`, and `user_password === undefined`,
  the existing user is returned unchanged with **no write**.
- Otherwise a partial update is built: `usrModifiedOn` is set to now; a supplied username updates
  `usrLoginName` **and** `usrDisplayName`; `user_phone` (when present) sets `usrMobileNo` (trimmed, or
  `null` if blank); `user_password` (when present) sets a freshly hashed `usrPasswordHash`.

### Delete semantics

- **Soft delete only.** `remove` runs an `updateMany` on non-deleted rows setting
  `usrIsDeleted = true`, `usrIsActive = false`, and `usrModifiedOn = now`. If nothing matched
  (`count === 0`) it throws `NotFoundException`. Rows are never hard-deleted.

### Password handling

- Hashing uses Node's [`scrypt`](users.service.ts): a random **16-byte** salt (hex) and a
  **64-byte** derived key.
- Stored format is `scrypt$<salt-hex>$<key-hex>`.
- The plaintext password is never persisted, logged, or returned.

### Validation

- `CreateUserDto` requires `user_phone`, `user_name`, and `user_password`, each `@IsString()`.
- `UpdateUserDto` is `PartialType(CreateUserDto)`, so every field is optional on update.

## Reuse from other modules

The module **exports `UsersService`**, and the `auth` module imports `UsersModule`
([auth.module.ts](../auth/auth.module.ts)). Alongside the CRUD methods, the service exposes
[`findByUsername`](users.service.ts) — a case-insensitive lookup of a non-deleted user by trimmed
login name (returns `null` for blank input) intended for authentication flows. Note that
`AuthService` currently authenticates directly via `PrismaService` and does not yet inject
`UsersService`, so `findByUsername` has no in-repo caller today.
