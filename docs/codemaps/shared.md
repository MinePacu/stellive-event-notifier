# Shared CODEMAP

Read this file only for shared contract, catalog, schema, or OpenAPI work or when changed files are under `shared/**`.

Do not read this file for merge-only work unless a conflict or failed check directly references shared files.

## Shared Contracts And Seeds

- `shared/member-catalog/generations.seed.json` - Seed generation/category catalog including active, upcoming, representative, and official groupings.
- `shared/member-catalog/members.seed.json` - Seed member, Gangzi, and official-channel catalog data used by backend and clients.
- `shared/openapi/openapi.yaml` - OpenAPI contract for public, mobile, admin, and internal backend routes.
- `shared/schemas/domain.ts` - Shared TypeScript domain types and schema helpers for catalog entries, events, live status, preferences, and hub events.
- `shared/schemas/mobileApi.ts` - Shared mobile API DTO definitions for app bootstrap and client-facing backend responses.

