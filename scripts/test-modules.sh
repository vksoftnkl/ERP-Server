#!/usr/bin/env bash
# Run the unit tests (`npm run test`) one module at a time instead of all
# of them in a single jest run. Each module gets its own jest process, a
# failing module does not stop the next one, and a summary prints at the end.
#
#   ./scripts/test-modules.sh                       every module below, one by one
#   ./scripts/test-modules.sh sales gst             only the named modules
#   ./scripts/test-modules.sh sales/bill            one sub-folder of a module
#   ./scripts/test-modules.sh sales --runInBand     anything starting with - goes to jest
#   ./scripts/test-modules.sh --list                print the module names and exit
#
# Same through npm:  npm run test:modules -- sales gst
#
# Put a # in front of a line in MODULES to skip that module.

cd "$(dirname "$0")/.." || exit 1

MODULES=(
  common
  accountsModule
  audit-log
  auth
  dropdown-details
  error-messages
  fixed
  grid-details
  gst
  health
  Inventory
  items-cust-rates-master
  master
  master-lookup
  purchase
  reports
  sales
  settings
  stocks
  till
  txn-status
  users
)

# `common` is src/common, everything else is src/modules/<name>.
path_for() {
  if [ "$1" = "common" ]; then echo "src/common/"; else echo "src/modules/$1/"; fi
}

SELECTED=()
JEST_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --list) printf '%s\n' "${MODULES[@]}"; exit 0 ;;
    -*) JEST_ARGS+=("$arg") ;;
    *) SELECTED+=("${arg%/}") ;;
  esac
done
[ ${#SELECTED[@]} -eq 0 ] && SELECTED=("${MODULES[@]}")

PASSED=()
FAILED=()
START=$SECONDS

for name in "${SELECTED[@]}"; do
  dir=$(path_for "$name")
  if [ ! -d "$dir" ]; then
    echo "!! $name: no folder $dir"
    FAILED+=("$name (not found)")
    continue
  fi

  echo
  echo "================================================================"
  echo "  $name   ($dir)"
  echo "================================================================"
  t=$SECONDS
  if npx jest "$dir" "${JEST_ARGS[@]}"; then
    PASSED+=("$name ($((SECONDS - t))s)")
  else
    FAILED+=("$name ($((SECONDS - t))s)")
  fi
done

echo
echo "================================================================"
echo "  Summary: ${#PASSED[@]} passed, ${#FAILED[@]} failed, $((SECONDS - START))s"
echo "================================================================"
for m in "${PASSED[@]}"; do echo "  PASS  $m"; done
for m in "${FAILED[@]}"; do echo "  FAIL  $m"; done

[ ${#FAILED[@]} -eq 0 ]
