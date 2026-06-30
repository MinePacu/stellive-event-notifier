#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
ANDROID_PROJECT_DIR="${ANDROID_PROJECT_DIR:-$ROOT/android/StelliveHubAndroid}"
GRADLE_TASK="${ANDROID_GRADLE_TASK:-:app:assembleDebug}"
LOG_FILE="$(new_log_file "$ROOT" "android-build")"

if [[ ! -x "$ANDROID_PROJECT_DIR/gradlew" ]]; then
  echo "error: Gradle wrapper not found or not executable: $ANDROID_PROJECT_DIR/gradlew" >&2
  exit 1
fi

run_logged "$LOG_FILE" "$ANDROID_PROJECT_DIR/gradlew" -p "$ANDROID_PROJECT_DIR" "$GRADLE_TASK"

APK="$(select_android_apk "$ANDROID_PROJECT_DIR")"
echo "Android debug build succeeded: $APK"
