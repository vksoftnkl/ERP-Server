# Backend release pipeline: ERP-Server

Push to `DEV-v1` → GitHub Actions checks the code, builds the backend on Windows, zips it
and uploads it to the folder in `vars.UPLOAD_DIR` on the VPS. That folder is a
**non-production** channel (`/var/www/updates/dev/backend`). Production
(`/var/www/updates/backend`) is never written by this setup. Pushes to other branches run
nothing.

| Workflow | Trigger | Does |
|---|---|---|
| `.github/workflows/release.yml` | push to `DEV-v1`, **Run workflow** button | `checks` (ubuntu) → `build` (windows-latest) → `publish` (ubuntu, repository secrets, DEV-v1 only) |

It replaced Part B Step 4's `backend-release.yml` (registry login + scp), which never ran.
Differences from the test repo below:

- Trigger branch `DEV-v1` (test repo: `main`).
- `BUILD_OFFSET` defaults to **2000**, above every test-repo build (1003-1012).
- Source maps are turned off by `tsconfig.release.json`, not `tsconfig.build.json`. The dev box
  keeps its maps, and `dist/` stays tracked here.
- Cloud sync is not in the zip: its module, migration and `syncDeletedRows.prisma` are
  gitignored here, and `CloudSyncModule` is commented out in `app.module.ts`.

Each run takes ~11 min, and its Windows job counts double against the GitHub Free minutes. A
push while a run is going waits. A second push while one waits replaces the waiting one, so
the intermediate commit gets no zip. Each zip is ~141 MB on the VPS and nothing prunes old
builds.

## ERP-Server setup (once, in this order)

1. **Key** (on your PC; the private half goes only into GitHub):
   ```bash
   ssh-keygen -t ed25519 -N '' -C vknex-ci-dev -f vknex-ci-dev
   ```
2. **VPS** (as root). Copy `deploy/updates-vps/` and `vknex-ci-dev.pub` there, then:
   ```bash
   sudo bash setup-update-uploads.sh --user deployer-dev --dir /var/www/updates/dev/backend \
     --pubkey "$(cat vknex-ci-dev.pub)" --host <VPS_HOST> --port 22
   ```
   It creates `deployer-dev`, which can write to that folder only, through the upload gate. It
   prints the `VPS_KNOWN_HOSTS` line(s). The test repo's `deployer-test` key is not touched.
3. **GitHub** → `vksoftnkl/ERP-Server` → Settings → Secrets and variables → Actions:
   - Repository **secrets**: `VPS_SSH_KEY` (the content of `vknex-ci-dev`), `VPS_HOST`,
     `VPS_USER` = `deployer-dev`, `VPS_KNOWN_HOSTS` (from step 2).
   - Repository **variables** (not secrets: a secret value is masked everywhere in the logs):
     `VPS_PORT` = `22`, `UPLOAD_DIR` = `/var/www/updates/dev/backend`,
     `PUBLIC_BASE_URL` = `https://<vps>/updates/dev/backend`.

   Then delete `vknex-ci-dev` (the private key) from your PC.
4. **Downloads** (the upload works without this, but `/updates/dev/` answers 404 until it is
   done). On the VPS, from the same folder:
   ```bash
   sudo bash install-nginx-updates-test.sh --channel dev --site /etc/nginx/sites-available/erp \
     --server-name <vps name>
   ```
   It installs `nginx-updates-dev.conf` as `/etc/nginx/snippets/vknex-updates-dev.conf`, adds the
   include to the 443 server block (backed up first), and reloads only if `nginx -t` passes. It
   reuses the test channel's login. From this PC, `release-test/vps-setup-dev.sh` runs steps 2
   and 4 together.
5. **Push** `DEV-v1`. If steps 1-3 aren't done, `publish` fails with "secret … is not
   configured". That is harmless: checks and the zip still run, and nothing is uploaded.

To share the test folder instead, run step 2 with `--user deployer-test --dir
/var/www/updates/test/backend`. That REPLACES the test repo's key, so the test repo stops
uploading.

---

# Test-repo record (`erp-part-b-step2`)

Push to `main` → GitHub Actions builds the backend on Windows → zips it → uploads it
to `/var/www/updates/test/backend/` on the VPS. Nothing else (no updater yet).

| Workflow | Trigger | Does |
|---|---|---|
| `.github/workflows/ci.yml` | push to `dev`, every PR | guard, schema + client, typecheck, build, no-map check, unit tests. No secrets, no upload |
| `.github/workflows/release.yml` | push to `main`, **Run workflow** button | `checks` (ubuntu) → `build` (windows-latest) → `publish` (ubuntu, repository secrets, main only) |

