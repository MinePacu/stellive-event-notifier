# Firebase FCM 코드 설계

## 기준 문서

- 기능 설계: `docs/FIREBASE_FCM_BOUNDARY_DESIGN.md`
- 관련 이슈: GitHub #26, GitLab #14
- 확인일: 2026-06-13 KST

## 목표

Firebase는 backend push provider 구현에만 존재해야 한다. 이벤트 수집, 정규화, 중복 제거, 설정 해석, queue/retry, fan-out 대상 결정, delivery attempt 기록은 기존 TypeScript 백엔드 모듈이 소유한다.

이 문서는 기능 설계를 코드 단위로 고정한다. 구현자는 새 Firebase 관련 코드를 추가하기 전에 이 문서의 module ownership, import boundary, test contract를 먼저 확인해야 한다.

## 현재 코드 기준

| 책임 | 현재 파일 | 유지할 경계 |
| --- | --- | --- |
| FCM provider client | `backend/stellive-hub-api/src/push/fcmClient.ts` | `firebase-admin/*` import 허용 위치 |
| Push provider abstraction | `backend/stellive-hub-api/src/push/pushSender.ts` | worker가 provider SDK를 직접 알지 않도록 분리 |
| Push payload 생성 | `backend/stellive-hub-api/src/push/pushPayloadFactory.ts` | normalized event + resolved preference만 입력 |
| Notification job 처리 | `backend/stellive-hub-api/src/jobs/notificationWorker.ts` | preference/load policy 이후 provider 호출 |
| Device token 저장 | `backend/stellive-hub-api/src/repositories/deviceRepository.ts` | token lifecycle만 저장, Firebase state 저장 금지 |
| Mobile token API | `backend/stellive-hub-api/src/routes/appRoutes.ts` | `fcm`/`apns_via_fcm` provider token update만 허용 |
| Internal drain API | `backend/stellive-hub-api/src/routes/internalRoutes.ts` | caller payload/device/preference override 금지 |
| Shared mobile contract | `shared/schemas/mobileApi.ts` | token provider enum과 mobile DTO 정의 |
| Android FCM service | `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/notification/StelliveFirebaseMessagingService.kt` | token refresh 및 notification display |
| Android token sync | `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/device/PushTokenSyncer.kt` | backend token registration only |
| iOS API client tests | `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift` | `apns_via_fcm` contract 검증 |

## 모듈 구조

```text
backend/stellive-hub-api/src/
  push/
    fcmClient.ts
    pushSender.ts
    pushPayloadFactory.ts
  jobs/
    notificationWorker.ts
    notificationJobRepository.ts
  repositories/
    deviceRepository.ts
    deliveryAttemptRepository.ts
    eventRepository.ts
    preferenceRepository.ts
  routes/
    appRoutes.ts
    internalRoutes.ts
  config/
    env.ts

shared/schemas/
  mobileApi.ts
  domain.ts

android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/
  notification/StelliveFirebaseMessagingService.kt
  device/PushTokenSyncer.kt
```

`firebase-admin` import는 `push/fcmClient.ts`에만 허용한다. 다른 backend 파일이 Firebase SDK 타입을 직접 import해야 한다면 설계가 잘못된 것이다. 그 경우 `PushSender`, `PushSendResult`, `MinimalPushPayload` 같은 내부 타입으로 추상화해야 한다.

FCM credential은 server-only secret이다. `FCM_SERVICE_ACCOUNT_FILE`이 설정되면 해당 JSON key 파일을 우선 사용하고, 설정되지 않은 경우에만 기존 `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` 조합을 backward-compatible fallback으로 사용한다. 파일이 잘못되었거나 필수 필드가 없으면 split env로 조용히 fallback하지 않고 `fcm_invalid_service_account_file` safe failure로 비활성화한다. Firebase 공식 환경에서는 `GOOGLE_APPLICATION_CREDENTIALS`도 권장 방식으로 참고할 수 있지만, 이 프로젝트가 명시적으로 지원하는 파일 경로 env는 `FCM_SERVICE_ACCOUNT_FILE`이다. JSON key 파일과 그 실제 경로·값은 Git에 커밋하지 않는다.

