# App version (Part B Step 2 Rev 2 + Step 4)

Records which client build each user and device runs, offers an "update
available" notice, and (Rev 2) does two things that can refuse a client:

1. **Build match.** While a platform's build policy is enforced, a login or
   refresh from that platform must send exactly the expected `X-App-Build`,
   else **426 `UPDATE_REQUIRED`**.
2. **Logout after a backend update.** When the backend starts on a new
   build (`build-info.json`, or `APP_BUILD`), every access and refresh token minted before it is refused
   with **401 `AUTH_BACKEND_UPDATED`**, so every user logs in again (and meets
   the build check).

Both are off until switched on. With no backend build (no `build-info.json`
and no `APP_BUILD`, the dev box), nothing is ever logged out. With `abp_enforce = false` on every platform (how a fresh
database starts), no build is ever refused.

Tables: `public.app_release`, `public.client_installation`,
`public.app_legacy_usage` (Step 1, migration `20261110170000_app_versioning`),
and `public.app_build_policy` + `public.app_auth_state` (Rev 2, migration
`20261111103000_app_build_policy`). The two Rev 2 tables are read and written
with raw SQL (`services/app-version-state.store.ts`).

## Client headers

Sent on every request. A missing or invalid value counts as absent. It is never
a 400. Parsed by `src/common/client-info/client-info.ts`.

| Header           | Value                                     |
|------------------|-------------------------------------------|
| `X-App-Platform` | `web` \| `desktop` \| `mobile` (any case) |
| `X-App-Build`    | CI build number, integer ≥ 1. 0 or junk = no build |
| `X-App-Version`  | display label, e.g. `1.2.0` (≤ 32 chars)  |
| `X-App-Commit`   | short git hash (≤ 40)                     |
| `X-Device-Id`    | the client's own device id (≤ 100). Absent = `unknown` |
| `X-Device-Os`    | e.g. `Windows 11 23H2` (≤ 100)            |

The build number is the identity: it must rise with every CI build of a
platform. The version label can stay the same across builds.

## Login and refresh

Order at `POST /auth/login`:

1. **Build check, first**, before the user lookup and the password. The
   platform is `X-App-Platform`, else the body's `device_type` (`web`/`browser`
   = web, `mobile`/`android`/… = mobile, anything else = desktop). If there is
   no platform at all, no policy applies.
2. Password, device, tokens. Both tokens carry `ep` (the current token epoch)
   and `platform` (the one resolved in step 1).
3. With platform + build headers: the installation is upserted in
   `client_installation` and the response gains `appUpdate` (the `/check`
   body). Without them the response is exactly the old one. A tracking failure
   is logged (`App version: could not …`) and ignored.

