# Android OLED Dark Mode Code Plan

**References:** GitLab work item `#19`, GitHub issue `#35`

**Goal:** Change only the Android app dark-mode background treatment to OLED-friendly pure black while preserving the existing light-mode look and current Android behavior.

**Issue Summary:** In Android dark mode, background colors should use complete black where the user perceives app/page background. Light mode must stay visually distinct and unchanged.

**Architecture:** Keep the change resource-driven through Android `values-night` colors first. Avoid touching backend, iOS, shared contracts, catalog data, notification policy, push delivery, or platform API code. Treat this as an Android visual resource adjustment with narrow UI verification.

**Tech Stack:** Android Kotlin View system, XML resources, existing Gradle test/build workflow.

## Project Rules

- Do not change member catalog, generation/category data, notification targets, seeds, or platform integration behavior.
- Do not add images, logos, profile assets, screenshots, secrets, or raw platform responses.
- Do not modify iOS, backend, shared OpenAPI/schema contracts, or notification delivery behavior for this issue.
- Keep all commands prefixed with `rtk`.

## Token-Efficient Work Plan

- Start from `CODEMAP.md` and the issue references instead of scanning the full repository.
- Use narrow searches only:

```bash
rtk rg "hub_background|hub_surface|hub_card|hub_top_bar|statusBarColor|navigationBarColor" android/StelliveHubAndroid/app/src/main
```

- Prefer reading only these expected files:

```text
android/StelliveHubAndroid/app/src/main/res/values/colors.xml
android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml
android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt
```

- Use `rtk grep`/`rtk rg` for resource names and only open full files after a match identifies a concrete edit target.
- Keep implementation to the smallest possible diff: ideally `values-night/colors.xml` only, plus a Kotlin system-bar update only if the current dark navigation/status bars still use non-black background.
- Avoid broad test output. Use `rtk test <cmd>` or targeted Gradle tasks so only failures are expanded.
- Do not re-run backend/iOS tests because this issue is Android-only and resource-scoped.

## Change Design

1. Inspect current Android dark color resources.

```bash
rtk grep "hub_background\|hub_surface\|hub_card\|hub_top_bar" android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml
```

2. Set dark-mode page/app background to pure black.

Expected primary change:

```xml
<color name="hub_background">#000000</color>
```

3. Evaluate whether `hub_surface` also acts as full-screen background. If it is used as a page root background, change it to `#000000`; if it is used for raised cards or controls, keep enough contrast and document the decision in the implementation summary.

4. Keep `hub_card`, text, line, chip, accent, and top-bar glass colors readable. Do not turn every dark color black if it removes component separation.

5. If Android system/navigation bars are set from app colors in `MainActivity.kt`, ensure dark mode uses black bars and light icons. Do not change light-mode icon behavior.

6. Confirm light-mode resource values in `values/colors.xml` are unchanged.

## Expected Files

- `android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml`
- Optional only if needed: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Optional only if existing tests assert exact dark colors: Android unit test files under `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/`

## Non-Goals

- No Android layout redesign.
- No backend, iOS, shared schema, OpenAPI, catalog, or notification changes.
- No new assets or screenshots committed.
- No platform-branded visual cloning.
- No behavior changes to live status, calendar, widgets, preferences, or push notifications.

## Verification

- [ ] Confirm diff scope:

```bash
rtk git diff -- android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt
```

- [ ] Check whitespace and XML sanity:

```bash
rtk git diff --check
```

- [ ] Run Android unit tests:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

- [ ] Run Android debug build:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:assembleDebug
```

- [ ] Manual visual check on Android dark mode: app background is `#000000`, cards/controls remain readable, top/status/navigation areas do not show unintended gray bands, and light mode remains unchanged.

## Acceptance Criteria

- Android dark-mode main background renders as OLED-friendly pure black.
- Light mode remains unchanged.
- Text, cards, dividers, chips, top bar, calendar, live page, settings, and history remain readable.
- Android unit tests and debug build pass.
- The final diff is limited to Android visual resources and any strictly necessary Android system-bar code.
