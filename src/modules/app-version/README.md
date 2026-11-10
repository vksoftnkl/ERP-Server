# App version (Part B Step 2)

Records which client build each user and device runs. Offers an optional
"update available" notice. Gives CI a route to register releases.

**Old builds see no change.** Nothing here refuses a request because of a
version: there is no 426 and no minimum build. A client that does not send both
`X-App-Platform` and `X-App-Build` gets exactly the responses it always got,
and nothing about it is recorded.

Tables (Step 1, migration `20261110170000_app_versioning`): `public.app_release`,
`public.client_installation` and `public.app_legacy_usage`.

## Client headers

Every header is optional. A missing or invalid value counts as absent and is
never an error. Parsed by `src/common/client-info/client-info.ts`.

| Header           | Value                                     |
|------------------|-------------------------------------------|
| `X-App-Platform` | `web` \| `desktop` \| `mobile` (any case) |
| `X-App-Build`    | CI build number, integer ≥ 1. 0 or junk = no build |
| `X-App-Version`  | display label, e.g. `1.2.0` (≤ 32 chars)  |
| `X-App-Commit`   | short git hash (≤ 40)                     |
| `X-Device-Id`    | the client's own device id (≤ 100). Absent = `unknown` |
| `X-Device-Os`    | e.g. `Windows 11 23H2` (≤ 100)            |

A developer's local build should send no `X-App-Build` (or `0`), so it is not
tracked and cannot raise the build floor (see releases below).

## Login and refresh

- `POST /auth/login` with platform + build: upserts `client_installation`. The
  response gains an `appUpdate` object (`AppUpdateInfoDto`, the same body as
  `/check`). Without the headers, the response has no `appUpdate` key at all.
- `POST /auth/refresh` with platform + build: upserts the installation at most
  once per 10 minutes per (company, user, device, platform) in each API
  process. The response never changes.
- A failed write or check is logged (`App version: could not …`) and ignored.
  It never fails the login.
- The login body's `app_version` is counted as the legacy field
  `auth.login.app_version` (superseded by `X-App-Version`).

## Routes (`/api/v1/app-version/…`)

| Route | Auth | |
|---|---|---|
| `GET check?platform=&build=` | public | update notice; query falls back to the headers; read-only |
| `POST releases` | ops key | CI registers a build → 201 |
| `PATCH releases/:platform/:build` | ops key | change severity / notes / link; `isDeleted: true` yanks, `false` restores |
| `GET releases?platform=` | ops key | live releases, newest first |
| `GET installations?platform=&build=&companyId=&userId=&deviceId=&limit=&offset=` | ops key | who runs what |
| `GET installations/summary?platform=&activeDays=30` | ops key | per platform: builds in use, `oldestActiveBuild`, up to date vs behind |
| `GET legacy-usage?name=&platform=&build=` | ops key | legacy-field counts per build (flushes first) |

The ops key is `X-Ops-Key` = env `OPS_API_KEY`. If the key is unset, the ops
routes answer 403 `APP_VERSION_OPS_DISABLED`. A missing or wrong key answers
401 `APP_VERSION_OPS_KEY_INVALID`. An optional `X-Ops-Actor: ci:run-123`
header is stamped into `created_by` / `modified_by` as `ops:ci:run-123`.

CI example:

```sh
curl -fsS -X POST "$API/api/v1/app-version/releases" \
  -H "X-Ops-Key: $OPS_API_KEY" -H "X-Ops-Actor: ci:$RUN_ID" -H 'Content-Type: application/json' \
  -d '{"platform":"desktop","build":57,"version":"1.2.0","commit":"aa10be0d","severity":"normal","downloadUrl":"https://…"}'
```

### Release rules

- **Live** = `arl_is_deleted = false` and `arl_is_active = true`. Only live
  releases are offered or listed.
- **Severity** of a notice = the most urgent among *all* live builds above the
  client's build (`normal < recommended < critical`). A critical 11 under a
  normal 12 reads critical.
- **409 `APP_RELEASE_BUILD_EXISTS`**: the platform + build is already
  registered. A yanked build keeps its number.
- **409 `APP_RELEASE_BUILD_TOO_LOW`**: the build is lower than the highest
  build any client of that platform has reported (`client_installation`, not
  deleted). A build between existing releases is accepted, because CI jobs can
  finish out of order. One stray high build reported against an environment
  raises this floor. Set `cin_is_deleted = true` on that installation row to
  lower it again.

## Error log

`createClientInfoMiddleware()` is registered first in `main.ts`. It logs every
response ≥ 400, except 401 and 404, as one `[HttpError]` line:

```
409 POST /api/v1/app-version/releases code=APP_RELEASE_BUILD_EXISTS platform=desktop build=10 version=1.2.0 device=pc-1 company=<uuid> user=tester1
```

It works at the response rather than in `AllExceptionsFilter`, because about
ninety controller-scoped module filters answer before the global filter could.

## Environment

| Variable | |
|---|---|
| `OPS_API_KEY` | enables the ops routes; unset = 403 |
| `APP_VERSION` | backend version on `/health`; falls back to package.json |
| `APP_BUILD` / `APP_COMMIT` | backend build / commit on `/health`; set by CI |

`/health` adds `version`, `build`, `commit` and `dbOk` to its existing body.

## Audit columns

Creates set `*_created_on` / `*_created_by`, and updates set `*_modified_on` /
`*_modified_by`. Reads filter `*_is_deleted = false`, and releases also filter
`arl_is_active = true`. `*_sync_date` is never written here.
