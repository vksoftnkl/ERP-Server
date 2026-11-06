#!/bin/bash
# Double-click launcher for the ERP server, run in a terminal window.
#  * If the erp-server service is installed for this folder (install-service.sh),
#    the server already runs in the background: this window only shows its live
#    log, and closing the window does not stop it.
#  * Otherwise it runs the server in this window and keeps a copy of the log in
#    console.log. Close the window (or press Ctrl+C) to stop the server.
SERVICE=erp-server
cd "$(dirname "$(readlink -f "$0")")" || exit 1

pause() { echo; read -r -p "Press Enter to close this window..." _; }

if [ ! -f .env ]; then
  echo "ERROR: .env is missing in $(pwd)."
  echo "Copy .env.example to .env and fill in the CHANGE_ME values."
  pause; exit 1
fi

env_value() {
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '[:space:]"'\'''
}
PORT=$(env_value PORT); PORT=${PORT:-3011}
DB=$(env_value DB_NAME)

service_dir=$(systemctl show -p WorkingDirectory --value "$SERVICE" 2>/dev/null)
if [ -n "$service_dir" ] && [ "$(readlink -f "$service_dir")" = "$(pwd)" ]; then
  if systemctl -q is-active "$SERVICE"; then
    echo "The ERP server runs in the background as the \"$SERVICE\" service"
    echo "(port $PORT, database $DB) and starts by itself at every boot."
    echo "Closing this window does NOT stop it. Stop it with: sudo systemctl stop $SERVICE"
    echo "Live log below (Ctrl+C to stop watching):"
    echo "------------------------------------------------------------"
    journalctl -u "$SERVICE" -f -n 40 -o cat
  else
    echo "The \"$SERVICE\" service is installed but not running:"
    echo
    systemctl status "$SERVICE" --no-pager -n 20
    echo
    echo "Start it with:  sudo systemctl start $SERVICE"
  fi
  pause; exit 0
fi

if ss -ltnH "sport = :$PORT" 2>/dev/null | grep -q .; then
  echo "Port $PORT is already in use. The ERP server is probably already running."
  echo
  ss -ltnpH "sport = :$PORT" 2>/dev/null
  echo
  echo "To stop it: close its window, or run:  pkill -x erp-server"
  pause; exit 1
fi

echo "Starting ERP server  (port $PORT, database $DB)"
echo "Close this window or press Ctrl+C to stop it."
echo "------------------------------------------------------------"
./start-erp-server.sh 2>&1 | tee console.log
status=${PIPESTATUS[0]}
echo "------------------------------------------------------------"
echo "ERP server stopped (exit code $status)."
pause
