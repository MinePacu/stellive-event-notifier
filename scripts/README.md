# Lightweight Repository Helpers

- `scripts/affected-scope.sh [base-ref]` lists at most 80 changed paths, detects path-based scopes, and suggests the smallest relevant context and checks.
- `scripts/pre-commit-scope.sh [base-ref|--base <ref>] [--staged]` suggests focused context, checks, and commit scope before commit or push without executing them.
- `scripts/check-pr-lite.sh <pr-number>` reads GitHub PR metadata and check states without fetching the full diff, comments, or CI logs.
- `scripts/merge-pr-lite.sh <pr-number> [options]` runs the lightweight check, requires confirmation by default, and merges only when explicitly invoked.

These helpers avoid full repository traversal, full diffs, full CI logs, and full test suites in commit/push preparation and merge-only workflows.

GitLab MR helper scripts are intentionally not added yet. Add them only after the repository's GitLab remote, project path, and `glab` usage policy are confirmed.
