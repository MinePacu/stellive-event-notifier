#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=scripts/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ROOT="$(project_root)"
SERVER_SSH_TARGET="${SERVER_SSH_TARGET:-}"
SERVER_PROJECT_DIR="${SERVER_PROJECT_DIR:-~/StelLiveNoti}"
SERVER_COMPOSE_FILE="${SERVER_COMPOSE_FILE:-backend/stellive-hub-api/docker-compose.yml}"
SERVER_FORCE_RECREATE="${SERVER_FORCE_RECREATE:-0}"
SERVER_DOCKER_PRUNE="${SERVER_DOCKER_PRUNE:-0}"
SERVER_DOCKER_PRUNE_UNTIL="${SERVER_DOCKER_PRUNE_UNTIL:-24h}"
SERVER_DOCKER_CACHE_KEEP_STORAGE="${SERVER_DOCKER_CACHE_KEEP_STORAGE:-1GB}"
SERVER_DOCKER_DF="${SERVER_DOCKER_DF:-0}"
LOG_FILE="$(new_log_file "$ROOT" "server-rebuild")"

require_command ssh
if [[ -z "$SERVER_SSH_TARGET" ]]; then
  echo "error: SERVER_SSH_TARGET is required, for example user@host." >&2
  exit 1
fi

REMOTE_COMMAND="cd $SERVER_PROJECT_DIR && \
if docker compose version >/dev/null 2>&1; then COMPOSE='docker compose'; COMPOSE_NAME='docker compose'; \
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE='docker-compose'; COMPOSE_NAME='docker-compose'; \
else echo 'error: neither docker compose nor docker-compose is available' >&2; exit 1; fi && \
echo \"Compose command selected: \$COMPOSE_NAME\" && \
COMPOSE_HELP=\$(\$COMPOSE --help 2>/dev/null || true) && \
COLOR_OPTIONS='' && \
case \"\$COMPOSE_HELP\" in *--no-color*) COLOR_OPTIONS='--no-color';; esac && \
UP_HELP=\$(\$COMPOSE up --help 2>/dev/null || true) && \
QUIET_OPTIONS='' && \
case \"\$UP_HELP\" in *--quiet-build*) QUIET_OPTIONS=\"\$QUIET_OPTIONS --quiet-build\";; esac && \
case \"\$UP_HELP\" in *--quiet-pull*) QUIET_OPTIONS=\"\$QUIET_OPTIONS --quiet-pull\";; esac && \
\$COMPOSE \$COLOR_OPTIONS -f $SERVER_COMPOSE_FILE up -d --build --remove-orphans\$QUIET_OPTIONS"

if [[ "$SERVER_FORCE_RECREATE" == "1" ]]; then
  REMOTE_COMMAND+=" --force-recreate"
fi

if [[ "$SERVER_DOCKER_PRUNE" == "1" ]]; then
  REMOTE_COMMAND+=" && docker image prune -f --filter 'until=$SERVER_DOCKER_PRUNE_UNTIL' >/dev/null"
  REMOTE_COMMAND+=" && docker builder prune -f --filter 'until=$SERVER_DOCKER_PRUNE_UNTIL' --keep-storage '$SERVER_DOCKER_CACHE_KEEP_STORAGE' >/dev/null"
fi

run_logged "$LOG_FILE" ssh "$SERVER_SSH_TARGET" "$REMOTE_COMMAND"

if [[ "$SERVER_DOCKER_DF" == "1" ]]; then
  DF_LOG_FILE="$(new_log_file "$ROOT" "server-docker-df")"
  run_logged "$DF_LOG_FILE" ssh "$SERVER_SSH_TARGET" "docker system df"
  cat "$DF_LOG_FILE"
fi
