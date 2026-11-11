#!/usr/bin/env bash
# Part B Step 4: the migration guard. Fails when the Prisma datamodel changed
# since the last released backend but no migration was added (team rule
# 2026-11-10: no hand-run DDL; every table change ships as a migration).
#
# Why not `prisma migrate diff --from-migrations`: the committed migrations do
# not replay into an empty database (20260930190000_app_theme_tokens inserts
# menu rows whose parents only exist in seeded data), so a shadow-database diff
# fails on every run. This guard needs no database:
#   1. rebuild prisma/schema.prisma from the fragments at BASE and at HEAD;
#   2. `prisma migrate diff --from-schema-datamodel BASE --to-schema-datamodel HEAD`;
#   3. if the datamodels differ, at least one new prisma/migrations/*/migration.sql
#      must have been added between BASE and HEAD.
#
# BASE = $1, else the newest backend-build-* tag, else HEAD~1. Run from the repo
# root with node_modules installed. Exit 0 = OK, 1 = schema change without a
# migration (or an error).
set -euo pipefail

base="${1:-}"
if [[ -z "$base" ]]; then
  base="$(git tag --list 'backend-build-*' --sort=-v:refname | head -n 1)"
fi
if [[ -z "$base" ]]; then
  if git rev-parse --verify --quiet HEAD~1 >/dev/null; then
    base="HEAD~1"
    echo "migration-guard: no backend-build-* tag yet; comparing with HEAD~1 only"
  else
    echo "migration-guard: nothing to compare with (single commit); skipped"
    exit 0
  fi
fi
base_sha="$(git rev-parse --verify "${base}^{commit}")"
head_sha="$(git rev-parse --verify HEAD)"
echo "migration-guard: ${base} (${base_sha:0:8}) -> HEAD (${head_sha:0:8})"
if [[ "$base_sha" == "$head_sha" ]]; then
  echo "migration-guard: no new commits; OK"
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

schema_at() { # <commit> <dir>: the schema.prisma the fragments of <commit> build
  local commit="$1" dir="$2"
  mkdir -p "$dir"
  git archive "$commit" prisma scripts/build-prisma-schema.js | tar -x -C "$dir"
  (cd "$dir" && node scripts/build-prisma-schema.js >/dev/null)
}
schema_at "$base_sha" "$work/base"
schema_at "$head_sha" "$work/head"

prisma="node_modules/.bin/prisma"
# migrate diff reads the datasource block; no connection is made.
export DATABASE_URL="${DATABASE_URL:-postgresql://guard:guard@localhost:5432/guard}"
set +e
"$prisma" migrate diff \
  --from-schema-datamodel "$work/base/prisma/schema.prisma" \
  --to-schema-datamodel "$work/head/prisma/schema.prisma" \
  --exit-code >"$work/diff.txt" 2>&1
status=$?
set -e
case "$status" in
  0)
    echo "migration-guard: datamodel unchanged; OK"
    exit 0
    ;;
  2) ;;
  *)
    cat "$work/diff.txt"
    echo "::error::migration-guard: prisma migrate diff failed (exit $status)"
    exit 1
    ;;
esac

added="$(git diff --name-only --diff-filter=A "$base_sha" "$head_sha" -- 'prisma/migrations/*/migration.sql')"
echo "migration-guard: the datamodel changed:"
sed 's/^/    /' "$work/diff.txt"
if [[ -n "$added" ]]; then
  echo "migration-guard: new migration(s):"
  echo "$added" | sed 's/^/    /'
  echo "migration-guard: OK"
  exit 0
fi
echo "::error::Schema change without a migration: the Prisma fragments changed since ${base} but no prisma/migrations/<timestamp>_<name>/migration.sql was added. Write the migration (no hand-run DDL)."
exit 1
