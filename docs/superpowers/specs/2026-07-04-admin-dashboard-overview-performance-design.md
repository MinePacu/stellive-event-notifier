# Admin Dashboard Overview Performance Design

## Goal

Reduce `/v1/internal/admin/overview` latency and steady-state operational load without changing the existing public response shape or redesigning the admin console.

## Scope

This change covers four related pressure points:

1. Admin refresh frequency and recent-result request coupling.
2. Repeated overview computation.
3. Application-side aggregation of 14 days of database rows.
4. Unbounded CHZZK live-list pagination and false live-ended transitions after incomplete verification.

Mobile clients, mockups, visual redesign, and unrelated ingestion behavior are out of scope.

## Admin Console Refresh

- Change the auto-refresh interval from 5 seconds to 30 seconds.
- Derive the displayed interval label from the interval constant so behavior and text cannot diverge.
- Automatic refresh requests only the overview endpoint.
- Manual dashboard refresh continues to update both overview data and recent external API results.
- The dedicated external API result refresh button remains unchanged.

## Overview Cache

`AdminHealthService` owns a per-process in-memory cache with a configurable TTL.

- `ADMIN_OVERVIEW_CACHE_TTL_SECONDS` defaults to 15 and is clamped to 0–60 seconds.
- Zero disables caching.
- Concurrent cache misses share one in-flight promise.
- A successful calculation becomes the cached snapshot; a rejected calculation clears the in-flight entry and is not cached.
- Returned values are fresh copies. Cached values are never mutated.
- `service.uptimeSeconds` is rebased from the cached snapshot's capture time so it continues to advance while other overview fields remain cached.

This is intentionally process-local. Multi-worker instances may refresh independently, which is acceptable because the cache protects each process from duplicate expensive work and preserves the existing API contract.

## Database Aggregation

`DeliveryAttemptRepository.summarizeDailyBuckets()` and `ExternalApiCallLogRepository.summarizeDaily()` move aggregation into PostgreSQL using parameterized Prisma `$queryRaw` template queries.

- KST day keys use `timezone('Asia/Seoul', timestamp)` and `to_char(..., 'YYYY-MM-DD')`.
- Date range boundaries remain computed by existing KST helpers.
- SQL returns only grouped rows rather than every matching record.
- Repository code converts PostgreSQL `bigint`, numeric, or string aggregates through a bounded numeric conversion helper.
- Existing zero-filled dates, totals, generated timestamps, and response field names remain unchanged.
- External API rows group by date and source, then merge source counts into each day and overall totals.

No schema migration or public API schema change is required.

## External API Log Retention

- Add `EXTERNAL_API_LOG_RETENTION_DAYS`, default 31, clamped to 14–365 days.
- Keep the existing prune route and repository method.
- The route passes the configured retention period instead of a hardcoded value.
- Automatic scheduling is deferred; the existing manual operation remains the execution mechanism.

## CHZZK Pagination and Verification Safety

- Add `CHZZK_LIVE_LIST_MAX_PAGES`, default 5. Invalid, zero, or negative values fall back to 5.
- `ChzzkApiClient.getLiveStatuses()` stops after the configured page limit.
- Channels found live within fetched pages remain verified live.
- When pagination ends naturally, still-pending targets are verified offline.
- When the page limit is reached while another page exists, still-pending targets become `verify_required`, not verified offline.
- Expose pagination diagnostics through backward-compatible optional metadata (`pagesFetched`, `limited`, and `pendingUnverified`) without changing the normalized status fields consumed by existing callers.
- `ChzzkOpenApiAdapter.pollLiveStatuses()` permits `chzzk_live_ended` only when the new status is verified offline.
- A `verify_required` result may update diagnostic freshness but must preserve the previous live state and transition timestamp, preventing both false persisted offline state and false ended events.

## Configuration

Add the following documented variables to the environment schema and example file:

- `ADMIN_OVERVIEW_CACHE_TTL_SECONDS=15`
- `EXTERNAL_API_LOG_RETENTION_DAYS=31`
- `CHZZK_LIVE_LIST_MAX_PAGES=5`

All values are parsed and bounded at configuration load time.

## Test Strategy

Use test-first changes in isolated slices:

1. Admin tests prove the 30-second label, manual-only recent-result refresh, cache reuse, single-flight behavior, zero-TTL behavior, copy safety, and uptime rebasing.
2. Repository tests provide `$queryRaw` aggregate rows and verify KST buckets, empty dates, numeric conversion, totals, and `bySource` while proving `findMany` is not used for daily summaries.
3. Route/config tests prove configured retention is passed to prune and new values are bounded.
4. CHZZK tests prove page limiting, pending `verify_required` results, natural-end verified offline results, and suppression of false ended events from unverified states.
5. Run focused suites first, then the full backend test suite and TypeScript build.

## Compatibility and Failure Handling

- Existing overview JSON fields remain stable.
- New CHZZK diagnostics are optional and additive.
- Cache failures are retriable on the next request.
- SQL query failures continue through the current service fallbacks.
- No secrets, raw provider responses, or unauthorized assets are introduced.

## Commit Boundaries

Keep changes reviewable as independent commits:

1. Admin refresh and overview cache.
2. PostgreSQL daily aggregation.
3. Configurable log retention.
4. CHZZK page limit and transition safety.
5. Final documentation or verification-only adjustments if required.
