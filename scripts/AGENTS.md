# Script Agent Rules

Read this file only for repository scripts, local tooling, PR/MR helpers, or operational helper scripts.

## Command And Search Conventions

- Prefix every shell command segment with `rtk`. If no filter exists, `rtk` passes the command through. For low-level debugging, raw commands are allowed; `rtk proxy <cmd>` records unfiltered usage.
- Use `rg` before `grep`, `fd` instead of `find`, and `ast-grep` when syntax-aware matching is materially useful.
- Consult `CODEMAP.md` only when repository navigation is needed. Merge-only work follows the root fast path and must not read it.
- If Serena tools are available, initialize them before semantic repository work and use them only when they improve symbol discovery or focused edits.
- Scripts must use strict error handling where appropriate, quote variables, avoid leaking secrets, and emit concise actionable errors.
- Prefer bounded output. Do not dump full CI logs, diffs, dependency trees, or test logs unless explicitly requested.
- Use safe defaults and require explicit confirmation for destructive or externally mutating actions.

## Merge Helpers

- Use `scripts/affected-scope.sh [base-ref]` to select context from changed paths without reading file contents.
- Before commit or push preparation, run `scripts/pre-commit-scope.sh <base-ref>` or `scripts/pre-commit-scope.sh --staged`.
- Use detected scopes to select only relevant context and focused checks.
- Do not inspect unrelated platform files or full diffs when path summaries and targeted diffs are enough.
- Do not run full backend, Android, and iOS verification together unless detected scopes require it or the user explicitly asks.
- For GitHub PR inspection use `scripts/check-pr-lite.sh <pr-number>`.
- For an explicitly authorized merge use `scripts/merge-pr-lite.sh <pr-number>`; add `--yes` only for approved non-interactive execution.
- PR helpers are metadata/checks-first and must not fetch full diffs, comments, or CI logs automatically.
- Never infer merge authorization from a request to inspect, review, or prepare scripts.
- Do not fetch full diffs, local tests, or complete CI logs in the merge-only fast path. Failed checks may expose at most the final 100 relevant log lines.
- Script changes must not execute a real merge during development or validation.

## Verification

- For shell scripts, run `rtk bash -n <script>` or raw `bash -n <script>` when `rtk` is unavailable.
- Run `rtk git diff --check` for whitespace validation.
- Do not run actual merges, deployments, Docker rebuilds, or remote server changes unless explicitly requested.

## Commit Message Formatting

When a requested commit message lists changed items, use consecutive bullet lines with no blank lines and no literal `\n` text. Prefer a message file for multi-line bodies:

```bash
rtk sh -lc "printf '%s\n' 'commit subject' '- First changed item' '- Second changed item' > /private/tmp/commit_msg && rtk git commit -F /private/tmp/commit_msg"
```

## Internal Backend Test Server

Use `minepacu@192.168.50.9` only when Docker-hosted backend or admin-console verification is required.

- Remote project: `~/StelLiveNoti`
- Service port: `4000`
- API base: `http://192.168.50.9:4000`
- Admin console: `http://192.168.50.9:4000/admin`
- Sync the current workspace before rebuilding, excluding `.git/`, `.gradle/`, `node_modules/`, `dist/`, `build/`, `qa-screenshots/`, `.DS_Store`, `.env`, and `.env.*`.
- Never transfer secrets, credentials, production device tokens, profile images, logos, fan art, captures, or prohibited media.
- Use the compose file `backend/stellive-hub-api/docker-compose.yml`; rebuild with `up -d --build --remove-orphans`, then check container state and only the required API log tail.
- Do not use `docker compose restart` to apply Compose, `env_file`, `environment`, or `.env` changes, because restart does not recreate containers with updated configuration.
- Use `--force-recreate` only when explicitly requested, when a normal `up -d --build --remove-orphans` does not apply the expected configuration, when stale or inconsistent containers are suspected, or when container recovery is required.
- If rebuilt images leave stale containers, use `up -d --no-build --force-recreate --remove-orphans` with the same compose file.
- Keep server testing scoped to the requested behavior. Do not deploy unrelated experiments.
