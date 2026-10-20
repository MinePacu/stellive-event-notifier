# FCM Topic 발송·구독 감사 기록 설계

상태: 설계 초안(계획). 이 문서의 코드·스키마는 아직 구현되지 않았다.
기준 문서: `docs/FIREBASE_FCM_BOUNDARY_DESIGN.md`(Service-wide announcement exception), `docs/SERVICE_ANNOUNCEMENTS.md`, `docs/PRIVACY_AND_TERMS.md`.

## 목적

경계 설계 문서는 topic 공지를 device-level `DeliveryAttempt`와 섞지 않고, provider-level 감사 기록은 별도 설계로 미뤘다. 이 문서는 실제로 무엇이 이미 기록되고 무엇이 빠져 있는지 확인한 뒤, 가장 작은 보완안을 정한다. 새 시스템을 만들지 않고 기존 테이블 재사용을 우선한다.

## 현재 기록 현황

모든 경로는 `backend/stellive-hub-api/` 기준이다.

| 동작 | 현재 기록 | 근거 |
| --- | --- | --- |
| 관리자 공지 발송 요청 | `ServiceAnnouncementPushAttempt`(status `queued`, `requestedBy`, `eventId`)와 `ServiceAnnouncementAuditLog` | `src/announcements/serviceAnnouncementAdminService.ts:198`, `prisma/schema.prisma:690`, `:711` |
| 발송 완료 | attempt를 `sent`/`skipped`/`failed`로 갱신하고 `providerErrorCode`, `retryAfterMs`, `completedAt`, `ServiceAnnouncement.pushStatus`를 저장 | `src/announcements/serviceAnnouncementRepository.ts:341-366`, `src/jobs/notificationWorker.ts:376-385` |
| 관리자 조회 | 공지별 attempt 최근 100건, audit 최근 100건 | `serviceAnnouncementRepository.ts:377`, `:325` |
| topic 단건 발송 호출 | `ExternalApiCallLog`에 `source=fcm`, `operation=service_announcement:<scope>`, 결과 상태, 오류 코드/사유 | `src/push/serviceAnnouncement.ts:53-83` (`fcmClient.sendToTopic`: `src/push/fcmClient.ts:268`) |
| topic 구독/해제 | 기록 없음. `ServiceTopicSyncResult`는 호출자에게 반환만 되고 reconcile 워커는 stdout JSON 요약 한 줄만 출력 | `src/push/fcmClient.ts:283`, `src/push/serviceTopicReconciliation.ts:52-91`, `src/workers/serviceTopicReconcileWorker.ts:25-27` |
| 레거시 topic 정리 | stdout 요약(scanned/cleaned/failed/retried)만 | `src/push/legacyServiceTopicCleanup.ts:11-47` |
| 보존 정리 | `ExternalApiCallLog`만 `EXTERNAL_API_LOG_RETENTION_DAYS`(기본 31, 14~365)로 prune. `ServiceAnnouncementPushAttempt`/`AuditLog`는 prune 없음 | `src/config/env.ts:72`, `src/routes/internalRoutes.ts:382-386`, `src/repositories/externalApiCallLogRepository.ts:267` |

### 코드 확인 결과 중요한 사실

- 현재 운영 경로의 서비스 공지 발송은 `PlatformEvent` + `NotificationJob`을 거치는 device fan-out이다(`serviceAnnouncementAdminService.ts:198-206`). 따라서 이 경로의 device별 결과는 기존 `DeliveryAttempt`에 남는다.
- `ServiceAnnouncementSender`(topic 발송)는 테스트 외에 호출하는 운영 코드가 없다. `routes.ts:91`의 `serviceTopicSubscriptions`는 deprecated 표시이며 모바일 route는 더 이상 topic sync를 호출하지 않는다. 즉 topic 경로는 사실상 reconcile/cleanup CLI 워커만 남아 있다. 경계 문서의 "topic 공지" 서술이 현재 코드보다 앞서 있거나 뒤처져 있을 수 있어, 구현 전에 이 점을 확정해야 한다(결정 필요 1).
- main 기준 보존 패턴은 repository의 `pruneOlderThan` + 내부 admin prune route + 환경변수 일수다. PR #181은 `DeliveryAttempt`와 `ExternalApiCallLog`를 주기적으로 정리하는 `src/jobs/logRetentionScheduler.ts`(advisory lock, `LOG_RETENTION_ENABLED`)를 추가한다.

## 공백

1. topic 단건 발송은 `ExternalApiCallLog`로 이미 호출 단위 감사가 되지만, 공지(`announcementId`)와 연결되지 않는다. `ServiceAnnouncementPushAttempt.topic`/`providerMessageId` 필드는 있으나 topic 경로에서 채우는 코드가 없다.
2. 구독/해제/정리 작업은 영속 기록이 없다. 실패한 topic 이름(`failedTopics`)과 집계 결과를 사후에 볼 수 없다.
3. `ServiceAnnouncementPushAttempt`와 `ServiceAnnouncementAuditLog`에 보존 정책이 없다.

topic 발송 감사는 공백이 작다(연결과 보존). 실질적 공백은 구독 작업 기록과 보존이다.

## 설계

원칙: 새 테이블은 구독 작업 집계 한 개만 추가하고, 발송은 기존 모델을 확장한다.

### 1. topic 발송: 기존 모델 재사용

