# Conventions

- Treat `docs/PROJECT_RULES.md`, `docs/NOTIFICATION_POLICY.md`, `docs/REALTIME_DELIVERY.md`, and `docs/API_IMPLEMENTATION_PLAN.md` as behavioral constraints, not optional docs.
- Backend routes/services/repositories should preserve clear boundaries: routes validate/authenticate/compose; repositories encapsulate Prisma; services enforce business policy; adapters do external API DTO validation only; workers own delivery/drain mechanics.
- All notification-producing paths must pass through preference resolution and load-reduction policy before push. Global off wins; realtime mode never enables disabled events.
- Event ingestion must drop unsupported/forbidden events before storage, especially official YouTube live scheduled/started/ended. Dedupe keys should remain source/event/target specific.
- Platform integrations are feature-flagged and disabled-safe. External API tests use fixtures/fakes, not network calls.
- Mobile apps consume backend DTOs only for CHZZK/YouTube/song/live status; protected credentials and direct platform API hosts stay out of Android/iOS source.
- Hub event image policy is metadata-only. Do not add upload fields, binary/local path fields, official logos, profile images, posters, copied thumbnails, screenshots, or raw provider payloads to API/mobile/push/widget surfaces.
- Calendar APIs may intentionally date-expand multi-day rows for markers/duration bars; feed/list/card projections should dedupe canonical hub events by `eventId` while preserving special-day rows that have no canonical `HubEvent`.
- UI should be original and app-owned. Android can reference spacious mobile settings mood; iOS can use grouped settings patterns. Do not clone Samsung One UI, Apple Settings, platform apps, Stellive branding, logos, or proprietary assets.
- Commit message bodies with changed-item lists should be consecutive bullet lines with no blank lines; prefer a temporary message file for multi-line bodies.
- Preserve dirty worktree changes made by others. Do not reset/revert unrelated files.