## Backend 타입 설계

### `FcmClient`

위치: `backend/stellive-hub-api/src/push/fcmClient.ts`

책임:

- Firebase Admin app 초기화.
- FCM message send.
- provider error를 내부 `PushSendResult`로 정규화.
- Firebase 설정 미구성 또는 placeholder 설정 시 disabled-safe client 반환.

인터페이스:

```ts
export type PushSendStatus =
  | "sent"
  | "disabled"
  | "transient_failure"
  | "permanent_token_failure";

export interface PushSendResult {
  status: PushSendStatus;
  providerMessageId?: string;
  providerErrorCode?: string;
  reason?: string;
}

export interface FcmSendInput {
  token: string;
  payload: MinimalPushPayload;
}

export interface FcmClient {
  enabled: boolean;
  send(input: FcmSendInput): Promise<PushSendResult>;
}
```

설계 규칙:

- `projectId`, `clientEmail`, `privateKey`가 모두 configured secret일 때만 enabled 처리한다.
- 빈 문자열, `verify_required`, `replace_with_*` prefix 값은 configured secret이 아니다.
- `privateKey`는 env newline escape만 normalize한다. 파일 경로나 JSON 파일 로딩을 추가하지 않는다.
- provider error는 worker가 정책 판단할 수 있는 내부 status로만 노출한다.
- tests는 `FirebaseMessageSender` fake sender injection을 사용한다.

### `PushSender`

위치: `backend/stellive-hub-api/src/push/pushSender.ts`

책임:

- worker와 provider SDK 사이의 최소 boundary.
- device target과 payload를 받아 provider-independent `PushSendResult` 반환.

인터페이스:

```ts
export interface PushTargetDevice {
  deviceId: string;
  platform: "android" | "ios";
  pushProvider: "fcm" | "apns_via_fcm";
  pushToken: string;
  tokenStatus: "active" | "missing" | "invalid" | "disabled";
  timezone?: string;
  locale?: string;
  appVersion?: string;
}

export interface PushSender {
  sendToDevice(input: {
    device: PushTargetDevice;
    payload: MinimalPushPayload;
  }): Promise<PushSendResult>;
}
```

설계 규칙:

- `FcmPushSender`는 `fcmClient.send({ token, payload })`만 호출한다.
- `PushSender`는 preference, queue, retry, delivery attempt를 알면 안 된다.
- APNs 직접 전송을 추가하더라도 worker 계약은 `PushSender` 그대로 유지한다.

### `MinimalPushPayload`

위치: `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`

책임:

- normalized `PlatformEvent`와 `ResolvedNotificationPreference`를 FCM-compatible 최소 payload로 변환.
- Android priority와 APNs priority를 resolved delivery level 기준으로 결정.

허용 data fields:

```ts
data: {
  eventId: string;
  source: string;
  eventType: string;
  generationId: string;
  memberId: string;
  tapAction: "open_app" | "open_platform";
  appDeepLink: string;
  platformUrl: string;
}
```

금지 fields:

- raw platform payload.
- OAuth token, API token, Firebase service account value.
- production device token.
- image metadata, thumbnail URL, official logo URL, fan art URL, copied media URL.
- user preference snapshot 전체.

priority 규칙:

- `deliveryLevel === "immediate_push"`이고 resolved policy가 realtime/high-priority 전송을 허용할 때만 Android `high`, APNs `"10"`.
- summary/default delivery는 Android `normal`, APNs `"5"`.
- silent data-only high priority push는 만들지 않는다.

## Worker 설계

위치: `backend/stellive-hub-api/src/jobs/notificationWorker.ts`

`NotificationWorker`는 FCM provider 이전과 이후의 모든 정책 상태를 소유한다.

처리 순서:

