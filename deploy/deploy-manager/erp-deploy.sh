#!/bin/bash
# ERP Deploy Manager engine: updates the installed ERP server from GitHub.
# The desktop app (erp-deploy-manager) runs this and shows its progress; it
# works from a terminal too. Nothing runs on a timer: only when asked.
#
#   erp-deploy.sh status   [--branch B] [--no-fetch]   what runs now, what is new on GitHub
#   erp-deploy.sh branches                             the branches on GitHub
#   erp-deploy.sh deploy   [--branch B] [--build-only]
#       fetch the branch, build the exe (the server keeps running), stop the
#       server, back up the database, apply migrations, install the new exe,
#       start it and check it answers. Any failure after the server stops puts
#       the previous exe and database back. --build-only stops after the build.
#   erp-deploy.sh rollback [--with-db]
#       swap back to the previous exe; --with-db also restores the database
#       backup taken just before the last update (the current one is kept
#       under a new name, nothing is deleted).
#
# Settings: ~/.config/erp-deploy/deploy.conf (ERP_DEPLOY_CONF overrides).
# Output lines starting with "::" are for the app; everything else is the log.
set -uo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0 LC_ALL=C.UTF-8 PRISMA_HIDE_UPDATE_MESSAGE=1

CONF=${ERP_DEPLOY_CONF:-$HOME/.config/erp-deploy/deploy.conf}

out()  { printf '%s\n' "$*"; }
info() { printf '::info %s=%s\n' "$1" "$2"; }

# ---------------------------------------------------------------- settings --

load_config() {
  if [ ! -f "$CONF" ]; then
    out "::fail 0 Settings file $CONF is missing. Run install.sh of ERP Deploy Manager first."
    out "::result failed"; exit 1
  fi
  # shellcheck source=/dev/null
  . "$CONF"
  if [ -z "${REPO_URL:-}" ] || [ -z "${SERVER_DIR:-}" ]; then
    out "::fail 0 REPO_URL and SERVER_DIR must be set in $CONF."
    out "::result failed"; exit 1
  fi
  BRANCH=${BRANCH:-main}
  WORK_DIR=${WORK_DIR:-$HOME/erp-deploy}
  SERVICE=${SERVICE:-erp-server}
  KEEP_BACKUPS=${KEEP_BACKUPS:-10}
  HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-120}
  ALLOW_EXTRA_MIGRATIONS=${ALLOW_EXTRA_MIGRATIONS:-}
  CONFIG_BRANCH=$BRANCH
  SERVER_DIR=$(readlink -m "$SERVER_DIR")
  SRC=$WORK_DIR/src
  STAGE=$WORK_DIR/stage/erp-server-linux-x64
  BACKUPS=$WORK_DIR/backups
  LOGS=$WORK_DIR/logs
  STATE=$WORK_DIR/last-deploy.env
}

