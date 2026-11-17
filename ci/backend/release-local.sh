#!/usr/bin/env bash
# Build the Windows backend zip on THIS PC and upload it to the update server, without
# GitHub Actions. The same steps as .github/workflows/release.yml (guard, typecheck, unit
# tests, build without maps, zip, content check, sha256, upload through the VPS gate), run
# in a throwaway git worktree of HEAD: your working tree, its dist/ and node_modules/ are
# never touched, and uncommitted changes are NOT in the zip.
#
#   bash ci/backend/release-local.sh               everything, then asks before uploading
#   bash ci/backend/release-local.sh --yes         ... uploads without asking
#   bash ci/backend/release-local.sh --no-upload   build + content check only (the zip stays in out/)
#   bash ci/backend/release-local.sh --skip-tests  no typecheck / unit tests (the migration guard still runs)
#   bash ci/backend/release-local.sh --any-branch  allow a branch other than DEV-v1
#   bash ci/backend/release-local.sh --config FILE another channel's settings
#
# Settings: KEY=value lines in --config FILE, else $RELEASE_CONFIG, else
# ~/.config/vknex/release-dev.env:
#   VPS_HOST, VPS_PORT (22), VPS_USER, UPLOAD_DIR, PUBLIC_BASE_URL
#   VPS_SSH_KEY_FILE       the upload key (it can write only to UPLOAD_DIR, through the gate)
#   VPS_KNOWN_HOSTS_FILE   the VPS host key line(s)
# Work folder: $RELEASE_WORK, default ../release-local beside the repo (the worktree while
# building, the node.exe cache, and out/ with every zip built).
#
# Build number: one above the higher of the server's latest.json, every backend-build-* tag
# and 2000 (the workflow's BUILD_OFFSET); BUILD=<n> overrides it. A GitHub run that later
# gets a number at or below it is refused by publish.sh, and nothing is overwritten.
#
# The zip is a CROSS build. dist/ is plain JavaScript, the same on every OS. Then:
#   npm ci --omit=dev --os=win32 --cpu=x64   the Windows variants of packages with native parts
#   PRISMA_CLI_BINARY_TARGETS=windows        schema-engine-windows.exe (prisma migrate deploy)
#   binaryTargets ["native","windows"]       query_engine-windows.dll.node in the Prisma client
#   node.exe                                 nodejs.org, the .nvmrc version, sha256-checked
# Linux-only engines are removed, and check-package.mjs --platform win proves every Windows
# piece is in the zip.
set -euo pipefail

die() { echo "release-local: ERROR: $*" >&2; exit 1; }
note() { echo "release-local: $*"; }
step() { printf '\n==== %s  (%s)\n' "$*" "$(date +%H:%M:%S)"; }

yes=0 upload=1 tests=1 any_branch=0
config="${RELEASE_CONFIG:-$HOME/.config/vknex/release-dev.env}"
while (( $# )); do
  case "$1" in
    -y | --yes) yes=1; shift ;;
    --no-upload) upload=0; shift ;;
    --skip-tests) tests=0; shift ;;
    --any-branch) any_branch=1; shift ;;
    --config) config="${2:?--config needs a file}"; shift 2 ;;
    -h | --help) sed -n '2,/^set -euo/p' "$0" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option $1 (see --help)" ;;
  esac
done

ci="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" # helper scripts: this copy, not the commit's
repo="$(cd "$ci/../.." && pwd)"
work="${RELEASE_WORK:-$(dirname "$repo")/release-local}"
out="$work/out"
mkdir -p "$out"
exec 9>"$work/.lock"
flock -n 9 || die "another release-local run is going (lock $work/.lock)"
started=$SECONDS

