Implementation Plan
> REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Android/iOS bootstrap treat reachable backend as connected, not fallback failure.

**Architecture:** Align mobile DTOs with the real `/v1/bootstrap` response from `192.168.50.9:4000`. Add temporary decode/error visibility only if needed, then remove noisy diagnostics.

**Tech Stack:** Fastify TypeScript backend, Android Kotlin Retrofit/Moshi, iOS Swift URLSession/Codable.

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Test: Android install/debug device, iPhone 17 simulator

**Steps:**
- [ ] Capture one real bootstrap JSON sample and compare only top-level required keys/types.
- [ ] Make missing backend fields optional/defaulted: `serverTime`, `foregroundRealtimeEnabled`, `liveStatus`, `hubCalendarWidgetSnapshot`.
- [ ] Support current top-level catalog shape: `members`/`generations`, plus existing `catalog` if present.
- [ ] Ensure empty `liveStatus` means `서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음`.
- [ ] Ensure device registration failure does not mark bootstrap failure.
- [ ] Add one focused Android/iOS decode test or temporary log if failure remains.
- [ ] Build/install Android with `GRADLE_USER_HOME=.gradle ./gradlew :app:installDebug --offline --quiet`.
- [ ] Build/install iOS on iPhone 17 simulator with `xcodebuild` and `simctl install`.
- [ ] Verify both apps show server-connected state when polling is disabled.
- [ ] Remove temporary diagnostics and update docs only if route/env guidance changes.

**Verification commands:**
```bash
curl -s "http://192.168.50.9:4000/v1/bootstrap?platform=android"
cd android/StelliveHubAndroid && GRADLE_USER_HOME=../../.gradle ./gradlew :app:installDebug --offline --quiet
xcodebuild -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -configuration Debug -destination "platform=iOS Simulator,name=iPhone 17" build
```
