# 굿즈/이벤트 일정 어드민 CRUD 설계

대상 이슈: GitHub #16, GitLab #9 `[backend][admin] 굿즈/이벤트 일정 어드민 CRUD 구현`

작성일: 2026-06-11

## 배경

`굿즈/행사` 데이터는 현재 mock 또는 in-memory 성격이 강하다. 어드민 콘솔에서 공식 출처 기반의 굿즈, 티켓팅, 오프라인 행사 일정을 등록하고 수정하며, 모바일 앱은 서버 저장소에 저장된 정규화된 `HubEvent`만 조회해야 한다.

이 기능은 기존 `HubEvent` read API, 캘린더, 위젯 스냅샷을 서버 저장소 기반으로 전환하기 위한 운영 도구다. 어드민 CRUD는 사용자 알림 정책, 프로젝트 카탈로그 정책, 출처 및 자산 정책을 우회할 수 없다.

## 목표

- 어드민 콘솔에서 이미지 없이도 `HubEvent`를 생성, 수정, 게시, 취소, 비활성화, 삭제 처리할 수 있다.
- 등록된 일정은 DB 또는 서버 저장소에 저장되고 기존 모바일 read API에서 조회된다.
- 카테고리, 상태, 기간, 출처 URL, 판매 URL, 티켓 URL, 세대/멤버 연결, 알림 대상 여부를 입력하고 검증한다.
- 모든 변경은 audit log로 남긴다.
- Former member, Gangzi/gamja, official YouTube live, 무단 이미지/로고/포스터 필드 등 프로젝트 금지 항목을 서버에서 차단한다.

## 비목표

- 공개 인터넷 크롤링, private cafe 수집, 로그인 쿠키 기반 수집, 플랫폼 우회 접근을 구현하지 않는다.
- 이미지 업로드, 공식 로고, 상품 이미지, 포스터, 프로필 이미지 저장 기능을 제공하지 않는다.
- 공개 사용자가 직접 이벤트를 등록하는 기능을 만들지 않는다.
- 어드민 CRUD가 선호도 해석, quiet hours, rate limit, load reduction, push worker를 우회해 즉시 푸시를 발송하지 않는다.
- Routine livestream, YouTube upload, ordinary X post를 `굿즈/행사`로 등록하지 않는다.

## 현재 구조

- 공유 도메인에는 `HubEvent`, `HubEventCategory`, `HubEventStatus`, `HubEventSourceType`이 있다.
- 백엔드는 `HubEventService`에서 in-memory seed를 정렬, 필터링하고 `effectiveStatus`를 계산한다.
- `hubEventPolicy`는 source, category, status, catalog scope, asset field를 검증한다.
- 모바일 read API는 `GET /v1/hub-events`, `GET /v1/hub-events/:id`, `GET /v1/hub-events/summary`, `GET /v1/hub-events/calendar`, `GET /v1/hub-events/widget-snapshot` 계열을 사용한다.
- Prisma schema에는 `HubEvent` 저장 모델이 이미 계획되어 있으나, 어드민 게시 상태와 audit log 모델이 별도로 필요하다.

## 핵심 설계

공개 이벤트 상태와 어드민 게시 상태를 분리한다.

- `HubEvent.status`: 사용자에게 보이는 일정 생명주기다. `announced`, `upcoming`, `open`, `closing_soon`, `ended`, `cancelled`만 허용한다.
- `HubEvent.publicationState`: 운영 상태다. `draft`, `published`, `inactive`, `deleted`를 사용한다.
- 모바일 read API, 캘린더, 위젯은 `publicationState = "published"`이고 `deletedAt`이 없는 이벤트만 반환한다.
- 취소는 공개 정보가 필요한 경우 `status = "cancelled"`로 게시 상태를 유지한다.
- 비활성화는 잘못 등록되었거나 더 이상 노출하면 안 되는 이벤트를 `publicationState = "inactive"`로 숨긴다.
- 삭제는 기본적으로 soft delete다. `deletedAt`과 audit log를 남긴 뒤 read API에서 제외한다.