# ---------------------------------------------------------------- settings
[[ -f "$config" ]] || die "no settings file $config (see --help)"
VPS_PORT=22
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  [[ "$key" =~ ^[[:space:]]*(#|$) ]] && continue
  key="${key//[[:space:]]/}"
  value="${value//$'\r'/}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#\"}"; value="${value%\"}"
  case "$key" in
    VPS_HOST | VPS_PORT | VPS_USER | UPLOAD_DIR | PUBLIC_BASE_URL | VPS_SSH_KEY_FILE | VPS_KNOWN_HOSTS_FILE)
      printf -v "$key" '%s' "$value" ;;
    *) die "$config: unknown setting '$key'" ;;
  esac
done <"$config"
for v in VPS_HOST VPS_USER UPLOAD_DIR PUBLIC_BASE_URL VPS_SSH_KEY_FILE VPS_KNOWN_HOSTS_FILE; do
  [[ -n "${!v:-}" ]] || die "$config: $v is not set"
done
[[ -f "$VPS_SSH_KEY_FILE" ]] || die "VPS_SSH_KEY_FILE $VPS_SSH_KEY_FILE does not exist"
[[ -f "$VPS_KNOWN_HOSTS_FILE" ]] || die "VPS_KNOWN_HOSTS_FILE $VPS_KNOWN_HOSTS_FILE does not exist"

gate() {
  ssh -i "$VPS_SSH_KEY_FILE" -p "$VPS_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o IdentityAgent=none \
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$VPS_KNOWN_HOSTS_FILE" \
    -o GlobalKnownHostsFile=/dev/null -o ConnectTimeout=20 -o LogLevel=ERROR \
    "$VPS_USER@$VPS_HOST" "$@"
}

# ---------------------------------------------------------------- 1. what is being released
step "1/8 commit and tools"
cd "$repo"
for tool in git node npm npx curl zip sha256sum ssh flock; do
  command -v "$tool" >/dev/null || die "$tool is not installed"
done
branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == DEV-v1 || $any_branch == 1 ]] ||
  die "you are on branch $branch; releases come from DEV-v1 (--any-branch to build it anyway)"
commit="$(git rev-parse HEAD)"
note "building commit ${commit:0:8} ($(git log -1 --format=%s "$commit")) on $branch"
dirty="$(git status --porcelain | wc -l)"
(( dirty == 0 )) || note "NOTE: $dirty uncommitted file(s) are NOT in this build; commit them first if they belong in it"
if git fetch -q origin 2>/dev/null; then
  git branch -r --contains "$commit" | grep -q . || note "NOTE: commit ${commit:0:8} is not pushed to origin yet"
else
  note "NOTE: git fetch failed (offline?); skipped the pushed check"
fi
node_want="$(git show "$commit:.nvmrc" | tr -d ' \r\n')"
[[ "$(node -v)" == "v$node_want" ]] ||
  die "node $(node -v) here, but .nvmrc wants v$node_want (the zip ships node.exe v$node_want)"

# ---------------------------------------------------------------- 2. server + build number
step "2/8 update server and build number"
gate hello "$UPLOAD_DIR" >/dev/null ||
  die "the update server refused the key or the folder ($VPS_USER@$VPS_HOST:$UPLOAD_DIR, settings $config)"
latest="$(gate latest)" || die "cannot read latest.json from the server"
read -r prev_build prev_commit < <(node -e '
  let j = {}; try { j = JSON.parse(process.argv[1] || "{}"); } catch { process.exit(3); }
  console.log(`${Number.isInteger(j.build) ? j.build : 0} ${j.commit || "-"}`);
' "$latest") || die "latest.json on the server is not valid JSON"
tag_build="$( { git tag --list 'backend-build-*'
                git ls-remote --tags origin 'backend-build-*' 2>/dev/null | sed 's|.*refs/tags/||; s|\^{}$||'; } |
              sed -n 's/^backend-build-\([0-9]\{1,10\}\)$/\1/p' | sort -n | tail -n 1)"
top=2000
(( prev_build > top )) && top=$prev_build
(( ${tag_build:-0} > top )) && top=$tag_build
build="${BUILD:-$(( top + 1 ))}"
[[ "$build" =~ ^[0-9]{1,10}$ ]] || die "bad BUILD $build"
(( build > prev_build )) || die "build $build is not above the server's build $prev_build"
note "server has build ${prev_build/#0/none}; this is build $build"
if [[ "$prev_commit" != - ]] && git cat-file -e "$prev_commit^{commit}" 2>/dev/null; then
  guard_base="$prev_commit"
  if git diff --quiet "$prev_commit" "$commit" -- prisma/migrations; then has_migrations=false; else has_migrations=true; fi
else
  guard_base=""
  has_migrations=true # first release, or the server's commit is unknown here
fi
if [[ -n "$guard_base" ]]; then
  note "hasMigrations: $has_migrations (prisma/migrations compared with the server's commit ${guard_base:0:8})"
else
  note "hasMigrations: true (no earlier release known, so the client runs migrate deploy)"
fi

# ---------------------------------------------------------------- 3. clean copy
step "3/8 clean copy of ${commit:0:8} + npm ci"
src="$work/src-b$build"
cleanup() {
  cd "$repo"
  git worktree remove --force "$src" 2>/dev/null || rm -rf "$src"
  git worktree prune
  rm -rf "$work/docs" # prisma-docs-generator writes ../../docs during npm ci
}
trap cleanup EXIT
git worktree prune
rm -rf "$src"
git worktree add -q --detach "$src" "$commit"
cd "$src"
export NODE_OPTIONS=--max-old-space-size=6144 # a fresh tsc over this tree peaks at ~3.8 GB
npm ci --no-audit --no-fund --loglevel=error # postinstall builds prisma/schema.prisma + the client
version="$(node -p "require('./package.json').version")"

