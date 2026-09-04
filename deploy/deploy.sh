#!/usr/bin/env bash
#
# Deploy the ERP server on this VPS. Run as root:
#
#     /opt/erp-server/bin/deploy.sh            # deploy the current branch
#     /opt/erp-server/bin/deploy.sh main       # deploy a different branch
#
# Idempotent and fail-fast: any step that fails aborts before PM2 is reloaded,
# so a broken build never replaces a running one.
set -euo pipefail

APP_DIR=/opt/erp-server/app
SECRETS=/root/.erp-deploy-secrets

[ "$(id -u)" -eq 0 ] || { echo "must run as root" >&2; exit 1; }

# The working tree is owned by erp, so every git call runs as erp -- root would
# trip git's dubious-ownership guard.
BRANCH="${1:-$(sudo -u erp git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)}"
# shellcheck source=/dev/null
. "$SECRETS"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
say "Fetching $BRANCH"
OLD_SHA=$(sudo -u erp git -C "$APP_DIR" rev-parse HEAD)
sudo -u erp git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
sudo -u erp git -C "$APP_DIR" reset --hard "origin/$BRANCH"
NEW_SHA=$(sudo -u erp git -C "$APP_DIR" rev-parse HEAD)
echo "$OLD_SHA -> $NEW_SHA"
sudo -u erp git -C "$APP_DIR" log -1 --oneline

# ---------------------------------------------------------------------------
# NODE_ENV must be unset here: @nestjs/cli and typescript are devDependencies,
# and npm skips them when NODE_ENV=production, which breaks the build.
say "Installing dependencies"
( cd "$APP_DIR" && sudo -u erp env -u NODE_ENV HOME=/opt/erp-server \
    npm ci --include=dev --no-audit --fund=false )

say "Building"
( cd "$APP_DIR" && sudo -u erp env -u NODE_ENV HOME=/opt/erp-server npm run build )

# ---------------------------------------------------------------------------
# Seven migrations carry `ALTER TABLE ... OWNER to postgres`, so migrations can
# only be applied by a superuser. The app itself runs as the unprivileged
# erp_app role -- hence the separate URL here.
say "Applying migrations (as postgres)"
( cd "$APP_DIR" && sudo -u erp env -u NODE_ENV HOME=/opt/erp-server \
    DATABASE_URL="$MIGRATE_DATABASE_URL" npm run prisma:migrate:deploy )

say "Re-granting erp_app privileges on any newly created objects"
sudo -u postgres psql -d erp -q -v ON_ERROR_STOP=1 -f - < /opt/erp-server/bin/grant-app-privileges.sql

# ---------------------------------------------------------------------------
# Bill/order/quotation tables are LIST-partitioned by accounting year. A year
# with no partition makes every save fail, so make sure the current and next
# fiscal year always exist. Indian FY: April -> March.
say "Ensuring accounting-year partitions"
YEAR=$(date +%Y); MONTH=$(date +%m)
if [ "$((10#$MONTH))" -ge 4 ]; then FY_START=$YEAR; else FY_START=$((YEAR - 1)); fi
for fy in "$FY_START-$((FY_START + 1))" "$((FY_START + 1))-$((FY_START + 2))"; do
  sudo -u postgres psql -d erp -q -v ON_ERROR_STOP=1 \
    -c "SELECT public.ensure_acc_year_partitions('$fy'::char(9));" >/dev/null
  echo "  ensured $fy"
done

# ---------------------------------------------------------------------------
say "Reloading PM2"
( cd /opt/erp-server && sudo -u erp HOME=/opt/erp-server pm2 reload erp-api --update-env )
( cd /opt/erp-server && sudo -u erp HOME=/opt/erp-server pm2 save >/dev/null )

say "Health check"
for i in $(seq 1 40); do
  if curl -fsS -m 5 http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then
    curl -s http://127.0.0.1:3000/api/v1/health; echo
    echo
    echo "Deployed $NEW_SHA successfully."
    exit 0
  fi
  sleep 3
done

echo "HEALTH CHECK FAILED after ~120s" >&2
echo "Last 40 log lines:" >&2
tail -40 /opt/erp-server/logs/pm2-error.log >&2 || true
echo >&2
echo "To roll back:  sudo -u erp git -C $APP_DIR reset --hard $OLD_SHA && $0" >&2
exit 1