Hard delete는 로컬 개발 seed 정리나 아직 게시되지 않은 draft에만 제한적으로 허용한다. 운영 데이터는 감사 추적과 알림 중복 방지를 위해 soft delete를 기본값으로 한다.

## 데이터 모델

기존 `HubEvent` 저장 모델에 다음 운영 필드를 추가한다.

```prisma
model HubEvent {
  id                   String   @id
  category             String
  participationMode    String
  status               String
  title                String
  summary              String?
  memberId             String?
  generationId         String
  sourceUrl            String
  sourceLabel          String
  sourceType           String
  announcedAt          DateTime?
  startsAt             DateTime?
  endsAt               DateTime?
  purchaseUrl          String?
  ticketUrl            String?
  venueName            String?
  venueAddress         String?
  notificationEligible Boolean  @default(true)

  publicationState     String   @default("draft")
  publishedAt          DateTime?
  cancelledAt          DateTime?
  deactivatedAt        DateTime?
  deletedAt            DateTime?
  revision             Int      @default(1)
  createdBy            String?
  updatedBy            String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([publicationState, deletedAt])
  @@index([status])
  @@index([category])
  @@index([participationMode])
  @@index([generationId])
  @@index([memberId])
  @@index([startsAt])
  @@index([endsAt])
  @@index([updatedAt])
}
```

Audit log는 별도 append-only 테이블로 둔다.

```prisma
model HubEventAuditLog {
  id          String   @id @default(cuid(2))
  hubEventId  String
  action      String
  actorId     String?
  reason      String?
  before      Json?
  after       Json?
  createdAt   DateTime @default(now())

  @@index([hubEventId, createdAt])
  @@index([action, createdAt])
}
```

`before`와 `after`에는 normalized event 필드만 저장한다. 토큰, 내부 인증값, raw provider payload, 개인 연락처, 디바이스 토큰은 저장하지 않는다.

## API 설계

어드민 API는 same-origin `/admin` 콘솔과 제한된 maintainer workflow 전용이다. `ADMIN_CONSOLE_ENABLED`, `ADMIN_CONSOLE_TOKEN`, `INTERNAL_API_TOKEN` 정책을 따른다. 공개 CORS를 열지 않는다.

```text
GET    /v1/admin/hub-events
POST   /v1/admin/hub-events
GET    /v1/admin/hub-events/:id
PUT    /v1/admin/hub-events/:id
POST   /v1/admin/hub-events/:id/publish
POST   /v1/admin/hub-events/:id/cancel
POST   /v1/admin/hub-events/:id/deactivate
DELETE /v1/admin/hub-events/:id
GET    /v1/admin/hub-events/:id/audit-log
POST   /v1/admin/hub-events/validate
```

`GET /v1/admin/hub-events` 필터:

```text
publicationState=draft|published|inactive|deleted
status=announced|upcoming|open|closing_soon|ended|cancelled
category=online_goods|online_collab|offline_concert|offline_collab|offline_popup|ticketing
generationId=<catalog generation id>
memberId=<catalog member id>
from=<ISO datetime>
to=<ISO datetime>
query=<title/source label search>
includeDeleted=false
cursor=<opaque cursor>
limit=<number>
```

생성은 기본적으로 draft를 만든다.

```json
{
  "category": "online_goods",
  "participationMode": "online",
  "status": "announced",
  "title": "공식 예약 굿즈",
  "summary": "공식 출처 기반 예약 판매 일정",
  "generationId": "official",
  "memberId": null,
  "sourceUrl": "https://example.com/source",
  "sourceLabel": "Stellive Official",
  "sourceType": "official",
  "announcedAt": "2026-06-11T00:00:00.000Z",
  "startsAt": "2026-06-20T09:00:00.000Z",
  "endsAt": "2026-06-30T14:59:00.000Z",
  "purchaseUrl": "https://example.com/store",
  "ticketUrl": null,
  "venueName": null,
  "venueAddress": null,
  "notificationEligible": true,
  "changeReason": "initial registration"
}
```

