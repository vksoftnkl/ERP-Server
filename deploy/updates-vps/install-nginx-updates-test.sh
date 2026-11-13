#!/usr/bin/env bash
# Release pipeline §3.4: serve /var/www/updates/test/ through nginx, behind basic auth.
# Run as root ON THE VPS, from this folder:
#
#   sudo bash install-nginx-updates-test.sh --site /etc/nginx/sites-available/erp \
#     --server-name 169-58-213-171.sslip.io
#
#   1. nginx-updates-test.conf -> /etc/nginx/snippets/vknex-updates-test.conf
#   2. /etc/nginx/vknex-updates-test.htpasswd (user vknex-test, random password), only if
#      missing. The password is kept in /root/.vknex-updates-test.credentials (mode 600).
#   3. adds `include /etc/nginx/snippets/vknex-updates-test.conf;` to the server block with
#      that server_name, just above its first other `include`/`location`. The site file is
#      backed up first.
#   4. nginx -t. On failure, the backup is restored and nothing is reloaded. Else
#      `systemctl reload nginx` (graceful: open connections are not dropped).
# Idempotent: a second run changes nothing.
set -euo pipefail

site="" name=""
while (( $# )); do
  case "$1" in
    --site) site="$2"; shift 2 ;;
    --server-name) name="$2"; shift 2 ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done
die() { echo "nginx-setup: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "run as root"
[[ -f "$site" ]] || die "--site $site does not exist"
[[ -n "$name" ]] || die "--server-name is required"
here="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$here/nginx-updates-test.conf" ]] || die "nginx-updates-test.conf is not beside this script"
snippet=/etc/nginx/snippets/vknex-updates-test.conf
htpasswd=/etc/nginx/vknex-updates-test.htpasswd
creds=/root/.vknex-updates-test.credentials
include_line="include $snippet;"

# 1. snippet
install -d -m 755 /etc/nginx/snippets
install -o root -g root -m 644 "$here/nginx-updates-test.conf" "$snippet"

# 2. basic auth
if [[ ! -f "$htpasswd" ]]; then
  password="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
  ( umask 077; printf 'user=vknex-test\npassword=%s\n' "$password" >"$creds" )
  printf 'vknex-test:%s\n' "$(openssl passwd -apr1 "$password")" >"$htpasswd"
  chown root:www-data "$htpasswd"
  chmod 640 "$htpasswd"
  echo "nginx-setup: basic auth user vknex-test; password in $creds"
else
  echo "nginx-setup: $htpasswd already exists (kept)"
fi

# 3. the include line
if grep -qF "$include_line" "$site"; then
  echo "nginx-setup: $site already includes the snippet"
  changed=0
else
  backup="$site.bak-$(date +%Y%m%d%H%M%S)"
  cp -p "$site" "$backup"
  awk -v name="$name" -v line="    $include_line" '
    /server[ \t]*\{/ { in_server = 1; target = 0; done_here = 0 }
    in_server && $1 == "server_name" {
      for (i = 2; i <= NF; i++) { n = $i; sub(/;$/, "", n); if (n == name) target = 1 }
    }
    in_server && target && !done_here && !inserted && ($1 == "include" || $1 == "location") {
      print line; inserted = 1; done_here = 1
    }
    { print }
    END { if (!inserted) exit 3 }
  ' "$backup" >"$site.new" || { rm -f "$site.new"; die "no server block with server_name $name and an include/location line in $site"; }
  mv -f "$site.new" "$site"
  echo "nginx-setup: added the include to the $name server block (backup $backup)"
  changed=1
fi

# 4. test, reload or roll back
if ! nginx -t 2>&1; then
  if [[ "${changed}" == 1 ]]; then
    cp -p "$backup" "$site"
    echo "nginx-setup: nginx -t failed; $site restored from $backup" >&2
  fi
  die "nginx -t failed; nothing reloaded"
fi
systemctl reload nginx
echo "nginx-setup: reloaded. https://$name/updates/test/backend/latest.json now needs the basic-auth login."
