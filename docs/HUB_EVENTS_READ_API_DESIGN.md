# 굿즈/이벤트 조회 API 기능 설계

## 출처
- GitHub issue #18: `[backend][api] 굿즈/이벤트 목록·상세·캘린더 조회 API 구현`
- GitLab work item #12: `[backend][api] 굿즈/이벤트 목록·상세·캘린더 조회 API 구현`
- 확인일: 2026-06-12
- 두 이슈의 본문은 동일하며, GitHub issue #18에는 댓글이 없다.

## 배경
모바일 앱은 굿즈/행사 목록, 상세, 캘린더, 위젯 표시용 데이터를 서버에서 안정적으로 조회해야 한다. 현재 백엔드에는 `/v1/hub-events`, `/v1/hub-events/calendar`, 위젯 스냅샷 성격의 라우트가 존재하지만, 이슈의 핵심은 mock 또는 in-memory 구현 여부와 무관하게 Android/iOS가 공통으로 사용할 조회 계약을 확정하고 OpenAPI/shared DTO와 일치시키는 것이다.

## 목표
- `GET /v1/hub-events` 목록 조회 계약을 확정한다.
- `GET /v1/hub-events/:id` 상세 조회 계약을 확정한다.
- `GET /v1/hub-events/calendar` 날짜 범위 기반 캘린더 조회 계약을 확정한다.
- `GET /v1/hub-events/widget-snapshot` 또는 bootstrap 내 widget snapshot 제공 방식을 확정한다.
- pagination, date range, category, status, generation/member 필터를 정의한다.
- Android/iOS 공통 DTO와 `shared/openapi/openapi.yaml`을 구현과 일치시킨다.

## 비목표
- 이 설계는 관리자 CRUD, 외부 플랫폼 ingestion, push delivery, 결제, 이미지 업로드를 포함하지 않는다.
- livestream, upload, ordinary post, fan-hosted event를 굿즈/행사로 자동 변환하지 않는다.
- 프로필 이미지, 공식 로고, 팬아트, 캡처 이미지, copied CDN asset을 API 응답 계약의 필수 자산으로 두지 않는다.
- Former members를 catalog, filter, seed, notification target에 포함하지 않는다.

## 도메인 원칙
- 굿즈/행사 feed는 공식 출처 기반의 time-bound goods, ticketing, offline event, collaboration 정보만 포함한다.
- 이미지가 없어도 API 응답과 모바일 UI가 정상 동작해야 한다.
- `generationId`는 `gen1`, `gen2`, `gen3`, `gamja`, `official`, `gen4-upcoming` 등 허용된 카탈로그 범위를 따른다.
- Gangzi는 `gamja` category의 `representative`로만 취급하며 generation member로 취급하지 않는다.
- `official` category는 UI에서 `기타`로 표시된다.
- 캘린더/위젯 응답은 livestream, upload, ordinary post, fan-hosted event를 굿즈/행사에 섞지 않는다.

## API 계약

### `GET /v1/hub-events`
굿즈/행사 목록을 조회한다.

Query parameters:
- `category`: optional. `online_goods`, `online_collab`, `offline_concert`, `offline_collab`, `offline_popup`, `ticketing`.
- `participationMode`: optional. `online`, `offline`, `hybrid`.
- `status`: optional. `announced`, `upcoming`, `open`, `closing_soon`, `ended`, `cancelled`.
- `generationId`: optional. 카탈로그 generation/category id.
- `memberId`: optional. 개별 멤버, Gangzi representative, official channel id.
- `from`: optional ISO 8601 datetime/date. 이벤트 기간이 이 시점 이후와 겹치는 항목만 반환한다.
- `to`: optional ISO 8601 datetime/date. 이벤트 기간이 이 시점 이전과 겹치는 항목만 반환한다.
- `cursor`: optional opaque cursor. 클라이언트는 값을 해석하지 않는다.
- `limit`: optional integer. 기본값은 서버 기본값을 사용하고, 최대값은 OpenAPI에 명시된 상한으로 clamp한다.