1. `notificationJobs.claimReady()`로 ready job claim.
2. `platformEvents.findById(job.eventId)`로 normalized event 조회.
3. `devices.listPushTargets()`로 active push target 조회.
4. `preferences.listForDevices(deviceIds)`로 device별 preference 조회.
5. `PreferenceResolutionService.resolve(event, deviceId, preferences)` 호출.
6. `resolveNotificationDelivery(event, resolution)` 호출.
7. push 대상이 아니면 `DeliveryAttempt`에 skipped 기록.
8. push 대상이면 `buildPushPayload({ event, resolution, deliveryLevel })`.
9. `pushSender.sendToDevice({ device, payload })` 호출.
10. provider result에 따라 delivery attempt 기록, token invalidation, retry/backoff, job complete/fail 처리.

금지:

- worker drain route request body에서 payload를 받지 않는다.
- caller-supplied device filter를 받지 않는다.
- caller-supplied preference override를 받지 않는다.
- Firebase topic/condition으로 fan-out 대상을 위임하지 않는다.

provider result handling:

| `PushSendResult.status` | worker 동작 |
| --- | --- |
| `sent` | `DeliveryAttempt.status="sent"`, `providerMessageId` 저장, job complete 후보 |
| `disabled` | `DeliveryAttempt.status="skipped"` 또는 provider disabled reason 기록, job complete 후보 |
| `permanent_token_failure` | `devices.markTokenInvalid()`, `DeliveryAttempt.status="skipped"` 또는 failed-with-permanent reason, job complete 후보 |
| `transient_failure` | `DeliveryAttempt.status="failed"`, retry delay 계산, job requeue 또는 terminal fail |

## Route 설계

### Mobile token route

위치: `backend/stellive-hub-api/src/routes/appRoutes.ts`

Endpoint:

```http
PUT /v1/devices/token
```

Request contract:

```ts
{
  deviceId: string;
  platform: "android" | "ios";
  provider: "fcm" | "apns_via_fcm";
  token: string;
  locale?: string;
  timezone?: string;
  appVersion?: string;
}
```

규칙:

- `token`이 없으면 `400 { error: "device_token_invalid" }`.
- Android 기본 provider는 `fcm`.
- iOS 기본 provider는 `apns_via_fcm`.
- route는 token 저장만 수행한다. provider validation 이상의 Firebase 호출을 하지 않는다.

### Internal worker drain route

위치: `backend/stellive-hub-api/src/routes/internalRoutes.ts`

Endpoint:

```http
POST /v1/internal/jobs/notifications/drain
```

Request contract:

```ts
{
  limit?: number;
}
```

규칙:

- `INTERNAL_API_TOKEN` 인증이 필요하다.
- `limit`만 허용한다.
- event payload, device ids, provider token, preference override, dry-run delivery policy를 body로 받지 않는다.
- route는 `NotificationWorker.drain({ limit, lockedBy })` 위임만 수행한다.

## Repository 설계

### `DeviceRepository`

책임:

- device registration.
- push token update.
- push target listing.
- permanent provider failure 시 token invalidation.

저장 필드:

- `deviceToken`
- `pushProvider`
- `tokenStatus`
- `platform`
- `locale`
- `timezone`
- `appVersion`
- `lastSeenAt`

금지:

- Firebase user id, Firebase auth claim, Firebase topic subscription state 저장.
- service account credential 저장.
- platform raw response 저장.

### `DeliveryAttemptRepository`

책임:

- worker decision 결과 기록.
- provider response metadata의 최소 저장.

허용 provider metadata:

- `providerMessageId`
- `providerErrorCode`
- normalized `reason`
- retry count/status

금지:

- FCM full response object.
- request payload 전체.
- device token 원문 중복 저장.
- raw platform payload.

## Config 설계

위치: `backend/stellive-hub-api/src/config/env.ts`

FCM env:

