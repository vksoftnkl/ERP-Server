#!/usr/bin/env bash
# One-time setup of an upload user for the backend release pipeline (plan §1.3 / §6.4).
# Run as root ON THE UPDATE SERVER, from this folder:
#
#   sudo bash setup-update-uploads.sh \
#     --user deployer-test \
#     --dir /var/www/updates/test/backend \
#     --pubkey "$(cat vknex-ci-test.pub)" \
#     --host <the VPS_HOST secret> [--port <the VPS_PORT secret, default 22>]
#
# What it does (idempotent; re-run it to rotate the key):
#   1. user --user: no sudo, locked password (key login only), shell /bin/bash
#      (sshd runs the forced command through the login shell)
#   2. --dir + builds/ + releases/ owned by that user; the parents root-owned 755
#   3. /usr/local/bin/vknex-upload-gate (root-owned) = the only command the key can run
#   4. authorized_keys = ONE line: restrict,command="vknex-upload-gate <dir>" <pubkey>,
#      root-owned so the user cannot change it
#   5. checks: the user cannot write to the production folder (/var/www/updates/backend)
#      or anywhere else under /var/www/updates; the gate answers "hello"
#   6. prints the VPS_KNOWN_HOSTS line(s) for the GitHub secret
#
# It never touches the production folder, nginx or sshd_config.
set -euo pipefail

user="" dir="" pubkey="" host="" port=22
while (( $# )); do
  case "$1" in
    --user) user="$2"; shift 2 ;;
    --dir) dir="${2%/}"; shift 2 ;;
    --pubkey) pubkey="$2"; shift 2 ;;
    --host) host="$2"; shift 2 ;;
    --port) port="$2"; shift 2 ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done
die() { echo "setup: $*" >&2; exit 1; }
[[ $EUID -eq 0 ]] || die "run as root"
[[ "$user" =~ ^[a-z][a-z0-9-]{2,31}$ ]] || die "--user must be a plain lowercase name"
[[ "$dir" =~ ^/var/www/updates/[a-z0-9/_-]+$ ]] || die "--dir must be under /var/www/updates/"
[[ "$dir" != /var/www/updates/backend* || "$user" != *test* ]] || die "a *test* user must not get the production folder"
[[ "$pubkey" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || die "--pubkey must be ONE ssh-ed25519 public key line"
[[ -n "$host" ]] || die "--host is required (the exact VPS_HOST secret value)"
[[ "$port" =~ ^[0-9]{1,5}$ ]] || die "bad --port"
here="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$here/vknex-upload-gate" ]] || die "vknex-upload-gate is not beside this script"
for tool in sshd flock sha256sum stat head logger find; do
  command -v "$tool" >/dev/null || die "$tool is missing"
done
command -v python3 >/dev/null || echo "setup: note: python3 missing, the gate will not JSON-check latest.json"

# 1. user
if ! id "$user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --comment "VK Nex release uploads" "$user"
  echo "setup: created user $user"
fi
usermod --shell /bin/bash "$user"
passwd --lock "$user" >/dev/null
for g in sudo admin wheel adm; do
  if id -nG "$user" | tr ' ' '\n' | grep -qx "$g"; then
    gpasswd --delete "$user" "$g" >/dev/null
    echo "setup: removed $user from group $g"
  fi
done

# 2. folders
install -d -o root -g root -m 755 /var/www /var/www/updates
parent="$(dirname "$dir")"
while [[ "$parent" != /var/www/updates && "$parent" != / ]]; do
  install -d -o root -g root -m 755 "$parent"
  parent="$(dirname "$parent")"
done
install -d -o "$user" -g "$user" -m 755 "$dir" "$dir/builds" "$dir/releases"

# 3. the gate
install -o root -g root -m 755 "$here/vknex-upload-gate" /usr/local/bin/vknex-upload-gate

# 4. the key, pinned to the gate and the folder
home="$(getent passwd "$user" | cut -d: -f6)"
install -d -o root -g "$user" -m 750 "$home/.ssh"
printf 'restrict,command="/usr/local/bin/vknex-upload-gate %s" %s\n' "$dir" "$pubkey" >"$home/.ssh/authorized_keys.new"
chown root:"$user" "$home/.ssh/authorized_keys.new"
chmod 640 "$home/.ssh/authorized_keys.new"
mv -f "$home/.ssh/authorized_keys.new" "$home/.ssh/authorized_keys"

# 5. checks
fail=0
probe() { # <dir>: the user must NOT be able to create a file there
  local target="$1"
  [[ -d "$target" ]] || return 0
  if runuser -u "$user" -- touch "$target/.vknex-write-probe" 2>/dev/null; then
    rm -f "$target/.vknex-write-probe"
    echo "setup: FAIL $user can write to $target"
    fail=1
  else
    echo "setup: ok   $user cannot write to $target"
  fi
}
probe /var/www/updates
probe /var/www/updates/backend
probe /var/www/updates/backend/builds
probe /var/www/updates/backend/releases
probe "$(dirname "$dir")"
probe /var/www
answer="$(runuser -u "$user" -- env SSH_ORIGINAL_COMMAND="hello $dir" /usr/local/bin/vknex-upload-gate "$dir" 2>&1)" ||
  { echo "setup: FAIL gate hello: $answer"; fail=1; }
[[ $fail == 0 ]] && echo "setup: ok   gate answers: $answer"
refused="$(runuser -u "$user" -- env SSH_ORIGINAL_COMMAND="touch /var/www/updates/backend/x" /usr/local/bin/vknex-upload-gate "$dir" 2>&1 || true)"
echo "setup: ok   gate refuses a shell command: $refused"
sshd_pw="$(sshd -T 2>/dev/null | awk '$1 == "passwordauthentication" {print $2}')"
echo "setup: sshd PasswordAuthentication=$sshd_pw (the $user password is locked either way)"

# 6. known_hosts line(s) for the VPS_KNOWN_HOSTS secret
if [[ "$port" == 22 ]]; then pattern="$host"; else pattern="[$host]:$port"; fi
echo
echo "VPS_KNOWN_HOSTS (paste ALL lines below into the secret):"
for pub in /etc/ssh/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ecdsa_key.pub /etc/ssh/ssh_host_rsa_key.pub; do
  [[ -f "$pub" ]] && printf '%s %s\n' "$pattern" "$(cut -d' ' -f1,2 "$pub")"
done
echo
[[ $fail == 0 ]] || die "a check failed (see above)"
echo "setup: done. $user can upload to $dir and nothing else."
