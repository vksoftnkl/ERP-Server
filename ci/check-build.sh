#!/usr/bin/env bash
# Part B Step 4 §3.3: the build-number check every CLIENT release workflow runs
# BEFORE it builds. The number itself stays manual: one integer in
# app-build.json ({ "build": 24 }), raised by hand in the release commit. This
# only checks it.
#
#   1. app-build.json must hold a whole number > 0;
#   2. it must be HIGHER than the last build registered for the platform,
#      yanked ones included (a number is never reused, never lowered).
#
# Canonical copy: ERP-Server/ci/check-build.sh. The web, desktop and mobile
# repos carry the same file.
#
# Env: PLATFORM (web | desktop | mobile), CI_API_URL (…/api/v1), CI_USER,
#      CI_PASSWORD; BUILD_FILE (default app-build.json).
# Needs curl and jq. Writes build=<n> to $GITHUB_OUTPUT when it is set.
set -euo pipefail

: "${PLATFORM:?PLATFORM is required (web | desktop | mobile)}"
: "${CI_API_URL:?CI_API_URL is required}"
: "${CI_USER:?CI_USER is required}"
: "${CI_PASSWORD:?CI_PASSWORD is required}"
build_file="${BUILD_FILE:-app-build.json}"
api="${CI_API_URL%/}"

die() { echo "::error::check-build: $*" >&2; exit 1; }

case "$PLATFORM" in web | desktop | mobile) ;; *) die "PLATFORM must be web, desktop or mobile";; esac
[[ -f "$build_file" ]] || die "$build_file is missing"
build="$(jq -r '.build // empty | if type == "number" and . == floor and . > 0 then tostring else "bad" end' "$build_file" 2>/dev/null || echo bad)"
[[ -n "$build" && "$build" != "bad" && "$build" -le 2147483647 ]] \
  || die "$build_file must look like { \"build\": 24 } with a whole number > 0"

# Log in as the CI user. No X-App-* headers and no device_type: the client
# build check never applies to it.
login_body="$(jq -n --arg u "$CI_USER" --arg p "$CI_PASSWORD" '{usrLoginName: $u, usrPassword: $p}')"
login="$(curl -sS -w '\n%{http_code}' -X POST "$api/auth/login" -H 'Content-Type: application/json' -d "$login_body")"
status="${login##*$'\n'}"; login="${login%$'\n'*}"
[[ "$status" == 2* ]] || die "CI login failed (HTTP $status $(jq -r '.errors[0].code // empty' <<<"$login" 2>/dev/null))"
token="$(jq -r '.access_token // empty' <<<"$login")"
[[ -n "$token" ]] || die "CI login answered without a token"

list="$(curl -sS -w '\n%{http_code}' "$api/app-version/releases?platform=$PLATFORM&includeDeleted=true" -H "Authorization: Bearer $token")"
status="${list##*$'\n'}"; list="${list%$'\n'*}"
[[ "$status" == 2* ]] || die "reading the release list failed (HTTP $status $(jq -r '.errors[0].code // empty' <<<"$list" 2>/dev/null))"
last="$(jq -r '[.[].build] | max // 0' <<<"$list")"

echo "check-build: $PLATFORM last released $last -> $build_file $build"
if (( build <= last )); then
  die "Raise the build number in $build_file (last released: $last)"
fi
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "build=$build" >>"$GITHUB_OUTPUT"
fi
echo "check-build: OK"