```env
FCM_SERVICE_ACCOUNT_FILE=
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=
FCM_RATE_LIMIT_ENABLED=true
FCM_SEND_MAX_PER_SECOND=500
FCM_SEND_MAX_PER_MINUTE=30000
FCM_SEND_BURST=1000
```

## Traffic control and hybrid fan-out

- 일반 이벤트는 preference resolution과 load reduction 이후 device token 직접 발송을 유지하며 topic/condition을 금지한다.
- provider 전송 전 in-memory token bucket으로 초·분당 전송량과 burst를 제한한다.
- quota/server unavailable 응답의 `retryAfterMs`가 있으면 worker 기본 1분·5분·15분·60분 backoff보다 우선하며, 기본 backoff에는 주입 가능한 jitter를 적용한다.
- 동일 payload는 `sendEachForMulticast`로 최대 500 token씩 전송하고 결과를 device별 `PushSendResult`와 `DeliveryAttempt`로 다시 분리한다. 검증된 push image URL도 동일 visual field에 유지한다.
- service-wide topic은 `service_all`, `service_incident`, `service_maintenance`, `service_version_update`만 허용한다. caller-supplied topic과 사용자별 fan-out topic은 금지한다.
- topic 공지는 기존 external API log에 scope와 정규화된 provider 결과만 기록하며 payload와 token은 저장하지 않는다. 서비스 공지는 기본 ON이며 global OFF 또는 `serviceAnnouncementsEnabled=false`가 네 allowlisted topic을 모두 해제한다.
- backend는 token 갱신과 preference 저장 후 topic membership을 동기화한다. 모바일은 설정 값을 왕복하지만 Firebase topic API를 직접 호출하지 않는다.
- load reduction context는 `recentPushCandidatesInWindow`, `recentPushCount`, `rateLimiterSaturated` 확장점을 제공하며 이번 변경에서 summary 정책을 바꾸지 않는다.

규칙:

- env parser는 값을 문자열로만 전달한다.
- configured 여부 판단은 `fcmClient.ts`의 `isConfiguredSecret` 규칙과 일치해야 한다.
- `.env.example`에는 이름만 추가하고 실제 secret, service account JSON, private key 원문을 넣지 않는다.
- Firebase 관련 추가 env를 만들 때는 FCM send에 필요한지 검토한다. storage/auth/functions 관련 env는 추가하지 않는다.

## Mobile 코드 설계

### Android

관련 파일:

- `StelliveFirebaseMessagingService.kt`
- `PushTokenSyncer.kt`
- `HubApiModels.kt`
- `HubApiClient.kt`

책임:

- FCM token refresh 수신.
- token을 backend `/v1/devices/token`으로 sync.
- FCM message payload를 최소 data contract로 파싱.
- notification tap action을 `appDeepLink` 또는 `platformUrl`로 처리.

금지:

- Android app에서 Firebase를 backend storage/auth/config로 사용.
- Android app에서 CHZZK/YouTube/Naver protected API 호출.
- push payload에서 꺼진 설정을 되살리는 client-side override.
- copied image asset, logo, fan art를 notification에 포함.

### iOS

관련 파일:

- `HubAPIClientTests.swift`
- iOS push token registration 코드.
- local notification/deep link handler 코드.

책임:

- APNs-via-FCM provider token을 backend에 등록.
- payload의 `tapAction`, `appDeepLink`, `platformUrl` 처리.
- notification display는 backend 최소 payload를 기준으로 수행.

금지:

- Firebase Auth/Firestore/Remote Config를 앱 데이터 권한 또는 설정 원천으로 사용.
- backend preference보다 우선하는 client fan-out filtering.

## Import boundary

허용:

```ts
// backend/stellive-hub-api/src/push/fcmClient.ts only
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
```

금지:

```ts
// routes, jobs, repositories, adapters, events에서 금지
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
```

검증 방식:

```bash
cd backend/stellive-hub-api
rg 'firebase-admin' src
```

expected:

```text
src/push/fcmClient.ts
```

## 테스트 설계

### Unit tests

Create or maintain:

