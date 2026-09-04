#!/usr/bin/env bash
#
# Add (or remove) browser origins on the CORS allowlist and reload the API.
#
#     add-cors-origin.sh https://192.168.0.106:3001
#     add-cors-origin.sh --remove https://old-host:3001
#     add-cors-origin.sh --list
#
# In production main.ts uses ONLY the CORS_ORIGINS list -- the localhost
# development defaults are not merged in -- so an origin missing from it is
# refused at preflight with "No 'Access-Control-Allow-Origin' header".
set -euo pipefail

ENV_FILE=/opt/erp-server/app/.env
[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }

current() { grep '^CORS_ORIGINS=' "$ENV_FILE" | cut -d= -f2-; }

list() {
  echo "Allowed origins:"
  current | tr ',' '\n' | sed '/^$/d;s/^/  /'
}

case "${1:-}" in
  --list|"") list; exit 0 ;;
esac

MODE=add
if [ "$1" = "--remove" ]; then MODE=remove; shift; fi
[ $# -gt 0 ] || { echo "usage: $0 [--remove] <origin>..." >&2; exit 1; }

changed=0
for origin in "$@"; do
  # An Origin header is scheme://host[:port] with no path and no trailing slash.
  # A trailing slash is the single most common cause of a rule that never matches.
  if ! printf '%s' "$origin" | grep -qE '^https?://[A-Za-z0-9._-]+(:[0-9]{1,5})?$'; then
    echo "refusing malformed origin: '$origin'" >&2
    echo "  expected scheme://host[:port] with no trailing slash or path" >&2
    exit 1
  fi

  list_now=$(current)
  # Compare against whole comma-delimited fields so 'http://a.com' cannot match
  # inside 'http://a.com.evil.net'.
  if printf ',%s,' "$list_now" | grep -qF ",$origin,"; then
    present=yes
  else
    present=no
  fi

  if [ "$MODE" = add ]; then
    if [ "$present" = yes ]; then echo "already present: $origin"; continue; fi
    new="${list_now:+$list_now,}$origin"
  else
    if [ "$present" = no ]; then echo "not present: $origin"; continue; fi
    new=$(printf '%s' ",$list_now," | sed "s#,$origin,#,#" | sed 's/^,//;s/,$//')
  fi

  # Rewrite the single line without touching anything else in the file.
  python3 - "$ENV_FILE" "$new" <<'PY'
import sys, pathlib
path, value = pathlib.Path(sys.argv[1]), sys.argv[2]
lines = path.read_text().splitlines(keepends=True)
for i, line in enumerate(lines):
    if line.startswith('CORS_ORIGINS='):
        lines[i] = f'CORS_ORIGINS={value}\n'
        break
else:
    raise SystemExit('CORS_ORIGINS= line not found in .env')
path.write_text(''.join(lines))
PY
  echo "${MODE}ed: $origin"
  changed=1
done

if [ "$changed" -eq 0 ]; then echo "nothing to do."; list; exit 0; fi

chown erp:erp "$ENV_FILE"; chmod 600 "$ENV_FILE"

echo "reloading API..."
( cd /opt/erp-server && sudo -u erp HOME=/opt/erp-server pm2 reload erp-api --update-env >/dev/null )

for i in $(seq 1 30); do
  curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1 && break
  sleep 2
done
echo
list
