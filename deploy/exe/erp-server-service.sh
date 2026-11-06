#!/bin/bash
# Started by the erp-server systemd service (see install-service.sh); not meant
# to be run by hand. Waits until PostgreSQL accepts connections, so the server
# does not start before the database at boot, then runs the server in this folder.
cd "$(dirname "$(readlink -f "$0")")" || exit 1

if [ ! -f .env ]; then
  echo ".env is missing in $(pwd). Copy .env.example to .env and fill in the CHANGE_ME values." >&2
  exit 1
fi

env_value() {
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '[:space:]"'\'''
}

DB_HOST=$(env_value DB_HOST); DB_HOST=${DB_HOST:-localhost}
DB_PORT=$(env_value DB_PORT); DB_PORT=${DB_PORT:-5432}
WAIT_SECONDS=120

for ((i = 0; i < WAIT_SECONDS; i++)); do
  if (exec 3<>"/dev/tcp/$DB_HOST/$DB_PORT") 2>/dev/null; then
    [ "$i" -gt 0 ] && echo "PostgreSQL at $DB_HOST:$DB_PORT is up after ${i}s."
    exec ./erp-server "$@"
  fi
  [ "$i" -eq 0 ] && echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT ..."
  sleep 1
done

# Exit with an error: systemd starts this script again after RestartSec.
echo "PostgreSQL at $DB_HOST:$DB_PORT did not answer within ${WAIT_SECONDS}s." >&2
exit 1