env_value() {
  local v
  v=$(grep -E "^$1=" "$SERVER_DIR/.env" | tail -1 | cut -d= -f2-)
  v=${v%$'\r'}; v=${v#\"}; v=${v%\"}; v=${v#\'}; v=${v%\'}
  printf '%s' "$v"
}

# Reads stdin, so a password never shows up in a process list.
urldecode() { python3 -c 'import sys, urllib.parse; sys.stdout.write(urllib.parse.unquote(sys.stdin.read()))'; }

# Connection details come from the server's own .env and go to psql/pg_dump
# through PG* variables, never on a command line.
load_server_env() {
  FAIL_MSG=""
  if [ ! -f "$SERVER_DIR/.env" ]; then FAIL_MSG="$SERVER_DIR/.env not found. Check SERVER_DIR in $CONF."; return 1; fi
  DATABASE_URL=$(env_value DATABASE_URL)
  if [ -z "$DATABASE_URL" ]; then FAIL_MSG="DATABASE_URL is not set in $SERVER_DIR/.env."; return 1; fi
  local url=${DATABASE_URL%%\?*} rest userinfo="" hostport
  rest=${url#*://}
  if [[ $rest == *@* ]]; then userinfo=${rest%@*}; rest=${rest##*@}; fi
  hostport=${rest%%/*}
  if [[ $rest != */* ]] || [ -z "${rest#*/}" ]; then FAIL_MSG="DATABASE_URL in .env has no database name."; return 1; fi
  DB_NAME=$(printf '%s' "${rest#*/}" | urldecode)
  PGUSER=$(printf '%s' "${userinfo%%:*}" | urldecode)
  if [[ $userinfo == *:* ]]; then PGPASSWORD=$(printf '%s' "${userinfo#*:}" | urldecode); else PGPASSWORD=""; fi
  PGHOST=${hostport%:*}; PGPORT=5432
  [[ $hostport == *:* ]] && PGPORT=${hostport##*:}
  [ -n "$PGHOST" ] || PGHOST=localhost
  export PGHOST PGPORT PGUSER PGDATABASE=$DB_NAME PGCONNECT_TIMEOUT=10
  if [ -n "$PGPASSWORD" ]; then export PGPASSWORD; else unset PGPASSWORD; fi

  local port prefix version scheme=http
  port=$(env_value PORT); prefix=$(env_value API_PREFIX); version=$(env_value API_VERSION)
  [ "$(env_value HTTPS_ENABLED)" = true ] && scheme=https
  SERVER_PORT=${port:-3011}
  HEALTH_URL="$scheme://127.0.0.1:$SERVER_PORT/${prefix:-api}/v${version:-1}/health"
}

# ---------------------------------------------------------------- database --

pq() { psql -X -Atq -v ON_ERROR_STOP=1 "$@"; }

db_migrations() {
  pq -d "$DB_NAME" -c "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null" | sort
}
db_failed_migrations() {
  pq -d "$DB_NAME" -c "select migration_name from _prisma_migrations where finished_at is null and rolled_back_at is null" | sort
}
# Drops names listed in ALLOW_EXTRA_MIGRATIONS: migrations that are applied to
# the database on purpose but never pushed (local-only features).
filter_allowed() {
  local allowed=" ${ALLOW_EXTRA_MIGRATIONS//$'\n'/ } " name
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    case "$allowed" in *" $name "*) ;; *) printf '%s\n' "$name" ;; esac
  done
}
branch_migrations() {
  git -C "$SRC" ls-tree -d --name-only "origin/$BRANCH" prisma/migrations/ | sed 's#^.*/##' | sort
}

# Restores a pg_dump file as the database, keeping the current one renamed.
restore_db() {
  local dump=$1 label=$2 ts tmp keep i
  ts=$(date +%Y%m%d_%H%M%S)
  tmp="${DB_NAME}_restore_$ts"
  keep="${DB_NAME}_${label}_$ts"
  echo "Restoring $dump ..."
  pq -d postgres -c "CREATE DATABASE \"$tmp\" TEMPLATE template0" || return 1
  if ! pg_restore --no-owner -d "$tmp" "$dump"; then
    echo "pg_restore failed; the current database was not touched."
    pq -d postgres -c "DROP DATABASE IF EXISTS \"$tmp\""
    return 1
  fi
  for i in 1 2 3 4 5; do
    if pq -d postgres \
        -c "select count(pg_terminate_backend(pid)) from pg_stat_activity where datname = '$DB_NAME' and pid <> pg_backend_pid()" \
        -c "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$keep\"" >/dev/null; then
      if pq -d postgres -c "ALTER DATABASE \"$tmp\" RENAME TO \"$DB_NAME\""; then
        echo "Database $DB_NAME is restored. The replaced copy is kept as \"$keep\"; drop it when you no longer need it."
        return 0
      fi
      echo "CRITICAL: could not rename \"$tmp\" to \"$DB_NAME\". Rename it by hand in pgAdmin."
      return 1
    fi
    echo "Database $DB_NAME is busy, retrying ($i/5) ..."
    sleep 1
  done
  echo "Could not take $DB_NAME offline to swap it. Restored copy left as \"$tmp\"."
  return 1
}

# ------------------------------------------------------------------ server --

# systemd when the erp-server service is installed for this folder, else the
# server is started by hand (double-click launcher or start-erp-server.sh).
control_mode() {
  local wd
  wd=$(systemctl show -p WorkingDirectory --value "$SERVICE" 2>/dev/null)
  if [ -n "$wd" ] && [ "$(readlink -m "$wd")" = "$SERVER_DIR" ] &&
     [ "$(systemctl show -p LoadState --value "$SERVICE" 2>/dev/null)" = loaded ]; then
    echo systemd
  else
    echo manual
  fi
}

server_pids() {
  local p
  for p in /proc/[0-9]*; do
    [ "$(cat "$p/comm" 2>/dev/null)" = erp-server ] || continue
    [ "$(readlink -m "$p/cwd" 2>/dev/null)" = "$SERVER_DIR" ] || continue
    printf '%s\n' "${p#/proc/}"
  done
}

health_ok() {
  local body
  body=$(curl -ks -m 3 "$HEALTH_URL" 2>/dev/null) || return 1
  [[ $body == *'"status":"ok"'* && $body == *'"database":{"status":"up"}'* ]]
}

stop_server() {
  local pid
  if [ "$CONTROL" = systemd ]; then
    echo "systemctl stop $SERVICE"
    systemctl stop "$SERVICE" || { echo "systemctl stop $SERVICE failed (no permission?)."; return 1; }
  fi
  for pid in $(server_pids); do
    echo "Stopping erp-server (pid $pid) ..."
    kill "$pid" 2>/dev/null
  done
  for _ in $(seq 1 40); do [ -z "$(server_pids)" ] && { echo "Server stopped."; return 0; }; sleep 0.5; done
  for pid in $(server_pids); do echo "Force-stopping pid $pid"; kill -9 "$pid" 2>/dev/null; done
  sleep 1
  [ -z "$(server_pids)" ]
}

start_server() {
  if [ "$CONTROL" = systemd ]; then
    echo "systemctl start $SERVICE"
    systemctl start "$SERVICE"
    return
  fi
  echo "Starting the server in the background (log: $SERVER_DIR/console.log)"
  # Own session, default signal handling, a clean environment (so only .env
  # configures it, as under systemd) and none of this script's file
  # descriptors (the lock on fd 9, the log pipe), so it outlives this script.
  ( cd "$SERVER_DIR" && setsid env -i --default-signal=INT,TERM \
      HOME="$HOME" USER="$(id -un)" LOGNAME="$(id -un)" LANG="${LANG:-C.UTF-8}" PATH=/usr/local/bin:/usr/bin:/bin \
      nohup ./start-erp-server.sh >> console.log 2>&1 < /dev/null 9>&- & )
}

show_server_log() {
  echo "--- last server output ---"
  if [ "$CONTROL" = systemd ]; then journalctl -u "$SERVICE" -n 30 --no-pager -o cat 2>/dev/null
  else tail -n 30 "$SERVER_DIR/console.log" 2>/dev/null; fi
  echo "--------------------------"
}

wait_health() {
  local i
  for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
    if health_ok; then echo "Server answers after ${i}s: $HEALTH_URL"; return 0; fi
    if [ "$CONTROL" = systemd ]; then
      systemctl -q is-failed "$SERVICE" && break
    elif [ "$i" -gt 5 ] && [ -z "$(server_pids)" ]; then
      echo "The server process exited."; break
    fi
    sleep 1
  done
  echo "The server did not answer at $HEALTH_URL."
  show_server_log
  return 1
}

# --------------------------------------------------------------------- git --

fetch_repo() {
  FAIL_MSG=""
  mkdir -p "$WORK_DIR"
  if [ ! -d "$SRC/.git" ]; then
    echo "Cloning $REPO_URL (first time only) ..."
    rm -rf "$SRC"
    git clone --quiet --no-checkout "$REPO_URL" "$SRC" || { FAIL_MSG="git clone $REPO_URL failed"; return 1; }
  fi
  git -C "$SRC" remote set-url origin "$REPO_URL"
  echo "git fetch origin"
  git -C "$SRC" fetch --prune --quiet origin || { FAIL_MSG="git fetch from $REPO_URL failed (network or login?)"; return 1; }
  git -C "$SRC" rev-parse -q --verify "origin/$BRANCH^{commit}" >/dev/null ||
    { FAIL_MSG="branch \"$BRANCH\" does not exist on $REPO_URL"; return 1; }
}

# ------------------------------------------------------------------- steps --

STEP_NO=0
TOTAL=0
CRITICAL=0
plan() { local IFS='|'; TOTAL=$#; out "::plan $*"; }
step() {
  STEP_NO=$1; STEP_START=$SECONDS
  out "::step $1"
  echo; echo "=== [$1/$TOTAL] $2 ==="
}
done_step() {
  # Test hook: ERP_DEPLOY_TEST_FAIL_AT=<step> makes that step fail.
  if [ "${ERP_DEPLOY_TEST_FAIL_AT:-}" = "$STEP_NO" ]; then
    fail "Test failure requested (ERP_DEPLOY_TEST_FAIL_AT=$STEP_NO)"
  fi
  out "::done $STEP_NO $(( SECONDS - STEP_START ))s${1:+ · $1}"
}
skip_step() { out "::skip $STEP_NO $1"; echo "Skipped: $1"; }

fail() {
  out "::fail $STEP_NO $*"
  echo "FAILED: $*"
  if [ "$CRITICAL" -eq 1 ]; then recover; fi
  out "::result failed"
  exit 1
}

on_cancel() { echo; echo "Cancelled. The server was not changed."; out "::result cancelled"; exit 130; }

# From here on the server is (being) changed: ignore Ctrl+C / cancel, and
# children started from now on inherit that, so a step is never cut in half.
enter_critical() { trap '' INT TERM; CRITICAL=1; out "::critical on"; }

EXE_SWAPPED=0; MIGRATE_STARTED=0; SERVER_STOPPED=0; BACKUP_FILE=""; APPLIED=0

recover() {
  CRITICAL=0
  out "::recovering"
  echo; echo "=== Putting the previous version back ==="
  local ok=1
  stop_server || echo "Could not stop the server."
  if [ "$EXE_SWAPPED" -eq 1 ]; then
    if cp -p "$SERVER_DIR/erp-server.prev" "$SERVER_DIR/erp-server.new" &&
       mv -f "$SERVER_DIR/erp-server.new" "$SERVER_DIR/erp-server"; then
      echo "Previous exe is back."
    else ok=0; echo "Could not put the previous exe back."; fi
  fi
  if [ "$MIGRATE_STARTED" -eq 1 ] && [ -n "$BACKUP_FILE" ]; then
    restore_db "$BACKUP_FILE" failed_update || ok=0
  fi
  if [ "$SERVER_STOPPED" -eq 1 ]; then
    if start_server && wait_health; then :; else ok=0; fi
  fi
  if [ "$ok" -eq 1 ]; then
    echo "The server is running the previous version again."
    out "::result rolled-back"; exit 1
  fi
  echo "PUTTING THE OLD VERSION BACK FAILED. The server may be down."
  echo "Backup taken before the update: ${BACKUP_FILE:-none}. Previous exe: $SERVER_DIR/erp-server.prev"
  out "::result rollback-failed"; exit 2
}

# --------------------------------------------------------------- commands --

read_deployed() {  # <file> <prefix>
  local f=$1 p=$2 k v
  [ -f "$f" ] || return 0
  while IFS='=' read -r k v; do
    case $k in
      commit|branch|subject|commit_date|deployed_at|migrations_applied) info "${p}_$k" "$v" ;;
    esac
    if [ "$p" = deployed ] && [ "$k" = commit ]; then DEPLOYED_COMMIT=$v; fi
  done < "$f"
}

cmd_branches() {
  local heads
  heads=$(git ls-remote --heads "$REPO_URL") || { out "::fail 0 Could not reach $REPO_URL"; out "::result failed"; return 1; }
  info config_branch "$CONFIG_BRANCH"
  printf '%s\n' "$heads" | sed 's#.*refs/heads/##' | sort | sed 's/^/::branch /'
  out "::result ok"
}

cmd_status() {
  DEPLOYED_COMMIT=""
  info config_branch "$CONFIG_BRANCH"; info branch "$BRANCH"; info repo "$REPO_URL"
  info server_dir "$SERVER_DIR"; info work_dir "$WORK_DIR"; info conf "$CONF"
  if ! load_server_env; then out "::blocked $FAIL_MSG"; out "::result failed"; return 1; fi
  CONTROL=$(control_mode)
  info control "$CONTROL"; info db_name "$DB_NAME"; info health_url "$HEALTH_URL"
  if health_ok; then info health up
  elif [ -n "$(server_pids)" ]; then info health not-answering
  else info health stopped; fi
  read_deployed "$SERVER_DIR/DEPLOYED.txt" deployed
  read_deployed "$SERVER_DIR/DEPLOYED.prev.txt" prev
  if [ -f "$SERVER_DIR/erp-server.prev" ]; then info prev_exe yes; else info prev_exe no; fi
  if [ -f "$STATE" ]; then
    # shellcheck source=/dev/null
    . "$STATE"
    info last_backup "${LAST_BACKUP:-}"; info last_migrations_applied "${LAST_APPLIED:-0}"
  fi

  local db_list="" err
  err=$(mktemp)
  if db_list=$(db_migrations 2>"$err"); then
    info db_migrations "$(grep -c . <<<"$db_list")"
    local failed; failed=$(db_failed_migrations 2>/dev/null)
    [ -z "$failed" ] || out "::blocked Migration $failed failed earlier and was never resolved. Fix it before updating."
  else
    out "::blocked Cannot read database $DB_NAME: $(tr '\n' ' ' < "$err")"
  fi
  rm -f "$err"

  if [ "$NO_FETCH" -eq 0 ]; then
    mkdir -p "$WORK_DIR"
    exec 9>"$WORK_DIR/.lock"
    if ! flock -n 9; then out "::blocked An update is running right now."; out "::result failed"; return 1; fi
    if ! fetch_repo; then out "::blocked Could not fetch from GitHub: $FAIL_MSG"; out "::result failed"; return 1; fi
    info fetched_at "$(date '+%Y-%m-%d %H:%M')"
  fi
  if [ -d "$SRC/.git" ] && git -C "$SRC" rev-parse -q --verify "origin/$BRANCH^{commit}" >/dev/null; then
    analyze_branch "$db_list"
  fi
  out "::result ok"
}

analyze_branch() {
  local db_list=$1 remote range n extra
  remote=$(git -C "$SRC" rev-parse "origin/$BRANCH")
  info remote_commit "$remote"
  info remote_subject "$(git -C "$SRC" log -1 --format=%s "$remote")"
  info remote_date "$(git -C "$SRC" log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M' "$remote")"
  if [ -n "$DEPLOYED_COMMIT" ] && git -C "$SRC" cat-file -e "$DEPLOYED_COMMIT^{commit}" 2>/dev/null; then
    range="$DEPLOYED_COMMIT..$remote"; n=200
    info commits_since deployed
    [ "$DEPLOYED_COMMIT" = "$remote" ] && info up_to_date yes
  else
    range=$remote; n=15
    info commits_since none
  fi
  git -C "$SRC" log -n "$n" --format='::commit %h|%cd|%an|%s' --date=format:'%Y-%m-%d %H:%M' "$range"

  if [ -n "$db_list" ]; then
    local branch_list; branch_list=$(branch_migrations)
    comm -13 <(printf '%s\n' "$db_list") <(printf '%s\n' "$branch_list") | sed '/^$/d; s/^/::migration pending /'
    extra=$(comm -23 <(printf '%s\n' "$db_list") <(printf '%s\n' "$branch_list") | filter_allowed)
    if [ -n "$extra" ]; then
      printf '%s\n' "$extra" | sed 's/^/::migration extra /'
      out "::blocked The database has $(grep -c . <<<"$extra") migration(s) that \"$BRANCH\" does not have (newest: $(tail -1 <<<"$extra")). Updating would run older code on a newer database. Commit and push those migrations first."
    fi
  fi
  git -C "$SRC" cat-file -e "origin/$BRANCH:scripts/build-exe.js" 2>/dev/null ||
    out "::blocked \"$BRANCH\" has no scripts/build-exe.js, so the exe cannot be built from it. Commit and push scripts/build-exe.js and deploy/exe/ first."
}

cmd_deploy() {
  local titles=("Check settings and database" "Fetch $BRANCH from GitHub" "Check migrations" "Install packages" "Build the exe")
  [ "$BUILD_ONLY" -eq 1 ] || titles+=("Stop the server" "Back up the database" "Apply migrations" "Install the new exe" "Start the server and check it")
  plan "${titles[@]}"
  trap on_cancel INT TERM

  step 1 "Check settings and database"
  local t
  for t in git node npm psql pg_dump pg_restore curl python3 flock setsid; do
    command -v "$t" >/dev/null || fail "\"$t\" is not installed."
  done
  load_server_env || fail "$FAIL_MSG"
  [ -x "$SERVER_DIR/erp-server" ] || fail "$SERVER_DIR/erp-server not found."
  [ -x "$SERVER_DIR/start-erp-server.sh" ] || fail "$SERVER_DIR/start-erp-server.sh not found."
  CONTROL=$(control_mode)
  local db_list failed
  db_list=$(db_migrations) || fail "Cannot connect to database $DB_NAME at $PGHOST:$PGPORT."
  failed=$(db_failed_migrations)
  [ -z "$failed" ] || fail "Migration $failed failed earlier and was never resolved. Fix it first."
  echo "Server folder: $SERVER_DIR (control: $CONTROL)"
  echo "Database: $DB_NAME on $PGHOST:$PGPORT, $(grep -c . <<<"$db_list") migrations applied"
  done_step "$DB_NAME · $(grep -c . <<<"$db_list") migrations"

  step 2 "Fetch $BRANCH from GitHub"
  fetch_repo || fail "$FAIL_MSG"
  git -C "$SRC" checkout -q -f -B deploy "origin/$BRANCH" || fail "git checkout of $BRANCH failed"
  git -C "$SRC" clean -q -ffdx -e node_modules || fail "git clean failed"
  COMMIT=$(git -C "$SRC" rev-parse HEAD)
  SUBJECT=$(git -C "$SRC" log -1 --format=%s)
  COMMIT_DATE=$(git -C "$SRC" log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M')
  echo "Building $BRANCH @ ${COMMIT:0:8}: $SUBJECT ($COMMIT_DATE)"
  done_step "${COMMIT:0:8} · $SUBJECT"

  step 3 "Check migrations"
  local branch_list pending extra
  branch_list=$(branch_migrations)
  pending=$(comm -13 <(printf '%s\n' "$db_list") <(printf '%s\n' "$branch_list") | sed '/^$/d')
  extra=$(comm -23 <(printf '%s\n' "$db_list") <(printf '%s\n' "$branch_list") | filter_allowed)
  [ -z "$ALLOW_EXTRA_MIGRATIONS" ] || echo "Allowed to exist only in the database (ALLOW_EXTRA_MIGRATIONS): $ALLOW_EXTRA_MIGRATIONS"
  if [ -n "$extra" ]; then
    echo "In the database but not in $BRANCH:"; printf '  %s\n' $extra
    fail "The database has $(grep -c . <<<"$extra") migration(s) that $BRANCH does not have. Updating would run older code on a newer database. Commit and push them first."
  fi
  [ -f "$SRC/scripts/build-exe.js" ] || fail "$BRANCH has no scripts/build-exe.js. Commit and push scripts/build-exe.js and deploy/exe/ first."
  if [ -n "$pending" ]; then echo "New migrations to apply:"; printf '  %s\n' $pending; else echo "No new migrations."; fi
  done_step "$(grep -c . <<<"$pending") new migration(s)"

  step 4 "Install packages"
  local lock_sum
  lock_sum=$(sha256sum "$SRC/package-lock.json" 2>/dev/null | cut -d' ' -f1)
  if [ -d "$SRC/node_modules" ] && [ -n "$lock_sum" ] && [ "$lock_sum" = "$(cat "$WORK_DIR/.npm-lock.sha" 2>/dev/null)" ]; then
    skip_step "package-lock.json unchanged, node_modules reused"
  else
    rm -f "$WORK_DIR/.npm-lock.sha"
    (cd "$SRC" && npm ci --no-audit --no-fund) || fail "npm ci failed"
    printf '%s\n' "$lock_sum" > "$WORK_DIR/.npm-lock.sha"
    done_step
  fi

  step 5 "Build the exe"
  (cd "$SRC" && npm run prisma:generate) || fail "npm run prisma:generate failed"
  (cd "$SRC" && npm run build) || fail "npm run build failed"
  rm -rf "$WORK_DIR/stage"
  (cd "$SRC" && node scripts/build-exe.js linux --out "$STAGE") || fail "scripts/build-exe.js failed"
  [ -x "$STAGE/erp-server" ] || fail "The build did not produce $STAGE/erp-server"
  done_step "$(du -m "$STAGE/erp-server" | cut -f1) MB"

  if [ "$BUILD_ONLY" -eq 1 ]; then
    echo; echo "Build only: the new exe is in $STAGE. The server was not touched."
    out "::result ok"; return 0
  fi

  enter_critical

  step 6 "Stop the server"
  SERVER_STOPPED=1
  stop_server || fail "Could not stop the server."
  done_step

  step 7 "Back up the database"
  mkdir -p "$BACKUPS"
  BACKUP_FILE="$BACKUPS/${DB_NAME}-$(date +%Y%m%d-%H%M%S)-before-${COMMIT:0:8}.dump"
  pg_dump -Fc -d "$DB_NAME" -f "$BACKUP_FILE.part" && mv "$BACKUP_FILE.part" "$BACKUP_FILE" ||
    { rm -f "$BACKUP_FILE.part"; BACKUP_FILE=""; fail "pg_dump failed"; }
  echo "Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  ls -1t "$BACKUPS"/*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
  done_step "$(du -h "$BACKUP_FILE" | cut -f1)"

  step 8 "Apply migrations"
  local before after
  before=$(db_migrations | grep -c .)
  MIGRATE_STARTED=1
  (cd "$SRC" && DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma) ||
    fail "prisma migrate deploy failed"
  after=$(db_migrations | grep -c .)
  APPLIED=$((after - before))
  [ "$APPLIED" -gt 0 ] || MIGRATE_STARTED=0   # nothing changed, nothing to restore
  done_step "$APPLIED applied"

  step 9 "Install the new exe"
  cp -p "$SERVER_DIR/erp-server" "$SERVER_DIR/erp-server.prev" || fail "Could not keep a copy of the current exe"
  if [ -f "$SERVER_DIR/DEPLOYED.txt" ]; then cp -p "$SERVER_DIR/DEPLOYED.txt" "$SERVER_DIR/DEPLOYED.prev.txt"
  else printf 'commit=\nsubject=(installed by hand before ERP Deploy Manager)\n' > "$SERVER_DIR/DEPLOYED.prev.txt"; fi
  EXE_SWAPPED=1
  cp "$STAGE/erp-server" "$SERVER_DIR/erp-server.new" && chmod 755 "$SERVER_DIR/erp-server.new" &&
    mv -f "$SERVER_DIR/erp-server.new" "$SERVER_DIR/erp-server" || fail "Could not install the new exe"
  cp -a "$STAGE/assets/." "$SERVER_DIR/assets/" || fail "Could not copy assets"
  for t in "$STAGE"/*.sh "$STAGE/.env.example"; do [ -f "$t" ] && cp -p "$t" "$SERVER_DIR/"; done
  echo "Installed. The previous exe is kept as erp-server.prev (.env was not touched)."
  done_step

  step 10 "Start the server and check it"
  start_server || fail "Could not start the server."
  wait_health || fail "The new server did not come up."
  {
    echo "commit=$COMMIT"; echo "branch=$BRANCH"; echo "subject=$SUBJECT"; echo "commit_date=$COMMIT_DATE"
    echo "deployed_at=$(date '+%Y-%m-%d %H:%M:%S')"; echo "migrations_applied=$APPLIED"
  } > "$SERVER_DIR/DEPLOYED.txt"
  printf 'LAST_BACKUP=%q\nLAST_APPLIED=%q\nLAST_COMMIT=%q\n' "$BACKUP_FILE" "$APPLIED" "$COMMIT" > "$STATE"
  done_step
  CRITICAL=0
  echo; echo "Done: the server runs $BRANCH @ ${COMMIT:0:8}."
  out "::result ok"
}

cmd_rollback() {
  local titles=("Check" "Stop the server")
  [ "$WITH_DB" -eq 1 ] && titles+=("Restore the database")
  titles+=("Put the previous exe back" "Start the server and check it")
  plan "${titles[@]}"
  trap on_cancel INT TERM
  local n=1

  step $n "Check"
  load_server_env || fail "$FAIL_MSG"
  [ -f "$SERVER_DIR/erp-server.prev" ] || fail "There is no previous exe (erp-server.prev) to go back to."
  CONTROL=$(control_mode)
  if [ "$WITH_DB" -eq 1 ]; then
    LAST_BACKUP=""
    # shellcheck source=/dev/null
    [ -f "$STATE" ] && . "$STATE"
    [ -n "$LAST_BACKUP" ] && [ -f "$LAST_BACKUP" ] || fail "The database backup from the last update is not available."
    echo "Database backup to restore: $LAST_BACKUP"
  fi
  done_step

  trap '' INT TERM; out "::critical on"
  step $((++n)) "Stop the server"
  stop_server || { out "::fail $n Could not stop the server."; out "::result failed"; exit 1; }
  done_step

  if [ "$WITH_DB" -eq 1 ]; then
    step $((++n)) "Restore the database"
    if ! restore_db "$LAST_BACKUP" before_rollback; then
      out "::fail $n Restoring the database failed; the current database was kept."
      start_server; wait_health; out "::result failed"; exit 1
    fi
    printf 'LAST_BACKUP=\nLAST_APPLIED=0\nLAST_COMMIT=\n' > "$STATE"
    done_step
  fi

  step $((++n)) "Put the previous exe back"
  ( cd "$SERVER_DIR" && mv -f erp-server erp-server.swap && mv -f erp-server.prev erp-server && mv -f erp-server.swap erp-server.prev ) ||
    { out "::fail $n Could not swap the exe files."; out "::result failed"; exit 1; }
  if [ -f "$SERVER_DIR/DEPLOYED.prev.txt" ]; then
    ( cd "$SERVER_DIR" && { [ -f DEPLOYED.txt ] && mv -f DEPLOYED.txt DEPLOYED.swap || true; } &&
      mv -f DEPLOYED.prev.txt DEPLOYED.txt && { [ -f DEPLOYED.swap ] && mv -f DEPLOYED.swap DEPLOYED.prev.txt || true; } )
  fi
  echo "Swapped: the version that was running is now erp-server.prev."
  done_step

  step $((++n)) "Start the server and check it"
  start_server && wait_health || { out "::fail $n The server did not come up."; out "::result failed"; exit 1; }
  done_step
  out "::result ok"
}

# -------------------------------------------------------------------- main --

CMD=${1:-}
[ $# -gt 0 ] && shift
NO_FETCH=0; BUILD_ONLY=0; WITH_DB=0; BRANCH_ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH_ARG=${2:-}; shift 2 ;;
    --no-fetch) NO_FETCH=1; shift ;;
    --build-only) BUILD_ONLY=1; shift ;;
    --with-db) WITH_DB=1; shift ;;
    *) echo "Unknown option $1"; exit 1 ;;
  esac
done

load_config
[ -n "$BRANCH_ARG" ] && BRANCH=$BRANCH_ARG
if ! git check-ref-format --branch "$BRANCH" >/dev/null 2>&1; then
  out "::fail 0 \"$BRANCH\" is not a valid branch name."; out "::result failed"; exit 1
fi

case "$CMD" in
  status) cmd_status ;;
  branches) cmd_branches ;;
  deploy|rollback)
    mkdir -p "$LOGS"
    LOGFILE="$LOGS/$CMD-$(date +%Y%m%d-%H%M%S).log"
    # Log to a file as well. tee ignores cancel signals and a closed app
    # window (-p), so a running update is never cut off by losing its log.
    exec > >(trap '' INT TERM; exec tee -p -a "$LOGFILE") 2>&1
    TEE_PID=$!
    trap 'exec 1>&- 2>&-; wait "$TEE_PID" 2>/dev/null' EXIT
    ls -1t "$LOGS"/*.log 2>/dev/null | tail -n +51 | xargs -r rm -f
    info logfile "$LOGFILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S')  erp-deploy $CMD  branch=$BRANCH  server=$SERVER_DIR"
    exec 9>"$WORK_DIR/.lock"
    if ! flock -n 9; then out "::fail 0 Another update is already running."; out "::result failed"; exit 1; fi
    if [ "$CMD" = deploy ]; then cmd_deploy; else cmd_rollback; fi
    ;;
  *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
