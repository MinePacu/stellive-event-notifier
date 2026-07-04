# Channel Image Cache Read API TTL Design

## Scope

Improve backend public member reads only. Mobile contracts, notification delivery, catalog seeds, and YouTube music synchronization remain unchanged.

## Design

- Create one `ShortTtlAsyncCache<Member[]>` per `registerRoutes` invocation with a 30-second TTL. Its loader reads the full catalog and applies `memberProfileImages.hydrateMembers()` when configured.
- Make both `GET /v1/members` and `GET /v1/members/:id` use that same hydrated-member snapshot. Missing IDs retain the existing `404 member not found` response.
- Keep `ChannelImageCacheRepository.listByChannelIds()` as the batch DB read boundary. In `MemberProfileImageHydrator`, an initial DB read failure returns cloned original members without attempting YouTube. A refresh or post-refresh DB read failure falls back to records already read, preserving a stale HTTPS image when available.
- Add positive-integer `CHANNEL_IMAGE_CACHE_TTL_SECONDS` and `CHANNEL_IMAGE_REFRESH_WAIT_MS` settings with defaults of 604800 and 1500. Pass them only when constructing the default hydrator; no API key still means no default hydrator.
- Add focused hydrator, route, and environment tests. Do not add a Prisma model or migration because `ChannelImageCache` already exists.

## Operational Notes

Production must have the existing `ChannelImageCache` table before deployment. This repository exposes `prisma:push:deploy` as `prisma db push --skip-generate`. Multi-worker refresh locking remains follow-up work; the existing per-process `refreshInFlight`, retry backoff, DB TTL, and shared full-member route cache limit duplicate refreshes.
