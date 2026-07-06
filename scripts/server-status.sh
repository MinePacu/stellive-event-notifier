#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
SERVER_SSH_TARGET="${SERVER_SSH_TARGET:-}"
SERVER_PROJECT_DIR="${SERVER_PROJECT_DIR:-~/StelLiveNoti}"
SERVER_COMPOSE_FILE="${SERVER_COMPOSE_FILE:-backend/stellive-hub-api/docker-compose.yml}"
SERVER_LOG_TAIL="${SERVER_LOG_TAIL:-0}"
LOG_FILE="$(new_log_file "$ROOT" "server-status")"

require_command ssh
if [[ -z "$SERVER_SSH_TARGET" ]]; then
  echo "error: SERVER_SSH_TARGET is required, for example user@host." >&2
  exit 1
fi

if [[ ! "$SERVER_LOG_TAIL" =~ ^[0-9]+$ ]]; then
  echo "error: SERVER_LOG_TAIL must be a non-negative integer." >&2
  exit 1
fi

REMOTE_COMMAND="cd $SERVER_PROJECT_DIR && docker ps --format 'table {{.Names}}\t{{.Status}}' | sed -n '1p;/stellive-hub-api/p'"
if (( SERVER_LOG_TAIL > 0 )); then
  REMOTE_COMMAND+=" && if docker compose version >/dev/null 2>&1; then COMPOSE='docker compose'; COMPOSE_NAME='docker compose'; \
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE='docker-compose'; COMPOSE_NAME='docker-compose'; \
else echo 'error: neither docker compose nor docker-compose is available' >&2; exit 1; fi && \
echo \"Compose command selected: \$COMPOSE_NAME\" && \
LOGS_HELP=\$(\$COMPOSE logs --help 2>/dev/null || true) && \
COLOR_OPTIONS='' && \
case \"\$LOGS_HELP\" in *--no-color*) COLOR_OPTIONS='--no-color';; esac && \
\$COMPOSE -f $SERVER_COMPOSE_FILE logs \$COLOR_OPTIONS --tail=$SERVER_LOG_TAIL api"
fi

run_logged "$LOG_FILE" ssh "$SERVER_SSH_TARGET" "$REMOTE_COMMAND"
cat "$LOG_FILE"
