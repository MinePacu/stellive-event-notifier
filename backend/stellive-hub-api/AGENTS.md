# Backend Agent Rules

Read this file only for backend/API/control-plane work under `backend/stellive-hub-api/**`, or when changed shared contracts require backend updates.

## Required Context

Do not read all docs by default. Read these only when directly relevant:

- `docs/API_IMPLEMENTATION_PLAN.md`: adapters, ingestion, database jobs, push delivery, or mobile-facing API contracts.
- `docs/NOTIFICATION_POLICY.md`: preferences, delivery decisions, delivery modes, or push behavior.
- `docs/REALTIME_DELIVERY.md`: foreground realtime delivery behavior.
- `docs/PROJECT_RULES.md`: policy-sensitive catalog, platform, image, asset, or API behavior.
- `docs/AI_HANDOFF.md`: only when the user asks for handoff context or the task clearly depends on current project status.

## Architecture And Data Safety

- Keep protected platform credentials and API calls on the backend. Mobile clients must not call CHZZK or other protected upstream APIs directly.
- Prefer official APIs and documented webhooks. Do not add scraping, private-session reuse, access bypasses, or collection of private community data.
- Normalize events before dedupe, preference resolution, persistence, and fan-out. User notification preferences remain authoritative.
- Global off blocks every delivery. `realtime_best_effort` remains best-effort, and `chzzk_chat` remains opt-in with explicit filters.
- Stellive official YouTube produces upload events only; do not emit official live scheduled, started, or ended events.
- Never log or persist secrets, raw private responses, production device tokens, or unnecessary personal data.
- Keep admin/internal routes authenticated and preserve the server-mediated control-plane boundary.
- Public and mobile APIs return normalized DTOs; do not expose raw provider payloads.

## Verification

- Prefer focused Vitest targets related to changed backend files.
- Run `rtk npm run build` when TypeScript types, route wiring, environment parsing, Prisma/client usage, or shared contracts change.
- Run broad `rtk npm test` only for changes spanning shared wiring, repositories, app composition, or multiple backend subsystems.
- Do not rebuild containers, sync the internal server, or run remote operational checks unless explicitly requested or required for deployment/ops validation.
- Server sync and Docker operation rules live in `scripts/AGENTS.md` and apply when those scripts are used.

## Internal Server And Ops

Server sync, Docker rebuild, PM2/systemd/Nginx, and remote-log procedures are ops-only context. Do not load or use them for ordinary backend changes.
