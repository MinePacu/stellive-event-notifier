#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

"$SCRIPT_DIR/server-sync.sh"
"$SCRIPT_DIR/server-rebuild.sh"
SERVER_LOG_TAIL="${SERVER_LOG_TAIL:-0}" "$SCRIPT_DIR/server-status.sh"