`release.yml` jobs:

1. **checks**: build number = `run_number + vars.BUILD_OFFSET` (default 1000; must be above the
   last `backend-build-*` tag), `hasMigrations` (did `prisma/migrations` change since that tag;
   first release = true), migration guard (base = that tag), typecheck, unit tests.
2. **build** (Windows): `npm ci` → `npm run build` (sourceMap off) → fail on any `dist/**/*.map`
   → `build-info.json` / `compat.json` / `releases.json` → `npm ci --omit=dev` → `ci/backend/package.sh`
   (Prisma CLI + Windows engines present, assemble, zip, **content check**, sha256) → artifact.
3. **publish** (only on `main`; repository secrets, see setup step 3): `ci/backend/publish.sh` through the upload gate, then tag
   `backend-build-<n>`. The deploy key exists only in this job, which runs no `npm install`.

The zip: `vknex-backend-<version>-b<build>-win-x64.zip`, one top folder of the same name:
`node.exe`, `dist/`, production `node_modules/` (Prisma CLI + Windows engines),
`prisma/schema.prisma` + `prisma/migrations/` + `prisma/seed/` (boot seed),
`assets/` (print fonts), `package.json`, `package-lock.json`, the three JSON files and
`.env.example`. `prisma/seed/` and `assets/` are not in the plan's list, but the server
reads them at startup.

## Server side: the upload gate

The CI key cannot open a shell. `authorized_keys` pins it to
`restrict,command="/usr/local/bin/vknex-upload-gate /var/www/updates/test/backend"`, so every
connection runs `deploy/updates-vps/vknex-upload-gate`. The gate accepts these verbs and no others,
in that one folder:

| Step (plan §3.2) | Verb |
|---|---|
| check the secret points at this folder | `hello <UPLOAD_DIR>` |
| previous release (build must go up) | `latest` |
| remove leftovers of an interrupted run (F8) | `clean` |
| 1. upload as `….zip.part` | `put-part <zip>` (stdin) |
| 2-3. sha256 on the server = CI value, then rename | `commit <zip> <sha256>` |
| 4. `releases/b<build>.json` | `put-release <build>` (stdin, tmp + rename) |
| 5. `latest.json`, always last | `put-latest` (stdin, tmp + rename) |

**One change from the plan's order:** the server verifies the sha256 of the `.part` **before**
renaming it. On a mismatch it deletes the `.part`, so a bad zip is never visible under its final
name. A released zip is never replaced: the same name with other content is refused.

The gate replaces `rrsync`. rrsync could not rename or hash on the server, both of which
§3.2 needs.

## Setup, in this order

1. **VPS** (as root; you, not CI). Copy `deploy/updates-vps/` to the VPS, then:
   ```bash
   ssh-keygen -t ed25519 -N '' -C vknex-ci-test -f vknex-ci-test   # on your PC; test-only key
   # copy vknex-ci-test.pub to the VPS, then on the VPS:
   sudo bash setup-update-uploads.sh --user deployer-test --dir /var/www/updates/test/backend \
     --pubkey "$(cat vknex-ci-test.pub)" --host <VPS_HOST> --port <VPS_PORT>
   ```
   It prints the `VPS_KNOWN_HOSTS` line(s). It also checks that `deployer-test` cannot write to
   `/var/www/updates/backend/` (the F10 file-permission half).
2. **nginx**: `deploy/updates-vps/nginx-updates-test.conf` goes into the 443 server block, with
   basic auth. Record the sha256 of production `/var/www/updates/backend/latest.json`, if it exists
   (plan §3.4).
3. **GitHub**: create the **private** repo `vksoftnkl/erp-part-b-step2`, with no README, so the
   first push is ours. vksoftnkl is on **GitHub Free**, and a private repo there has no
   Environments. So in Settings → Secrets and variables → Actions add:
   - **Repository secrets**: `VPS_SSH_KEY` (the content of `vknex-ci-test`), `VPS_HOST`,
     `VPS_USER` = `deployer-test`, `VPS_KNOWN_HOSTS`.
   - **Repository variables**: `VPS_PORT` = `22`, `UPLOAD_DIR` = `/var/www/updates/test/backend`,
     `PUBLIC_BASE_URL` = `https://<vps>/updates/test/backend`. None of them is secret. GitHub
     replaces every occurrence of a secret's value in the logs with `***`: a `VPS_PORT` secret of
     `22` garbled every "22" (in sha256 values, sizes, times), and a `PUBLIC_BASE_URL` secret hides
     the download URL. Secrets with these names still work.

   Then delete `vknex-ci-test` (the private key) from your PC. The publish job's
   `if: github.ref == 'refs/heads/main'` keeps uploads to `main`. On Pro/Team, or in a public
   repo, put the secrets in an Environment `test-release` limited to `main`, and add
   `environment: test-release` to the publish job.
