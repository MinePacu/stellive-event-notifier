# Settings Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single long mobile Settings screen with a short Settings hub and focused child pages on iOS and Android.

**Architecture:** Add small settings navigation policy helpers that expose stable hub rows and summaries from the existing preference state. Render iOS child pages with SwiftUI navigation destinations and Android child pages through the existing `MainActivity` screen renderer, preserving the same underlying settings model and defaults.

**Tech Stack:** SwiftUI, XCTest, Kotlin, Android Views, JUnit.

---

### Task 1: Add Settings Navigation Policy Tests

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`

- [x] Add iOS tests asserting Settings hub rows are summarized and child-page groups preserve policy-sensitive defaults.
- [x] Add Android tests asserting Settings hub rows are summarized and child-page groups preserve policy-sensitive defaults.
- [x] Run focused tests and verify they fail because the policy helpers do not exist yet.

### Task 2: Add Settings Navigation Policy Helpers

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`

- [x] Add iOS route, row, and section helper types with summary count logic.
- [x] Add Android route, row, and section helper types with summary count logic.
- [x] Run focused tests and verify they pass.

### Task 3: Rework iOS Settings UI

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`

- [x] Replace the long form with a Settings hub.
- [x] Add child pages for delivery, targets, platforms, event types, goods/events, and advanced combination settings.
- [x] Keep appearance mode and global notification controls on the hub.
- [x] Run iOS build verification.

### Task 4: Rework Android Settings UI

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`

- [x] Replace the long settings render with a Settings hub.
- [x] Add child screens for delivery, targets, platforms, event types, goods/events, and advanced combination settings.
- [x] Reuse existing cards, rows, toggles, back navigation, and bottom tabs.
- [x] Run Android tests.

### Task 5: Verify Policy And Build

**Files:**
- No additional files expected.

- [x] Run iOS build verification.
- [x] Attempt iOS simulator tests; blocked by simulator destination resolution.
- [x] Run Android unit tests.
- [x] Scan changed code for Former member reintroduction, official YouTube live generation, unauthorized assets, and policy regressions.
