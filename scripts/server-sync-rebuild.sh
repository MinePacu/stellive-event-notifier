#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

"$SCRIPT_DIR/server-sync.sh"
"$SCRIPT_DIR/server-rebuild.sh"
"$SCRIPT_DIR/server-status.sh"