4. **Push**: `git remote add origin git@github.com:vksoftnkl/erp-part-b-step2.git`,
   `git push -u origin main`, then `git push origin main:dev`. The `main` push is the first
   release run (E2). Steps 1-3 must be done first, or `publish` fails with "secret … is not
   configured". That failure is harmless: nothing gets uploaded.

## Running the tests (plan §4, §5)

| # | How | Where it is checked |
|---|---|---|
| E1 | commit a log line on `dev`, push | `ci.yml` runs; `release.yml` does not |
| E2-E3, E5 | merge `dev` into `main`, push; push again | job summary: build, zip, size, sha256, URL; build +1 |
| E4 | search the logs for the key / host | secrets are masked; `publish.sh` never echoes them |
| E6-E9 | on the VPS: `ls builds releases`, `sha256sum -c builds/*.sha256`, `cat latest.json` | gate step 5 + read-back step 8 |
| E12-E15 | download, `unzip -l` | `check-package.mjs` already failed the job if anything was off |
| E17-E20 | test Windows PC, see below | — |
| F1 | TypeScript error on `test/fail-build`, merge | `checks` → Typecheck fails; no build, no upload |
| F2 | break an `expect` in a spec | `checks` → Unit tests |
| F3 | edit a `prisma/**/*.prisma` fragment only | `checks` → Migration guard: "Schema change without a migration" |
| F4 | `"sourceMap": true` in **tsconfig.build.json** | `build` → No source maps |
| F5 | in `package.sh`, add `cp -R src "$stage/"` (or a `.env`) before the zip | `build` → content check |
| F6 | wrong `VPS_SSH_KEY` | `publish` step 1/8 fails ("refused the connection") |
| F7 | wrong `VPS_KNOWN_HOSTS` | step 1/8: "Host key verification failed" |
| F8 | cancel the run during step 4/8 | the VPS keeps at most `builds/*.part`; `latest.json` is unchanged; the next run's step 3/8 removes the leftover |
| F9 | in `publish.sh` change step 4 to `{ cat "$ZIP"; printf X; } \| gate put-part "$zip_name"` | step 5/8: "checksum mismatch … (upload deleted)" |
| F10 | add a step `ssh … deployer-test@<vps> "touch /var/www/updates/backend/x"` | gate: "refused: unknown command"; file permissions deny it too (setup check) |

Revert each `test/fail-*` change on `main` afterwards. After every failure, `latest.json` still
shows the previous good build, because it is written last.

### E17-E20 on a Windows test PC

```bat
:: C:\vknex-test\.env      <- a TEST .env, pointing to a COPY of a client DB
:: C:\vknex-test\releases\ <- unzip the release here
cd C:\vknex-test
set R=releases\vknex-backend-1.0.0-b1001-win-x64
%R%\node.exe %R%\node_modules\prisma\build\index.js migrate deploy --schema %R%\prisma\schema.prisma
%R%\node.exe %R%\node_modules\prisma\build\index.js migrate status --schema %R%\prisma\schema.prisma
%R%\node.exe %R%\dist\src\main.js
curl http://localhost:3011/api/v1/health
```

The server reads `.env` from the folder it is started in (`C:\vknex-test`) and writes `logs\`
there. Fonts, seeds and `build-info.json` come from the release folder.

## Moving to ERP-Server (plan §6)

- Same `release.yml`. Set `vars.RELEASE_ENVIRONMENT=production` and `vars.BUILD_OFFSET` above
  every test build. The plan's "required reviewer" on a **private** ERP-Server needs GitHub
  Enterprise. Without it, the gate is the trigger itself: drop `push` and keep only the
  **Run workflow** button, which needs write access to the repo.
- Carry back (these are not test-only): `tsconfig.build.json` sourceMap off, the
  `font.registry.ts` fix, the tax-rate spec fixtures, `ci/backend/*`, `deploy/updates-vps/*`,
  `.nvmrc`.
- Do NOT carry back: the `.gitignore` here (it commits cloud-sync and ignores `dist/`).