Response:
```json
{
  "items": [
    {
      "id": "official-reservation-goods",
      "category": "online_goods",
      "participationMode": "online",
      "status": "open",
      "title": "예약 판매",
      "summary": "요약",
      "memberId": "stellive-official",
      "generationId": "official",
      "sourceUrl": "https://example.com",
      "sourceLabel": "공식 공지",
      "sourceType": "official",
      "announcedAt": "2026-06-12T00:00:00.000Z",
      "startsAt": "2026-06-12T00:00:00.000Z",
      "endsAt": "2026-06-19T14:59:59.000Z",
      "purchaseUrl": "https://example.com",
      "ticketUrl": null,
      "venueName": null,
      "venueAddress": null,
      "notificationEligible": true,
      "createdAt": "2026-06-12T00:00:00.000Z",
      "updatedAt": "2026-06-12T00:00:00.000Z"
    }
  ],
  "nextCursor": "opaque-cursor-or-null"
}
```

Sorting:
- Primary: effective status priority `closing_soon`, `open`, `upcoming`, `announced`, `cancelled`, `ended`.
- Secondary: nearest relevant date first.
- Tertiary: stable `id` ordering.

### `GET /v1/hub-events/:id`
단일 굿즈/행사 상세를 조회한다.

Path parameters:
- `id`: Hub event id.

Response:
- `200`: `HubEvent`.
- `404`: `{ "error": "hub_event_not_found" }`.

Rules:
- 상세 응답은 목록 항목과 같은 DTO를 사용한다.
- 모바일 deep link는 `stellivehub://hub-events/{id}` 형태를 표준으로 사용한다.
- 이미지 필드는 MVP 필수값이 아니며, 이미지가 없는 항목은 placeholder UI로 처리한다.

### `GET /v1/hub-events/calendar`
날짜 범위 기반 캘린더 데이터를 조회한다.

Query parameters:
- `from`: optional ISO 8601 datetime/date. 없으면 서버 기본 월간 범위를 사용한다.
- `to`: optional ISO 8601 datetime/date. 없으면 서버 기본 월간 범위를 사용한다.
- `timezone`: optional IANA timezone. 기본값 `Asia/Seoul`.

Response:
```json
{
  "timezone": "Asia/Seoul",
  "from": "2026-06-01",
  "to": "2026-06-30",
  "days": [
    {
      "date": "2026-06-12",
      "entries": [
        {
          "id": "official-reservation-goods:2026-06-12",
          "eventId": "official-reservation-goods",
          "title": "예약 판매",
          "category": "online_goods",
          "status": "open",
          "participationMode": "online",
          "generationId": "official",
          "memberId": "stellive-official",
          "startsAt": "2026-06-12T00:00:00.000Z",
          "endsAt": "2026-06-19T14:59:59.000Z",
          "displayDate": "2026-06-12",
          "displayTimeText": "09:00 시작",
          "appDeepLink": "stellivehub://hub-events/official-reservation-goods",
          "platformUrl": "https://example.com"
        }
      ]
    }
  ]
}
```

Rules:
- 이벤트 기간이 `from`/`to` 범위와 겹치면 포함한다.
- 날짜 grouping은 `timezone` 기준 local date로 계산한다.
- 캘린더 entry는 상세 화면 진입에 필요한 `eventId`, `appDeepLink`, `platformUrl`을 포함한다.
- ended/cancelled 이벤트는 캘린더 조회에는 표시할 수 있으나 위젯 기본 후보에서는 후순위로 둔다.

### `GET /v1/hub-events/widget-snapshot`
위젯이 빠르게 렌더링할 compact snapshot을 조회한다.

Query parameters:
- `timezone`: optional IANA timezone. 기본값 `Asia/Seoul`.
- `limit`: optional integer. 기본값 5, 최대 10.

Response:
```json
{
  "generatedAt": "2026-06-12T00:00:00.000Z",
  "timezone": "Asia/Seoul",
  "entries": [],
  "staleAfter": "2026-06-12T01:00:00.000Z"
}
```

Bootstrap integration:
- `GET /v1/bootstrap`은 모바일 초기 화면 성능을 위해 `hubCalendarWidgetSnapshot`을 포함할 수 있다.
- canonical refresh endpoint는 `GET /v1/hub-events/widget-snapshot`으로 둔다.
- bootstrap snapshot과 standalone widget snapshot의 DTO는 동일해야 한다.

## DTO 정의

