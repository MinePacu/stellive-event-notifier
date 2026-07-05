#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
usage: scripts/commit-push-lite.sh -m <message> [options]

Options:
  -m, --message <message>       Required commit message
  --base <ref>                  Scope comparison base (default: main)
  --staged                      Commit currently staged files only
  --all                         Stage tracked modified/deleted files
  --add <path>                  Stage an explicit path; repeatable
  --no-push                     Commit without pushing (default)
  --push-github                 Push to one detected GitHub remote
  --push-gitlab                 Push to one detected GitLab remote
  --push-all                    Push to detected GitHub and GitLab remotes
  --github-remote <name>        Explicit GitHub remote name
  --gitlab-remote <name>        Explicit GitLab remote name
  --branch <name>               Branch to push (default: current branch)
  --yes                         Skip confirmation prompts
  -h, --help                    Show this help
EOF
}

command -v git >/dev/null 2>&1 || die "git is required."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git repository."

MESSAGE=""
BASE_REF="main"
STAGED_ONLY=false
STAGE_ALL=false
ASSUME_YES=false
PUSH_MODE="none"
GITHUB_REMOTE=""
GITLAB_REMOTE=""
BRANCH=""
ADD_PATHS=()

set_push_mode() {
  if [[ "$PUSH_MODE" != "none" ]]; then
    die "only one push mode may be specified."
  fi
  PUSH_MODE="$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      [[ $# -ge 2 ]] || die "$1 requires a message."
      MESSAGE="$2"
      shift 2
      ;;
    --base)
      [[ $# -ge 2 ]] || die "--base requires a ref."
      BASE_REF="$2"
      shift 2
      ;;
    --staged) STAGED_ONLY=true; shift ;;
    --all) STAGE_ALL=true; shift ;;
    --add)
      [[ $# -ge 2 ]] || die "--add requires a path."
      ADD_PATHS+=("$2")
      shift 2
      ;;
    --no-push) set_push_mode none_explicit; shift ;;
    --push-github) set_push_mode github; shift ;;
    --push-gitlab) set_push_mode gitlab; shift ;;
    --push-all) set_push_mode all; shift ;;
    --github-remote)
      [[ $# -ge 2 ]] || die "--github-remote requires a name."
      GITHUB_REMOTE="$2"
      shift 2
      ;;
    --gitlab-remote)
      [[ $# -ge 2 ]] || die "--gitlab-remote requires a name."
      GITLAB_REMOTE="$2"
      shift 2
      ;;
    --branch)
      [[ $# -ge 2 ]] || die "--branch requires a name."
      BRANCH="$2"
      shift 2
      ;;
    --yes) ASSUME_YES=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$MESSAGE" ]] || die "--message is required."
if [[ "$STAGED_ONLY" == true && ( "$STAGE_ALL" == true || ${#ADD_PATHS[@]} -gt 0 ) ]]; then
  die "--staged cannot be combined with --all or --add."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SCOPE_SCRIPT="$SCRIPT_DIR/pre-commit-scope.sh"
[[ -x "$SCOPE_SCRIPT" ]] || die "pre-commit-scope.sh is missing or not executable."

if [[ "$STAGED_ONLY" == true ]]; then
  "$SCOPE_SCRIPT" --staged
else
  "$SCOPE_SCRIPT" --base "$BASE_REF"
fi

printf '\n== Working tree summary ==\n'
git status --short
if [[ "$STAGED_ONLY" == true ]]; then
  git diff --cached --stat
  git diff --cached --check
else
  git diff --stat
  git diff --check
fi

if [[ "$STAGE_ALL" == true ]]; then
  git add -u
fi
for ADD_PATH in "${ADD_PATHS[@]}"; do
  git add -- "$ADD_PATH"
done

STAGED_PATHS="$(mktemp)"
GITHUB_CANDIDATES="$(mktemp)"
GITLAB_CANDIDATES="$(mktemp)"
trap 'rm -f "$STAGED_PATHS" "$GITHUB_CANDIDATES" "$GITLAB_CANDIDATES"' EXIT

git diff --cached --name-only >"$STAGED_PATHS"
[[ -s "$STAGED_PATHS" ]] || die "no staged changes to commit."

printf '\n== Staged summary ==\n'
git diff --cached --stat
git diff --cached --check

RISK_FOUND=false
while IFS= read -r STAGED_PATH; do
  case "$STAGED_PATH" in
    .env|.env.*|*/.env|*/.env.*|*.keystore|*.p12|*.mobileprovision|*/GoogleService-Info.plist|GoogleService-Info.plist|*/google-services.json|google-services.json|build/*|*/build/*|.gradle/*|*/.gradle/*|node_modules/*|*/node_modules/*|DerivedData/*|*/DerivedData/*|.DS_Store|*/.DS_Store)
      printf 'warning: risky staged path: %s\n' "$STAGED_PATH" >&2
      RISK_FOUND=true
      ;;
  esac
done <"$STAGED_PATHS"

remote_exists() {
  git remote get-url "$1" >/dev/null 2>&1
}

detect_remotes() {
  for REMOTE_NAME in $(git remote); do
    REMOTE_URL="$(git remote get-url --push "$REMOTE_NAME" 2>/dev/null || git remote get-url "$REMOTE_NAME" 2>/dev/null || true)"
    REMOTE_URL_LOWER="$(printf '%s' "$REMOTE_URL" | tr '[:upper:]' '[:lower:]')"
    case "$REMOTE_URL_LOWER" in
      *github.com*) printf '%s\n' "$REMOTE_NAME" >>"$GITHUB_CANDIDATES" ;;
    esac
    case "$REMOTE_URL_LOWER" in
      *gitlab.com*|*gitlab*) printf '%s\n' "$REMOTE_NAME" >>"$GITLAB_CANDIDATES" ;;
    esac
  done
  sort -u "$GITHUB_CANDIDATES" -o "$GITHUB_CANDIDATES"
  sort -u "$GITLAB_CANDIDATES" -o "$GITLAB_CANDIDATES"
}

resolve_remote() {
  PROVIDER="$1"
  EXPLICIT_NAME="$2"
  CANDIDATES_FILE="$3"
  if [[ -n "$EXPLICIT_NAME" ]]; then
    remote_exists "$EXPLICIT_NAME" || die "$PROVIDER remote '$EXPLICIT_NAME' does not exist."
    printf '%s\n' "$EXPLICIT_NAME"
    return
  fi
  CANDIDATE_COUNT="$(wc -l <"$CANDIDATES_FILE" | tr -d ' ')"
  if [[ "$CANDIDATE_COUNT" -eq 0 ]]; then
    die "no $PROVIDER remote detected; specify --${PROVIDER}-remote."
  fi
  if [[ "$CANDIDATE_COUNT" -gt 1 ]]; then
    die "multiple $PROVIDER remotes detected; specify --${PROVIDER}-remote."
  fi
  sed -n '1p' "$CANDIDATES_FILE"
}

TARGET_GITHUB=""
TARGET_GITLAB=""
if [[ "$PUSH_MODE" == "github" || "$PUSH_MODE" == "gitlab" || "$PUSH_MODE" == "all" ]]; then
  detect_remotes
fi
if [[ "$PUSH_MODE" == "github" || "$PUSH_MODE" == "all" ]]; then
  TARGET_GITHUB="$(resolve_remote github "$GITHUB_REMOTE" "$GITHUB_CANDIDATES")"
fi
if [[ "$PUSH_MODE" == "gitlab" || "$PUSH_MODE" == "all" ]]; then
  TARGET_GITLAB="$(resolve_remote gitlab "$GITLAB_REMOTE" "$GITLAB_CANDIDATES")"
fi

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git branch --show-current)"
fi
[[ -n "$BRANCH" ]] || die "cannot determine current branch; specify --branch."

printf '\n== Remote targets ==\n'
printf 'GitHub: %s\n' "${TARGET_GITHUB:-not selected}"
printf 'GitLab: %s\n' "${TARGET_GITLAB:-not selected}"
printf '\n== Push plan ==\nBranch: %s\n' "$BRANCH"
if [[ -n "$TARGET_GITHUB" || -n "$TARGET_GITLAB" ]]; then
  printf 'Targets:\n'
  [[ -n "$TARGET_GITHUB" ]] && printf -- '- %s (GitHub)\n' "$TARGET_GITHUB"
  [[ -n "$TARGET_GITLAB" ]] && printf -- '- %s (GitLab)\n' "$TARGET_GITLAB"
else
  printf 'Targets: none (commit only)\n'
fi

if [[ "$RISK_FOUND" == true ]]; then
  printf 'warning: review risky staged paths before continuing.\n' >&2
fi
if [[ "$ASSUME_YES" != true ]]; then
  printf 'Create commit on %s with the staged changes? [y/N] ' "$BRANCH"
  read -r REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || { printf 'Cancelled.\n'; exit 0; }
fi

git commit -m "$MESSAGE"
COMMIT_SHA="$(git rev-parse --short HEAD)"
printf '\n== Commit ==\nCreated commit: %s\n' "$COMMIT_SHA"

if [[ -z "$TARGET_GITHUB" && -z "$TARGET_GITLAB" ]]; then
  printf '\n== Push result ==\nNot pushed.\n'
  exit 0
fi

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  printf 'warning: pushing directly to default-style branch %s.\n' "$BRANCH" >&2
fi
if [[ "$ASSUME_YES" != true ]]; then
  printf 'Push %s to the selected remote target(s)? [y/N] ' "$BRANCH"
  read -r REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || { printf 'Push cancelled; commit %s remains local.\n' "$COMMIT_SHA"; exit 0; }
fi

printf '\n== Push result ==\n'
if [[ -n "$TARGET_GITHUB" ]]; then
  git push "$TARGET_GITHUB" "$BRANCH"
  printf 'GitHub: pushed to %s/%s\n' "$TARGET_GITHUB" "$BRANCH"
fi
if [[ -n "$TARGET_GITLAB" ]]; then
  git push "$TARGET_GITLAB" "$BRANCH"
  printf 'GitLab: pushed to %s/%s\n' "$TARGET_GITLAB" "$BRANCH"
fi
