# App version (Part B Step 2, Rev 2)

Records which client build each user and device runs, offers an "update
available" notice, and (Rev 2) does two things that can refuse a client:

1. **Build match.** While a platform's build policy is enforced, a login or
   refresh from that platform must send exactly the expected `X-App-Build`,
   else **426 `UPDATE_REQUIRED`**.
2. **Logout after a backend update.** When the backend starts on a new
   `APP_BUILD`, every access and refresh token minted before it is refused
   with **401 `AUTH_BACKEND_UPDATED`**, so every user logs in again (and meets
   the build check).

Both are off until switched on. With no `APP_BUILD` (the dev box), nothing is
ever logged out. With `abp_enforce = false` on every platform (how a fresh
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
`APP_BUILD` it was last raised for. At every start, in `onApplicationBootstrap`
(before the port opens), `BackendUpdateService`:

1. reads `APP_BUILD` and the compat manifest. If either is missing or invalid,
   it changes nothing and logs a warning;
2. in one transaction under `pg_advisory_xact_lock(hashtext('app_version'),
   hashtext('backend_update'))`, if `APP_BUILD` ≠ `aas_last_build`: raises the
   epoch by one, stores the build, and writes the manifest into
   `app_build_policy` (rows with `abp_source = 'manual'` are left alone). Two
   API processes starting together raise it once;
3. after a raise, best effort: closes the open `audit.user_login_sessions` rows
   (`uls_logout_type = 'BACKEND_UPDATE'`) and drops the Redis `auth:session:*`
   keys. The `ep` claim already refuses the old tokens. This only tidies up;
4. loads the epoch and the policies into memory and re-reads both every 30 s,
   so a change made by another process arrives within 30 s.

A restart, reboot or power cut on the same build changes nothing. A token with
no `ep` (minted before Rev 2) reads as epoch 0, so the first start of a backend
that has `APP_BUILD` + a manifest logs everyone out once. That start is a
backend update. If the tables cannot be read, the last known state stands
(epoch 0 and nothing enforced on a fresh process). This never locks anyone out.

## Compat manifest

CI writes `compat-manifest.json` into the backend package. Example:
`deploy/compat-manifest.example.json`. It is looked for at `APP_COMPAT_MANIFEST`,
else beside the packed exe (`scripts/build-exe.js` copies it there), else
beside `package.json`.

```json
{
  "backendBuild": 57,
  "clients": {
    "web":     { "expectedBuild": 57,  "enforce": false },
    "desktop": { "expectedBuild": 120, "enforce": true,
                 "message": "Please update VK Nex Desktop", "downloadUrl": "https://…" },
    "mobile":  { "expectedBuild": 20,  "enforce": false }
  }
}
```

- `backendBuild` is optional. If it is given, it must equal `APP_BUILD`.
- `enforce` defaults to false, which is the rollout gate: turn a platform on
  only after its client handles 426 / 401 (Rev 2 §9). Mobile should stay false
  (decision D6: one Play Store build for every customer).
- A platform left out expects nothing (enforce false, no build).
- Anything malformed (unknown key, `enforce` without a build, …) rejects the
  whole file. The backend then behaves as if it were missing.

## Routes (`/api/v1/app-version/…`)

| Route | Auth | |
|---|---|---|
| `GET check?platform=&build=` | public | update notice; query falls back to the headers; never blocked by the build check |
| `GET policy` | admin | build policy of web, desktop, mobile |
| `PATCH policy/:platform` | admin | `{enforce?, expectedBuild?, message?, downloadUrl?}`; only the fields sent change; `null` clears; the row becomes `manual`. `enforce:false` = emergency switch, applies at once |
| `POST policy/:platform/use-manifest` | admin | hand the row back to the bundled manifest (its values, source `manifest`); 409 `APP_POLICY_NO_MANIFEST` if this server has none |
| `POST releases` | admin | CI registers a build → 201 |
| `PATCH releases/:platform/:build` | admin | severity / notes / link; `isDeleted: true` yanks, `false` restores |
| `GET releases?platform=` | admin | live releases, newest first |
| `GET installations?…` | admin | who runs what |
| `GET installations/summary?platform=&activeDays=30` | admin | per platform: builds in use, `oldestActiveBuild`, up to date vs behind |
| `GET legacy-usage?name=&platform=&build=` | admin | legacy-field counts per build |

**Admin** = a JWT (`Authorization: Bearer …`, else 401) of a user whose
`usr_type` is `ADMIN` or `SUPER ADMIN`, read from `user_master` on every call
(else 403 `APP_VERSION_ADMIN_ONLY`). The `X-Ops-Key` / `OPS_API_KEY` of the
first version is gone. CI logs in as such a user. Writes stamp that user's id
into `*_created_by` / `*_modified_by`. Startup writes stamp `system-update`.

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
| `APP_BUILD` | this backend's build. Set = logout-on-update and manifest loading are on |
| `APP_VERSION` / `APP_COMMIT` | shown on `/health`. `APP_VERSION` falls back to package.json |
| `APP_COMPAT_MANIFEST` | optional path of the compat manifest |

`/health` (public, never blocked) adds `version`, `build`, `commit`, `dbOk`,
`tokenEpoch` and `expectedClientBuilds: {web|desktop|mobile: {enforce, expectedBuild}}`.

## Turning enforcement on (Rev 2 §9)

Deploy with `enforce: false` for every platform. Turn a platform on (manifest
`enforce: true` in the next build, or `PATCH policy/:platform`) only when:
its client build with 426 / 401 handling is installed; `GET installations`
shows that platform's devices sending headers; the expected build can be
downloaded. If it goes wrong, `PATCH policy/:platform {"enforce": false}` lets
everyone in again at once.
