# Operations Current Context

This file contains current active context only.
Do not append long historical logs here.
Move completed or stale implementation notes to `docs/handoff/archive/`.

## Scope

- This document is for deployment, internal test-server, Docker, PM2/systemd/Nginx, remote logs, and operational validation only.
- Do not read it for ordinary backend, Android, iOS, documentation, merge-only, or routine review work.

## Active Boundaries

- The internal backend test service uses `minepacu@192.168.50.9`, project path `~/StelLiveNoti`, and port `4000` only when remote validation is explicitly required.
- Workspace sync must exclude Git metadata, dependencies, build outputs, screenshots, local environment files, secrets, credentials, production tokens, private responses, and prohibited media.
- Backend containers use `backend/stellive-hub-api/docker-compose.yml`.
- Rebuild, recreate, remote log, admin-console, and scheduler operations require explicit task scope; do not run them as routine code verification.
- Never place admin tokens, internal API tokens, Firebase credentials, OAuth credentials, or production device tokens in commands, logs, docs, commits, or issues.

## Validation Discipline

- Check only the requested service, route, container, or bounded log tail.
- Do not deploy unrelated working-tree changes or experiments.
- Keep historical deployment transcripts and old incident logs in the archive, not here.
