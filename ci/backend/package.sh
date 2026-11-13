#!/usr/bin/env bash
# Release pipeline §2.2 steps 7-10: assemble, zip, check and hash one backend release.
#
#   vknex-backend-<version>-b<build>-<target>.zip      (target: win-x64 on the Windows runner)
#   └── vknex-backend-<version>-b<build>-<target>/
#       node.exe                 the Node that built node_modules (node on Linux)
#       dist/                    nest build output, no *.map, no *.tsbuildinfo
#       node_modules/            PRODUCTION dependencies only, with the Prisma engine
#                                for this OS and the Prisma CLI (migrate deploy)
#       prisma/schema.prisma     the generated schema
#       prisma/migrations/       every committed migration (cloud-sync is gitignored here)
#       prisma/seed/             boot seed SQL (read at startup)
#       assets/                  print fonts (read at startup)
#       package.json, package-lock.json
#       build-info.json, compat.json, releases.json
#       .env.example             a template only; the real .env lives OUTSIDE the folder
#   + <zip>.sha256               "<sha256>  <zip name>"
#
# Run from the repo root AFTER `npm run build` and `npm ci --omit=dev`, with the three
# JSON files written. Named files are copied (never a whole-tree copy of the repo), so
# src/, test/, .env*, certs/, logs/ and release/ cannot get in; check-package.mjs then
# proves it on the finished zip.
#
# Env:
#   BUILD          required
#   COMMIT         optional: build-info.json must carry it
#   VERSION        default: package.json version
#   TARGET         default: win-x64 on Windows, linux-x64 elsewhere
#   OUT_DIR        default: release
#   PACKAGE_MOVE   1 = move dist/ and node_modules/ into the package instead of copying
#                  (CI only: fast on Windows, but it empties the working tree)
# Writes name, zip, sha256, size (bytes) to $GITHUB_OUTPUT when set.
set -euo pipefail

: "${BUILD:?BUILD is required}"
[[ "$BUILD" =~ ^[0-9]{1,10}$ ]] || { echo "::error::package: BUILD must be digits (got $BUILD)"; exit 1; }
version="${VERSION:-$(node -p "require('./package.json').version")}"
[[ "$version" =~ ^[0-9A-Za-z.+-]{1,32}$ ]] || { echo "::error::package: bad version '$version'"; exit 1; }
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) os=win ;;
  *) os=linux ;;
esac
target="${TARGET:-$([[ $os == win ]] && echo win-x64 || echo linux-x64)}"
out="${OUT_DIR:-release}"
name="vknex-backend-${version}-b${BUILD}-${target}"
stage="$out/$name"
zip="$out/$name.zip"

die() { echo "::error::package: $*" >&2; exit 1; }

# ---- inputs
for need in dist/src/main.js node_modules prisma/schema.prisma prisma/migrations prisma/seed \
            assets package.json package-lock.json deploy/exe/.env.example \
            build-info.json compat.json releases.json; do
  [[ -e "$need" ]] || die "$need is missing"
done
node -e '
  const info = require("./build-info.json");
  if (String(info.build) !== process.argv[1]) { console.error(`build-info.json is for build ${info.build}`); process.exit(1); }
' "$BUILD" || die "build-info.json is not for build ${BUILD}"
maps="$(find dist -name '*.map' -type f | head -n 5)"
[[ -z "$maps" ]] || die "source maps in dist/ (sourceMap must be off in tsconfig.build.json): $maps"

# ---- production dependencies only, Prisma CLI kept (§2.2 step 7)
# (typescript is NOT a marker: @prisma/client and prisma install it as a peer)
for dev in jest ts-jest @nestjs/cli eslint prettier; do
  [[ ! -e "node_modules/$dev/package.json" ]] || die "node_modules/$dev is present: run npm ci --omit=dev first"
done
[[ -f node_modules/prisma/build/index.js ]] || die "the Prisma CLI is missing from the production install (prisma must stay in dependencies)"
echo "package: Prisma CLI in the production install:"
node node_modules/prisma/build/index.js --version | sed 's/^/    /'
if [[ $os == win ]]; then
  [[ -f node_modules/.prisma/client/query_engine-windows.dll.node ]] || die "the Windows Prisma query engine is missing"
  [[ -f node_modules/@prisma/engines/schema-engine-windows.exe ]] || die "the Windows Prisma schema engine is missing (migrate deploy needs it)"
fi

# ---- assemble (§2.2 step 8)
rm -rf "$stage" "$zip" "$zip.sha256"
mkdir -p "$stage/prisma"
node_bin="$(node -p 'process.execPath')"
if [[ $os == win ]]; then
  # Git Bash: C:\...\node.exe -> /c/.../node.exe. (Never pass a literal "/" argument to a
  # Windows program here: MSYS rewrites it to "C:/Program Files/Git/".)
  node_bin="$(cygpath -u "$node_bin")"
  cp "$node_bin" "$stage/node.exe"
else
  cp "$node_bin" "$stage/node"
fi
if [[ "${PACKAGE_MOVE:-0}" == 1 ]]; then
  mv dist node_modules "$stage/"
else
  cp -R dist node_modules "$stage/"
fi
cp prisma/schema.prisma "$stage/prisma/"
cp -R prisma/migrations prisma/seed "$stage/prisma/"
cp -R assets "$stage/"
cp package.json package-lock.json build-info.json compat.json releases.json "$stage/"
cp deploy/exe/.env.example "$stage/.env.example"
# Never shipped, wherever they came from: maps (dist and node_modules), build-info
# caches, stray engine backups, .env files.
find "$stage" -type f \( -name '*.map' -o -name '*.tsbuildinfo' \) -delete
find "$stage/node_modules/.prisma" -type f -name '*.bak' -delete 2>/dev/null || true
rm -rf "$stage/node_modules/.cache" # Prisma's engine download cache (~38 MB), never read at runtime
find "$stage" -type f \( -name '.env' -o -name '.env.*' \) ! -name '.env.example' -print -delete

# ---- zip
(
  cd "$out"
  if [[ $os == win ]] && command -v 7z >/dev/null 2>&1; then
    7z a -tzip -mx=5 -bso0 -bsp0 "$name.zip" "$name"
  elif command -v zip >/dev/null 2>&1; then
    zip -qrX "$name.zip" "$name"
  elif command -v 7z >/dev/null 2>&1; then
    7z a -tzip -mx=5 -bso0 -bsp0 "$name.zip" "$name"
  else
    die "neither 7z nor zip is available"
  fi
)

# ---- content check (§2.2 step 9)
node ci/backend/check-package.mjs "$zip" --platform "$os" --build "$BUILD" ${COMMIT:+--commit "$COMMIT"}

# ---- sha256 (§2.2 step 10)
sha="$(sha256sum "$zip" | cut -d' ' -f1)"
printf '%s  %s\n' "$sha" "$name.zip" >"$zip.sha256"
size="$(wc -c <"$zip" | tr -d ' ')"
echo "package: $zip ($size bytes)"
echo "package: sha256 $sha"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "name=$name"
    echo "zip=$zip"
    echo "sha256=$sha"
    echo "size=$size"
  } >>"$GITHUB_OUTPUT"
fi