`ServiceAnnouncementPushAttempt`를 그대로 쓴다. topic 경로가 다시 사용될 때 `topic`, `providerMessageId`, `providerErrorCode`를 채우고 `ExternalApiCallLog`는 호출 수준 보조 기록으로 둔다. 스키마 변경 없음. `DeliveryAttempt`에는 topic 발송을 기록하지 않는다(경계 문서 유지).

### 2. 구독 작업: 집계 단위 기록 (계획)

device/token 단위가 아니라 실행(run) 단위로 기록한다. device ID도 저장하지 않는다.

```prisma
// 계획: 아직 schema.prisma에 없음
model ServiceTopicSyncRun {
  id             String    @id @default(cuid(2))
  kind           String    // "reconcile" | "legacy_cleanup"
  status         String    // "completed" | "partial" | "failed" | "fcm_disabled"
  processed      Int       @default(0)
  synced         Int       @default(0)
  tokenMissing   Int       @default(0)
  disabled       Int       @default(0)
  transientFailure Int     @default(0)
  retries        Int       @default(0)
  failedTopicCounts Json?  // { "service_all": 3, ... } 토픽 허용 목록 키만
  startedAt      DateTime
  completedAt    DateTime?
  createdAt      DateTime  @default(now())

  @@index([kind, startedAt])
  @@index([startedAt])
}
```

기록 항목은 기존 `ServiceTopicReconciliationSummary`/`LegacyServiceTopicCleanupSummary` 필드와 1:1이다. 새 계산은 없다.

### 금지 항목

- device token, deviceId, 사용자 식별자, 사용자별 preference 값을 저장하지 않는다.
- raw FCM 응답/예외 메시지를 저장하지 않는다. 오류는 `normalizeProviderError`가 정규화한 코드(`providerErrorCode`)만 저장한다.
- topic 이름은 허용 목록 4개 값만 저장한다.

## 보존 기간

기존 패턴(repository `pruneOlderThan` + 내부 prune route + env 일수)을 따르고, PR #181 머지 후에는 `logRetentionScheduler`의 정리 대상에 추가해 자동으로 정리한다.

- `ServiceTopicSyncRun`: 기본 90일. 새 env `SERVICE_TOPIC_AUDIT_RETENTION_DAYS`(기본 90, 범위 30~365).
- `ServiceAnnouncementPushAttempt`: 공지 삭제 시 cascade되는 운영 기록이므로 기본은 prune하지 않는다. 필요하면 같은 일수로 `requestedAt` 기준 prune을 추가한다(결정 필요 3).
- `ServiceAnnouncementAuditLog`는 변경하지 않는다.
- `PRIVACY_AND_TERMS.md`의 "server-side delivery attempts는 retention-limited" 규칙과 맞추기 위해 90일을 상한 기본값으로 제안한다.

## 어드민 조회 범위

- 기존 공지별 attempt 조회(`listPushAttempts`)는 변경 없음.
- `ServiceTopicSyncRun` 최근 N건 조회 한 개(`kind` 필터, 최대 100건), 내부 인증 admin route 아래에 둔다. 집계 수치와 시각만 노출하고 token·deviceId는 없다.
- 공개 API DTO에는 topic 이름과 감사 기록을 노출하지 않는다.

## 구현 단계

1. (결정 필요 1 확정 후) 경계 문서의 topic 서술을 현재 코드와 맞춘다.
2. `ServiceTopicSyncRun` 마이그레이션과 repository(`record`, `listRecent`, `pruneOlderThan`).
3. reconcile/cleanup 워커가 종료 시 요약을 저장한다. 저장 실패는 워커 결과에 영향을 주지 않는다(로그만).
4. env 일수와 내부 prune route, 어드민 조회 route.
5. topic 발송 경로를 다시 쓰는 경우에만 `ServiceAnnouncementSender`가 attempt의 `topic`/`providerMessageId`를 채우도록 연결한다.
6. 테스트: repository prune 경계, 요약 저장, token 미저장 확인, 저장 실패 시 워커 무영향.

## 범위 밖

- device/token 단위 구독 이력, per-user 알림 이력.
- `DeliveryAttempt` 스키마 변경 또는 topic 결과 혼합.
- topic 확대(멤버·세대·플랫폼·이벤트 타입 topic은 계속 금지).
- 외부 감사 로그 시스템, 대시보드·알림.

## 결정 필요

1. topic 단건 발송 경로(`ServiceAnnouncementSender`)를 폐기할지, 재사용할지. 폐기라면 단계 5와 발송 쪽 설계는 불필요하고 경계 문서의 topic 서술을 정리한다.
2. 구독 작업 기록을 새 테이블(`ServiceTopicSyncRun`)로 둘지, 비용을 줄여 stdout 로그 + 기존 로그 수집에 맡길지.
3. `ServiceAnnouncementPushAttempt` prune 여부와 보존 일수(제안: 90일).
4. 어드민 콘솔 UI까지 포함할지, 내부 API 조회만 둘지.

## 수용 기준

- 구독 reconcile/cleanup 실행마다 집계 1건이 저장되고, 저장 실패가 워커 종료 코드에 영향을 주지 않는다.
- 저장 데이터에 token, deviceId, 사용자 식별자, raw FCM 응답이 없다(테스트로 확인).
- 보존 일수를 초과한 기록이 prune route로 삭제된다.
- `DeliveryAttempt` 스키마와 동작이 변경되지 않는다.
- 경계 문서와 `docs/codemaps/docs.md`가 이 문서를 가리킨다.