Order at `POST /auth/refresh`: verify the token, **epoch check** (401
`AUTH_BACKEND_UPDATED`), **build check** (the platform is `X-App-Platform`,
else the token's `platform` claim), session check, new access token. The
installation is recorded at most once per 10 minutes per device.

Every other protected route checks only the epoch (in `AccessTokenGuard`, from
memory). The build is not checked there (decision D7): every backend update
logs everyone out, so the next login meets the build check, and a policy
switched on by hand reaches a running client at its next refresh (≤ 15 min).

### 426 UPDATE_REQUIRED

```json
{
  "success": false,
  "statusCode": 426,
  "code": "UPDATE_REQUIRED",
  "platform": "desktop",
  "clientBuild": 10,
  "expectedBuild": 12,
  "message": "Please update VK Nex Desktop to continue.",
  "downloadUrl": "https://…/setup.exe",
  "errors": [{ "field": "x-app-build", "code": "UPDATE_REQUIRED", "message": "…" }],
  "path": "/api/v1/auth/login",
  "timestamp": "…"
}
```

`clientBuild` is null when the header was missing or unreadable. `message` is
the policy's `abp_message`, else `Please update VK Nex <Platform> to continue.`
`success` / `errors[]` keep the house shape, so a client that words refusals
from `errors[0].code` (today's Qt app) shows the message instead of a bare 426.
A newer build is refused too: the match is exact.

### 401 AUTH_BACKEND_UPDATED

Same house shape as every other auth 401. `field` is `authorization` (access
token) or `refresh_token`. A refresh will not help: go to the login screen.
Keep local / offline data.

## Logout after a backend update (token epoch)

`public.app_auth_state` (one row, `aas_key = 'auth'`) holds the epoch and the
backend build it was last raised for. At every start, in `onApplicationBootstrap`
(before the port opens), `BackendUpdateService`:

1. reads this backend's build (`APP_BUILD`, else `build-info.json`) and
   `compat.json`. If either is missing or invalid, it changes nothing and logs a
   warning. It also reads `releases.json`; a missing or invalid one only skips
   the release import;
2. in one transaction under `pg_advisory_xact_lock(hashtext('app_version'),
   hashtext('backend_update'))`, if the build ≠ `aas_last_build`: raises the
   epoch by one, stores the build, writes the expected builds into
   `app_build_policy` (rows with `abp_source = 'manual'` are left alone;
   `abp_enforce` is never touched) and imports `releases.json` into
   `app_release`. Two API processes starting together do it once;
3. still under the lock, best effort: closes the open `audit.user_login_sessions`
   rows (`uls_logout_type = 'BACKEND_UPDATE'`) and drops the Redis
   `auth:session:*` keys. The `ep` claim already refuses the old tokens;
4. loads the epoch and the policies into memory and re-reads both every 30 s,
   so a change made by another process arrives within 30 s. A step 2 that
   failed (database busy, migration not run) is retried at each re-read.

A restart, reboot or power cut on the same build changes nothing. A token with
no `ep` (minted before Rev 2) reads as epoch 0, so the first start of a backend
that has a build + `compat.json` logs everyone out once. That start is a
backend update. If the tables cannot be read, the last known state stands
(epoch 0 and nothing enforced on a fresh process). This never locks anyone out.
The step is skipped under `NODE_ENV=test` (e2e suites boot the app on the live
dev database).

## Package files (Step 4)

CI (`ci/backend/write-package-files.mjs`) writes three files into the backend
package. Samples: `deploy/package-files.example/`. They are looked for in
`APP_PACKAGE_DIR`, else beside the packed exe (`scripts/build-exe.js` copies
them there), else beside `package.json` (`src/common/package-files`).

**`build-info.json`**: `{ "version", "build", "commit", "builtAt" }`, this
backend's own build. `APP_VERSION` / `APP_BUILD` / `APP_COMMIT` each override
their field (the cloud). On-prem needs nothing in `.env` (closes D4).

**`compat.json`**: the client build this package expects per platform. CI
takes the latest live release of each platform from the registry, or a
`workflow_dispatch` override.

```json
{
  "backendBuild": 1057,
  "clients": {
    "web": 24,
    "desktop": { "expectedBuild": 120, "message": "…", "downloadUrl": "https://…" },
    "mobile": null
  }
}
```

- `backendBuild` is optional. If it is given, it must equal this backend's build.
- It **never switches enforcement**: `enforce` is an admin's call
  (`PATCH policy/:platform`), and a file that carries it is refused.
- A platform that is null or left out keeps its stored values; so does any
  field the file leaves null.
- Anything malformed rejects the whole file. The backend then behaves as if it
  were missing.

⚠ Exact match: with enforce on, a client released after a backend package is
not expected by that backend until the next backend package. On-prem: release
the clients first, then the backend package. Cloud: register the client with
`setExpected: true` (decision E3).

**`releases.json`**: every client release from the registry, yanked ones
included (`isDeleted: true`). On a new build it is upserted into `app_release`
(`*_created_by = system-update`), so the on-prem update notice works offline
(decision E4). It never deletes a row and never restores a yanked one (an older
list must not bring back a bad build). A row that already matches is left
untouched. `APP_RELEASES_IMPORT=false` skips it: set that on the cloud backend,
which IS the registry.

## Routes (`/api/v1/app-version/…`)

| Route | Auth | |
|---|---|---|
| `GET check?platform=&build=` | public | update notice; query falls back to the headers; never blocked by the build check |
| `GET policy` | admin | build policy of web, desktop, mobile |
| `PATCH policy/:platform` | admin | `{enforce?, expectedBuild?, message?, downloadUrl?}`; only the fields sent change; `null` clears. Setting `expectedBuild` / `message` / `downloadUrl` makes the row `manual` (backend updates leave it alone); switching `enforce` alone does not. `enforce:false` = emergency switch, applies at once |
| `POST policy/:platform/use-manifest` | admin | hand the row back to the bundled `compat.json` (its values, source `manifest`, enforce kept); 409 `APP_POLICY_NO_MANIFEST` if this server has none |
| `POST releases` | release | registers a client build → 201. `setExpected: true` also makes it this backend's expected build (same transaction, enforce untouched; a `manual` row is kept and the response says `expectedBuildSet: false`) |
| `PATCH releases/:platform/:build` | admin | severity / notes / link; `isDeleted: true` yanks, `false` restores |
| `GET releases?platform=&includeDeleted=` | release | live releases, newest first; `includeDeleted=true` adds yanked / inactive ones (CI build check, `releases.json`) |
| `GET installations?…` | admin | who runs what |
| `GET installations/summary?platform=&activeDays=30` | admin | per platform: builds in use, `oldestActiveBuild`, up to date vs behind |
| `GET legacy-usage?name=&platform=&build=` | admin | legacy-field counts per build |

**Admin** = a JWT (`Authorization: Bearer …`, else 401) of a user whose
`usr_type` is `ADMIN` or `SUPER ADMIN`, read from `user_master` on every call
(else 403 `APP_VERSION_ADMIN_ONLY`). **Release** = the same, plus
`RELEASE MANAGER`: the role of the CI user `ci-release` (decision E5; give it no
menus and one login channel). The `X-Ops-Key` / `OPS_API_KEY` of the first
version is gone. Writes stamp the user's id into `*_created_by` /
`*_modified_by`; startup writes stamp `system-update`.

Policy refusals: 400 `APP_POLICY_BUILD_REQUIRED` (the change would leave
`enforce = true` with no expected build). The DB also refuses it
(`ck_abp_enforce_build`).

### Release rules

- **Live** = `arl_is_deleted = false` and `arl_is_active = true`.
- **Severity** of a notice = the most urgent among *all* live builds above the
  client's build (`normal < recommended < critical`).
- **409 `APP_RELEASE_BUILD_EXISTS`**: the platform + build is already
  registered. A yanked build keeps its number.
- **409 `APP_RELEASE_BUILD_TOO_LOW`**: the build is lower than the highest
  build any client of that platform has reported. Set `cin_is_deleted = true`
  on a stray installation row to lower that floor.

## Error log

`createClientInfoMiddleware()` (first in `main.ts`) logs every response ≥ 400
except 401 and 404 as one `[HttpError]` line, 426 included:

```
426 POST /api/v1/auth/login code=UPDATE_REQUIRED platform=desktop build=10 version=1.2.0 device=pc-1
```

## Environment

| Variable | |
|---|---|
| `APP_BUILD` / `APP_VERSION` / `APP_COMMIT` | override `build-info.json` field by field (the cloud). On-prem: leave empty |
| `APP_PACKAGE_DIR` | read `build-info.json`, `compat.json`, `releases.json` from this folder |
| `APP_RELEASES_IMPORT` | `false` = never import `releases.json` (the cloud registry backend) |

`/health` (public, never blocked) adds `version`, `build`, `commit`, `builtAt`,
`dbOk`, `tokenEpoch` and `expectedClientBuilds: {web|desktop|mobile: {enforce, expectedBuild}}`.

## Turning enforcement on (Rev 2 §9)

Deploy with `enforce: false` for every platform. Turn a platform on
(`PATCH policy/:platform {"enforce": true}`; `compat.json` never does) only when:
its client build with 426 / 401 handling is installed; `GET installations`
shows that platform's devices sending headers; the expected build can be
downloaded. If it goes wrong, `PATCH policy/:platform {"enforce": false}` lets
everyone in again at once.
