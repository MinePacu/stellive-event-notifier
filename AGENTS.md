# Stellive Notification Hub Agent Rules

These rules apply from the repository root to every subdirectory. Read this file before changing code, docs, tests, seeds, or generated configuration.

This project is an unofficial open-source fan project with no direct monetization plan. Non-profit and open-source status does not remove copyright, portrait/publicity, trademark, platform API, or terms-of-service obligations.

Non-negotiable rules:
- Do not include Former members in the MVP member catalog, notification targets, UI filters, or seed data.
- The member catalog may include only `active` or `upcoming` entries.
- Gangzi is not a generation member. Include Gangzi as a `representative` entry in the `gamja` category with `roleLabel: "스텔라이브 대표"`.
- The `official` category is displayed as `기타` and includes Stellive official YouTube and X notification targets.
- Stellive official YouTube supports upload notifications only. Do not create official YouTube live scheduled/started/ended notifications.
- Prefer official APIs and platform terms. Do not implement unauthorized crawling, login-cookie scraping, private cafe collection, or bypass access.
- Never commit API secrets, tokens, OAuth credentials, raw private platform responses, or production device tokens.
- Do not commit profile image binaries, official logos, fan art, captured images, or unauthorized member assets.
- Use placeholder avatars by default. Show platform API image URLs only conditionally and with fallback behavior.
- Do not clone Samsung One UI, Apple Settings, CHZZK, YouTube, X, Naver, or Stellive proprietary logos/assets/designs.
- Android may reference the general mood of spacious mobile settings UIs; iOS may reference grouped settings patterns. Both must remain original.
- Keep a server-mediated/API-first event ingestion architecture. A lightweight backend or managed control plane handles protected API access, dedupe, preference enforcement, and push fan-out; mobile apps handle settings UI, local history/cache, deep links, and foreground display.
- User notification preferences are authoritative. Global off blocks every notification.
- Users must be able to configure global, platform, event type, generation/category, and individual member/Gangzi/official-channel notification settings.
- Users must be able to enable `realtime_best_effort`. It never guarantees instant delivery and must not bypass API, OS, push-service, battery, or rate-limit policies.
- `chzzk_chat` is off by default and should require explicit filters before push delivery.

Before starting new work, read:
- `docs/PROJECT_RULES.md`
- `docs/NOTIFICATION_POLICY.md`
- `docs/REALTIME_DELIVERY.md`
- `docs/API_IMPLEMENTATION_PLAN.md` before implementing backend/API integrations, ingestion adapters, notification jobs, or push delivery.
- `docs/AI_HANDOFF.md`


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->

## Internal Backend Test Server

Use the internal server computer `minepacu@192.168.50.9` for later Codex backend test automation when a Docker-hosted backend is needed.

- The test service port is fixed to `4000`.
- Connect by SSH and run Docker directly on the server computer.
- Test URLs should use `http://192.168.50.9:4000` plus the required path.
- The admin console URL is `http://192.168.50.9:4000/admin`.
- Transfer required project files to the server computer by command before building there.
- On the server computer, the project must live at `~/StelLiveNoti`.
- The contents of `~/StelLiveNoti` must mirror the current workspace structure, excluding dependency/build-heavy folders such as `node_modules`.
- If the server computer has insufficient disk space, clear build caches and other safe generated caches, then retry the transfer/build/run step.
- Do not transfer secrets, production credentials, production device tokens, profile image binaries, official logos, fan art, captured images, copied media assets, or other files prohibited by the project rules.

### Server Sync, Rebuild, And Test Flow

Use this flow when a later Codex session needs to test backend or admin-console changes on the internal server.

1. Sync the current workspace to the server, excluding generated and secret-heavy paths:

```bash
rtk rsync -az --delete \
  --exclude '.git/' \
  --exclude '.gradle/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'build/' \
  --exclude 'qa-screenshots/' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude '.env.*' \
  ./ minepacu@192.168.50.9:~/StelLiveNoti/
```

2. Rebuild and recreate the Docker services on the server:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml up -d --build --force-recreate'
```

3. Confirm all containers are running:

```bash
rtk ssh minepacu@192.168.50.9 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep stellive-hub-api'
```

4. Check API startup logs:

```bash
rtk ssh minepacu@192.168.50.9 'cd ~/StelLiveNoti && docker compose -f backend/stellive-hub-api/docker-compose.yml logs --no-color --tail=40 api'
```

5. For admin-console work, open `http://192.168.50.9:4000/admin`, sign in with the admin session, enter the internal API bearer token from the operator's local environment, and verify the target form or route manually.

Notes:

- If `up -d --build --force-recreate` builds images but leaves old containers running, run the same compose file with `up -d --no-build --force-recreate --remove-orphans`.
- Never write real admin tokens, internal API tokens, Firebase credentials, OAuth credentials, or production device tokens into this file, shell history snippets, commits, issues, or logs.
- Keep server testing scoped to the requested backend/admin behavior. Do not deploy unrelated local experiments unless the user explicitly asks for them.
