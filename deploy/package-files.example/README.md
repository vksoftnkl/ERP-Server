# Backend package files (Part B Step 4)

CI writes these three files into the backend package root (beside package.json,
or beside the exe). Samples only: the real ones come from
`ci/backend/write-package-files.mjs`. See `src/modules/app-version/README.md`.

| File | What the backend does with it |
|---|---|
| `build-info.json` | its own version / build / commit / builtAt (`/health`, logout after an update). `APP_*` env vars override it |
| `compat.json` | on a new build: the expected client build per platform into `app_build_policy` (never `enforce`) |
| `releases.json` | on a new build: upserted into `app_release` (never deletes, never un-yanks) |
