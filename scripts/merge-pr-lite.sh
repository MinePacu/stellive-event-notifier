#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'usage: scripts/merge-pr-lite.sh <pr-number> [--yes] [--merge|--squash|--rebase] [--no-delete-branch]\n'
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

if [[ $# -eq 0 ]]; then
  usage
  exit 2
fi

if [[ $1 == "-h" || $1 == "--help" ]]; then
  usage
  exit 0
fi

[[ $1 =~ ^[0-9]+$ ]] || die "first argument must be a PR number."

PR_NUMBER="$1"
shift
ASSUME_YES=false
DELETE_BRANCH=true
METHOD="--merge"
METHOD_SET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) ASSUME_YES=true ;;
    --no-delete-branch) DELETE_BRANCH=false ;;
    --merge|--squash|--rebase)
      if [[ "$METHOD_SET" == true ]]; then
        die "only one merge method may be specified."
      fi
      METHOD="$1"
      METHOD_SET=true
      ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

command -v gh >/dev/null 2>&1 || die "gh CLI is required."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
CHECK_SCRIPT="$SCRIPT_DIR/check-pr-lite.sh"
[[ -x "$CHECK_SCRIPT" ]] || die "check-pr-lite.sh is missing or not executable."

"$CHECK_SCRIPT" "$PR_NUMBER"

METHOD_NAME="${METHOD#--}"
if [[ "$ASSUME_YES" != true ]]; then
  printf 'Merge PR #%s using %s? [y/N] ' "$PR_NUMBER" "$METHOD_NAME"
  read -r REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    printf 'Merge cancelled.\n'
    exit 0
  fi
fi

MERGE_ARGS=(pr merge "$PR_NUMBER" "$METHOD")
if [[ "$DELETE_BRANCH" == true ]]; then
  MERGE_ARGS+=(--delete-branch)
fi

ERROR_FILE="$(mktemp)"
trap 'rm -f "$ERROR_FILE"' EXIT

if gh "${MERGE_ARGS[@]}" >/dev/null 2>"$ERROR_FILE"; then
  MERGED=true
else
  MERGED=false
  if POST_STATE="$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null)" && [[ "$POST_STATE" == "MERGED" ]]; then
    MERGED=true
    printf 'Merged PR #%s, but branch cleanup or local post-merge handling reported an error.\n' "$PR_NUMBER"
    tail -n 10 "$ERROR_FILE" >&2
  else
    printf 'error: merge failed.\n' >&2
    tail -n 10 "$ERROR_FILE" >&2
    exit 1
  fi
fi

if [[ "$MERGED" == true ]]; then
  printf 'Merged PR #%s using %s.\n' "$PR_NUMBER" "$METHOD_NAME"
  if ! gh pr view "$PR_NUMBER" --json number,state,mergedAt,mergeCommit,url \
    --jq '"PR: #\(.number) | state: \(.state) | merged: \(.mergedAt // "unknown") | commit: \(.mergeCommit.oid // "unknown")\n\(.url)"'; then
    printf 'post-merge metadata check skipped/failed.\n'
  fi
  if [[ "$DELETE_BRANCH" == true ]]; then
    printf 'branch cleanup: requested (--delete-branch)\n'
  else
    printf 'branch cleanup: not requested\n'
  fi
fi
