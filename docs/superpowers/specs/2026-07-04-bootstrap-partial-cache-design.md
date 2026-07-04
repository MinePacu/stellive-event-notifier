# Bootstrap Partial Cache Design

## Goal

Reduce repeated shared-data work in `BootstrapService.getBootstrap()` without caching any device-specific response state or changing the public `/v1/bootstrap` response contract.

## Architecture

Add a small generic `ShortTtlAsyncCache<T>` utility. Each cache stores one resolved value with an expiry timestamp and, while a refresh is running, exposes the same in-flight promise to every caller. A failed refresh is not cached and clears the in-flight promise so a later request can retry.

Each `BootstrapService` instance owns three independent cache instances:

- hydrated catalog (`generations` plus visible, profile-image-hydrated `members`): 30 seconds by default;
- live status: 10 seconds by default and always limited to 1–10 seconds;
- hub-events summary: 30 seconds by default.

Instance ownership prevents state from leaking between tests or independently configured service instances. The existing injected `clock(): Date` supplies both response time and cache time, allowing deterministic expiry tests without real timers.

## Request Data Flow

Every `getBootstrap()` call still reads `device` and `preferences` directly. It obtains hydrated catalog, live status, and hub-events summary through their independent caches. The response is assembled in the existing shape, and `serverTime` is generated from `this.clock().toISOString()` after the current request's data has been obtained.

The following values are never cached:

- device record and token status;
- notification preferences;
- `serverTime`;
- the complete bootstrap response.

The static config object remains outside the caches. Its `catalogVersion` is not derived from cached data, so its existing behavior is unchanged.

## Configuration

Add these validated environment variables and document them in the backend example environment file:

- `BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS`, positive integer, default `30`;
- `BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS`, integer from `1` through `10`, default `10`;
- `BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS`, positive integer, default `30`.

`buildApp()` passes the parsed values to the repository-backed `BootstrapService`. Direct service construction remains compatible because constructor options have the same defaults.

## Failure Behavior

The cache does not serve stale data after expiry. If refresh fails, all callers awaiting that refresh receive the error, no failed result is retained, and the next request can retry. Existing route-level error handling remains authoritative.

## Testing

Use fake mutable time through the existing `clock` dependency. Tests will prove:

- repeated calls inside each TTL invoke shared expensive dependencies once;
- calls after expiry refresh the corresponding dependency;
- device and preferences are read on every call and updated values appear immediately;
- `serverTime` follows the current fake clock even inside cache TTLs;
- concurrent cache misses share one expensive operation;
- cache refresh failures are retryable;
- environment defaults are applied and live-status TTL values above 10 seconds are rejected;
- the existing bootstrap response contract remains unchanged.

## Scope

This change affects only backend bootstrap response assembly and configuration. It does not modify notification workers, mobile clients, shared response schemas, event ingestion, or push delivery.
