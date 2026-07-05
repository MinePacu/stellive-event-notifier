#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
IOS_PROJECT_DIR="${IOS_PROJECT_DIR:-$ROOT/ios/StelliveHubiOS}"
IOS_SCHEME="${IOS_SCHEME:-StelliveHubiOS}"
IOS_CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
IOS_DESTINATION="${IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 16}"
IOS_DERIVED_DATA_DIR="${IOS_DERIVED_DATA_DIR:-$ROOT/scripts/logs/DerivedData-ios-simulator}"
LOG_FILE="$(new_log_file "$ROOT" "ios-build-simulator")"

require_command xcodebuild
mkdir -p "$IOS_DERIVED_DATA_DIR"

PROJECT_ARG=()
while IFS= read -r project_arg; do
  PROJECT_ARG+=("$project_arg")
done < <(ios_project_arg "$IOS_PROJECT_DIR")

run_logged "$LOG_FILE" \
  xcodebuild build \
  "${PROJECT_ARG[0]}" "${PROJECT_ARG[1]}" \
  -scheme "$IOS_SCHEME" \
  -configuration "$IOS_CONFIGURATION" \
  -destination "$IOS_DESTINATION" \
  -derivedDataPath "$IOS_DERIVED_DATA_DIR" \
  CODE_SIGNING_ALLOWED=NO

APP_PATH="$(select_ios_app "$IOS_DERIVED_DATA_DIR" "$IOS_CONFIGURATION" "$IOS_SCHEME")"
echo "iOS simulator build succeeded: $APP_PATH"
