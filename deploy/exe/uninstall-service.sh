#!/bin/bash
# Stops the ERP server service and stops it starting at boot.
# The server, .env and logs in this folder are left alone.
#
#   sudo ./uninstall-service.sh
SERVICE=erp-server
UNIT_FILE=/etc/systemd/system/$SERVICE.service

if [ "$(id -u)" -ne 0 ]; then
  echo "This needs administrator rights. Run:  sudo $0" >&2; exit 1
fi
if [ ! -f "$UNIT_FILE" ]; then
  echo "The $SERVICE service is not installed."; exit 0
fi

systemctl disable --now "$SERVICE" >/dev/null 2>&1
rm -f "$UNIT_FILE" "/etc/polkit-1/rules.d/50-$SERVICE.rules"
systemctl daemon-reload
systemctl reset-failed "$SERVICE" >/dev/null 2>&1
echo "Removed the $SERVICE service. The server no longer starts at boot."
echo "To run it by hand: $(dirname "$(readlink -f "$0")")/start-erp-server.sh"