# ---------------------------------------------------------------- 4. checks
step "4/8 migration guard, typecheck, unit tests"
bash "$ci/migration-guard.sh" ${guard_base:+"$guard_base"}
if (( tests )); then
  npx tsc --noEmit -p tsconfig.json
  npm test -- --ci --silent
else
  note "typecheck and unit tests SKIPPED (--skip-tests)"
fi

# ---------------------------------------------------------------- 5. build
step "5/8 build (no source maps) + build-info.json"
npx nest build --path tsconfig.release.json
maps="$(find dist -name '*.map' -type f | head -n 5)"
[[ -z "$maps" ]] || die "source maps in dist/: $maps"
BUILD="$build" COMMIT="$commit" VERSION="$version" node "$ci/write-package-files.mjs"

# ---------------------------------------------------------------- 6. Windows runtime
step "6/8 Windows production dependencies + node.exe"
PRISMA_CLI_BINARY_TARGETS=windows npm ci --omit=dev --os=win32 --cpu=x64 --no-audit --no-fund --loglevel=error
# (package.sh drops the Linux Prisma engines from a win-x64 zip.)
rm -rf node_modules/msgpackr-extract/build # a Linux compile, if npm made one; the win32 prebuild is used
node_exe="$work/node-v$node_want-win-x64.exe"
node_sum="$(curl -fsSL "https://nodejs.org/dist/v$node_want/SHASUMS256.txt" | awk '$2 == "win-x64/node.exe" { print $1 }')" ||
  die "cannot read SHASUMS256.txt for node v$node_want from nodejs.org"
[[ "$node_sum" =~ ^[0-9a-f]{64}$ ]] || die "nodejs.org lists no win-x64/node.exe for v$node_want"
if [[ ! -f "$node_exe" ]] || [[ "$(sha256sum "$node_exe" | cut -d' ' -f1)" != "$node_sum" ]]; then
  note "downloading node.exe v$node_want (win-x64)"
  curl -fsSL -o "$node_exe.tmp" "https://nodejs.org/dist/v$node_want/win-x64/node.exe"
  [[ "$(sha256sum "$node_exe.tmp" | cut -d' ' -f1)" == "$node_sum" ]] ||
    { rm -f "$node_exe.tmp"; die "node.exe does not match the sha256 nodejs.org publishes"; }
  mv -f "$node_exe.tmp" "$node_exe"
fi
note "node.exe v$node_want sha256 ok"

# ---------------------------------------------------------------- 7. zip
step "7/8 package, content check, sha256"
BUILD="$build" COMMIT="$commit" VERSION="$version" TARGET=win-x64 NODE_EXE="$node_exe" \
  OUT_DIR="$out" PACKAGE_MOVE=1 bash "$ci/package.sh"
name="vknex-backend-$version-b$build-win-x64"
zip="$out/$name.zip"
rm -rf "${out:?}/$name" # the unzipped staging folder; the zip + .sha256 stay
[[ -f "$zip" && -f "$zip.sha256" ]] || die "package.sh made no $zip"

# ---------------------------------------------------------------- 8. upload
step "8/8 upload"
size_mb=$(( $(wc -c <"$zip") / 1048576 ))
if (( ! upload )); then
  note "upload SKIPPED (--no-upload). Zip: $zip ($size_mb MB)"
  exit 0
fi
if (( ! yes )); then
  read -r -p "Upload build $build ($size_mb MB) to $VPS_HOST:$UPLOAD_DIR? [y/N] " answer || answer=""
  [[ "$answer" == [yY]* ]] || { note "not uploaded. Zip: $zip"; exit 0; }
fi
VPS_SSH_KEY="$(cat "$VPS_SSH_KEY_FILE")" VPS_KNOWN_HOSTS="$(cat "$VPS_KNOWN_HOSTS_FILE")" \
  VPS_HOST="$VPS_HOST" VPS_PORT="$VPS_PORT" VPS_USER="$VPS_USER" \
  UPLOAD_DIR="$UPLOAD_DIR" PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \
  ZIP="$zip" BUILD="$build" VERSION="$version" COMMIT="$commit" HAS_MIGRATIONS="$has_migrations" \
  bash "$ci/publish.sh"
git -C "$repo" tag "backend-build-$build" "$commit" 2>/dev/null &&
  note "tagged backend-build-$build here (to share it: git push origin backend-build-$build)"
mins=$(( (SECONDS - started) / 60 ))
printf '\nrelease-local: DONE in %d min. Build %s is on the server:\n  %s/builds/%s.zip\n' \
  "$mins" "$build" "${PUBLIC_BASE_URL%/}" "$name"
