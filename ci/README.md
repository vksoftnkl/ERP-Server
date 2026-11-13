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
| `backend/write-package-files.mjs` | backend workflow | writes `build-info.json`, `compat.json`, `releases.json` (from the registry when `CI_API_URL` is set, else an empty release list) |
| `backend/package.sh` | backend workflow (Windows) | packs node.exe + dist + prod node_modules + prisma + assets + the three files into `vknex-backend-<version>-b<build>-win-x64.zip`, runs the content check, writes the `.sha256` |
| `backend/check-package.mjs` | `package.sh` | lists the zip and fails on a missing required or a present forbidden path |
| `backend/publish.sh` | backend workflow (publish job) | uploads through the gate: `.part` → server sha256 → rename → `releases/b<n>.json` → `latest.json` |

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

## Backend workflows

See [RELEASE-PIPELINE.md](RELEASE-PIPELINE.md). `release.yml` covers `DEV-v1`: a Windows zip,
uploaded to the update server through `deploy/updates-vps/vknex-upload-gate`. It replaces the
earlier `backend-release.yml` (registry login + scp). There is no `ci.yml` here (the test repo
has one for dev pushes and PRs).

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
