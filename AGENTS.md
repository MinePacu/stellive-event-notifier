# Stellive Notification Hub Agent Rules

Read this file first. It is a lightweight routing document.

Do not automatically read all project documents. Choose the smallest relevant context from the user request and changed paths. A deeper `AGENTS.md` extends or overrides this file for its subtree.

## Fast Paths

### Work Area Routing

- Backend/API/ingestion/push: `backend/stellive-hub-api/AGENTS.md`
- Android: `android/StelliveHubAndroid/AGENTS.md`
- iOS: `ios/StelliveHubiOS/AGENTS.md`
- Documentation: `docs/AGENTS.md`
- Helper, build, merge, and server-operation scripts: `scripts/AGENTS.md`
- Shared contracts, seeds, or root metadata: use the common rules below and inspect only directly relevant documentation.

### Merge-Only PR/MR Work

Use this path when the user only asks to check, prepare, or perform a PR/MR merge. It takes precedence over normal repository exploration and handoff-reading rules, without relaxing security or explicit user instructions.

- Do not inspect the repository, full diff, or full CI logs.
- Do not read `CODEMAP.md`, `docs/AI_HANDOFF.md`, `docs/superpowers/**`, or `docs/handoff/archive/**` unless a conflict or failed check directly references one.
- Do not run local tests unless the user explicitly asks.
- Check only target branch, draft status, mergeability/conflicts, required checks, and merge method.
- For a failed check, inspect only its name and at most the final 100 relevant log lines.
- If blocked, report the blocker and stop. If successful, report only the PR/MR number, merge commit SHA, and branch-cleanup result.
- For GitHub use `scripts/check-pr-lite.sh` and `scripts/merge-pr-lite.sh`. Apply the same principles to GitLab only when its CLI and remote configuration are confirmed.

## Repository-Wide Rules

- This is an unofficial, non-profit open-source fan project. Copyright, portrait/publicity, trademark, platform API, and terms-of-service obligations still apply.
- Never commit secrets, tokens, OAuth credentials, raw private platform responses, production device tokens, private config, or prohibited media assets.
- Prefer official APIs. Do not implement unauthorized crawling, login-cookie scraping, private cafe collection, or access bypasses.
- Do not commit profile images, official logos, fan art, captured images, or unauthorized member assets. Use placeholder avatars; platform API image URLs require fallback behavior.
- Do not clone proprietary service or brand designs. Platform UIs may use familiar native patterns but must remain original.
- The member catalog may contain only `active` or `upcoming` members. Former members are excluded from the MVP catalog, targets, filters, tests, and seeds.
- Gangzi is a `representative` in `gamja`, not a generation member, with `roleLabel: "스텔라이브 대표"`.
- Display `official` as `기타`; it contains Stellive official YouTube and X targets. Official YouTube supports upload notifications only.
- Keep protected API access, dedupe, preference enforcement, and push fan-out server-mediated. Mobile clients own settings UI, local history/cache, deep links, and foreground presentation.
- User preferences are authoritative: global off blocks all notifications. Preserve global, platform, event-type, category/generation, and individual target controls.
- `realtime_best_effort` never guarantees instant delivery or bypasses opt-out, quiet hours, API, OS, push, battery, or rate-limit policies. `chzzk_chat` is off by default and requires explicit filters.
- Preserve unrelated working-tree changes. Follow the closest scoped `AGENTS.md` before editing.

## Archived And Historical Context

Archived or historical documents are not active instructions. Do not read `docs/handoff/archive/**`, archived logs, or broad `docs/superpowers/**` history during normal work unless the user explicitly requests historical context or a current document links to a specific relevant file.

## Command And Tool Defaults

- Prefer targeted searches and focused file reads over full-file or full-repository dumps.
- Use `CODEMAP.md` only as a routing aid when needed. Do not read every area codemap or all docs by default.
- Prefix shell command segments with `rtk` when available. Detailed script conventions live in `scripts/AGENTS.md`.
- Use Serena tools only when available and materially useful for symbol-level understanding or targeted edits.
- Internal server, Docker, rsync, remote-log, and commit-message procedures live in `scripts/AGENTS.md`; do not load them for unrelated work.