응답은 normalized `HubEvent`, `publicationState`, `revision`, validation warnings를 포함한다. 모바일 public API에는 `publicationState`, audit data, actor fields를 노출하지 않는다.

## 상태 전이

허용되는 운영 상태 전이는 다음과 같다.

```text
draft -> published
draft -> deleted
published -> inactive
published -> deleted
published -> published(updated revision)
published -> published(status=cancelled)
inactive -> published
inactive -> deleted
published(status=cancelled) -> inactive
```

`cancel` 액션은 `status = "cancelled"`와 `cancelledAt`을 설정한다. `deactivate`는 `publicationState = "inactive"`로 숨기지만 공개 일정 상태를 바꾸지 않는다. `DELETE`는 `publicationState = "deleted"`와 `deletedAt`을 설정한다.

게시 이후 title, source, date window, generation/member, notification eligibility가 바뀌면 `revision`을 증가시키고 `event_updated` 후보를 만든다. 단, 실제 푸시 여부는 기존 선호도 해석과 load reduction 결과에 따른다.

## 검증 규칙

서버는 create, update, publish, validate에서 동일한 validator를 사용한다.

- `title`, `category`, `participationMode`, `status`, `generationId`, `sourceUrl`, `sourceLabel`, `sourceType`은 필수다.
- `sourceType`은 `official`, `member`, `official_collab`만 허용한다.
- `category`는 `online_goods`, `online_collab`, `offline_concert`, `offline_collab`, `offline_popup`, `ticketing`만 허용한다.
- `status`는 공개 `HubEventStatus` 값만 허용한다. Draft 여부는 `publicationState`로만 표현한다.
- `memberId`가 있으면 active 또는 upcoming catalog entry여야 한다.
- Former member, unknown member, `memberId = "gangzi"`, `generationId = "gamja"`는 거부한다.
- 공식 프로젝트 이벤트는 `generationId = "official"`과 `memberId = null`을 허용한다.
- `sourceUrl`, `purchaseUrl`, `ticketUrl`은 HTTPS URL이어야 한다. localhost/dev 예외는 test fixture와 local seed에만 제한한다.
- `startsAt`과 `endsAt`이 모두 있으면 `startsAt <= endsAt`이어야 한다.
- 게시 가능한 이벤트는 `announcedAt`, `startsAt`, `endsAt` 중 하나 이상의 날짜가 있어야 한다.
- `event_sales_open` 후보는 `startsAt`이 있을 때만 만든다.
- `event_deadline_soon` 후보는 `endsAt`이 있을 때만 만들며 MVP 기본 window는 24시간이다.
- 이미지, 로고, 포스터, 썸네일, 프로필 이미지, copied CDN asset URL 필드는 요청 body에 있어도 거부한다.
- official YouTube live scheduled/started/ended 성격의 입력은 `HubEvent`로 저장하지 않는다.
- Fan-hosted event, private/community-only source, unauthorized repost, regular livestream/upload/social post는 거부한다.

검증 실패 응답은 field path와 machine-readable reason을 반환한다.

```json
{
  "valid": false,
  "errors": [
    {
      "field": "memberId",
      "reason": "member_not_allowed",
      "message": "MVP hub events can reference only active or upcoming members."
    }
  ]
}
```

## 알림 동작

어드민 API는 푸시를 직접 발송하지 않는다. 모든 알림은 normalized `PlatformEvent` 후보 생성 후 기존 preference resolution, quiet hours, keyword rules, rate limit, load reduction, push worker를 통과해야 한다.

