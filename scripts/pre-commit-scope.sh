#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf 'usage: scripts/pre-commit-scope.sh [base-ref] [--base <ref>] [--staged]\n'
}

command -v git >/dev/null 2>&1 || die "git is required."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git repository."

BASE_REF="main"
BASE_SET=false
STAGED=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      [[ $# -ge 2 ]] || die "--base requires a ref."
      [[ "$BASE_SET" == false ]] || die "base ref was specified more than once."
      BASE_REF="$2"
      BASE_SET=true
      shift 2
      ;;
    --staged)
      STAGED=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*) die "unknown option: $1" ;;
    *)
      [[ "$BASE_SET" == false ]] || die "base ref was specified more than once."
      BASE_REF="$1"
      BASE_SET=true
      shift
      ;;
  esac
done

CHANGED_FILE="$(mktemp)"
CANDIDATE_FILE="$(mktemp)"
SCOPES_FILE="$(mktemp)"
trap 'rm -f "$CHANGED_FILE" "$CANDIDATE_FILE" "$SCOPES_FILE"' EXIT

MODE="branch and working-tree changes"
if [[ "$STAGED" == true ]]; then
  MODE="staged changes"
  git diff --name-only --cached >"$CHANGED_FILE"
else
  if ! git diff --name-only "$BASE_REF"...HEAD >"$CANDIDATE_FILE" 2>/dev/null; then
    if ! git diff --name-only "$BASE_REF" HEAD >"$CANDIDATE_FILE" 2>/dev/null; then
      die "cannot compare HEAD with $BASE_REF."
    fi
  fi
  git diff --name-only >>"$CANDIDATE_FILE"
  git diff --name-only --cached >>"$CANDIDATE_FILE"
  git ls-files --others --exclude-standard >>"$CANDIDATE_FILE"
  sort -u "$CANDIDATE_FILE" >"$CHANGED_FILE"
fi

printf '== Pre-commit scope ==\nBase: %s\nMode: %s\n' "$BASE_REF" "$MODE"

printf '\n== Changed files ==\n'
TOTAL="$(wc -l <"$CHANGED_FILE" | tr -d ' ')"
if [[ "$TOTAL" -eq 0 ]]; then
  printf 'No changed files detected.\n'
  exit 0
fi

sed -n '1,80p' "$CHANGED_FILE"
if [[ "$TOTAL" -gt 80 ]]; then
  printf '... and %s more files\n' "$((TOTAL - 80))"
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
if [[ -s "$SCOPES_FILE" ]]; then
  sed -n '1,20p' "$SCOPES_FILE"
else
  printf '(none)\n'
fi

printf '\n== Suggested context ==\n- AGENTS.md\n'
while IFS= read -r SCOPE; do
  case "$SCOPE" in
    backend) printf '%s\n' '- backend/stellive-hub-api/AGENTS.md' '- docs/codemaps/backend.md (if present)' ;;
    android) printf '%s\n' '- android/StelliveHubAndroid/AGENTS.md' '- docs/codemaps/android.md (if present)' ;;
    ios) printf '%s\n' '- ios/StelliveHubiOS/AGENTS.md' '- docs/codemaps/ios.md (if present)' ;;
    shared) printf '%s\n' '- docs/codemaps/shared.md (if present)' '- Platform AGENTS files only for consumers affected by the contract change' ;;
    docs) printf '%s\n' '- docs/AGENTS.md' ;;
    scripts) printf '%s\n' '- scripts/AGENTS.md' ;;
    ci) printf '%s\n' '- Relevant changed CI configuration only' ;;
    root) printf '%s\n' '- The changed root metadata file only' ;;
  esac
done <"$SCOPES_FILE"

printf '\n== Suggested pre-commit checks ==\n- rtk git diff --check\n'
if grep -qx backend "$SCOPES_FILE"; then
  printf '%s\n' '- cd backend/stellive-hub-api && rtk npm test -- <focused targets>' '- cd backend/stellive-hub-api && rtk npm run build (for TypeScript wiring, contracts, env, or routes)'
fi
if grep -qx android "$SCOPES_FILE"; then
  printf '%s\n' '- cd android/StelliveHubAndroid && rtk ./gradlew :app:testDebugUnitTest --tests <focused tests>' '- Run assemble/build only for compile, resources, manifest, or Gradle wiring changes'
fi
if grep -qx ios "$SCOPES_FILE"; then
  printf '%s\n' '- cd ios/StelliveHubiOS && rtk xcodebuild test ... -only-testing:<focused tests>' '- Run build only for compile, project, entitlement, widget, or shared DTO mapping changes'
fi
if grep -qx shared "$SCOPES_FILE"; then
  printf '%s\n' '- Run focused checks only for consumers touched by the shared change' '- Avoid all-platform verification unless the contract affects all three platforms'
fi
if grep -qx docs "$SCOPES_FILE"; then
  printf '%s\n' '- Run Markdown/link/path checks only when relevant'
fi
if grep -qx scripts "$SCOPES_FILE"; then
  printf '%s\n' '- rtk bash -n scripts/<changed-script>.sh'
fi
if grep -qx ci "$SCOPES_FILE"; then
  printf '%s\n' '- Review or syntax-check changed CI config; do not run full CI locally by default'
fi

SCOPE_LABEL="$(paste -sd/ "$SCOPES_FILE")"
printf '\n== Commit guidance ==\n'
if [[ -n "$SCOPE_LABEL" ]]; then
  printf -- '- Suggested subject prefix: %s: ...\n' "$SCOPE_LABEL"
else
  printf '%s\n' '- Use a general subject that matches the changed files.'
fi
printf '%s\n' \
  '- Confirm unrelated files are not included.' \
  '- Confirm secrets, generated files, dependencies, and build outputs are not staged.' \
  '- This script does not commit, push, test, build, or inspect file contents.'
