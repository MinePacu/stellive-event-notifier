#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
ANDROID_PROJECT_DIR="${ANDROID_PROJECT_DIR:-$ROOT/android/StelliveHubAndroid}"
ADB_BIN="${ADB_BIN:-adb}"
LOG_FILE="$(new_log_file "$ROOT" "android-install")"

require_command "$ADB_BIN"

APK="$(select_android_apk "$ANDROID_PROJECT_DIR")"

if ! "$ADB_BIN" devices >"$LOG_FILE" 2>&1; then
  echo "error: adb devices failed." >&2
  print_log_tail "$LOG_FILE" "${LOG_TAIL_LINES:-160}"
  exit 1
fi

DEVICES=()
while IFS= read -r device; do
  DEVICES+=("$device")
done < <(awk 'NR > 1 && $2 == "device" { print $1 }' "$LOG_FILE")

if [[ "${#DEVICES[@]}" -eq 0 ]]; then
  echo "error: no connected Android device found." >&2
  echo "Connect a device/emulator and verify it appears as 'device' in adb devices." >&2
  echo "log: $LOG_FILE" >&2
  exit 1
fi

SERIAL="${ANDROID_SERIAL:-}"
if [[ -z "$SERIAL" ]]; then
  if [[ "${#DEVICES[@]}" -gt 1 ]]; then
    echo "error: multiple Android devices are connected." >&2
    echo "Set ANDROID_SERIAL to one of:" >&2
    printf '  %s\n' "${DEVICES[@]}" >&2
    exit 1
  fi
  SERIAL="${DEVICES[0]}"
fi

MATCHED=false
for device in "${DEVICES[@]}"; do
  if [[ "$device" == "$SERIAL" ]]; then
    MATCHED=true
    break
  fi
done

if [[ "$MATCHED" != true ]]; then
  echo "error: ANDROID_SERIAL is not connected as a device: $SERIAL" >&2
  echo "connected devices:" >&2
  printf '  %s\n' "${DEVICES[@]}" >&2
  exit 1
fi

run_logged "$LOG_FILE" "$ADB_BIN" -s "$SERIAL" install -r "$APK"

echo "Android install succeeded on $SERIAL: $APK"
