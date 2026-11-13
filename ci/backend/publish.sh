#!/usr/bin/env bash
# Release pipeline §2.2 step 11 + §3.2: upload one backend release to the update server,
# in an order that never shows a half file:
#
#   1. hello <UPLOAD_DIR>      the key's folder (authorized_keys) must be UPLOAD_DIR
#   2. latest                  the previous release; this build must be above it
#   3. clean                   drop *.part / *.tmp an interrupted run left behind (F8)
#   4. put-part <zip>          the zip, streamed as builds/<zip>.part
#   5. commit <zip> <sha256>   the SERVER hashes the .part: a mismatch deletes it and
#                              fails the job (F9); a match renames it to builds/<zip>
#                              and writes builds/<zip>.sha256
#   6. put-release <build>     releases/b<build>.json
#   7. put-latest              latest.json (tmp + rename), ALWAYS last
#   8. latest                  read back: it must name this build and sha256
#
# The server side is deploy/updates-vps/vknex-upload-gate (a forced command: this key
# can do the verbs above and nothing else, in its own folder only).
#
# Env (secrets of the GitHub Environment, never echoed):
#   VPS_HOST, VPS_PORT (default 22), VPS_USER, VPS_SSH_KEY (private key),
#   VPS_KNOWN_HOSTS (host key line(s); strict checking), UPLOAD_DIR, PUBLIC_BASE_URL
# Env (the build):
#   ZIP              path of the zip (its .sha256 beside it)
#   BUILD, VERSION, COMMIT, HAS_MIGRATIONS (true|false)
#   NOTES            release notes (default: the commit message of COMMIT)
# Local test seam: UPLOAD_GATE_LOCAL=<path of vknex-upload-gate> runs the gate directly
# with UPLOAD_DIR as its folder instead of over ssh.
set -euo pipefail

die() { echo "::error::publish: $*" >&2; exit 1; }
for v in ZIP BUILD VERSION COMMIT HAS_MIGRATIONS UPLOAD_DIR PUBLIC_BASE_URL; do
  [[ -n "${!v:-}" ]] || die "$v is not set"
done
if [[ -z "${UPLOAD_GATE_LOCAL:-}" ]]; then
  for v in VPS_HOST VPS_USER VPS_SSH_KEY VPS_KNOWN_HOSTS; do
    [[ -n "${!v:-}" ]] || die "secret $v is not configured in the GitHub Environment"
  done
fi
[[ "$BUILD" =~ ^[0-9]{1,10}$ ]] || die "bad BUILD"
[[ "$HAS_MIGRATIONS" == true || "$HAS_MIGRATIONS" == false ]] || die "HAS_MIGRATIONS must be true or false"
[[ -f "$ZIP" && -f "$ZIP.sha256" ]] || die "$ZIP or its .sha256 is missing"

zip_name="$(basename "$ZIP")"
[[ "$zip_name" == "vknex-backend-${VERSION}-b${BUILD}-"*.zip ]] || die "$zip_name is not the zip of version $VERSION build $BUILD"
sha="$(cut -d' ' -f1 "$ZIP.sha256")"
[[ "$sha" =~ ^[0-9a-f]{64}$ ]] || die "$ZIP.sha256 holds no sha256"
local_sha="$(sha256sum "$ZIP" | cut -d' ' -f1)"
[[ "$local_sha" == "$sha" ]] || die "the zip does not match its .sha256 (artifact damaged in transfer?)"
size="$(wc -c <"$ZIP" | tr -d ' ')"
url="${PUBLIC_BASE_URL%/}/builds/${zip_name}"

# ---------------------------------------------------------------- transport
if [[ -n "${UPLOAD_GATE_LOCAL:-}" ]]; then
  gate() { SSH_ORIGINAL_COMMAND="$*" "$UPLOAD_GATE_LOCAL" "$UPLOAD_DIR"; }
  echo "publish: LOCAL gate $UPLOAD_GATE_LOCAL -> $UPLOAD_DIR"
else
  ssh_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/vknex-ssh.XXXXXX")"
  trap 'rm -rf "$ssh_dir"' EXIT
  (
    umask 077
    printf '%s\n' "$VPS_SSH_KEY" | tr -d '\r' >"$ssh_dir/key"
    printf '%s\n' "$VPS_KNOWN_HOSTS" | tr -d '\r' >"$ssh_dir/known_hosts"
  )
  grep -q -- '-----BEGIN OPENSSH PRIVATE KEY-----' "$ssh_dir/key" ||
    die "VPS_SSH_KEY is not an OpenSSH private key (the value is not printed)"
  ssh_opts=(
    -i "$ssh_dir/key" -p "${VPS_PORT:-22}"
    -o BatchMode=yes -o IdentitiesOnly=yes -o IdentityAgent=none
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$ssh_dir/known_hosts"
    -o GlobalKnownHostsFile=/dev/null -o UpdateHostKeys=no
    -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=8
    -o LogLevel=ERROR
  )
  gate() { ssh "${ssh_opts[@]}" "$VPS_USER@$VPS_HOST" "$@"; }
