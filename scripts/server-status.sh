#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
SERVER_SSH_TARGET="${SERVER_SSH_TARGET:-}"
SERVER_PROJECT_DIR="${SERVER_PROJECT_DIR:-~/StelLiveNoti}"
SERVER_COMPOSE_FILE="${SERVER_COMPOSE_FILE:-backend/stellive-hub-api/docker-compose.yml}"
SERVER_LOG_TAIL="${SERVER_LOG_TAIL:-40}"
LOG_FILE="$(new_log_file "$ROOT" "server-status")"

require_command ssh
if [[ -z "$SERVER_SSH_TARGET" ]]; then
  echo "error: SERVER_SSH_TARGET is required, for example user@host." >&2
  exit 1
fi

REMOTE_COMMAND="cd $SERVER_PROJECT_DIR && docker ps --format 'table {{.Names}}\t{{.Status}}' | sed -n '1p;/stellive-hub-api/p' && docker compose -f $SERVER_COMPOSE_FILE logs --no-color --tail=$SERVER_LOG_TAIL api"
run_logged "$LOG_FILE" ssh "$SERVER_SSH_TARGET" "$REMOTE_COMMAND"

echo "Server status check succeeded. Log saved: $LOG_FILE"
