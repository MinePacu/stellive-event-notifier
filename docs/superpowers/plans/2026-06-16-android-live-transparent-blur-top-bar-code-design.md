# Android Live Transparent Blur Top Bar Code Design

Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Android live page status bar and title bar use the same translucent blurred visual treatment as the iOS live page reference while preserving live page behavior.

**Architecture:** Keep the change inside Android UI shell code. Add an Android-native top glass container/background around the existing `topBar`, configure edge-to-edge status bar behavior in `MainActivity`, and make scroll state update only opacity/divider intensity. Provide a no-blur fallback via translucent drawable resources.

**Tech Stack:** Android Kotlin, View system XML, `WindowCompat`/`WindowInsetsCompat`, `RenderEffect` or `View.setRenderEffect` where available, existing `SwipeRefreshLayout` and `ScrollView` live page.

## Files

Modify:

- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml`

Create if needed:

- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml`

Test:

- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt` if a new pure UI policy helper is introduced.
- Existing Android unit tests and debug build.

## Step 1: Capture Current Baseline

- [ ] Run `rtk git status --short`.
- [ ] Inspect `activity_main.xml` top-level layout and current `topBar`/`topBarDivider`.
- [ ] Inspect `MainActivity.updateTopBarScrolled(scrolled: Boolean)` and any status/navigation bar setup.

## Step 2: Add Glass Background Resource

- [ ] Add `bg_top_bar_glass.xml` as a translucent dark shape using existing palette-compatible colors.
- [ ] Add or reuse color tokens such as `hub_top_bar_glass`, `hub_top_bar_glass_scrolled`, and `hub_top_bar_divider_glass`.
- [ ] Keep colors generic and original; do not add platform logo or copied visual assets.

Expected shape:

```xml
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/hub_top_bar_glass" />
</shape>
```

## Step 3: Update Layout For Overlay Top Bar

- [ ] Wrap or update the existing `topBar` area so it uses `@drawable/bg_top_bar_glass`.
- [ ] Keep `topBar` height at `52dp` and settings/back button size at `44dp`.
- [ ] Keep `collapsedTitle`, `collapsedRole`, and `topBarDivider` IDs unchanged.
- [ ] Make content layout capable of drawing behind the top bar by moving top spacing responsibility to runtime insets/padding instead of a solid top background.

## Step 4: Configure Edge-To-Edge Status Bar

- [ ] In `MainActivity.onCreate`, set transparent status bar color for Android versions that support it.
- [ ] Ensure status bar icons use light appearance on dark glass.
- [ ] Apply top inset padding to the top glass area so it covers the system status bar and title bar continuously.
- [ ] Keep navigation bar behavior unchanged unless existing edge-to-edge setup requires explicit contrast handling.

Expected Kotlin direction:

```kotlin
WindowCompat.setDecorFitsSystemWindows(window, false)
window.statusBarColor = Color.TRANSPARENT
WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
```

## Step 5: Apply Blur With Fallback

- [ ] Add a small helper such as `configureTopBarGlass()` in `MainActivity`.
- [ ] On Android 12+ (`Build.VERSION_CODES.S`), apply `RenderEffect.createBlurEffect(...)` to the glass background layer if it produces the intended visual result.
- [ ] On lower versions, rely on translucent scrim resource only.
- [ ] Avoid applying blur directly to text/buttons so icons and labels stay sharp.

## Step 6: Preserve Scroll-Driven Title Behavior

- [ ] Keep `updateTopBarScrolled(scrolled: Boolean)` as the only place that changes collapsed title alpha.
- [ ] Adjust divider alpha and optional glass tint alpha when scrolled.
- [ ] Do not reintroduce a large live page title.
- [ ] Confirm live page content starts visually under the glass top area but remains readable when stationary.

## Step 7: Verify Gesture Behavior

- [ ] Run Android debug build:

```bash
rtk ./gradlew :app:assembleDebug
```

- [ ] Run Android unit tests:

```bash
rtk ./gradlew :app:testDebugUnitTest
```

- [ ] Install on connected Android device:

```bash
rtk adb install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] Manually verify live page pull-to-refresh, drag reorder, settings button, and elapsed live timer.

## Acceptance Criteria

- [ ] Android live page status bar and title bar form one translucent dark glass overlay.
- [ ] Blur appears on supported Android versions; unsupported versions use a readable translucent fallback.
- [ ] Live member list scrolls under the top overlay without losing readability.
- [ ] Top settings button remains visible and tappable.
- [ ] Pull-to-refresh and long-press reorder still work.
- [ ] No backend, catalog, notification, CHZZK API, or iOS files are changed.
