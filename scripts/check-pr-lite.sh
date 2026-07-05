#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'usage: scripts/check-pr-lite.sh <pr-number>\n' >&2
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

if [[ $# -ne 1 || ! $1 =~ ^[0-9]+$ ]]; then
  usage
  exit 2
fi

command -v gh >/dev/null 2>&1 || die "gh CLI is required."

PR_NUMBER="$1"
ERROR_FILE="$(mktemp)"
trap 'rm -f "$ERROR_FILE"' EXIT

if ! gh auth status >/dev/null 2>"$ERROR_FILE"; then
  printf 'error: GitHub authentication is required.\n' >&2
  tail -n 5 "$ERROR_FILE" >&2
  exit 1
fi

if ! METADATA="$(gh pr view "$PR_NUMBER" \
  --json number,title,state,isDraft,baseRefName,headRefName,mergeable,mergeStateStatus,reviewDecision,commits,changedFiles,additions,deletions,url \
  2>"$ERROR_FILE")"; then
  printf 'error: unable to read PR metadata.\n' >&2
  tail -n 10 "$ERROR_FILE" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  STATE="$(printf '%s' "$METADATA" | jq -r '.state')"
  IS_DRAFT="$(printf '%s' "$METADATA" | jq -r '.isDraft')"
  MERGEABLE="$(printf '%s' "$METADATA" | jq -r '.mergeable')"
  MERGE_STATE="$(printf '%s' "$METADATA" | jq -r '.mergeStateStatus')"
  printf '== PR metadata ==\n'
  printf '%s' "$METADATA" | jq -r '"#\(.number) \(.title)\nstate: \(.state) | draft: \(.isDraft)\nbranch: \(.headRefName) -> \(.baseRefName)\nmergeable: \(.mergeable) | merge state: \(.mergeStateStatus)\nreview: \(.reviewDecision // "")\ncommits: \(.commits | length) | files: \(.changedFiles) | +\(.additions) -\(.deletions)\n\(.url)"'
else
  STATE="$(printf '%s' "$METADATA" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')"
  IS_DRAFT="$(printf '%s' "$METADATA" | sed -n 's/.*"isDraft":\([^,}]*\).*/\1/p')"
  MERGEABLE="$(printf '%s' "$METADATA" | sed -n 's/.*"mergeable":"\([^"]*\)".*/\1/p')"
  MERGE_STATE="$(printf '%s' "$METADATA" | sed -n 's/.*"mergeStateStatus":"\([^"]*\)".*/\1/p')"
  printf '== PR metadata ==\n%s\n' "$METADATA"
fi

printf '\n== PR checks ==\n'
if gh pr checks "$PR_NUMBER"; then
  CHECKS_RESULT="checks command completed"
else
  CHECKS_RESULT="one or more checks are not passing, unavailable, or pending"
fi

printf '\n== Lightweight recommendation ==\n'
if [[ "$IS_DRAFT" == "true" ]]; then
  printf 'blocked: draft PR\n'
elif [[ "$STATE" != "OPEN" ]]; then
  printf 'blocked: PR is not open\n'
elif [[ "$MERGE_STATE" == "DIRTY" || "$MERGE_STATE" == "BLOCKED" || "$MERGE_STATE" == "DRAFT" ]]; then
  printf 'blocked or needs attention (%s); %s\n' "$MERGE_STATE" "$CHECKS_RESULT"
elif [[ "$MERGE_STATE" == "CLEAN" || "$MERGEABLE" == "MERGEABLE" ]]; then
  printf 'likely mergeable; confirm required checks (%s)\n' "$CHECKS_RESULT"
else
  printf 'manual review required (merge state: %s, mergeable: %s); %s\n' "${MERGE_STATE:-unknown}" "${MERGEABLE:-unknown}" "$CHECKS_RESULT"
fi
