# Firebase FCM 사용 경계 기능 설계

## 출처

- GitHub issue #26: `Limit Firebase usage to FCM push delivery only`
- GitLab issue #14: `Limit Firebase usage to FCM push delivery only`
- 확인일: 2026-06-13 KST

## 배경

Stellive Notification Hub는 서버 중재형 알림 허브다. 백엔드는 플랫폼 API 접근, 이벤트 수집, 정규화, 중복 제거, 사용자 설정 해석, 알림 작업 처리, 전달 시도 기록을 소유한다. Firebase는 이 구조를 대체하지 않고 Android/iOS 푸시 전송을 위한 Firebase Cloud Messaging(FCM) provider로만 사용한다.

이 설계는 Firebase 사용 범위를 FCM push delivery로 고정해 비용, 벤더 종속, 데이터 경계, 테스트 안정성을 관리하기 위한 기능 구성 문서다.

## 목표

- Firebase 사용을 FCM 푸시 전송 경로로만 제한한다.
- 백엔드가 이벤트 ingestion, normalization, dedupe, preference resolution, queueing, retry, fan-out, delivery attempt recording을 계속 소유한다.
- Android/iOS는 FCM/APNs-via-FCM 토큰을 백엔드에 등록하고, 수신한 최소 payload를 앱 deep link 및 로컬 표시로 처리한다.
- 테스트는 fake push sender를 사용하며 Firebase provider API를 호출하지 않는다.
- FCM 전송은 best effort임을 사용자/운영 정책에 반영하고, 즉시 전달을 보장하지 않는다.

## 비목표

- Firebase를 application backend, primary data store, event store, preference store, job queue로 사용하지 않는다.
- Firestore, Realtime Database, Firebase Auth, Cloud Functions, Cloud Scheduler, Remote Config, Analytics, Crashlytics, Storage를 MVP 알림 백엔드 기능 구성 요소로 도입하지 않는다.
- 일반 이벤트에 Firebase topic/condition fan-out을 사용하거나 사용자 preference resolution을 우회하지 않는다. 예외는 서버 allowlist로 고정된 service-wide announcement topic뿐이다.
- 클라이언트가 CHZZK, YouTube, X, Naver 등 보호된 플랫폼 API를 직접 호출하게 하지 않는다.

## 기능 경계

| 영역 | 소유자 | 허용 | 금지 |
| --- | --- | --- | --- |
| Platform API credentials | Backend | secret-managed env/storage | 모바일 앱 번들 포함 |
| Event ingestion | Backend adapters | official/allowed API, webhook, scheduler | Firebase Functions ingestion |
| Normalization/dedupe | Backend event service/repository | normalized `PlatformEvent`, dedupe key | Firebase DB 기반 dedupe |
| Preference resolution | Backend `PreferenceResolutionService` | global/platform/type/category/member 설정 적용 | FCM topic으로 설정 우회 |
| Queue/retry | Backend `NotificationJob` worker | DB-backed queue, retry/backoff | Firebase queue 대체 |
| Push provider | Backend `PushSender` | FCM send API only | Firebase가 fan-out 대상 결정 |
| Delivery audit | Backend repository | `DeliveryAttempt` 기록 | provider response만으로 상태 판단 |
| Mobile token sync | Android/iOS app | device token 등록/갱신 | 토큰을 Git, 문서, seed에 저장 |

## 런타임 흐름

1. 플랫폼 webhook, scheduler, polling adapter가 raw event를 수신한다.
2. 백엔드 adapter가 DTO를 검증하고 `ingestionService`에 전달한다.
3. `ingestionService`가 catalog 정책, 금지 이벤트, dedupe key를 검증한다.
4. 신규 이벤트만 `PlatformEvent`로 저장하고 `NotificationJob`을 생성한다.
5. `NotificationWorker`가 job을 claim한다.
6. worker가 push target device와 device preference를 조회한다.
7. `PreferenceResolutionService`와 load reduction policy가 실제 전달 수준을 결정한다.
8. push 전송 대상인 경우 `pushPayloadFactory`가 최소 payload를 생성한다.
9. `FcmPushSender`가 `FcmClient`를 통해 FCM send API를 호출한다.
10. worker가 sent/skipped/failed 결과를 `DeliveryAttempt`로 기록하고, transient failure는 retry/backoff 처리한다.

