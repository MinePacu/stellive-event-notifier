# Backend Core

- Root: `backend/stellive-hub-api`. TypeScript ESM Fastify API/control plane, Prisma storage, Zod env validation, Vitest tests, Docker Compose local/self-host option.
- App composition: `src/app.ts` wires env, CORS, Swagger, repositories, services, workers, routes. Process entry: `src/index.ts`.
- Config/storage: `src/config/env.ts` parses feature flags/env; `src/storage/prisma.ts` owns Prisma client singleton; `prisma/schema.prisma` is persistent model source.
- Main route boundaries: `src/routes/appRoutes.ts` mobile bootstrap/devices/preferences/live/hub-event reads; `webhookRoutes.ts` YouTube WebSub; `internalRoutes.ts` scheduler/job/admin internals; `admin/*` serves `/admin` console.
- Ingestion/push architecture: adapters validate external DTOs only; ingestion validates catalog, guards unsupported events, dedupes, persists normalized events, enqueues jobs; notification worker resolves preferences/load reduction before FCM/APNs send. Do not let adapters or routes directly bypass preference resolution or push policy.
- Platform notes: YouTube WebSub/Data API backend-only; official channel upload only. CHZZK live polling uses official client-auth live-list; mobile consumes normalized `/v1/bootstrap` and `/v1/live-status`. X remains no-paid-API and disabled unless free official path is verified. Naver Cafe automatic collection deferred.
- Hub events: public read APIs include `/v1/hub-events`, `/:id`, `/calendar`, `/widget-snapshot`, `/summary`; admin CRUD is protected under `/v1/admin/hub-events*`; image support is metadata-only and calendar/widget/push payloads stay image-free unless explicitly changed by policy.
- Music/song APIs: public music uses DB/cache routes; sync uses backend-only YouTube Data API and internal protected scheduler routes. Mobile apps must not call YouTube directly or receive `YOUTUBE_API_KEY`.
- Use fake provider clients in tests; adapter tests must not hit network. FCM client must remain disabled-safe when provider env is absent/placeholders.
- Internal/admin endpoints require `INTERNAL_API_TOKEN`, admin session, or `ADMIN_CONSOLE_TOKEN`; never log or persist real values in docs/commits/test fixtures.