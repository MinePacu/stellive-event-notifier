#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
IOS_SCHEME="${IOS_SCHEME:-StelliveHubiOS}"
IOS_CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
IOS_DERIVED_DATA_DIR="${IOS_DERIVED_DATA_DIR:-$ROOT/scripts/logs/DerivedData-ios-simulator}"
LOG_FILE="$(new_log_file "$ROOT" "ios-install-simulator")"

require_command xcrun

APP_PATH="$(select_ios_app "$IOS_DERIVED_DATA_DIR" "$IOS_CONFIGURATION" "$IOS_SCHEME")"

if ! xcrun simctl getenv booted SIMULATOR_UDID >"$LOG_FILE" 2>&1; then
  echo "error: no booted iOS simulator found." >&2
  echo "Boot a simulator first, then rerun this script." >&2
  print_log_tail "$LOG_FILE" "${LOG_TAIL_LINES:-160}"
  exit 1
fi

BOOTED_UDID="$(tr -d '[:space:]' <"$LOG_FILE")"
if [[ -z "$BOOTED_UDID" ]]; then
  echo "error: no booted iOS simulator found." >&2
  echo "Boot a simulator first, then rerun this script." >&2
  echo "log: $LOG_FILE" >&2
  exit 1
fi

run_logged "$LOG_FILE" xcrun simctl install booted "$APP_PATH"

echo "iOS simulator install succeeded on booted simulator $BOOTED_UDID: $APP_PATH"
