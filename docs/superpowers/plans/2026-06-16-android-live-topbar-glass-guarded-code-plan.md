# Android Live Top Bar Glass Guarded Code Plan

Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve only the Android live page top system/title bar glass effect so it matches the browser mockup more closely, while minimizing token use and avoiding unrelated edits.

**Architecture:** Treat `docs/superpowers/specs/android-live-topbar-glass-browser-mockup.html` as the visual reference. Keep all production changes inside the Android view shell: top bar layout/resource colors/drawable and the small `MainActivity` top bar helper. Do not touch live data, reorder, backend, iOS, CI, catalog, or notification code.

**Tech Stack:** Android Kotlin View system, XML resources, existing `ActivityMainBinding`, existing `ScrollView`/`SwipeRefreshLayout`, local HTML/CSS browser mockup.

## Hard Scope Rules

Allowed production files:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml`
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml`

Allowed reference file:

- `docs/superpowers/specs/android-live-topbar-glass-browser-mockup.html`

Do not modify:

- `.gitlab-ci.yml`
- `backend/**`
- `ios/**`
- `shared/**`
- Android live ordering, member catalog, server DTO, notification, CHZZK polling, or repository files
- Any profile image, logo, fan art, captured screenshot, or copied media asset

Token rules:

- Use `rtk` for every shell command.
- Prefer `rtk grep`, `rtk sed -n`, and narrow `rtk git diff -- <file>` over broad reads.
- Do not print full files unless a targeted grep/sed fails.
- Do not run full repository tests; run only Android unit test/build commands listed below.
- Stop and report if a needed change falls outside the allowed file list.

## Current Reference

- Browser mockup URL when local server is running: `http://127.0.0.1:8765/docs/superpowers/specs/android-live-topbar-glass-browser-mockup.html`
- Intended look: light translucent top glass, strong backdrop blur, content visible but softened behind system bar/title bar, readable black status icons, white circular settings button.

## Step 1: Confirm Dirty State

- [ ] Run:

```bash
rtk git status --short
```

- [ ] Confirm existing unrelated changes are not reverted.
- [ ] Confirm only allowed files will be staged/edited for this task.

## Step 2: Inspect Only Relevant Code

- [ ] Run:

```bash
rtk grep "topBar\\|collapsedTitle\\|topBarDivider\\|configureTopBarGlass\\|updateTopBarGlass" android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt
```

- [ ] Run:

```bash
rtk grep "topBar\\|topBarDivider\\|contentRefresh" android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml
```

- [ ] Run:

```bash
rtk grep "hub_top_bar\\|hub_background\\|hub_surface\\|hub_text" android/StelliveHubAndroid/app/src/main/res/values/colors.xml
```

## Step 3: Align Android Glass To Mockup

- [ ] Keep `topBar`, `collapsedTitle`, `collapsedRole`, `topBarDivider`, and `topBarSettings` IDs unchanged.
- [ ] Make the Android top bar use a light translucent glass color equivalent to the mockup, not the previous dark glass.
- [ ] Keep status bar icons dark only if the bar is light enough for readability; otherwise keep light icons.
- [ ] Avoid tinting text/buttons with the glass tint; text and icons must remain sharp.
- [ ] If adding real blur, apply it only to a background layer on Android 12+ and leave a readable translucent fallback.

Expected direction:

```kotlin
WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = true
window.statusBarColor = color(R.color.hub_top_bar_glass)
```

## Step 4: Preserve Existing Behavior

- [ ] Do not change live/offline/all filters.
- [ ] Do not change member order persistence.
- [ ] Do not change pull-to-refresh setup.
- [ ] Do not change elapsed live timer code.
- [ ] Do not change navigation or settings destination.

## Step 5: Validate Narrowly

- [ ] Run:

```bash
rtk git diff --check
```

- [ ] Run Android tests/build only:

```bash
rtk ./gradlew :app:testDebugUnitTest :app:assembleDebug
```

- [ ] Install only after build succeeds:

```bash
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
```

## Step 6: Report Concisely

- [ ] List changed files only.
- [ ] State whether tests/build passed.
- [ ] State whether Android install succeeded.
- [ ] Mention if iOS was intentionally untouched.
- [ ] Mention any skipped visual verification briefly.

## Acceptance Criteria

- Android live top system/title bar visually follows the light glass mockup.
- Content remains readable while scrolling behind the top area.
- Settings button remains visible and tappable.
- Pull-to-refresh, drag reorder, filters, and live timer behavior are unchanged.
- No files outside the allowed list are modified by this implementation step.
