# iOS Agent Rules

Read this file only for iOS app or WidgetKit work under `ios/StelliveHubiOS/**`, or when shared mobile DTO changes require iOS updates.

## Required Context

Do not read all docs by default.

- Read `docs/PROJECT_RULES.md` or `docs/NOTIFICATION_POLICY.md` only for related catalog, settings, notification, or delivery behavior.
- Read `docs/REALTIME_DELIVERY.md` only for realtime UI or client behavior.
- Read `docs/UI_GUIDELINES.md` only for substantial UI work.
- Read `docs/AI_HANDOFF.md` only when the user asks for handoff context or current status is required.

## iOS Boundaries

- iOS consumes the server-mediated API and must not access protected platform APIs directly.
- Preserve authoritative global, platform, event-type, category/generation, and individual notification controls.
- Keep local history/cache, deep links, widgets, foreground presentation, and notification permissions within Apple platform conventions.
- Grouped settings patterns are acceptable, but do not clone Apple Settings, CHZZK, YouTube, X, Naver, Stellive, or proprietary assets.
- Use placeholder avatars by default. Remote platform images require conditional loading and a fallback.
- Do not commit secrets, provisioning data, `GoogleService-Info.plist`, DerivedData, screenshots, or generated build artifacts.

## Navigation And Context

- Prefer targeted search and focused file reads.
- Do not read backend or Android files unless the task explicitly involves shared behavior or cross-platform parity.
- Use the iOS codemap only when navigation requires it; do not load unrelated codemaps.

## Verification

- Prefer targeted XCTest commands with `-only-testing`.
- Run broad xcodebuild tests only when iOS models, app composition, navigation, project settings, or WidgetKit integration change broadly.
- Run a build for project settings, compile-sensitive Swift, entitlements, widget targets, or shared DTO mapping changes.
- Do not run backend, Android, CI, simulator boot/install, or app launch workflows unless explicitly requested or required for requested UI verification.
- Root helper commands for iOS builds and installs are governed by `scripts/AGENTS.md`.
