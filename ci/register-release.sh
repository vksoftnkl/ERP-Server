#!/usr/bin/env bash
# Part B Step 4 §7: registers one CLIENT release in the release registry
# (POST /app-version/releases) as the CI user. Run it only AFTER the artifact
# is uploaded / deployed, so a failed upload never leaves a registered build.
# Any non-2xx (409 = build already registered or too low, 401 = bad CI
# password, 403 = the CI user lacks the RELEASE MANAGER role) fails the job.
#
# Canonical copy: ERP-Server/ci/register-release.sh. The web, desktop and mobile
# repos carry the same file.
#
# Env (required): PLATFORM, BUILD, VERSION, CI_API_URL (…/api/v1), CI_USER, CI_PASSWORD
# Env (optional):
#   COMMIT        default: git rev-parse --short=8 HEAD
#   SEVERITY      normal (default) | recommended | critical
#   NOTES         default: commit subjects since the last registered release's commit
#   DOWNLOAD_URL  installer / store / web link
#   SET_EXPECTED  true = also make this build the expected one on that backend (E3, cloud)
# Needs curl, jq and git.
set -euo pipefail

: "${PLATFORM:?PLATFORM is required (web | desktop | mobile)}"
: "${BUILD:?BUILD is required}"
: "${VERSION:?VERSION is required (the version label, e.g. 1.2.0)}"
: "${CI_API_URL:?CI_API_URL is required}"
: "${CI_USER:?CI_USER is required}"
: "${CI_PASSWORD:?CI_PASSWORD is required}"
api="${CI_API_URL%/}"
commit="${COMMIT:-$(git rev-parse --short=8 HEAD)}"
severity="${SEVERITY:-normal}"
set_expected="${SET_EXPECTED:-false}"

die() { echo "::error::register-release: $*" >&2; exit 1; }
[[ "$BUILD" =~ ^[0-9]+$ && "$BUILD" -ge 1 ]] || die "BUILD must be a whole number > 0"
[[ "$set_expected" == true || "$set_expected" == false ]] || die "SET_EXPECTED must be true or false"

call() { # <method> <path> [body] -> sets $status and $resp (no subshell, so both survive)
  local out
  out="$(curl -sS -w '\n%{http_code}' -X "$1" "$api$2" -H 'Content-Type: application/json' \
    ${token:+-H "Authorization: Bearer $token"} ${3:+-d "$3"})"
  status="${out##*$'\n'}"
  resp="${out%$'\n'*}"
}

token=""
call POST /auth/login "$(jq -n --arg u "$CI_USER" --arg p "$CI_PASSWORD" '{usrLoginName: $u, usrPassword: $p}')"
login="$resp"
[[ "$status" == 2* ]] || die "CI login failed (HTTP $status $(jq -r '.errors[0].code // empty' <<<"$login" 2>/dev/null))"
token="$(jq -r '.access_token // empty' <<<"$login")"
[[ -n "$token" ]] || die "CI login answered without a token"

if [[ -z "${NOTES:-}" ]]; then
  # Default notes: the commit subjects since the last live release of this platform.
  call GET "/app-version/releases?platform=$PLATFORM"
  latest="$resp"
  since="$(jq -r 'first(.[] | .commit // empty) // empty' <<<"$latest" 2>/dev/null || true)"
  if [[ -n "$since" ]] && git cat-file -e "${since}^{commit}" 2>/dev/null; then
    NOTES="$(git log --no-merges --format='- %s' "${since}..HEAD" | head -n 50)"
  else
    NOTES="$(git log --no-merges --format='- %s' -n 10)"
  fi
fi

body="$(jq -n \
  --arg platform "$PLATFORM" --argjson build "$BUILD" --arg version "$VERSION" \
  --arg commit "$commit" --arg severity "$severity" --arg notes "${NOTES:0:10000}" \
  --arg url "${DOWNLOAD_URL:-}" --argjson setExpected "$set_expected" \
  '{platform: $platform, build: $build, version: $version, commit: $commit,
    severity: $severity, notes: $notes, setExpected: $setExpected}
   + (if $url == "" then {} else {downloadUrl: $url} end)')"
call POST /app-version/releases "$body"
created="$resp"
if [[ "$status" != 2* ]]; then
  die "registration of $PLATFORM build $BUILD failed (HTTP $status $(jq -r '.errors[0].code // empty' <<<"$created" 2>/dev/null)): $(jq -r '.message // empty' <<<"$created" 2>/dev/null)"
fi
echo "register-release: $PLATFORM build $BUILD ($VERSION, $commit) registered$(
  jq -r 'if has("expectedBuildSet") then (if .expectedBuildSet then "; now the expected build" else "; expected build NOT changed (policy row set by hand)" end) else "" end' <<<"$created")"
