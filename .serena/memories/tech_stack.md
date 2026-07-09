# Tech Stack

- Backend: Node 22 in CI, TypeScript 5.7 ESM, Fastify 5, Prisma 6.2, Zod 3, Firebase Admin 13, BullMQ/ioredis present, Vitest 2.1, npm with `package-lock.json`.
- Backend scripts: `dev` uses `tsx watch`; `build` runs `tsc`; `test` runs `vitest run`; Prisma scripts include `prisma:generate`, `prisma:migrate`, `prisma:push`, `prisma:push:deploy`.
- Backend local/self-host: Dockerfile and `docker-compose.yml` under `backend/stellive-hub-api`; local API default port 4000; Swagger UI at `/docs` when server is running.
- Android: Gradle Kotlin DSL, Android Gradle Plugin 8.10.1, Kotlin 2.1.21, Java 17, Hilt 2.55, Retrofit/Moshi/OkHttp, Room, DataStore, WorkManager, Firebase Messaging. App uses XML/View-based Android UI with viewBinding enabled.
- Android CI uses Temurin Java 17 and `gradle assembleDebug`; local repo includes wrapper `android/StelliveHubAndroid/gradlew`.
- iOS: SwiftUI app + WidgetKit extension in Xcode project, shared scheme `StelliveHubiOS`; CI example builds on macOS 15 with destination `iPhone 16`, local docs often use `iPhone 17 Pro` simulator.
- Shared/contracts: TypeScript schema files plus OpenAPI YAML and JSON seed files.
- Tooling conventions: run shell commands with `rtk` prefix; use `fd` for file discovery, `rg` for text search, `ast-grep` for syntax search when useful.