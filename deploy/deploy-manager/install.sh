#!/bin/bash
# Builds and installs ERP Deploy Manager for the current user (no sudo needed):
# the app, its deploy script, a settings file and an icon in the app menu and
# on the Desktop.
#
#   ./install.sh --server-dir /path/to/erp-server-linux-x64 [--branch main]
#                [--repo URL] [--qt ~/Qt/6.12.0/gcc_64]
#
# Run it again to rebuild after changing the app. Existing settings are kept;
# edit ~/.config/erp-deploy/deploy.conf to change them.
set -euo pipefail

HERE=$(dirname "$(readlink -f "$0")")
PREFIX=$HOME/.local/opt/erp-deploy-manager
BUILD=$HOME/.cache/erp-deploy-manager-build
CONF=$HOME/.config/erp-deploy/deploy.conf

SERVER_DIR=""; BRANCH=main; REPO_URL=""; QT_DIR=${QT_DIR:-}
while [ $# -gt 0 ]; do
  case "$1" in
    --server-dir) SERVER_DIR=$2; shift 2 ;;
    --branch) BRANCH=$2; shift 2 ;;
    --repo) REPO_URL=$2; shift 2 ;;
    --qt) QT_DIR=$2; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$QT_DIR" ]; then
  QT_DIR=$(ls -d "$HOME"/Qt/6.*/gcc_64 2>/dev/null | sort -V | tail -1 || true)
fi
if [ -z "$QT_DIR" ] || [ ! -d "$QT_DIR/lib/cmake/Qt6Widgets" ]; then
  echo "Qt 6 not found. Pass --qt /path/to/Qt/6.x/gcc_64." >&2; exit 1
fi
for t in cmake ninja g++; do
  command -v "$t" >/dev/null || { echo "\"$t\" is needed to build the app." >&2; exit 1; }
done

echo "Building with Qt from $QT_DIR ..."
cmake -S "$HERE/gui" -B "$BUILD" -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH="$QT_DIR" >/dev/null
cmake --build "$BUILD"
cmake --install "$BUILD" --prefix "$PREFIX" >/dev/null
chmod 755 "$PREFIX/erp-deploy.sh"
echo "Installed to $PREFIX"

if [ -f "$CONF" ]; then
  echo "Keeping the existing settings in $CONF"
else
  if [ -z "$SERVER_DIR" ]; then
    echo "First install: pass --server-dir with the installed server folder (the one holding erp-server and .env)." >&2
    exit 1
  fi
  SERVER_DIR=$(readlink -f "$SERVER_DIR")
  [ -f "$SERVER_DIR/.env" ] || { echo "$SERVER_DIR/.env not found." >&2; exit 1; }
  if [ -z "$REPO_URL" ]; then
    REPO_URL=$(git -C "$HERE" remote get-url origin 2>/dev/null || true)
    [ -n "$REPO_URL" ] || { echo "Pass --repo with the GitHub URL of the ERP server." >&2; exit 1; }
  fi
  mkdir -p "$(dirname "$CONF")"
  cat > "$CONF" <<EOF
# ERP Deploy Manager settings.
# GitHub repository of the ERP server, and the branch the app selects first.
REPO_URL=$REPO_URL
BRANCH=$BRANCH
# The installed server folder (holds erp-server and .env; .env is never changed).
SERVER_DIR=$SERVER_DIR
# Where the app keeps its copy of the code, the builds, database backups and logs.
WORK_DIR=$HOME/erp-deploy
# systemd service name (used when install-service.sh has been run).
SERVICE=erp-server
# Database backups to keep (one is taken before every update).
KEEP_BACKUPS=10
# Seconds to wait for the new server to answer before rolling back.
HEALTH_TIMEOUT=120
# Migrations applied to the database on purpose but kept out of git (space separated).
ALLOW_EXTRA_MIGRATIONS=
EOF
  echo "Wrote settings to $CONF"
fi

DESKTOP_FILE=$HOME/.local/share/applications/erp-deploy-manager.desktop
mkdir -p "$(dirname "$DESKTOP_FILE")"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=ERP Deploy Manager
Comment=Update the ERP server from GitHub: build, migrate, restart
Exec=$PREFIX/erp-deploy-manager
Path=$PREFIX
Icon=system-software-update
Terminal=false
Categories=Development;
StartupNotify=true
StartupWMClass=erp-deploy-manager
EOF
chmod 755 "$DESKTOP_FILE"
DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
if [ -d "$DESKTOP_DIR" ]; then
  cp "$DESKTOP_FILE" "$DESKTOP_DIR/ERP Deploy Manager.desktop"
  chmod 755 "$DESKTOP_DIR/ERP Deploy Manager.desktop"
  gio set "$DESKTOP_DIR/ERP Deploy Manager.desktop" metadata::trusted true 2>/dev/null || true
fi
echo "Added \"ERP Deploy Manager\" to the app menu and the Desktop."
