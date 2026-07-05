# Backend Current Context

This file contains current active context only.
Do not append long historical logs here.
Move completed or stale implementation notes to `docs/handoff/archive/`.

## Active Boundaries

- The backend is the control plane for protected provider access, normalization, dedupe, preference enforcement, persistence, and push fan-out.
- Public and mobile routes return normalized DTOs. Never expose provider secrets or raw private payloads.
- CHZZK OAuth, YouTube API keys, Firebase credentials, internal API tokens, and provider state remain backend-only.
- Official Stellive YouTube produces upload notifications only; do not add official live scheduled, started, or ended notifications.
- Global notification off is authoritative. `realtime_best_effort` remains best effort, and `chzzk_chat` remains explicit opt-in.

## Current Functional Areas

- Music catalog synchronization supports official cover/original playlists, source preservation, manual overrides, member matching, public music reads, and recent-cover mobile consumption.
- Music channel discovery is worker-driven, deduplicates by video ID, preserves manual decisions, and leaves uncertain matches for review.
- CHZZK live status and YouTube ingestion must continue through official backend adapters and server-side credentials.
- Hub event calendar/read routes, special-day projections, mobile bootstrap/preferences, notification workers, and push payload generation remain server-mediated.

## Task Routing

- Read `docs/API_IMPLEMENTATION_PLAN.md` only for adapters, ingestion, jobs, push, or mobile API contract changes.
- Read `docs/NOTIFICATION_POLICY.md` only for preference or delivery behavior.
- Read `docs/REALTIME_DELIVERY.md` only for realtime behavior.
- Historical implementation and test logs are archived and are not active context.
