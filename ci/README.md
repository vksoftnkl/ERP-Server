# CI release scripts (Part B Step 4)

Every release of every app has its own build number, and the number only goes
up. Frontends set it by hand in `app-build.json`. The backend's number is set by
CI. Every client release is registered in `app_release` by a CI user (a JWT;
there is no ops key).

| Platform | Build number | Who changes it |
|---|---|---|
| Web, desktop, mobile | `app-build.json` (`{ "build": 24 }`) in each repo | you, by hand, in the release commit |
| Backend | `github.run_number` + `vars.BACKEND_BUILD_OFFSET` | CI |

## Files

| File | Used by | What it does |
|---|---|---|
| `check-build.sh` | client release workflows, **before** building | `app-build.json` must be a whole number > 0 and higher than the last registered build of the platform (yanked ones included), else the job fails: "Raise the build number in app-build.json (last released: N)" |
| `register-release.sh` | client release workflows, **after** a successful upload | `POST /app-version/releases`. 409 / 401 / 403 / any non-2xx fail the job. `SET_EXPECTED=true` for the cloud (decision E3). Default notes = commit subjects since the last release |
| `backend/migration-guard.sh` | backend workflow | fails when the Prisma datamodel changed since the last `backend-build-*` tag but no migration was added |
| `backend/write-package-files.mjs` | backend workflow | writes `build-info.json`, `compat.json`, `releases.json` from the registry |
| `backend/package.sh` | backend workflow (Windows) | packs node.exe + dist + prod node_modules + prisma + assets + the three files into `erp-server-backend-<build>.zip`, with a `.sha256` |

`check-build.sh` and `register-release.sh` are the canonical copies. Copy them
into the web, desktop and mobile repos unchanged. They need `curl`, `jq` and
`git`.

### Why the migration guard does not replay migrations

The plan's `prisma migrate diff --from-migrations` needs every committed
migration to replay into an empty shadow database. They do not:
`20260930190000_app_theme_tokens` inserts menu rows whose parents exist only in
seeded data, so it fails with a foreign-key error. The guard instead builds
`schema.prisma` from the fragments at the last `backend-build-<n>` tag (else
`HEAD~1`) and at `HEAD`, diffs the two datamodels with
`prisma migrate diff --from-schema-datamodel … --to-schema-datamodel …` (no
database), and fails if they differ and no new `prisma/migrations/*/migration.sql`
was added in between. It checks that a migration exists. It cannot check that
the migration matches the schema.

## Backend workflow: `.github/workflows/backend-release.yml`

Triggers: the **Run workflow** button (`workflow_dispatch`, with optional
expected-build overrides for `compat.json` and an "upload" switch) or a push to
`release/**`. Steps: build number → `npm ci` → migration guard → `npm run build`
→ unit tests → the three package files → Windows packaging → upload to the
release storage → tag `backend-build-<n>`. Cloud deploy stays manual (E7).

**Never rename the workflow.** That resets `run_number`. If it happens, raise
`BACKEND_BUILD_OFFSET` above the last `backend-build-*` tag. The build-number
step refuses anything lower.

### One-time setup

1. On the cloud backend, create the user **`ci-release`** in User
   Administration: role **RELEASE MANAGER**, **no menus**, one login channel
   (e.g. web) switched on, a long random password. This role may only list and
   register releases. The RELEASE MANAGER role exists from this branch on.
2. GitHub, ERP-Server repo → Settings → Secrets and variables → Actions:

   | Kind | Name | Value |
   |---|---|---|
   | secret | `CI_API_URL` | `https://<cloud host>/api/v1` |
   | secret | `CI_USER` / `CI_PASSWORD` | the ci-release user |
   | secret | `RELEASE_SSH_HOST` / `RELEASE_SSH_USER` | the release storage host (E6: VPS static folder) |
   | secret | `RELEASE_SSH_KEY` | private key of a deploy key allowed only to write the release folder |
   | secret | `RELEASE_SSH_KNOWN_HOSTS` | `ssh-keyscan <host>` output |
   | variable | `RELEASE_DIR` | e.g. `/var/www/releases` (packages land in `<dir>/backend/<build>/`) |
   | variable | `BACKEND_BUILD_OFFSET` | `1000` (above every number used in testing) |

3. On the cloud backend set `APP_RELEASES_IMPORT=false`, because it is the
   registry. Keep `APP_BUILD` / `APP_COMMIT` there as an override if you deploy
   the cloud by hand from a checkout.

Nothing secret goes into a package: the scripts write no credentials and no
registry URL, and `package.sh` copies named files only (never `.env`).

## Client workflows (next round)

Each client repo gets `app-build.json`, the two scripts and a workflow shaped
like this:

```yaml
- name: Build-number check
  id: check
  env: { PLATFORM: desktop, CI_API_URL: ${{ secrets.CI_API_URL }}, CI_USER: ${{ secrets.CI_USER }}, CI_PASSWORD: ${{ secrets.CI_PASSWORD }} }
  run: bash ci/check-build.sh            # writes build=<n> to the step output
# … build with that number baked in, test, package, upload …
- name: Register the release
  env:
    PLATFORM: desktop
    BUILD: ${{ steps.check.outputs.build }}
    VERSION: 1.2.0                        # the version label, from CMakeLists / package.json / app.config
    DOWNLOAD_URL: https://<storage>/desktop/${{ steps.check.outputs.build }}/VKNexDesktop.exe
    SET_EXPECTED: 'true'                  # cloud (E3)
    SEVERITY: ${{ inputs.severity || 'normal' }}
    NOTES: ${{ inputs.notes }}
    CI_API_URL: ${{ secrets.CI_API_URL }}
    CI_USER: ${{ secrets.CI_USER }}
    CI_PASSWORD: ${{ secrets.CI_PASSWORD }}
  run: bash ci/register-release.sh
```

A mobile OTA update (EAS Update) changes no build number and is not registered.