fi

# ---------------------------------------------------------------- 1-3
echo "publish: 1/8 hello"
gate hello "$UPLOAD_DIR" || die "the update server refused the connection or the folder (wrong key, host key or UPLOAD_DIR?)"

echo "publish: 2/8 previous release"
previous="$(gate latest)" || die "cannot read latest.json"
prev="$(node -e '
  let j = {}; try { j = JSON.parse(process.argv[1] || "{}"); } catch { process.exit(3); }
  process.stdout.write(`${Number.isInteger(j.build) ? j.build : ""} ${typeof j.sha256 === "string" ? j.sha256 : ""}`);
' "$previous")" || die "the server's latest.json is not valid JSON"
read -r prev_build prev_sha <<<"$prev" || true
echo "publish: previous build ${prev_build:-none}, this build $BUILD"
if [[ "${prev_build:-}" == "$BUILD" && "${prev_sha:-}" == "$sha" ]]; then
  # A re-run of a publish job that failed after latest.json was written (e.g. at the tag).
  echo "publish: build $BUILD with this sha256 is already the latest release; nothing to upload"
  [[ -z "${GITHUB_OUTPUT:-}" ]] || echo "url=$url" >>"$GITHUB_OUTPUT"
  exit 0
fi
if [[ -n "${prev_build:-}" ]] && (( BUILD <= prev_build )); then
  die "build $BUILD is not above the released build $prev_build (workflow renamed? raise vars.BUILD_OFFSET)"
fi

echo "publish: 3/8 clean leftovers"
gate clean

# ---------------------------------------------------------------- 4-5
echo "publish: 4/8 upload $zip_name ($size bytes) as .part"
gate put-part "$zip_name" <"$ZIP" >/dev/null || die "upload failed (a .part may be left; the next run cleans it)"

echo "publish: 5/8 server-side sha256 check + rename"
gate commit "$zip_name" "$sha" || die "the server did not accept the upload (checksum mismatch or already released with other content)"

# ---------------------------------------------------------------- 6-7
release_json="$(mktemp)"
NOTES="${NOTES:-$(git log -1 --format=%B "$COMMIT" 2>/dev/null || true)}" \
URL="$url" SHA256="$sha" SIZE="$size" node -e '
  const e = process.env;
  const notes = (e.NOTES || "").trim().slice(0, 4000);
  const release = {
    version: e.VERSION,
    build: Number(e.BUILD),
    url: e.URL,
    sha256: e.SHA256,
    size: Number(e.SIZE),
    hasMigrations: e.HAS_MIGRATIONS === "true",
    notes,
    releasedAt: new Date().toISOString(),
    commit: e.COMMIT,
  };
  process.stdout.write(JSON.stringify(release, null, 2) + "\n");
' >"$release_json"

echo "publish: 6/8 releases/b$BUILD.json"
gate put-release "$BUILD" <"$release_json" || die "writing releases/b$BUILD.json failed (latest.json unchanged)"

echo "publish: 7/8 latest.json (last)"
gate put-latest <"$release_json" || die "writing latest.json failed (the old latest.json stays)"

# ---------------------------------------------------------------- 8
echo "publish: 8/8 read back"
after="$(gate latest)"
node -e '
  const j = JSON.parse(process.argv[1]);
  if (j.build !== Number(process.argv[2]) || j.sha256 !== process.argv[3]) {
    console.error(`latest.json reads build ${j.build} sha256 ${j.sha256}`);
    process.exit(1);
  }
' "$after" "$BUILD" "$sha" || die "latest.json on the server does not show this build"

echo "publish: done. $url"
cat "$release_json"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "url=$url"
    echo "previous=${prev_build:-}"
  } >>"$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  mb="$(node -e 'console.log((Number(process.argv[1]) / 1048576).toFixed(1))' "$size")"
  {
    echo "## Backend release b$BUILD uploaded"
    echo
    echo "| | |"
    echo "|---|---|"
    echo "| Build | **$BUILD** (previous: ${prev_build:-none}) |"
    echo "| Version | $VERSION |"
    echo "| Zip | \`$zip_name\` |"
    echo "| Size | $mb MB ($size bytes) |"
    echo "| sha256 | \`$sha\` |"
    echo "| Download | $url |"
    echo "| Has migrations | $HAS_MIGRATIONS |"
    echo "| Commit | \`$COMMIT\` |"
  } >>"$GITHUB_STEP_SUMMARY"
fi
rm -f "$release_json"