- `backend/stellive-hub-api/test/fcmClient.test.ts`
- `backend/stellive-hub-api/test/pushPayloadFactory.test.ts`
- `backend/stellive-hub-api/test/notificationWorker.test.ts`
- `backend/stellive-hub-api/test/mobileDeviceRoutes.test.ts`

Required cases:

- `createFcmClient` returns disabled client when env is missing.
- `createFcmClient` returns disabled client for `verify_required` and `replace_with_*`.
- fake sender success returns `sent` with `providerMessageId`.
- fake sender transient provider error returns `transient_failure`.
- fake sender invalid-token provider error returns `permanent_token_failure`.
- push payload contains only allowed data fields.
- push payload excludes image metadata and raw payload.
- global off does not call `pushSender.sendToDevice`.
- preference off records skipped delivery attempt.
- transient failure requeues job with retry delay.
- permanent token failure calls `markTokenInvalid`.
- `/v1/devices/token` rejects missing token.
- `/v1/devices/token` accepts `fcm` and `apns_via_fcm`.
- `/v1/internal/jobs/notifications/drain` ignores or rejects fields other than `limit`.

### Integration tests

Backend integration tests must use fake provider dependencies. They must not call Firebase network APIs.

Required route wiring checks:

- `buildApp()` wires `FcmPushSender` only through dependency construction, not route handlers.
- internal drain route delegates to `NotificationWorker`.
- mobile token route delegates to `DeviceRepository.updateToken`.

### Mobile tests

Android:

```bash
cd android/StelliveHubAndroid
./gradlew :app:testDebugUnitTest
```

Required cases:

- token sync sends provider `fcm`.
- missing backend registration keeps token pending for retry.
- notification payload parser tolerates missing optional URLs.

iOS:

Required cases:

- token sync sends provider `apns_via_fcm`.
- deep link handler honors `open_app` and `open_platform`.

## Verification commands

Backend:

```bash
cd backend/stellive-hub-api
npm test -- notification
npm test -- push
npm test -- mobileDeviceRoutes
npm run build
rg 'firebase-admin' src
```

Android:

```bash
cd android/StelliveHubAndroid
./gradlew :app:testDebugUnitTest
```

iOS:

```bash
cd ios/StelliveHubiOS
xcodebuild test -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

## 코드 변경 체크리스트

- [ ] `firebase-admin` import가 `push/fcmClient.ts` 밖으로 확산되지 않는다.
- [ ] `PushSender` interface가 worker와 provider SDK 사이의 유일한 send boundary다.
- [ ] `NotificationWorker`가 preference resolution과 load reduction 이후에만 push sender를 호출한다.
- [ ] internal drain route가 caller payload/device/preference override를 받지 않는다.
- [ ] push payload data field가 allowlist를 벗어나지 않는다.
- [ ] raw platform payload, image metadata, secrets, device token이 push payload에 포함되지 않는다.
- [ ] provider disabled 상태가 test/local 환경에서 안전하게 처리된다.
- [ ] permanent token failure가 token invalidation으로 이어진다.
- [ ] transient failure가 retry/backoff로 이어진다.
- [ ] Android/iOS는 token sync와 display/deep link 처리만 담당한다.
- [ ] Firebase storage/auth/functions/remote config를 MVP backend path에 도입하지 않는다.

## 리팩터링 지침

Firebase 관련 요구가 늘어날 때는 다음 순서로 판단한다.

1. FCM message send 또는 token lifecycle에 필요한가?
2. `FcmClient` 또는 `PushSender` 내부로 제한할 수 있는가?
3. worker, repository, route가 Firebase SDK 타입을 직접 알아야 하는가?
4. preference resolution, queue/retry, delivery audit를 우회하지 않는가?
5. fake sender로 provider network 없이 테스트 가능한가?

3번이 “예”이거나 4번이 “아니오”이면 구현하지 않는다. 백엔드 repository/job/internal route 구조로 다시 설계해야 한다.
