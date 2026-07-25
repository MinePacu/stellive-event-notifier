#!/usr/bin/env bash
set -euo pipefail

project_root() {
  local source_dir
  source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  cd "$source_dir/../.." && pwd -P
}

stellive_cache_root() {
  if [[ -n "${STELLIVE_CACHE_DIR:-}" ]]; then
    printf '%s\n' "$STELLIVE_CACHE_DIR"
    return
  fi

  local root cache_root_file cache_root
  root="$(project_root)"
  cache_root_file="$root/scripts/.cache-root"
  if [[ -f "$cache_root_file" ]]; then
    IFS= read -r cache_root <"$cache_root_file" || true
    if [[ -n "$cache_root" ]]; then
      printf '%s\n' "$cache_root"
      return
    fi
  fi

  echo "error: no cache root configured." >&2
  echo "Set STELLIVE_CACHE_DIR or add the cache path to scripts/.cache-root." >&2
  return 1
}

ios_derived_data_dir() {
  local cache_root
  cache_root="$(stellive_cache_root)"
  printf '%s/DerivedData-ios-simulator\n' "$cache_root"
}

gradle_user_home_dir() {
  local cache_root
  cache_root="$(stellive_cache_root)"
  printf '%s/gradle-user-home\n' "$cache_root"
}

require_cache_root() {
  local cache_root
  cache_root="$(stellive_cache_root)"

  if [[ -d "$cache_root" ]]; then
    return
  fi

  echo "error: cache root is unavailable: $cache_root" >&2
  echo "Mount the external volume or set STELLIVE_CACHE_DIR to an available directory." >&2
  exit 1
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "error: required command not found: $command_name" >&2
    exit 127
  fi
}

ensure_log_dir() {
  local root="$1"
  mkdir -p "$root/scripts/logs"
}

new_log_file() {
  local root="$1"
  local name="$2"
  ensure_log_dir "$root"
  printf '%s/scripts/logs/%s-%s.log\n' "$root" "$name" "$(date +%Y%m%d-%H%M%S)"
}

print_log_tail() {
  local log_file="$1"
  local lines="${2:-160}"
  echo "log: $log_file" >&2
  if [[ -f "$log_file" ]]; then
    echo "---- last $lines lines ----" >&2
    tail -n "$lines" "$log_file" >&2
    echo "---- end log tail ----" >&2
  fi
}

run_logged() {
  local log_file="$1"
  shift

  if "$@" >"$log_file" 2>&1; then
    return 0
  fi

  local status=$?
  echo "error: command failed with status $status: $*" >&2
  print_log_tail "$log_file" "${LOG_TAIL_LINES:-160}"
  exit "$status"
}

select_android_apk() {
  local android_project_dir="$1"
  local apk_path="${APK_PATH:-}"

  if [[ -n "$apk_path" ]]; then
    if [[ -f "$apk_path" ]]; then
      printf '%s\n' "$apk_path"
      return 0
    fi
    echo "error: APK_PATH does not exist: $apk_path" >&2
    exit 1
  fi

  local preferred="$android_project_dir/app/build/outputs/apk/debug/app-debug.apk"
  if [[ -f "$preferred" ]]; then
    printf '%s\n' "$preferred"
    return 0
  fi

  shopt -s nullglob globstar
  local candidates=("$android_project_dir"/app/build/outputs/apk/debug/**/*.apk "$android_project_dir"/app/build/outputs/apk/debug/*.apk)
  shopt -u nullglob globstar

  local unique=()
  local candidate existing found
  for candidate in "${candidates[@]}"; do
    found=false
    for existing in "${unique[@]}"; do
      if [[ "$existing" == "$candidate" ]]; then
        found=true
        break
      fi
    done
    if [[ "$found" == false ]]; then
      unique+=("$candidate")
    fi
  done

  if [[ "${#unique[@]}" -eq 1 ]]; then
    printf '%s\n' "${unique[0]}"
    return 0
  fi

  echo "error: could not select a unique debug APK." >&2
  echo "Set APK_PATH to the APK to install." >&2
  if [[ "${#unique[@]}" -gt 1 ]]; then
    printf 'candidates:\n' >&2
    printf '  %s\n' "${unique[@]}" >&2
  fi
  exit 1
}

ios_project_arg() {
  local ios_project_dir="$1"

  shopt -s nullglob
  local workspaces=("$ios_project_dir"/*.xcworkspace)
  local projects=("$ios_project_dir"/*.xcodeproj)
  shopt -u nullglob

  if [[ "${#workspaces[@]}" -eq 1 ]]; then
    printf '%s\n%s\n' "-workspace" "${workspaces[0]}"
    return 0
  fi

  if [[ "${#workspaces[@]}" -gt 1 ]]; then
    echo "error: multiple iOS workspaces found. Set IOS_WORKSPACE_PATH." >&2
    printf '  %s\n' "${workspaces[@]}" >&2
    exit 1
  fi

  if [[ -n "${IOS_WORKSPACE_PATH:-}" ]]; then
    printf '%s\n%s\n' "-workspace" "$IOS_WORKSPACE_PATH"
    return 0
  fi

  if [[ -n "${IOS_PROJECT_PATH:-}" ]]; then
    printf '%s\n%s\n' "-project" "$IOS_PROJECT_PATH"
    return 0
  fi

  if [[ "${#projects[@]}" -eq 1 ]]; then
    printf '%s\n%s\n' "-project" "${projects[0]}"
    return 0
  fi

  echo "error: could not select a unique iOS Xcode project." >&2
  echo "Set IOS_PROJECT_PATH or IOS_WORKSPACE_PATH." >&2
  if [[ "${#projects[@]}" -gt 1 ]]; then
    printf 'project candidates:\n' >&2
    printf '  %s\n' "${projects[@]}" >&2
  fi
  exit 1
}

default_ios_app_path() {
  local derived_data_dir="$1"
  local configuration="$2"
  local scheme="$3"
  printf '%s/Build/Products/%s-iphonesimulator/%s.app\n' "$derived_data_dir" "$configuration" "$scheme"
}

select_ios_app() {
  local derived_data_dir="$1"
  local configuration="$2"
  local scheme="$3"
  local app_path="${IOS_APP_PATH:-}"

  if [[ -n "$app_path" ]]; then
    if [[ -d "$app_path" ]]; then
      printf '%s\n' "$app_path"
      return 0
    fi
    echo "error: IOS_APP_PATH does not exist: $app_path" >&2
    exit 1
  fi

  local preferred
  preferred="$(default_ios_app_path "$derived_data_dir" "$configuration" "$scheme")"
  if [[ -d "$preferred" ]]; then
    printf '%s\n' "$preferred"
    return 0
  fi

  shopt -s nullglob globstar
  local candidates=("$derived_data_dir"/Build/Products/"$configuration"-iphonesimulator/*.app)
  shopt -u nullglob globstar

  if [[ "${#candidates[@]}" -eq 1 ]]; then
    printf '%s\n' "${candidates[0]}"
    return 0
  fi

  echo "error: could not select a unique iOS .app product." >&2
  echo "Set IOS_APP_PATH or run scripts/ios-build-simulator.sh first." >&2
  if [[ "${#candidates[@]}" -gt 1 ]]; then
    printf 'candidates:\n' >&2
    printf '  %s\n' "${candidates[@]}" >&2
  fi
  exit 1
}
