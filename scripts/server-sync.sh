#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
SERVER_SSH_TARGET="${SERVER_SSH_TARGET:-}"
SERVER_PROJECT_DIR="${SERVER_PROJECT_DIR:-~/StelLiveNoti}"
LOG_FILE="$(new_log_file "$ROOT" "server-sync")"

require_command rsync
if [[ -z "$SERVER_SSH_TARGET" ]]; then
  echo "error: SERVER_SSH_TARGET is required, for example user@host." >&2
  exit 1
fi

run_logged "$LOG_FILE" \
  rsync -az --delete \
  --exclude ".git/" \
  --exclude ".gradle/" \
  --exclude "node_modules/" \
  --exclude "dist/" \
  --exclude "build/" \
  --exclude "qa-screenshots/" \
  --exclude ".DS_Store" \
  --exclude ".env" \
  --exclude ".env.*" \
  "$ROOT/" "$SERVER_SSH_TARGET:$SERVER_PROJECT_DIR/"

echo "Server sync succeeded: $SERVER_SSH_TARGET:$SERVER_PROJECT_DIR"
