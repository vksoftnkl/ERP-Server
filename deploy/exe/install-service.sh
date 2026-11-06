#!/bin/bash
# Makes the ERP server start automatically when this PC boots, before anyone
# logs in. It runs in the background as the systemd service "erp-server".
#
#   sudo ./install-service.sh                 install (or update) and start it now
#   sudo ./install-service.sh --user NAME     run the server as NAME (default: the
#                                             user who ran sudo, else the folder's owner)
#        ./install-service.sh --print         only show the service file it would write
#
# Run it again after moving this folder. Remove it with: sudo ./uninstall-service.sh
set -u

SERVICE=erp-server
UNIT_FILE=/etc/systemd/system/$SERVICE.service
DIR=$(dirname "$(readlink -f "$0")")

RUN_USER=""
PRINT_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --user) RUN_USER=${2:-}; shift 2 ;;
    --print) PRINT_ONLY=1; shift ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
  esac
done

if [ -z "$RUN_USER" ]; then
  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then RUN_USER=$SUDO_USER
  else RUN_USER=$(stat -c %U "$DIR"); fi
fi
if ! id "$RUN_USER" >/dev/null 2>&1; then
  echo "User \"$RUN_USER\" does not exist." >&2; exit 1
fi
RUN_GROUP=$(id -gn "$RUN_USER")

# systemd expands % in unit files, so a literal % in the folder path must be %%.
SD_DIR=${DIR//%/%%}

unit_text() {
  cat <<EOF
# Written by $DIR/install-service.sh. Run that script again to update this file.
[Unit]
Description=ERP server ($SD_DIR)
After=network-online.target postgresql.service
Wants=network-online.target
# Never give up restarting after a crash.
StartLimitIntervalSec=0

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$SD_DIR
ExecStart="$SD_DIR/erp-server-service.sh"
Restart=on-failure
RestartSec=5
# Node exits with 143 when systemd stops it with SIGTERM: that is a clean stop.
SuccessExitStatus=143
TimeoutStopSec=20
# Output goes to the system journal: journalctl -u $SERVICE -f

[Install]
WantedBy=multi-user.target
EOF
}

if [ "$PRINT_ONLY" -eq 1 ]; then unit_text; exit 0; fi

if [ "$(id -u)" -ne 0 ]; then
  echo "This needs administrator rights. Run:  sudo $0" >&2; exit 1
fi
if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
  echo "This PC does not use systemd, so the service cannot be installed." >&2; exit 1
fi

for f in erp-server erp-server-service.sh; do
  if [ ! -f "$DIR/$f" ]; then echo "$DIR/$f is missing." >&2; exit 1; fi
  chmod 755 "$DIR/$f"
done
if [ ! -f "$DIR/.env" ]; then
  echo "$DIR/.env is missing. Copy .env.example to .env and fill in the CHANGE_ME values first." >&2
  exit 1
fi
if ! runuser -u "$RUN_USER" -- test -r "$DIR/.env" -a -x "$DIR/erp-server" -a -w "$DIR"; then
  echo "User \"$RUN_USER\" cannot read .env, run erp-server or write logs in $DIR." >&2
  echo "Fix the folder permissions, or pass --user with the folder's owner." >&2
  exit 1
fi

env_value() {
  grep -E "^$1=" "$DIR/.env" | tail -1 | cut -d= -f2- | tr -d '[:space:]"'\'''
}
PORT=$(env_value PORT); PORT=${PORT:-3011}
PREFIX=$(env_value API_PREFIX); PREFIX=${PREFIX:-api}
VERSION=$(env_value API_VERSION); VERSION=${VERSION:-1}
SCHEME=http; [ "$(env_value HTTPS_ENABLED)" = true ] && SCHEME=https
HEALTH_URL="$SCHEME://127.0.0.1:$PORT/$PREFIX/v$VERSION/health"

# A copy started by hand from this folder (double-click or start-erp-server.sh)
# holds the port, so stop it and let the service take over.
for proc in /proc/[0-9]*; do
  [ "$(cat "$proc/comm" 2>/dev/null)" = erp-server ] || continue
  [ "$(readlink "$proc/cwd" 2>/dev/null)" = "$DIR" ] || continue
  pid=${proc#/proc/}
  if [ "$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null)" = "$pid" ]; then continue; fi
  echo "Stopping the ERP server already running from this folder (pid $pid) ..."
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 30); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  kill -9 "$pid" 2>/dev/null
done

if ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q . && ! systemctl -q is-active "$SERVICE"; then
  echo "WARNING: another program is using port $PORT:" >&2
  ss -ltnpH "sport = :$PORT" >&2
  echo "The service will keep retrying until that port is free." >&2
fi

unit_text > "$UNIT_FILE"
chmod 644 "$UNIT_FILE"

# Let the server's user start/stop/restart this one service without a
# password, so ERP Deploy Manager can restart it after an update.
POLKIT_RULE=/etc/polkit-1/rules.d/50-$SERVICE.rules
if [ -d /etc/polkit-1/rules.d ]; then
  cat > "$POLKIT_RULE" <<EOF
// Written by $DIR/install-service.sh. Lets $RUN_USER start, stop and restart
// $SERVICE.service without a password (used by ERP Deploy Manager).
polkit.addRule(function (action, subject) {
  if (action.id == "org.freedesktop.systemd1.manage-units" &&
      action.lookup("unit") == "$SERVICE.service" &&
      subject.user == "$RUN_USER") {
    var verb = action.lookup("verb");
    if (verb == "start" || verb == "stop" || verb == "restart") {
      return polkit.Result.YES;
    }
  }
});
EOF
  chmod 644 "$POLKIT_RULE"
fi
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || { echo "systemctl enable $SERVICE failed." >&2; exit 1; }
systemctl restart "$SERVICE"

echo "Installed $UNIT_FILE (runs as $RUN_USER, starts at every boot)."
echo -n "Waiting for the server to answer on port $PORT "
ok=0
for _ in $(seq 1 90); do
  if command -v curl >/dev/null 2>&1; then
    curl -ks -m 2 "$HEALTH_URL" | grep -q '"status":"ok"' && { ok=1; break; }
  elif ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q .; then ok=1; break; fi
  systemctl -q is-failed "$SERVICE" && break
  echo -n "."; sleep 1
done
echo

if [ "$ok" -eq 1 ]; then
  echo "The ERP server is running: $HEALTH_URL"
else
  echo "The service did not come up yet. Its latest output:" >&2
  journalctl -u "$SERVICE" -n 25 --no-pager -o cat >&2
fi

cat <<EOF

  Status:     systemctl status $SERVICE
  Live log:   journalctl -u $SERVICE -f
  Stop:       sudo systemctl stop $SERVICE
  Start:      sudo systemctl start $SERVICE
  Restart:    sudo systemctl restart $SERVICE    (after changing .env or the exe)
  Remove:     sudo $DIR/uninstall-service.sh
EOF
[ "$ok" -eq 1 ]
