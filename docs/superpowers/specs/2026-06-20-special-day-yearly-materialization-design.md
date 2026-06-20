# 생일/기념일 연간 DB Materialization 기능 설계

## 배경

현재 굿즈/행사 캘린더의 생일/기념일은 `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts`에서 정적 카탈로그를 요청 범위의 연도별 calendar entry로 투영한다. 최근 변경으로 status는 `Asia/Seoul` 기준 일별 스냅샷을 통해 `ended`, `open`, `upcoming`으로 계산하도록 설계되었지만, 생일/기념일 occurrence 자체는 여전히 API 응답 생성 시점에 매번 만들어진다.

운영 요구는 매년 1월 1일이 될 때 그 해의 생일/기념일을 자동으로 DB에 추가해 두고, public calendar/widget 응답은 이미 materialize된 행을 읽도록 만드는 것이다. 이렇게 하면 요청마다 “해당 연도의 생일/기념일 날짜 생성”을 반복하지 않고, 날짜 목록은 연 1회 또는 수동 backfill 시점에만 확정된다.

## 목표

- 매년 1월 1일 `Asia/Seoul` 기준으로 해당 연도의 verified 생일/기념일 occurrence를 DB에 idempotent하게 추가한다.
- 같은 연도/같은 special day가 중복 생성되지 않도록 DB unique constraint를 둔다.
- 기존 special day 정책을 유지한다: Former member 제외, `official` 제외, Gangzi는 `gamja` representative 규칙만 허용, `verify_required`는 production materialization 제외.
- 각 occurrence는 `startsAt`, `endsAt`을 KST 하루 범위로 고정한다. 예: `2026-05-21T00:00:00+09:00`부터 `2026-05-22T00:00:00+09:00` 전까지.
- API 응답 shape와 모바일 DTO를 바꾸지 않는다. `HubCalendarEntry`는 기존 `entryKind`, `specialDayKind`, `specialDayLabel`, `displayDate`, `displayTimeText`를 계속 사용한다.
- 기존 read-only calendar 성격을 유지한다. 생일/기념일 materialization은 push notification을 만들지 않는다.

## 비목표

- 생일/기념일 날짜를 외부 API, 크롤링, 검색 결과, private Cafe에서 자동 수집하지 않는다.
- 생일/기념일 admin CRUD 전체를 만들지 않는다.
- 생일/기념일 push notification type을 추가하지 않는다.
- Android/iOS UI를 변경하지 않는다.
- 공식 로고, 프로필 이미지, 팬아트, 캡처 이미지 등 asset을 추가하지 않는다.

## 선택지

### 선택지 A: `HubEvent` 테이블에 생일/기념일을 직접 생성

장점:
- 기존 `HubEventRepository`, calendar projection, admin list 일부를 재사용할 수 있다.

단점:
- 굿즈/행사와 생일/기념일이 같은 테이블에 섞인다.
- `HubEvent.sourceUrl` 같은 필수 필드에 synthetic URL을 넣어야 한다.
- admin publish/cancel/notification 로직과 섞여 policy risk가 커진다.

판단: 권장하지 않는다.

### 선택지 B: 별도 `HubCalendarSpecialDayOccurrence` 테이블 추가

장점:
- 생일/기념일이 일반 굿즈/행사 및 notification pipeline과 분리된다.
- DB materialization 요구를 충족하면서도 read-only calendar 정책을 유지한다.
- `specialDayId + displayYear` unique constraint로 idempotency가 명확하다.

단점:
- Prisma migration, repository, calendar merge 로직이 추가된다.

판단: 권장안.

### 선택지 C: 기존 projection 유지 + cache 강화

장점:
- migration이 없다.
- 구현량이 가장 작다.

단점:
- “DB에 추가” 요구를 충족하지 않는다.
- 프로세스 재시작 시 occurrence materialization 상태를 보존하지 않는다.

판단: 이번 요구에는 부적합하다.

## 권장 설계

별도 Prisma model을 추가한다.

```prisma
model HubCalendarSpecialDayOccurrence {
  id              String   @id
  specialDayId    String
  kind            String
  displayYear     Int
  displayDate     String
  title           String
  specialDayLabel String
  generationId    String
  memberId        String?
  startsAt        DateTime
  endsAt          DateTime
  sourceLabel     String
  policyState     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([specialDayId, displayYear])
  @@index([displayDate])
  @@index([startsAt])
  @@index([endsAt])
  @@index([generationId])
  @@index([memberId])
  @@index([kind])
}
```

