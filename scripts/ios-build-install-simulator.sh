#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

"$SCRIPT_DIR/ios-build-simulator.sh"
"$SCRIPT_DIR/ios-install-simulator.sh"
