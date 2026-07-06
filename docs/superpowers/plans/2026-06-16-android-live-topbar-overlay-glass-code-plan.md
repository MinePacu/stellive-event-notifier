# Android Live Top Bar Overlay Glass Code Plan

Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework only the Android app shell so the live page content scrolls behind a light translucent top system/title bar overlay, matching the browser mockup behavior.

**Architecture:** Change the Android root layout from a vertical flow that reserves top-bar space into an overlay structure: content fills the screen, bottom navigation stays anchored at bottom, and the top bar glass layer is drawn above scroll content. Keep the existing `topBar`, `collapsedTitle`, `collapsedRole`, `topBarDivider`, `topBarSettings`, `contentRefresh`, `contentScroll`, `contentList`, and bottom navigation IDs so existing binding and navigation code remain stable.

**Tech Stack:** Android Kotlin View system, XML layout resources, `WindowInsetsCompat`, `WindowInsetsControllerCompat`, `ActivityMainBinding`, existing `ScrollView`/`SwipeRefreshLayout`.

## Hard Scope Rules

Allowed production files:

- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml`
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml`

Allowed reference file:

- `docs/superpowers/specs/android-live-topbar-glass-browser-mockup.html`

Do not modify:

- `.gitlab-ci.yml`
- `backend/**`
- `ios/**`
- `shared/**`
- Android live member ordering policy, catalog, repository, DTO, notification, CHZZK polling, or tests unrelated to layout

Token rules:

- Use `rtk` for all shell commands.
- Inspect only targeted snippets with `rtk grep` or `rtk sed -n`.
- Do not print full files unless targeted reads fail.
- Do not run full repository tests.

## Current Problem

Device verification showed:

- The top area is a large solid gray block.
- Live content starts below the top bar instead of scrolling underneath it.
- There is no visible backdrop blur/content-through-glass effect.
- The settings button is visible, but the top bar does not behave like the mockup overlay.

Root cause:

- `activity_main.xml` currently uses a vertical `LinearLayout` root with `topBar` and `topBarDivider` before `contentRefresh`, so the top bar consumes layout height and pushes content down.

## Step 1: Confirm Scope

- [ ] Run:

```bash
rtk git status --short
```

- [ ] Confirm existing unrelated changes are not reverted.
- [ ] Edit only the allowed files listed above.

## Step 2: Inspect Relevant Layout Only

- [ ] Run:

```bash
rtk grep "LinearLayout\\|FrameLayout\\|topBar\\|topBarDivider\\|contentRefresh\\|contentScroll" android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml
```

- [ ] Run:

```bash
rtk grep "configureTopBarGlass\\|updateTopBarGlass\\|contentScroll\\|contentList\\|WindowInsets" android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt
```

## Step 3: Convert Root Layout To Overlay Structure

- [ ] Replace the root vertical `LinearLayout` in `activity_main.xml` with a root `FrameLayout`.
- [ ] Add a vertical content container inside the root that holds `contentRefresh` and bottom navigation.
- [ ] Make the content container `match_parent`.
- [ ] Move `topBar` and `topBarDivider` into a top overlay container drawn after content so it appears above `contentRefresh`.
- [ ] Preserve every existing view ID used by binding.

Expected shape:

```xml
<FrameLayout ...>
  <LinearLayout android:id="@+id/mainContent" ...>
    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout ... />
    <LinearLayout ... bottom navigation ... />
  </LinearLayout>
  <LinearLayout android:id="@+id/topGlassOverlay" ...>
    <LinearLayout android:id="@+id/topBar" ... />
    <View android:id="@+id/topBarDivider" ... />
  </LinearLayout>
</FrameLayout>
```

## Step 4: Add Runtime Insets And Content Padding

- [ ] In `MainActivity.configureTopBarGlass()`, keep light status bar icons setting:

```kotlin
WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = true
```

- [ ] Add a narrow helper that applies system top inset to the top overlay height/padding.
- [ ] Add equivalent top padding to `contentList` or `contentScroll` so the first content remains reachable but can scroll behind the overlay.
- [ ] Do not change bottom navigation or navigation bar behavior.

Expected behavior:

- Top overlay covers status bar plus app title bar.
- Content initially appears below readable overlay padding.
- When user scrolls, rows/cards pass behind the translucent top overlay.

## Step 5: Keep Glass Visuals Light And Readable

- [ ] Keep `hub_top_bar_glass` and `hub_top_bar_glass_scrolled` light translucent.
- [ ] Keep `topBarSettings` visible and tappable.
- [ ] Do not tint text/icons with the glass color.
- [ ] If blur is implemented, apply it only to a background/scrim layer and guard Android version support.
- [ ] If real blur is not reliable, keep the translucent fallback and report that Android native blur remains fallback-only.

## Step 6: Preserve Existing Live Behavior

- [ ] Do not change filter chips.
- [ ] Do not change live/offline/all state logic.
- [ ] Do not change drag reorder logic.
- [ ] Do not change pull-to-refresh listener.
- [ ] Do not change live elapsed timer updates.
- [ ] Do not change settings navigation.

## Step 7: Verify

- [ ] Run:

```bash
rtk git diff --check
```

- [ ] Run Android verification:

```bash
rtk ./gradlew :app:testDebugUnitTest :app:assembleDebug
```

- [ ] Install to the connected Android device:

```bash
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] Launch and capture:

```bash
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp shell am start -n dev.minepacu.stelliveeventnotifier/.MainActivity
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp exec-out screencap -p > /private/tmp/stellive-android-live-topbar-overlay.png
```

- [ ] Confirm the live tab shows content moving behind the top overlay when scrolled.

## Acceptance Criteria

- Top system/title bar is not a solid gray block.
- Live content can scroll behind the top translucent overlay.
- The overlay uses the light glass tone from the browser mockup.
- Settings button remains visible and tappable.
- Pull-to-refresh, drag reorder, filters, and live timer still work.
- No files outside the allowed list are changed by implementation.
