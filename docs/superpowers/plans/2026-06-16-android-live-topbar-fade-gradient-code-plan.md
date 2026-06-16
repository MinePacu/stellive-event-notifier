# Android Live Top Bar Fade Gradient Code Plan

Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an iOS-like fade gradient between the Android live top bar overlay and scroll content so the boundary no longer looks like a hard block.

**Architecture:** Keep the existing overlay layout and live page behavior. Split the visual treatment into a top glass tint layer and a bottom fade layer: the top tint provides light/dark-mode readability, while the fade layer gradually transitions to transparent over the content. Do not reintroduce a divider line.

**Tech Stack:** Android XML drawable resources, Android View XML layout, Kotlin `ActivityMainBinding`, existing `WindowInsetsCompat` top inset handling.

## Scope Rules

Allowed production files:

- `android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml`
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml`
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_fade.xml`
- `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_button_glass.xml`
- `android/StelliveHubAndroid/app/src/main/res/values/colors.xml`
- `android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml`
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`

Do not modify:

- `.gitlab-ci.yml`
- `backend/**`
- `ios/**`
- `shared/**`
- Android live member ordering, catalog, repository, DTO, notification, CHZZK polling, or unrelated tests

Token rules:

- Use `rtk` for all shell commands.
- Inspect only targeted snippets with `rtk grep` or `rtk sed -n`.
- Do not print full files unless targeted reads fail.

## Current Problem

Observed from screenshots:

- iOS top overlay fades into content with a soft gradient.
- Android top overlay currently has a clear hard boundary between title bar and content.
- `topBarDivider` is hidden/transparent, so the remaining boundary comes from the overlay background ending abruptly.

## Step 1: Confirm Current Files

- [ ] Run:

```bash
rtk git status --short
```

- [ ] Run:

```bash
rtk grep "topGlassOverlay\\|topBarDivider\\|bg_top_bar_glass\\|hub_top_bar" android/StelliveHubAndroid/app/src/main/res/layout/activity_main.xml android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_glass.xml android/StelliveHubAndroid/app/src/main/res/values/colors.xml android/StelliveHubAndroid/app/src/main/res/values-night/colors.xml
```

## Step 2: Create Fade Drawable

- [ ] Add `android/StelliveHubAndroid/app/src/main/res/drawable/bg_top_bar_fade.xml`.
- [ ] Use a vertical gradient from `@color/hub_top_bar_glass` to transparent.
- [ ] Keep it asset-free and resource-driven so light/dark mode colors come from `values` and `values-night`.

Expected:

```xml
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <gradient
        android:angle="270"
        android:startColor="@color/hub_top_bar_glass"
        android:endColor="@android:color/transparent" />
</shape>
```

## Step 3: Keep Main Top Bar Solid Enough For Readability

- [ ] Keep `bg_top_bar_glass.xml` as a solid color resource using `@color/hub_top_bar_glass`.
- [ ] Keep `values/colors.xml` light mode color light translucent.
- [ ] Keep `values-night/colors.xml` dark mode color dark translucent.
- [ ] Keep `hub_top_bar_divider` transparent in both modes.

## Step 4: Add Fade Layer Below Top Bar

- [ ] In `activity_main.xml`, add a new view inside `topGlassOverlay` below `topBar`.
- [ ] Give it a fixed height such as `42dp` to create the soft transition.
- [ ] Set `android:background="@drawable/bg_top_bar_fade"`.
- [ ] Keep `topBarDivider` present only for binding compatibility but `android:visibility="gone"`.
- [ ] Do not change view IDs already used by code.

Expected shape:

```xml
<LinearLayout android:id="@+id/topGlassOverlay" ...>
    <LinearLayout android:id="@+id/topBar" ... />
    <View
        android:id="@+id/topBarFade"
        android:layout_width="match_parent"
        android:layout_height="42dp"
        android:background="@drawable/bg_top_bar_fade" />
    <View android:id="@+id/topBarDivider" android:visibility="gone" ... />
</LinearLayout>
```

## Step 5: Adjust Content Padding If Needed

- [ ] Check `MainActivity.configureTopBarGlass()` content top padding.
- [ ] If the fade layer covers too much initial content, increase initial `contentList` top padding by fade height.
- [ ] Keep scroll behavior: when scrolled, cards should pass behind the fade area.
- [ ] Do not change filters, reorder, pull-to-refresh, live timer, or settings navigation.

## Step 6: Make Top Buttons Circular Glass

- [ ] Add `bg_top_bar_button_glass.xml` as an oval translucent background.
- [ ] Use color resources for light/dark mode, for example `hub_top_bar_button_glass`.
- [ ] Add `hub_top_bar_button_glass` to `values/colors.xml` and `values-night/colors.xml`.
- [ ] Apply `@drawable/bg_top_bar_button_glass` to both `topBarSettings` and `topBarBack`.
- [ ] Keep both buttons at `44dp x 44dp`.
- [ ] Keep existing icons and content descriptions.
- [ ] Preserve visibility behavior: `topBarBack` still appears only when back navigation is available.

Expected drawable:

```xml
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="@color/hub_top_bar_button_glass" />
</shape>
```

## Step 7: Verify

- [ ] Run:

```bash
rtk git diff --check
```

- [ ] Run Android test/build:

```bash
rtk ./gradlew :app:testDebugUnitTest :app:assembleDebug
```

- [ ] Install to connected device:

```bash
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp install -r android/StelliveHubAndroid/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] Capture live page after scrolling:

```bash
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp shell am start -n dev.stellive.hub/.MainActivity
rtk adb -s adb-R3CN80F8E4N-xdQWoe._adb-tls-connect._tcp exec-out screencap -p > /private/tmp/stellive-android-live-topbar-fade.png
```

## Acceptance Criteria

- Android top overlay no longer has a hard visual boundary with content.
- The transition from title/status bar to content is a soft gradient in both light and dark mode.
- `topBarDivider` remains hidden.
- Status bar/title bar icons and text remain readable.
- Settings and back buttons use circular translucent backgrounds like the iPhone reference.
- Live filters, pull-to-refresh, drag reorder, elapsed timer, and settings navigation are unchanged.
- No files outside the allowed list are modified.