FCM은 9번 단계의 provider adapter일 뿐이며, 1-8번과 10번의 정책/상태 변경을 소유하지 않는다.

## 허용되는 Firebase 사용

- `firebase-admin/messaging`을 통한 서버 측 FCM message send.
- `FCM_SERVICE_ACCOUNT_FILE` JSON 로딩과 split env fallback은 Firebase provider boundary 내부에만 둔다. JSON key 파일은 server-only secret이며 Git에 커밋하지 않는다.
- Android FCM registration token 수신 및 백엔드 등록.
- iOS APNs-via-FCM token/provider 사용. 단, iOS payload도 백엔드 정책 결과로만 생성한다.
- FCM provider error normalization:
  - permanent token failure: device token invalid 처리.
  - transient failure: job retry/backoff.
  - disabled/not configured: provider disabled 상태로 안전하게 skip 또는 fail 기록.
- 로컬/테스트 환경에서 Firebase env가 비어 있거나 placeholder이면 provider disabled 상태를 반환한다.

## 금지되는 Firebase 사용

- Firestore/Realtime Database를 event, device, preference, job, delivery attempt primary storage로 사용.
- Firebase Auth를 사용자/디바이스 권한의 필수 백엔드 인증 체계로 사용.
- Cloud Functions/Cloud Scheduler로 ingestion, notification worker, retry, fan-out 책임을 이전.
- Remote Config로 알림 정책, preference, feature flag의 authoritative source를 대체.
- Analytics/Crashlytics/Storage 등 FCM 외 Firebase SDK를 MVP 알림 기능 요구로 추가.
- FCM topics/conditions로 세대, 멤버, 플랫폼, 이벤트 타입별 fan-out을 직접 처리.
- allowlist 밖 topic 또는 caller가 직접 지정한 topic 문자열 전송.

## Service-wide announcement exception

- 일반 이벤트는 backend가 device token 직접 fan-out하며 device별 preference, quiet hours, keyword block, rate limit을 계속 적용한다.
- 내부 인증 route는 `service_all`, `service_incident`, `service_maintenance`, `service_version_update`만 topic으로 전송할 수 있다.
- topic 공지는 device-level `DeliveryAttempt`와 혼합하지 않는다. provider-level audit persistence는 별도 DB 설계가 필요한 후속 TODO다.
- 서비스 공지는 기본 ON이며 global OFF 또는 `serviceAnnouncementsEnabled=false`이면 backend가 네 topic에서 token을 해제한다. 모바일은 임의 topic을 직접 구독하지 않으며 멤버·세대·플랫폼·이벤트 타입 topic은 계속 금지한다.
- provider payload에 raw platform response, secrets, production device token, image binary, official logo, fan art, screenshot, copied media URL metadata를 포함.

## 백엔드 구성

관련 경계는 다음 모듈을 기준으로 유지한다.

- `backend/stellive-hub-api/src/push/fcmClient.ts`
  - Firebase Admin SDK 초기화와 FCM provider error normalization만 담당한다.
  - Firebase config가 없거나 placeholder이면 disabled-safe client로 동작한다.
- `backend/stellive-hub-api/src/push/pushSender.ts`
  - provider adapter interface를 제공한다.
  - 현재 구현은 `FcmPushSender`이며 worker는 provider 세부 구현을 알지 않는다.
- `backend/stellive-hub-api/src/push/pushPayloadFactory.ts`
  - normalized event와 resolved preference에서 최소 push payload를 만든다.
  - image metadata, raw payload, secret, credential, 불필요한 platform payload를 포함하지 않는다.
- `backend/stellive-hub-api/src/jobs/notificationWorker.ts`
  - job claim, preference resolution, load reduction, send, delivery attempt recording, retry/backoff를 소유한다.
  - caller-supplied payload, caller-supplied device filter, preference override를 받지 않는다.

## 모바일 구성

Android/iOS 앱은 푸시 provider token lifecycle과 사용자 표시를 담당한다.

