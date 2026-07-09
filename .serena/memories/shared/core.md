# Shared Core

- `shared/schemas/domain.ts` is the shared domain contract for catalog entries, events, live status, preferences, hub events, and related policy shapes.
- `shared/schemas/mobileApi.ts` defines mobile-facing API DTOs used by backend and clients for bootstrap/song/live/preference-style responses.
- `shared/member-catalog/generations.seed.json` and `members.seed.json` are authoritative seeds for allowed active/upcoming members, Gangzi representative entry, official channel entry, and external IDs. Do not add Former entries or unverified handles without official-source verification.
- `shared/openapi/openapi.yaml` is the public/admin/internal contract document; update with backend route/DTO changes.
- Catalog invariants: Gangzi in `gamja` only as representative; official channel in `official`/`기타`; official YouTube upload event allowed, official YouTube live event types unsupported.
- Shared contracts must not expose raw provider payloads, secrets, production device tokens, local file paths, binary image data, copied asset URLs, or provider responses beyond normalized/minimal runtime fields allowed by policy.