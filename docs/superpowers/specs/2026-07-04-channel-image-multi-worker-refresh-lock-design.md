# Channel Image Multi-Worker Refresh Lock Design

## Scope

Prevent duplicate YouTube channel-profile refreshes across backend workers without changing public API contracts, notification paths, Prisma schema, or behavior when Redis is absent.

## Design

- Reuse the existing owner-token Redis `SET NX PX` lock implementation through its lock interface. Configure a channel-image-specific key prefix so it cannot collide with music synchronization locks.
- Inject an optional lock into `MemberProfileImageHydrator`. The existing in-process `refreshInFlight` remains the first deduplication layer.
- Normalize and sort refresh channel IDs to form a deterministic lock key. A 30-second lease bounds orphaned locks.
- The lock owner performs the existing batch YouTube refresh and releases in `finally`. A non-owner waits for the existing refresh wait duration, then returns so `hydrateMembers()` rereads the shared DB cache.
- Lock acquisition or release failures never break public reads. Acquisition failure skips YouTube refresh, and the existing DB/stale/placeholder fallback remains authoritative.
- `app.ts` creates and closes a dedicated lazy Redis connection only when both the default profile hydrator is enabled and `REDIS_URL` is configured. Without Redis, no distributed lock is injected and existing behavior remains.

## Tests

Add hydrator tests for lock ownership, contention, and lock acquisition failure. Keep existing fresh-cache, stale URL, retry backoff, non-HTTPS, route cache, full backend, and build verification.
