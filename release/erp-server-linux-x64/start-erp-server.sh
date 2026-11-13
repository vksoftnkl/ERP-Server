#!/bin/sh
# Starts the ERP server from its own folder: it reads .env and writes logs/ there.
cd "$(dirname "$(readlink -f "$0")")" || exit 1
if [ ! -f .env ]; then
  echo ".env is missing. Copy .env.example to .env and fill in the CHANGE_ME values." >&2
  exit 1
fi
exec ./erp-server "$@"