- 앱 시작 또는 token refresh 시 backend device API에 token을 등록/갱신한다.
- payload의 `eventId`, `source`, `eventType`, `memberId`, `generationId`, `tapAction`, `appDeepLink`, `platformUrl`만 신뢰한다.
- 백그라운드 전달은 OS/FCM/APNs 정책에 따른 best effort로 처리한다.
- foreground 상태에서는 backend foreground stream 또는 refresh API를 사용할 수 있으나, FCM을 실시간 데이터 동기화 채널로 사용하지 않는다.
- 사용자가 꺼둔 global/platform/event type/generation/member 설정은 클라이언트 표시 단계에서도 되살리지 않는다.

## 환경 변수

FCM provider는 다음 backend-only env를 사용한다.

```env
FCM_SERVICE_ACCOUNT_FILE=
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=
```

규칙:

- 실제 service account 값은 secret manager 또는 배포 환경 변수에만 둔다.
- `.env.example`에는 빈 값 또는 placeholder만 둔다.
- `verify_required`, `replace_with_*`, 빈 문자열은 configured secret으로 취급하지 않는다.
- production device token, Firebase service account JSON, private key 원문을 Git에 커밋하지 않는다.

## 전달 정책

- FCM/APNs/Android/iOS delivery는 best effort다.
- `realtime_best_effort`는 이미 허용된 이벤트의 delivery strategy만 조정한다.
- global off, quiet hours, keyword block, rate limit, platform off, event type off, generation/member off는 FCM 우선순위보다 항상 우선한다.
- high priority push는 policy 결과가 immediate push이고 realtime/load policy가 허용한 경우에만 사용한다.
- silent data-only high priority push로 OS 정책이나 사용자 설정을 우회하지 않는다.

## 테스트 계약

필수 테스트는 provider network 없이 실행되어야 한다.

- `fcmClient`:
  - Firebase env 미설정/placeholder 시 disabled-safe 결과를 반환한다.
  - injected fake sender로 success, transient failure, permanent token failure를 검증한다.
- `pushPayloadFactory`:
  - payload가 최소 필드만 포함한다.
  - image metadata, raw platform payload, secret-like field를 포함하지 않는다.
- `NotificationWorker`:
  - global off와 preference off는 push sender 호출 없이 skipped delivery attempt를 기록한다.
  - transient provider failure는 job을 retry/backoff 상태로 둔다.
  - permanent token failure는 device token invalid 처리 후 delivery attempt를 기록한다.
  - fake push sender만 사용하며 Firebase provider API를 호출하지 않는다.
- API route tests:
  - device token 등록/갱신 DTO가 provider=`fcm` 또는 `apns_via_fcm`만 허용한다.
  - notification worker drain route는 caller payload나 preference override를 받지 않는다.

권장 검증 명령:

```bash
cd backend/stellive-hub-api
npm test -- notification
npm test -- push
npm run build
```

## 수용 기준

- Firebase 관련 production code path가 `push/fcmClient.ts`와 provider adapter 경계 밖으로 확산되지 않는다.
- backend ingestion, dedupe, preference, queue, retry, delivery attempt 저장소가 Firebase에 의존하지 않는다.
- Firebase가 비활성화된 환경에서도 backend build/test가 통과하고, worker가 disabled provider 상태를 안전하게 처리한다.
- FCM payload는 normalized event id/link/action 중심의 최소 payload이며 raw provider payload를 전달하지 않는다.
- 모든 push delivery는 preference resolution과 load reduction policy 이후에만 수행된다.
- 문서와 OpenAPI/env 예시는 Firebase를 FCM 전송 provider로만 설명한다.

## 구현 체크리스트

- [ ] 새 Firebase SDK 의존성을 추가할 때 FCM send/token lifecycle에 필요한지 확인한다.
- [ ] Firebase 관련 코드를 추가하면 `push/*` provider 경계 안에 둘 수 있는지 먼저 검토한다.
- [ ] storage, auth, scheduler, queue 요구가 생기면 Firebase가 아니라 기존 backend repository/job/internal route 구조로 설계한다.
- [ ] push payload 변경 시 `pushPayloadFactory` 테스트에 금지 필드 부재 검증을 추가한다.
- [ ] worker 변경 시 fake sender 기반 success/skipped/transient/permanent failure 테스트를 갱신한다.
- [ ] Android/iOS 변경 시 token sync와 notification display만 담당하는지 확인한다.
- [ ] 사용자 설정, quiet hours, rate limit, realtime best effort가 FCM 우선순위보다 먼저 적용되는지 검증한다.
