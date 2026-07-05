#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || die "git is required."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git repository."

if [[ $# -gt 1 ]]; then
  printf 'usage: scripts/affected-scope.sh [base-ref]\n' >&2
  exit 2
fi

BASE_REF="${1:-main}"
CHANGED_FILE="$(mktemp)"
SCOPES_FILE="$(mktemp)"
trap 'rm -f "$CHANGED_FILE" "$SCOPES_FILE"' EXIT

if ! git diff --name-only "$BASE_REF"...HEAD >"$CHANGED_FILE" 2>/dev/null; then
  if ! git diff --name-only "$BASE_REF" HEAD >"$CHANGED_FILE" 2>/dev/null; then
    die "cannot compare HEAD with $BASE_REF."
  fi
fi

printf '== Changed files vs %s ==\n' "$BASE_REF"
TOTAL="$(wc -l <"$CHANGED_FILE" | tr -d ' ')"
if [[ "$TOTAL" -eq 0 ]]; then
  printf '(none)\n'
else
  sed -n '1,80p' "$CHANGED_FILE"
  if [[ "$TOTAL" -gt 80 ]]; then
    printf '... and %s more files\n' "$((TOTAL - 80))"
  fi
fi

while IFS= read -r FILE_PATH; do
  case "$FILE_PATH" in
    backend/stellive-hub-api/*) printf '%s\n' backend >>"$SCOPES_FILE" ;;
    android/StelliveHubAndroid/*) printf '%s\n' android >>"$SCOPES_FILE" ;;
    ios/StelliveHubiOS/*) printf '%s\n' ios >>"$SCOPES_FILE" ;;
    shared/*) printf '%s\n' shared >>"$SCOPES_FILE" ;;
    docs/*|mockups/*|README.md|CODEMAP.md) printf '%s\n' docs >>"$SCOPES_FILE" ;;
    scripts/*) printf '%s\n' scripts >>"$SCOPES_FILE" ;;
    .github/*|.gitlab-ci.yml) printf '%s\n' ci >>"$SCOPES_FILE" ;;
    AGENTS.md|.gitignore|.dockerignore|.serena/*) printf '%s\n' root >>"$SCOPES_FILE" ;;
    */*) : ;;
    ?*) printf '%s\n' root >>"$SCOPES_FILE" ;;
  esac
done <"$CHANGED_FILE"

sort -u "$SCOPES_FILE" -o "$SCOPES_FILE"

printf '\n== Detected scopes ==\n'
if [[ ! -s "$SCOPES_FILE" ]]; then
  printf '(none)\n'
else
  sed -n '1,20p' "$SCOPES_FILE"
fi

printf '\n== Suggested context ==\nRead:\n- AGENTS.md\n'
while IFS= read -r SCOPE; do
  case "$SCOPE" in
    backend)
      printf '%s\n' '- backend/stellive-hub-api/AGENTS.md' '- docs/codemaps/backend.md (if present)'
      ;;
    android)
      printf '%s\n' '- android/StelliveHubAndroid/AGENTS.md' '- docs/codemaps/android.md (if present)'
      ;;
    ios)
      printf '%s\n' '- ios/StelliveHubiOS/AGENTS.md' '- docs/codemaps/ios.md (if present)'
      ;;
    shared)
      printf '%s\n' '- docs/codemaps/shared.md (if present)' '- Relevant platform AGENTS.md only when the contract change requires it'
      ;;
    docs) printf '%s\n' '- docs/AGENTS.md' ;;
    scripts) printf '%s\n' '- scripts/AGENTS.md' ;;
    ci) printf '%s\n' '- Only the changed CI configuration; do not read full logs' ;;
    root) printf '%s\n' '- Only the changed root metadata file' ;;
  esac
done <"$SCOPES_FILE"

printf '\nAvoid:\n'
printf '%s\n' \
  '- Unrelated platform docs and tests unless cross-platform behavior is required.' \
  '- Full CI logs unless a required check failed.' \
  '- Full repository traversal.'

printf '\n== Suggested checks ==\n'
if grep -qx backend "$SCOPES_FILE"; then
  printf '%s\n' '- cd backend/stellive-hub-api && rtk npm test -- <focused targets>' '- cd backend/stellive-hub-api && rtk npm run build (when compile-sensitive)'
fi
if grep -qx android "$SCOPES_FILE"; then
  printf '%s\n' '- cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests <focused test>'
fi
if grep -qx ios "$SCOPES_FILE"; then
  printf '%s\n' '- Run targeted XCTest with -only-testing when verification is required'
fi
if grep -Eqx 'docs|scripts|root|ci|shared' "$SCOPES_FILE"; then
  printf '%s\n' '- rtk git diff --check'
fi
if [[ ! -s "$SCOPES_FILE" ]]; then
  printf '(none)\n'
fi