- Draft 생성: 알림 없음.
- Publish: `notificationEligible = true`이면 `event_announced` 후보를 만든다.
- Publish 시점에 이미 판매 기간이 열려 있고 `startsAt`이 과거면 `event_sales_open`을 중복 없이 후보로 만들 수 있다.
- `startsAt` 도달: `event_sales_open` 후보를 만든다.
- `endsAt - 24h` 도달: `event_deadline_soon` 후보를 만든다.
- Cancel: `event_cancelled` 후보를 만든다.
- Material update: `event_updated` 후보를 만든다. 기본 사용자 설정은 disabled다.

`HubEvent` 기반 `PlatformEvent`는 `source = "hub_event"`, `deliveryMode = "standard"`, `realtimeEligible = false`로 생성한다. `realtime_best_effort`는 이 이벤트들을 즉시성 보장 이벤트로 승격하지 않는다.

dedupe key 예시:

```text
hub_event:<hubEventId>:event_announced:<revision>
hub_event:<hubEventId>:event_sales_open:<startsAt>
hub_event:<hubEventId>:event_deadline_soon:<endsAt>:24h
hub_event:<hubEventId>:event_cancelled:<cancelledAt>
hub_event:<hubEventId>:event_updated:<revision>
```

## 어드민 콘솔 UI

`/admin` 콘솔에 `굿즈/행사` 관리 화면을 추가한다.

목록 화면:

- publication state, 공개 status, category, generation/member, date window, validation state, updatedAt을 표시한다.
- draft, published, inactive, deleted 필터를 제공한다.
- 제목과 source label 검색을 제공한다.
- deleted 항목은 기본 숨김이며 `includeDeleted`를 켰을 때만 표시한다.

폼 화면:

- 제목, 요약, 카테고리, 참여 방식, 공개 상태, 세대, 멤버, 출처 URL, 출처 라벨, 출처 타입, 발표일, 시작일, 종료일, 판매 URL, 티켓 URL, 장소명, 장소 주소, 알림 대상 여부를 입력한다.
- 이미지 업로드, 로고 URL, 포스터 URL 입력 필드는 만들지 않는다.
- 공식 출처와 프로젝트 금지 항목 체크 결과를 저장 전 validation panel로 보여준다.
- 게시 전 preview는 모바일 read DTO와 같은 shape를 사용한다.

액션:

- `Save draft`: draft 저장.
- `Publish`: 검증 통과 시 published로 전환.
- `Cancel`: published 이벤트를 cancelled로 변경.
- `Deactivate`: read API에서 숨김.
- `Delete`: soft delete.
- `View audit log`: 변경 이력 확인.

## 저장소 및 서비스 경계

새 모듈은 다음처럼 분리한다.

```text
backend/stellive-hub-api/src/hub-events/
  hubEventPolicy.ts
  hubEventRepository.ts
  hubEventAdminService.ts
  hubEventNotificationFactory.ts
  hubEventCalendar.ts
  hubEventService.ts

backend/stellive-hub-api/src/routes/
  adminHubEventRoutes.ts
```

- `hubEventPolicy`: 도메인 검증. read/write/admin/import 경로가 모두 공유한다.
- `hubEventRepository`: Prisma 접근과 pagination, soft delete 필터를 캡슐화한다.
- `hubEventAdminService`: create/update/publish/cancel/deactivate/delete, audit log 작성, revision 증가를 담당한다.
- `hubEventNotificationFactory`: `HubEvent` 변경에서 `PlatformEvent` 후보를 만든다.
- `HubEventService`: public read API용 조회, effective status, summary를 담당한다.
- `adminHubEventRoutes`: 인증된 어드민 route binding만 담당한다.

외부 official API adapter가 나중에 hub event candidate를 만들더라도 `hubEventAdminService` 또는 동등한 validation boundary를 거쳐야 한다.

## OpenAPI 및 계약

`shared/openapi/openapi.yaml`에 다음 스키마를 추가한다.