`id`는 `special-day-occurrence:{specialDayId}:{displayYear}`처럼 deterministic하게 만든다. `specialDayId`는 기존 catalog id인 `birthday:ayatsuno-yuni`, `anniversary:gen3:debut` 등을 그대로 저장한다.

## Materialization 정책

- 기준 timezone은 고정으로 `Asia/Seoul`을 사용한다.
- 자동 실행 대상 연도는 KST local date의 year이다.
- 실행 시각은 1월 1일 00:05 KST 이후를 권장한다. 실제 예약은 배포 환경의 cron/scheduler가 내부 endpoint를 호출한다.
- 수동 backfill을 위해 `targetYear`를 받을 수 있는 internal endpoint를 둔다.
- 같은 `specialDayId + displayYear`가 이미 있으면 중복 insert하지 않고 upsert한다.
- catalog title, member/generation metadata가 변경되었을 때는 upsert로 최신 catalog 값을 반영한다.
- `generation_anniversary`는 `displayYear - startYear`가 1 이상일 때만 생성한다.
- 2월 29일 항목이 비윤년에 있으면 skip한다.

## API 및 운영 Endpoint

신규 internal endpoint:

```text
POST /v1/internal/schedulers/hub-events/special-days/materialize-year
Authorization: Bearer <INTERNAL_API_TOKEN>
Content-Type: application/json

{
  "targetYear": 2027,
  "dryRun": false
}
```

응답 예:

```json
{
  "ok": true,
  "targetYear": 2027,
  "timezone": "Asia/Seoul",
  "created": 10,
  "updated": 0,
  "skipped": 0,
  "dryRun": false
}
```

자동 실행은 서버 앱 내부 timer보다 외부 scheduler가 이 endpoint를 호출하는 방식이 안전하다. 컨테이너 재시작, scale-out, 중복 실행이 있어도 upsert로 idempotent하게 처리한다.

## Calendar/Widget Read 정책

- `GET /v1/hub-events/calendar`와 `GET /v1/hub-events/widget-snapshot`은 DB occurrence를 읽어 기존 `HubCalendarEntry`로 변환한다.
- DB occurrence mode가 활성화되어 있고 해당 범위에 materialized row가 있으면 DB row를 사용한다.
- migration이 없는 로컬/테스트 환경 또는 feature flag off 상태에서는 기존 projection fallback을 유지할 수 있다.
- 중복 방지를 위해 같은 `entryKind + eventId + displayDate`는 한 번만 반환한다.
- status는 occurrence의 `startsAt`, `endsAt`과 현재 시각을 기준으로 `ended/open/upcoming`으로 계산한다. 요청마다 날짜 occurrence를 생성하지 않으며, status 계산은 기존 daily snapshot cache 또는 동일한 local-date helper를 재사용한다.

## 운영 및 실패 처리

- 1월 1일 자동 materialization이 실패해도 public calendar는 projection fallback으로 응답할 수 있어야 한다.
- 실패한 internal scheduler 호출은 5xx를 반환하고 로그에 targetYear, created/updated/skipped count, error reason을 남긴다.
- 관리자 수동 버튼은 별도 구현으로 둘 수 있지만 필수는 아니다. 이미 존재하는 special-day status 재계산 버튼은 cache clear 용도이며, 연간 DB materialization과는 별도 동작이다.

## 보안 및 정책

- endpoint는 `/v1/internal/*` 보호 규칙을 그대로 사용하고 `INTERNAL_API_TOKEN` 없이는 실행되지 않는다.
- request body로 임의의 생일/기념일 데이터를 받지 않는다. 서버 catalog만 source of truth로 사용한다.
- Former member, official channel, `verify_required`, malformed catalog entry는 materialization 대상에서 제외한다.
- notification job, push payload, preference resolution에는 연결하지 않는다.

## 테스트 기준

- 같은 연도 materialization을 두 번 실행해도 중복 row가 없다.
- 2026년 5월 21일 유니 생일 occurrence가 KST 하루 범위로 생성된다.
- 과거 occurrence는 calendar 응답에서 `ended`, 당일 occurrence는 `open`, 미래 occurrence는 `upcoming`으로 변환된다.
- `verify_required`, `official`, malformed special day는 DB에 생성되지 않는다.
- `generation_anniversary`는 `n주년` label과 title을 올바르게 생성한다.
- internal endpoint는 인증 없이는 401을 반환한다.

