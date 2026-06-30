#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
SERVER_SSH_TARGET="${SERVER_SSH_TARGET:-}"
SERVER_PROJECT_DIR="${SERVER_PROJECT_DIR:-~/StelLiveNoti}"
SERVER_COMPOSE_FILE="${SERVER_COMPOSE_FILE:-backend/stellive-hub-api/docker-compose.yml}"
LOG_FILE="$(new_log_file "$ROOT" "server-rebuild")"

require_command ssh
if [[ -z "$SERVER_SSH_TARGET" ]]; then
  echo "error: SERVER_SSH_TARGET is required, for example user@host." >&2
  exit 1
fi

REMOTE_COMMAND="cd $SERVER_PROJECT_DIR && docker compose -f $SERVER_COMPOSE_FILE up -d --build --force-recreate"
run_logged "$LOG_FILE" ssh "$SERVER_SSH_TARGET" "$REMOTE_COMMAND"

echo "Server rebuild/recreate succeeded: $SERVER_SSH_TARGET"
