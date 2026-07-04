# Music Discovery Peak Schedule Design

## Scope

Change only the YouTube music channel discovery worker schedule. From 12:00 through 23:59 in `Asia/Seoul`, the worker polls every 5 minutes. From 00:00 through 11:59, it polls every 60 minutes. Music classification, YouTube request composition, API routes, catalog targets, mobile contracts, notification delivery, and response caching remain unchanged.

## Configuration

- Keep `MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES` as the off-peak interval, with the existing default of `60`.
- Add `MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES`, defaulting to `5`.
- Add `MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR`, defaulting to `12` and interpreted inclusively.
- Add `MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR`, defaulting to `24` and interpreted exclusively, so the default peak window is `[12:00, 24:00)`.
- Add `MUSIC_CHANNEL_DISCOVERY_TIME_ZONE`, defaulting to `Asia/Seoul` and validated as an IANA time-zone identifier.
- Document these defaults in `.env.example`, `docs/API_SETUP.md`, `docs/AI_HANDOFF.md`, and `CODEMAP.md` where the discovery worker is described.

## Scheduling Policy

Create a pure scheduling policy separate from the worker loop. Given the current instant and configuration, it returns the delay until the next discovery attempt.

- Inside the peak window, the base delay is the peak interval.
- Outside the peak window, the base delay is the off-peak interval.
- The returned delay is capped at the next window boundary. This prevents an off-peak run at 11:30 from sleeping until 12:30; it sleeps only until 12:00.
- A peak run at 23:58 sleeps only until 00:00, after which the off-peak interval applies.
- Window decisions use `Asia/Seoul` regardless of the server or container host time zone.
- The existing behavior of attempting discovery immediately when the worker starts remains unchanged.
- The worker calculates the next delay after each attempt completes. Failed attempts keep the same schedule calculation and error logging behavior; this change does not add a separate retry loop.

The configuration permits a future non-wrapping window where `startHour < endHour`. This change does not support overnight windows such as `[22:00, 06:00)` because the required production window is `[12:00, 24:00)`.

## Worker Integration

The worker continues to call the existing internal endpoint and remains a single Docker Compose service. Replace the one fixed `intervalMs` value with a per-iteration call to the scheduling policy. Dependency injection for the clock and sleep function should make the loop testable without real waiting, while the production entry point uses `Date.now()` and `setTimeout`.

No second worker, host cron entry, database schedule table, or distributed scheduler is introduced. The existing Redis lock in the music synchronization service continues to prevent overlapping discovery work at the API layer.

## Quota And Operational Expectations

At the observed upper estimate of approximately 32 YouTube Data API units per discovery run, the default schedule performs 144 peak runs and 12 off-peak runs per day. Expected usage is approximately 4,992 units per day before unrelated YouTube operations, leaving approximately 5,008 units against the default 10,000-unit daily allocation.

After deployment, verify the worker remains single-instance, inspect the external API call log for 24 hours, and confirm projected usage stays below the operational target of 8,000 units per day. Exceeding that target is an operational signal to restore a longer peak interval; automatic quota throttling is outside this change.

## Validation

Add focused unit tests covering:

- `11:30 KST` returns a 30-minute delay to the peak boundary.
- `11:59 KST` returns a 1-minute delay to the peak boundary.
- `12:00 KST` returns the 5-minute peak interval.
- `23:58 KST` returns a 2-minute delay to the off-peak boundary.
- `00:00 KST` returns the 60-minute off-peak interval.
- UTC instants are interpreted using `Asia/Seoul`, independent of the test process time zone.
- Invalid intervals, hours, time zones, and non-increasing window bounds fail environment validation.
- The worker recalculates its delay after every success and failure rather than retaining the startup interval.

Run the focused environment and worker tests, the full backend test suite, and the TypeScript build before deployment. On the internal server, rebuild the Compose services, confirm the discovery worker is healthy, and observe calls around both 12:00 and 00:00 KST boundaries.

## Out Of Scope

- Reducing YouTube calls by caching uploads playlist IDs.
- Persisting non-music video inspection results.
- Changing music API cache invalidation.
- Adding quota-based automatic backoff.
- Changing WebSub behavior or notification delivery.
