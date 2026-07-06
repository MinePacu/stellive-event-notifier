# CHZZK Unverified Live Display Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure non-verified CHZZK status is never displayed or persisted as confirmed LIVE while preserving verified transition behavior.

**Architecture:** Enforce fail-closed status at the bootstrap boundary, adapter persistence layer, and both mobile mappings. Keep event and transition generation limited to consecutive verified observations, and require concrete live evidence when the upstream list omits an explicit status.

**Tech Stack:** TypeScript/Vitest/Fastify, Kotlin/JUnit, Swift/XCTest, PostgreSQL-backed repository contracts.

---

### Task 1: Bootstrap display sanitization

**Files:**
- Modify: `backend/stellive-hub-api/test/mobileBootstrap.test.ts`
- Modify: `backend/stellive-hub-api/src/mobile/bootstrapService.ts`

- [ ] Add one test containing verified live, verified offline, and `verify_required + isLive=true` rows. Assert the unverified row returns `isLive: false` with `title`, `viewerCount`, and `startedAt` undefined while verified rows are unchanged.
- [ ] Run `rtk npm test -- mobileBootstrap.test.ts` from `backend/stellive-hub-api`; confirm the unverified assertion fails because it remains live.
- [ ] Add `toMobileDisplayLiveStatus(status: LiveStatus): LiveStatus`:

```ts
function toMobileDisplayLiveStatus(status: LiveStatus): LiveStatus {
  if (status.sourceVerificationState === "verified") return status;
  return {
    ...status,
    isLive: false,
    title: undefined,
    viewerCount: undefined,
    startedAt: undefined,
  };
}
```

- [ ] Map the cached rows before returning bootstrap: `liveStatus: liveStatus.map(toMobileDisplayLiveStatus)`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Adapter persistence and transition safety

**Files:**
- Modify: `backend/stellive-hub-api/test/chzzkOpenApiAdapter.test.ts`
- Modify: `backend/stellive-hub-api/src/adapters/chzzk/chzzkOpenApiAdapter.ts`

- [ ] Replace the previous-live/unverified expectation with `isLive: false`, cleared live-only fields, unchanged prior `lastTransitionAt`, `eventsCreated: 0`, and `verifyRequired: 1`. Add a case proving the first verified row after a `verify_required` previous row emits no transition event.
- [ ] Run `rtk npm test -- chzzkOpenApiAdapter.test.ts`; confirm the persistence test fails because previous live is preserved.
- [ ] Remove the `effectiveStatus` previous-live preservation. In `toLiveStatusInput`, calculate transitions only for verified observations and clear unverified live-only fields:

```ts
const isVerified = status.sourceVerificationState === "verified";
const transitioned = isVerified && previous !== null && previous.isLive !== status.isLive;
const lastTransitionAt = transitioned ? now : (previous?.lastTransitionAt ?? undefined);
const isLive = isVerified && status.isLive;
```

- [ ] Extend the local previous-record type to include `sourceVerificationState`, and emit events only when both `previous?.sourceVerificationState === "verified"` and the current status is verified.
- [ ] Run the focused adapter tests and confirm verified live/offline transitions still pass.

### Task 3: Live-list evidence guard and operations guidance

**Files:**
- Modify: `backend/stellive-hub-api/test/chzzkClientAuthLiveList.test.ts`
- Modify: `backend/stellive-hub-api/src/adapters/chzzk/chzzkApiClient.ts`
- Modify: `backend/stellive-hub-api/.env.example`

- [ ] Add a channel-ID-only response test expecting verified offline. Retain the existing status-less title test expecting live.
- [ ] Run `rtk npm test -- chzzkClientAuthLiveList.test.ts`; confirm the channel-only test fails as live.
- [ ] Add a live-evidence predicate using nonblank title, open/start date, or live ID; use it only when explicit status fields are absent.
- [ ] Add an adjacent `.env.example` comment: frequent page-limit `verify_required` results should be investigated with `CHZZK_LIVE_LIST_MAX_PAGES=30–50` while monitoring API usage; keep the default at 5.
- [ ] Re-run the focused client test and `rtk npm run build`.

### Task 4: Android fail-closed mapping

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt`

- [ ] Add an unverified live DTO to the repository fixture and assert its member is offline with null start time, title, viewer count, and platform URL. Keep the verified live assertions.
- [ ] Run `rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ServerHubRepositoryTest`; confirm the new assertions fail.
- [ ] Compute `val displayLive = status.isLive && status.sourceVerificationState == "verified"` and populate live-only domain fields only when `displayLive` is true. Preserve `lastCheckedAt` and channel image metadata as diagnostics/profile data.
- [ ] Re-run the focused Android test and confirm it passes.

### Task 5: iOS fail-closed mapping

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/ServerLiveStatusMappingTests.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`

- [ ] Add an unverified `isLive: true`, nil-title response row and assert the resulting member is offline with no live title, start time, viewer count, or platform URL. Preserve verified live coverage.
- [ ] Run the `StelliveHubiOSTests/ServerLiveStatusMappingTests` XCTest through the discovered shared scheme and an available simulator; confirm the unverified assertions fail.
- [ ] In `applyBootstrap`, calculate `displayLive = status.isLive && status.sourceVerificationState == "verified"`, assign `isLive = displayLive`, and clear live-only fields unless true.
- [ ] Re-run the focused XCTest and confirm it passes.

### Task 6: Cross-layer verification

**Files:**
- Verify all modified source and test files above.

- [ ] Run `rtk npm test` and `rtk npm run build` in `backend/stellive-hub-api`.
- [ ] Run `rtk ./gradlew :app:testDebugUnitTest` in `android/StelliveHubAndroid`.
- [ ] Run the iOS unit-test scheme if a compatible simulator is available; otherwise record the exact environment blocker and retain focused source/test review.
- [ ] Run `rtk git diff --check` and review `rtk git diff --stat` plus targeted diffs for secrets or unrelated changes.
- [ ] Commit implementation and tests with a scoped bug-fix message.