### `HubEvent`
Required fields:
- `id`
- `category`
- `participationMode`
- `status`
- `title`
- `generationId`
- `sourceUrl`
- `sourceLabel`
- `sourceType`
- `notificationEligible`
- `createdAt`
- `updatedAt`

Optional fields:
- `summary`
- `memberId`
- `announcedAt`
- `startsAt`
- `endsAt`
- `purchaseUrl`
- `ticketUrl`
- `venueName`
- `venueAddress`

### `HubCalendarEntry`
Required fields:
- `id`
- `eventId`
- `title`
- `category`
- `status`
- `participationMode`
- `generationId`
- `displayDate`
- `displayTimeText`
- `appDeepLink`
- `platformUrl`

Optional fields:
- `memberId`
- `startsAt`
- `endsAt`

## Validation And Error Handling
- Invalid enum query values return `400` with a machine-readable error code.
- Invalid `from`, `to`, or `timezone` values return `400`; the server may fall back only where the OpenAPI contract explicitly says so.
- `from > to` returns `400`.
- Unknown `id` returns `404`.
- Unsupported but well-formed filters return `200` with an empty `items` or empty `days` result.
- API responses must not include raw private platform payloads or secrets.

## Shared Contract Updates
- `shared/schemas/domain.ts` is the source for `HubEvent` enum and core DTO types.
- `shared/schemas/mobileApi.ts` must expose `hubCalendarWidgetSnapshot` when bootstrap includes it.
- `shared/openapi/openapi.yaml` must define:
  - `/v1/hub-events`
  - `/v1/hub-events/{id}`
  - `/v1/hub-events/calendar`
  - `/v1/hub-events/widget-snapshot`
  - shared schemas for `HubEvent`, `HubEventListResponse`, `HubCalendarResponse`, `HubCalendarWidgetSnapshot`.
- Android and iOS should consume the same field names and enum values as OpenAPI.

## Acceptance Criteria
- 모바일이 서버에서 굿즈/이벤트 목록과 상세를 조회할 수 있다.
- 모바일이 날짜 범위 기준 캘린더 데이터를 조회할 수 있다.
- 이미지가 없어도 API 응답과 모바일 UI가 정상 동작한다.
- 캘린더/위젯 응답은 livestream, upload, ordinary post, fan-hosted event를 굿즈/행사로 섞지 않는다.
- OpenAPI 또는 shared contract가 구현과 일치한다.

## Test Plan
- Backend route tests:
  - list default response returns `items` and optional `nextCursor`.
  - list filters by category, status, generationId, memberId, date range.
  - detail returns `200` for known event and `404` for unknown event.
  - calendar groups entries by requested timezone and date range.
  - widget snapshot respects `limit` and returns `generatedAt`, `timezone`, `entries`, `staleAfter`.
- Contract tests:
  - OpenAPI schemas match runtime response shape.
  - shared Android/iOS DTOs compile against the response fields.
- Policy tests:
  - Former members do not appear.
  - official YouTube live events are not represented as hub events.
  - livestream, upload, ordinary post, fan-hosted event fixtures are excluded.
  - missing image fields do not break mobile rendering.

## Implementation Notes
- Existing `HubEventService` can remain the read boundary while storage is in-memory or Prisma-backed.
- Cursor values should be treated as opaque even if the initial implementation uses event ids.
- Effective status should be computed server-side so mobile clients do not duplicate closing-soon/open/ended logic.
- The backend remains the authority for filtering; mobile-side filters are display controls, not security or policy enforcement.
## HubEvent Image Metadata

`HubEvent.image` is optional metadata only. The backend never stores or returns image binaries, app-bundled copied assets, official logos, fan art, screenshots, or copied CDN assets.

Allowed `policyState` values are `none`, `official_runtime_url`, `third_party_allowed`, `verify_required`, and `blocked`.

Mobile clients may attempt image rendering only for `official_runtime_url` and `third_party_allowed` with a valid HTTPS URL. `none`, `verify_required`, `blocked`, missing URL, invalid URL, and image load failure must render the normal text-first layout without “이미지가 없습니다” copy.

`HubCalendarEntry`, widget snapshots, and push payloads intentionally do not include image metadata. They remain compact schedule/notification projections and must not depend on image loading.