- `AdminHubEventCreateRequest`
- `AdminHubEventUpdateRequest`
- `AdminHubEventResponse`
- `AdminHubEventListResponse`
- `AdminHubEventValidationError`
- `HubEventAuditLogEntry`

Public `HubEvent` 스키마에는 admin-only 필드를 추가하지 않는다. Android/iOS DTO는 기존 public read 계약을 유지한다.

## 테스트 전략

Backend unit/integration tests:

- create는 draft를 저장하고 public read API에는 노출하지 않는다.
- publish는 validation 통과 이벤트만 public read API, calendar, widget snapshot에 노출한다.
- update는 revision을 증가시키고 audit log before/after를 남긴다.
- cancel은 `status = "cancelled"`와 `cancelledAt`을 설정하고 `event_cancelled` 후보만 dedupe해서 만든다.
- deactivate와 delete는 public read API에서 숨긴다.
- Former member, Gangzi, `generationId = "gamja"`, official YouTube live, image/logo/poster fields를 거부한다.
- `notificationEligible = false`이면 publish/update/cancel notification 후보를 만들지 않는다.
- global off, event type disabled, quiet hours 등은 기존 preference tests와 worker tests에서 계속 적용된다.

Admin route tests:

- admin token이 없으면 401 또는 403.
- 공개 CORS origin에서 호출 가능한 route가 아니다.
- validation error response가 field path와 reason을 포함한다.
- deleted 이벤트는 `includeDeleted=true`에서만 반환된다.

Repository tests:

- pagination이 `updatedAt`, `id` 기준으로 안정적이다.
- `publicationState = "published"`와 `deletedAt = null` 필터가 public query에 항상 적용된다.
- audit log는 append-only로 쌓인다.

## 수용 기준 매핑

- 이미지 없이 등록 가능: `HubEvent` 모델과 어드민 폼에 이미지 필드가 없고 asset field 입력은 거부한다.
- 서버 저장소 기반 관리: Prisma `HubEvent`, `HubEventAuditLog`, repository를 사용한다.
- 생성/수정/게시/취소/삭제 또는 비활성화: admin routes와 상태 전이로 지원한다.
- 입력 규칙: category, status, 기간, source/purchase/ticket URL, generation/member, notification eligibility를 검증한다.
- 공식 출처 중심 검증: source type, source URL, fan/private/unauthorized source 금지 규칙을 적용한다.
- 변경 이력 저장: 모든 write action이 audit log를 남긴다.
- 프로젝트 규칙 검증: Former member, Gangzi/gamja, official YouTube live, 무단 asset field를 서버에서 차단한다.

## 구현 순서 제안

1. Prisma schema와 migration에 admin publication fields, audit log를 추가한다.
2. `hubEventRepository`와 public read API를 DB-backed로 전환하되 기존 mock seed는 test fixture로 옮긴다.
3. `hubEventAdminService`와 validation tests를 추가한다.
4. admin routes와 OpenAPI 스키마를 추가한다.
5. `/admin` 콘솔에 목록, 폼, validation panel, audit log view를 추가한다.
6. hub event notification 후보 생성과 worker enqueue 연결을 추가한다.
7. Android/iOS read 화면이 DB-backed API 응답으로 기존 mock과 같은 DTO를 받는지 통합 테스트한다.

## 운영 체크리스트

- `ADMIN_CONSOLE_ENABLED`는 기본 false다.
- 어드민 콘솔은 private route, SSH tunnel, VPN, 또는 동등한 제한된 경로에서만 연다.
- 실제 토큰, OAuth credentials, production device tokens는 audit log와 client bundle에 남기지 않는다.
- public read API는 draft, inactive, deleted 이벤트를 반환하지 않는다.
- 삭제와 비활성화는 알림을 직접 보내지 않는다. 취소 알림이 필요한 경우 `cancel` 액션을 사용한다.
- 공식 로고, 포스터, 상품 이미지, 프로필 이미지, copied CDN URL을 입력하거나 저장하지 않는다.
