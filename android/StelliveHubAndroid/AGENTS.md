# Android Agent Rules

Read this file only for Android work under `android/StelliveHubAndroid/**`, or when shared mobile DTO changes require Android updates.

## Required Context

Do not read all docs by default.

- Read `docs/PROJECT_RULES.md` or `docs/NOTIFICATION_POLICY.md` only for related catalog, settings, notification, or delivery behavior.
- Read `docs/REALTIME_DELIVERY.md` only for realtime UI or client behavior.
- Read `docs/UI_GUIDELINES.md` only for substantial UI work.
- Read `docs/AI_HANDOFF.md` only when the user asks for handoff context or current status is required.

## Android Boundaries

- Android consumes the server-mediated API and must not access protected platform APIs directly.
- Preserve authoritative global, platform, event-type, category/generation, and individual notification controls.
- Keep local history/cache, deep links, widgets, foreground presentation, and permission prompts within Android platform conventions.
- A spacious settings-app mood is acceptable, but do not clone Samsung One UI, CHZZK, YouTube, X, Naver, Stellive, or proprietary assets.
- Use placeholder avatars by default. Remote platform images require conditional loading and a fallback.
- Do not add secrets, `google-services.json`, local properties, build outputs, screenshots, or generated caches to source control.

## Navigation And Context

- Prefer targeted search and focused file reads.
- Do not read backend or iOS files unless the task explicitly involves shared behavior or cross-platform parity.
- Use the Android codemap only when navigation requires it; do not load unrelated codemaps.

## Verification

- Prefer focused tests with `rtk ./gradlew :app:testDebugUnitTest --tests ...`.
- Run broad `rtk ./gradlew :app:testDebugUnitTest` only when Android policies, models, repository mapping, or navigation change broadly.
- Run assemble/build only for compile, resource, manifest, Gradle, or wiring changes.
- Do not run backend, iOS, CI, emulator, device-install, or launch workflows unless explicitly requested.
- Root helper commands for Android builds and installs are governed by `scripts/AGENTS.md`.
