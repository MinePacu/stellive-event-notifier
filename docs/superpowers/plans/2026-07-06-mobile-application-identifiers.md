# Mobile Application Identifier Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the Android and iOS application identifier families with `dev.minepacu.stelliveeventnotifier` without changing names or deep-link schemes.

**Architecture:** Apply exact identifier substitutions in mobile configuration, source, tests, and documentation. Move Android package directories with Git-aware renames, then use repository-wide negative searches and platform builds as the acceptance checks.

**Tech Stack:** Kotlin/Gradle, Swift/Xcode, plist/entitlements, Markdown, Git

---

### Task 1: Establish baseline and configuration inventory

**Files:**
- Inspect: `android/StelliveHubAndroid/**`
- Inspect: `ios/StelliveHubiOS/**`
- Inspect: `docs/**`, `CODEMAP.md`, `README.md`

- [x] Run the legacy-identifier search and confirm it returns matches before implementation.
- [x] Run Android unit tests from `android/StelliveHubAndroid` with `rtk ./gradlew test` and record the baseline result.
- [x] Run `rtk xcodebuild -project StelliveHubiOS.xcodeproj -list` from `ios/StelliveHubiOS` and record the baseline result.
- [x] Check tracked Firebase configuration using `rtk git ls-files '*google-services.json' '*GoogleService-Info.plist'`.

### Task 2: Migrate Android identifiers and package paths

**Files:**
- Modify: `android/StelliveHubAndroid/app/build.gradle.kts`
- Move: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/**`
- Move: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/**`
- Move if present: `android/StelliveHubAndroid/app/src/androidTest/java/dev/minepacu/stelliveeventnotifier/**`
- Modify: Kotlin files below the moved package directories

- [x] Change `namespace` and `applicationId` to `dev.minepacu.stelliveeventnotifier`.
- [x] Move each existing Android package directory to `dev/minepacu/stelliveeventnotifier` using `rtk git mv`.
- [x] Replace Kotlin package and import prefixes with `dev.minepacu.stelliveeventnotifier`.
- [x] Confirm the manifest keeps relative component class names and the `stellivehub` scheme.
- [x] Run `rtk ./gradlew test` and `rtk ./gradlew assembleDebug`; expect successful completion.

### Task 3: Migrate iOS identifiers and shared storage names

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj/project.pbxproj`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/StelliveHubiOS.entitlements`
- Modify: `ios/StelliveHubiOS/StelliveHubCalendarWidget/StelliveHubCalendarWidget.entitlements`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/DeviceIDStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/PushTokenSyncer.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Info.plist`
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarWidgetStoreTests.swift`

- [x] Set app, tests, and widget bundle identifiers to their specified derived values.
- [x] Set both entitlements and the widget-store constant to `group.dev.minepacu.stelliveeventnotifier`.
- [x] Set the device ID and pending token keys to the new identifier prefix.
- [x] Set `CFBundleURLName` to the new app identifier while preserving `CFBundleURLSchemes` value `stellivehub`.
- [x] Update test expectations that contain the App Group identifier.
- [x] Lint both Info.plist files and both entitlement files; expect `OK`.
- [x] List the Xcode project and build the `StelliveHubiOS` scheme for an available iOS Simulator destination.

### Task 4: Update repository documentation and codemaps

**Files:**
- Modify when matched: `docs/**`
- Modify when matched: `CODEMAP.md`
- Modify when matched: `README.md`

- [x] Replace the legacy dotted identifier with `dev.minepacu.stelliveeventnotifier`.
- [x] Replace the legacy slash-form Android package path with `dev/minepacu/stelliveeventnotifier`.
- [x] Confirm Android and iOS codemaps resolve to existing paths after the migration.

### Task 5: Final acceptance verification

**Files:**
- Verify: repository ordinary text files outside `.git`, build, dependency, cache, and DerivedData paths

- [x] Run the repository-wide legacy-identifier search with all requested exclusions; expect no output and exit status 1.
- [x] Run `rtk git diff --check`; expect no whitespace errors.
- [x] Inspect `rtk git diff --stat` and focused diffs for identifiers and `stellivehub`.
- [x] Run final Android tests/build and iOS plist/project/build checks, recording any environment-only failure separately.
- [x] Check `rtk git status --short` and verify unrelated user files are absent from the worktree changes.
