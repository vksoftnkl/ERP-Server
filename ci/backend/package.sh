#!/usr/bin/env bash
# Part B Step 4 §4.1: packs one backend build for on-prem (Part A updater format):
#
#   erp-server-backend-<build>/
#     node.exe (node on Linux)   the Node runtime that built the production node_modules
#     dist/                      nest build output
#     node_modules/              PRODUCTION dependencies (npm ci --omit=dev on the
#                                target OS, so native addons and the Prisma engine fit)
#     prisma/                    schema, migrations, seeds (read at startup)
#     assets/                    fonts for printing
#     package.json, package-lock.json
#     build-info.json, compat.json, releases.json   (ci/backend/write-package-files.mjs)
#     .env.example               deploy/exe/.env.example
#
# Then a zip of that folder and a sha256 file beside it.
# Run from the repo root AFTER `npm ci --omit=dev` and with dist/ and the three
# JSON files in place. Env: BUILD (required), OUT_DIR (default out).
# Prints the zip path as zip=<path> to $GITHUB_OUTPUT when set.
set -euo pipefail

: "${BUILD:?BUILD is required}"
out="${OUT_DIR:-out}"
name="erp-server-backend-${BUILD}"
stage="$out/$name"

die() { echo "::error::package: $*" >&2; exit 1; }
for need in dist/src/main.js node_modules prisma/schema.prisma package.json \
            build-info.json compat.json releases.json; do
  [[ -e "$need" ]] || die "$need is missing"
done
grep -q "\"build\": *${BUILD}\b" build-info.json || die "build-info.json is not for build ${BUILD}"

rm -rf "$stage" "$out/$name.zip" "$out/$name.zip.sha256"
mkdir -p "$stage"

node_bin="$(node -p 'process.execPath')"
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) cp "$node_bin" "$stage/node.exe" ;;
  *) cp "$node_bin" "$stage/node" ;;
esac
cp -R dist node_modules prisma "$stage/"
[[ -d assets ]] && cp -R assets "$stage/"
cp package.json "$stage/"
[[ -f package-lock.json ]] && cp package-lock.json "$stage/"
cp build-info.json compat.json releases.json "$stage/"
cp deploy/exe/.env.example "$stage/.env.example"
# Nothing secret goes into a package (Step 4 §2).
rm -f "$stage/.env" "$stage"/prisma/.env

(
  cd "$out"
  if command -v 7z >/dev/null 2>&1; then
    7z a -tzip -mx=5 "$name.zip" "$name" >/dev/null
  elif command -v zip >/dev/null 2>&1; then
    zip -qr "$name.zip" "$name"
  else
    die "neither 7z nor zip is available"
  fi
  sha256sum "$name.zip" >"$name.zip.sha256"
)
size="$(du -h "$out/$name.zip" | cut -f1)"
echo "package: $out/$name.zip ($size)"
cat "$out/$name.zip.sha256"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "zip=$out/$name.zip" >>"$GITHUB_OUTPUT"
  echo "name=$name" >>"$GITHUB_OUTPUT"
fi
