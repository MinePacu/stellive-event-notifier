# CHZZK Live Elapsed Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show CHZZK live stream elapsed time on Android and iOS live pages using server-normalized live start time.

**Architecture:** Backend `/v1/live-status` exposes `startedAt` from CHZZK `openDate` through the existing shared `LiveStatus` contract. Android and iOS keep display logic local by formatting `now - startedAt`, falling back to the existing live/offline labels when start time is missing.

**Tech Stack:** TypeScript/Fastify/Vitest, Kotlin/JVM tests, SwiftUI/XCTest.

---

### Task 1: Backend live-status startedAt contract

**Files:**
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Test: `backend/stellive-hub-api/test/liveStatus.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("live status route", () => {
  it("returns a startedAt timestamp for current CHZZK live entries", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/live-status" });
    await app.close();

    expect(response.statusCode).toBe(200);
    const statuses = response.json();
    const live = statuses.find((status: { memberId: string }) => status.memberId === "ayatsuno-yuni");
    expect(live).toMatchObject({ isLive: true, platform: "chzzk" });
    expect(live.startedAt).toBe("2026-06-02T09:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm test -- liveStatus`
Expected: FAIL because `/v1/live-status` does not yet return `startedAt`.

- [ ] **Step 3: Implement minimal backend change**

Set the first mock live status item to include deterministic `startedAt: "2026-06-02T09:00:00.000Z"` and a deterministic `platformUrl` to preserve the normalized `LiveStatus` shape.

- [ ] **Step 4: Run green test**

Run: `npm test -- liveStatus`
Expected: PASS.

### Task 2: Android elapsed-time display

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`

- [ ] **Step 1: Write failing test**

```kotlin
@Test
fun liveStatusTextShowsElapsedTimeWhenStartedAtExists() {
    val startedAt = Instant.parse("2026-06-02T09:00:00Z")
    val now = Instant.parse("2026-06-02T10:23:00Z")

    assertEquals("방송 중 · 1시간 23분 진행 중", MainUiPolicy.liveStatusText(true, startedAt, now))
    assertEquals("방송 중", MainUiPolicy.liveStatusText(true, null, now))
    assertEquals("오프라인", MainUiPolicy.liveStatusText(false, startedAt, now))
}
```

- [ ] **Step 2: Run red test**

Run: `./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest`
Expected: FAIL because `MainUiPolicy.liveStatusText` does not exist.

- [ ] **Step 3: Implement minimal Android change**

Add `liveStartedAt: Instant?` to `HubMember`, seed the live mock member, add `MainUiPolicy.liveStatusText`, and call it from `MainActivity.liveMemberTextBlock`.

- [ ] **Step 4: Run green test**

Run: `./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest`
Expected: PASS.

### Task 3: iOS elapsed-time display

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`

- [ ] **Step 1: Write failing test**

```swift
func testLiveStatusTextShowsElapsedTimeWhenStartedAtExists() {
    let startedAt = Date(timeIntervalSince1970: 1_780_390_800)
    let now = Date(timeIntervalSince1970: 1_780_395_780)

    XCTAssertEqual(LiveStatusFormatter.statusText(isLive: true, startedAt: startedAt, now: now), "방송 중 · 1시간 23분 진행 중")
    XCTAssertEqual(LiveStatusFormatter.statusText(isLive: true, startedAt: nil, now: now), "방송 중")
    XCTAssertEqual(LiveStatusFormatter.statusText(isLive: false, startedAt: startedAt, now: now), "오프라인")
}
```

- [ ] **Step 2: Run red test**

Run: `xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
Expected: FAIL because `LiveStatusFormatter` does not exist.

- [ ] **Step 3: Implement minimal iOS change**

Add `liveStartedAt: Date?` to `HubMember`, seed the live mock member, add `LiveStatusFormatter`, and use `TimelineView(.periodic(from: .now, by: 60))` in `LiveMemberRow`.

- [ ] **Step 4: Run green test**

Run: `xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
Expected: PASS.

### Final verification

- [ ] Run backend tests: `npm test`
- [ ] Run Android unit tests: `./gradlew :app:testDebugUnitTest`
- [ ] Run iOS tests: `xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
