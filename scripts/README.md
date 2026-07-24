# Lightweight Repository Helpers

- `scripts/affected-scope.sh [base-ref]` lists at most 80 changed paths, detects path-based scopes, and suggests the smallest relevant context and checks.
- `scripts/pre-commit-scope.sh [base-ref|--base <ref>] [--staged]` suggests focused context, checks, and commit scope before commit or push without executing them.
- `scripts/commit-push-lite.sh -m <message> [options]` checks scope and staged paths, creates a confirmed commit, and can push the same branch to detected GitHub and GitLab remotes.
- `scripts/check-pr-lite.sh <pr-number>` reads GitHub PR metadata and check states without fetching the full diff, comments, or CI logs.
- `scripts/merge-pr-lite.sh <pr-number> [options]` runs the lightweight check, requires confirmation by default, and merges only when explicitly invoked.

These helpers avoid full repository traversal, full diffs, full CI logs, and full test suites in commit/push preparation and merge-only workflows.

## Mobile build cache

Set the cache root with `STELLIVE_CACHE_DIR`, or put its absolute path as the only
line in `scripts/.cache-root`. The local config file is ignored by Git. The iOS
simulator build and install scripts use its `DerivedData-ios-simulator` subfolder;
Android build scripts use its `gradle-user-home` subfolder. The external cache root
must be mounted before a mobile build starts. `IOS_DERIVED_DATA_DIR` and
`GRADLE_USER_HOME` override their respective full cache paths for one invocation.
Build logs remain in `scripts/logs`.

`commit-push-lite.sh` defaults to commit-only mode. Use `--push-github`, `--push-gitlab`, or `--push-all` for explicit push targets; use `--no-push` to state commit-only intent. It never force-pushes or pushes tags.

```bash
scripts/commit-push-lite.sh -m "scripts: add commit push helper" --no-push
scripts/commit-push-lite.sh -m "scripts: add commit push helper" --push-github
scripts/commit-push-lite.sh -m "scripts: add commit push helper" --push-gitlab
scripts/commit-push-lite.sh -m "scripts: add commit push helper" --push-all
```

When preparing a commit with Codex, use the `Commit Message Formatting` section in `scripts/AGENTS.md`. Locate that heading and read only its small relevant range, not the entire file.

GitLab MR helper scripts are intentionally not added yet. Add them only after the repository's GitLab remote, project path, and `glab` usage policy are confirmed.
