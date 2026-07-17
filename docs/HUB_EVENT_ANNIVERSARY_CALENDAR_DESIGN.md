# 굿즈/행사 캘린더 기념일 지원 기능 설계

연결 이슈:
- GitHub: https://github.com/MinePacu/stellive-event-notifier/issues/28
- GitLab: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/15

## 목표

굿즈/행사 캘린더에서 판매, 예약, 티켓팅 같은 일정뿐 아니라 멤버 생일과 각 기수 시작일 기준 n주년 기념일도 함께 볼 수 있게 한다.

이 기능은 캘린더 표시 기능이 우선이며, 별도 정책 결정 전까지 푸시 알림, 알림 기록, 실시간 전달 대상이 아니다.

## 범위

포함:
- active/upcoming 멤버의 생일 캘린더 표시
- 기수별 시작일 기준 매년 n주년 캘린더 표시
- `GET /v1/hub-events/calendar`, `GET /v1/hub-events/widget-snapshot`, `GET /v1/bootstrap`의 캘린더/위젯 투영 반영
- Android/iOS 캘린더 UI에서 기존 굿즈/행사 일정과 함께 표시
- 필터, 정렬, 테스트, OpenAPI 문서 반영

제외:
- Former member 생일 또는 이전 활동 기념일
- official/기타 채널 기념일
- 공식 로고, 프로필 이미지, 팬아트, 캡처 이미지, 복사된 CDN 이미지
- 푸시 알림 자동 생성
- CHZZK, YouTube, Naver Cafe 외부 수집 경로 추가
- private Cafe, 로그인 쿠키, HTML 크롤링, 접근 우회

## 정책 원칙

- MVP 카탈로그에는 `active` 또는 `upcoming`만 포함한다.
- Former member는 seed data, API 응답, UI 필터, 테스트 fixture 어디에도 포함하지 않는다.
- Gangzi는 기수 멤버가 아니라 `generationId: "gamja"`, `catalogRole: "representative"`인 대표 항목으로 유지한다.
- Gangzi의 생일 또는 대표 관련 기념일을 다룰 경우에도 `gamja` 카테고리 하위 representative로만 처리한다.
- `official` 카테고리, 즉 `기타` 공식 채널은 생일/기수 기념일 대상이 아니다.
- 기념일 캘린더 항목은 서버가 생성하는 read projection이다. 클라이언트가 카탈로그 원본을 재계산해 정책 필터를 우회하면 안 된다.
- `realtime_best_effort`는 이 기능에 영향을 주지 않는다.

## 사용자 경험

캘린더:
- 기존 굿즈/행사 날짜 그룹 안에 기념일 항목을 함께 표시한다.
- 생일은 `생일` 배지로 표시한다.
- 기수 n주년은 `n주년` 또는 `기념일` 배지로 표시한다.
- 시간 정보가 없는 항목은 `종일`로 표시한다.
- 날짜가 같은 굿즈/행사와 기념일은 같은 날짜 섹션에 함께 노출한다.

필터:
- `전체`에는 굿즈/행사와 기념일을 모두 포함한다.
- 기수 필터는 해당 `generationId`의 생일 및 기수 n주년 항목을 포함한다.
- `gamja` 필터는 Gangzi representative 관련 허용 기념일만 포함한다.
- `official` 필터는 기존 공식 굿즈/행사 일정만 포함하고 생일/기수 기념일은 포함하지 않는다.
- 별도 유형 필터를 추가한다면 `굿즈/행사`, `생일`, `기념일`을 분리한다.

위젯:
- 위젯은 가까운 일정 요약에 기념일도 포함할 수 있다.
- 화면 공간이 작으므로 제목은 짧게 유지한다.
- 예: `아야츠노 유니 생일`, `스텔라이브 3기 2주년`
- 위젯은 이미지를 표시하지 않는다.

## 도메인 모델

기념일은 외부 플랫폼 이벤트가 아니라 프로젝트 카탈로그에서 관리되는 정적/반정적 원천 데이터다.

권장 원천 타입:

```ts
type HubCalendarSpecialDayKind = "member_birthday" | "generation_anniversary";

interface HubCalendarSpecialDay {
  id: string;
  kind: HubCalendarSpecialDayKind;
  title: string;
  generationId: "gen1" | "gen2" | "gen3" | "gamja" | "gen4-upcoming";
  memberId?: string;
  month: number;
  day: number;
  startYear?: number;
  activeStatus: "active" | "upcoming";
  catalogRole?: "member" | "representative";
  sourceLabel: "카탈로그";
  policyState: "catalog_verified" | "verify_required";
}
```

필드 규칙:
- `member_birthday`는 `memberId`, `month`, `day`를 가진다.
- `generation_anniversary`는 `generationId`, `month`, `day`, `startYear`를 가진다.
- `startYear`가 없거나 검증되지 않은 경우 `generation_anniversary` 항목을 생성하지 않는다.
- `policyState: "verify_required"`인 항목은 운영/개발 fixture에는 둘 수 있지만 production calendar에는 기본 노출하지 않는다.
- `official` generation은 허용하지 않는다.

## Calendar Entry 투영

기존 `HubCalendarEntry`를 최대한 유지하되, 캘린더 항목의 원천을 구분할 수 있는 필드를 추가한다.

권장 확장:

```ts
type HubCalendarEntryKind = "hub_event" | "member_birthday" | "generation_anniversary";

interface HubCalendarEntry {
  id: string;
  eventId: string;
  entryKind: HubCalendarEntryKind;
  title: string;
  category: HubEventCategory | "birthday" | "anniversary";
  status: HubEventStatus;
  participationMode: HubEventParticipationMode;
  generationId: string;
  memberId?: string;
  startsAt?: string;
  endsAt?: string;
  displayDate: string;
  displayTimeText: string;
  sourceLabel: string;
  appDeepLink: string;
  platformUrl?: string;
}
```

기념일 투영 규칙:
- `entryKind = "member_birthday"` 또는 `"generation_anniversary"`를 사용한다.
- `status = "upcoming"` 또는 당일이면 `"open"`에 준하는 표시 상태를 서버에서 계산한다.
- `participationMode = "online"`으로 둔다. 실제 참여 이벤트가 아니라 일정 표시 항목이므로 UI 문구에서 참여 방식 배지는 숨기는 것을 권장한다.
- `displayTimeText = "종일"`로 둔다.
- `platformUrl`은 없다.
- `appDeepLink`는 `stellivehub://calendar/special-days/{id}?date=YYYY-MM-DD` 형태를 권장한다.
- 상세 화면을 만들기 전까지 deep link는 캘린더 화면 해당 날짜 포커스로 처리할 수 있다.

ID 규칙:
- 생일 원천 ID: `birthday:{memberId}`
- 생일 entry ID: `birthday:{memberId}:{YYYY-MM-DD}`
- 기수 기념일 원천 ID: `anniversary:{generationId}:debut`
- 기수 기념일 entry ID: `anniversary:{generationId}:debut:{YYYY-MM-DD}`
- 같은 날짜에 여러 항목이 있어도 ID가 충돌하지 않아야 한다.

## n주년 계산

서버가 요청 timezone 기준 local date 범위를 순회하며 해당 연도의 기념일을 계산한다.

계산 규칙:
- `anniversaryYear = displayYear - startYear`
- `anniversaryYear <= 0`이면 n주년 항목을 생성하지 않는다.
- 예: `startYear = 2024`, 표시 연도 `2026`이면 `2주년`
- 윤년 2월 29일 항목은 원천 데이터에서 피하는 것을 우선한다. 필요해지면 2월 28일 또는 3월 1일 중 하나를 정책으로 확정하기 전까지 `verify_required`로 둔다.

날짜 범위:
- `from`/`to`는 기존 캘린더 API와 동일하게 timezone 기준 local date로 해석한다.
- 다년 범위 요청도 처리할 수 있으나, API 상한을 유지해 과도한 항목 생성을 막는다.

## API 설계

### `GET /v1/hub-events/calendar`

기존 응답에 기념일 projection을 병합한다.

추가 query parameter 후보:
- `entryKind`: optional, comma-separated. `hub_event`, `member_birthday`, `generation_anniversary`
- `includeSpecialDays`: optional boolean. 기본값 `true`

기본값은 기존 사용자가 별도 설정 없이 캘린더에서 기념일을 볼 수 있도록 `includeSpecialDays=true`를 권장한다.

응답 예:

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
          "id": "birthday:member-yuni:2026-06-12",
          "eventId": "birthday:member-yuni",
          "entryKind": "member_birthday",
          "title": "아야츠노 유니 생일",
          "category": "birthday",
          "status": "upcoming",
          "participationMode": "online",
          "generationId": "gen1",
          "memberId": "member-yuni",
          "displayDate": "2026-06-12",
          "displayTimeText": "종일",
          "sourceLabel": "카탈로그",
          "appDeepLink": "stellivehub://calendar/special-days/birthday:member-yuni?date=2026-06-12"
        }
      ]
    }
  ]
}
```

### `GET /v1/hub-events/widget-snapshot`

위젯 snapshot은 기존 `entries` 배열에 기념일 entry를 포함할 수 있다.

정렬 우선순위:
1. 오늘 진행 중/당일 기념일
2. 마감 임박 굿즈/행사
3. 시작일이 가까운 굿즈/행사
4. 다가오는 생일
5. 다가오는 기수 n주년
6. 종료/취소 항목

기념일이 굿즈/행사 긴급 항목을 밀어내지 않도록, `closing_soon`과 `open` 상태 굿즈/행사를 우선한다.

### `GET /v1/bootstrap`

초기 렌더링 성능을 위해 기존 `hubCalendarWidgetSnapshot`에 기념일 entry를 포함한다.

클라이언트는 bootstrap snapshot을 캐시로 사용하고, 최신 데이터는 `GET /v1/hub-events/widget-snapshot`에서 다시 가져온다.

## 저장소/서비스 설계

권장 구성:
- `shared/schemas/domain.ts`: `HubCalendarEntryKind`, `HubCalendarSpecialDay` 또는 동등 DTO 추가
- `backend/stellive-hub-api/src/hubEvents/specialDayCatalog.ts`: 정적 기념일 원천 데이터
- `backend/stellive-hub-api/src/hubEvents/specialDayProjection.ts`: 날짜 범위별 `HubCalendarEntry` 생성
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`: 캘린더/위젯 응답 병합
- `backend/stellive-hub-api/test/hubEventSpecialDays.test.ts`: 생일/n주년/정책 제외 테스트

처리 흐름:
1. 요청의 `from`, `to`, `timezone`, 필터를 검증한다.
2. 기존 HubEvent repository에서 굿즈/행사 항목을 조회한다.
3. special day catalog에서 허용 대상만 필터링한다.
4. 날짜 범위에 해당하는 생일/n주년 entry를 생성한다.
5. 기존 HubEvent entry와 special day entry를 병합한다.
6. 서버 정렬 규칙으로 날짜별 entry 순서를 결정한다.
7. Android/iOS는 응답을 표시만 하고 정책 필터를 재해석하지 않는다.

## 모바일 설계

Android:
- `HubCalendarEntry` 모델에 `entryKind`와 확장 category 값을 추가한다.
- `CalendarUiPolicy.statusLabel` 또는 별도 label policy에서 생일/기념일 배지를 처리한다.
- `CalendarWidgetTextFormatter`는 `entryKind`를 보고 `종일` 기념일 문구를 짧게 표시한다.
- `MockHubRepository` fixture에 active/upcoming 멤버 생일과 기수 n주년 예시를 추가한다.
- UI 필터는 서버 응답의 `generationId`, `entryKind`를 기준으로만 동작한다.

iOS:
- Android와 동일한 DTO 필드를 사용한다.
- 캘린더 리스트/위젯에서 `entryKind` 기반 배지를 표시한다.
- 이미지 의존 UI를 추가하지 않는다.

공통:
- 기념일 상세 화면이 없다면 entry tap은 캘린더 날짜 포커스 또는 기존 굿즈/행사 캘린더 화면으로 이동한다.
- `platformUrl`이 없는 항목에서 외부 링크 버튼을 표시하지 않는다.

## 정렬 정책

날짜 내 정렬:
1. 당일 굿즈/행사 진행/마감 임박
2. 생일
3. 기수 n주년
4. 예정 굿즈/행사
5. 종료/취소 항목
6. 안정적인 `id` 오름차순

위젯 정렬은 긴급도 중심이고, 캘린더 정렬은 날짜 내 가독성 중심이다. 두 정책을 같은 comparator로 강제하지 않는다.

## 알림 정책

초기 버전에서는 기념일 entry가 다음을 생성하지 않는다.
- `PlatformEvent`
- `NotificationJob`
- push payload
- notification history
- realtime stream event

향후 생일/기념일 알림을 추가하려면 별도 이슈로 다음을 먼저 설계한다.
- 사용자 opt-in 기본값
- event type 추가 여부
- generation/member preference와의 관계
- quiet hours, rate limit, load reduction 적용 방식
- 기념일 전날/당일 알림 여부

## 데이터 검증

생일/기수 시작일 데이터는 공식 또는 프로젝트에서 허용한 검증 출처로 확인된 값만 production 노출한다.

금지:
- 검색엔진 이미지/문서 긁기
- private Cafe, 로그인 쿠키, 비공개 게시글
- 캡처 이미지 기반 seed
- 외부 팬 정리표 무단 복사

검증 전 값은 코드에 넣지 않거나 `verify_required`로 두고 production projection에서 제외한다.

## 테스트 계획

Backend:
- active 멤버 생일이 요청 범위에 있으면 calendar entry가 생성된다.
- upcoming 멤버 생일도 정책상 허용된다.
- Former member fixture가 들어와도 entry가 생성되지 않는다.
- `official` generation special day는 생성되지 않는다.
- Gangzi 관련 항목은 `gamja` representative로만 생성된다.
- 기수 시작일의 `n주년` 계산이 맞다.
- `startYear`가 없거나 `anniversaryYear <= 0`이면 n주년 entry가 생성되지 않는다.
- `includeSpecialDays=false`이면 기존 HubEvent만 반환된다.
- widget snapshot에서 긴급 굿즈/행사가 생일/기념일보다 우선된다.

Android:
- `entryKind=member_birthday` 항목에 생일 배지가 표시된다.
- `entryKind=generation_anniversary` 항목에 n주년/기념일 배지가 표시된다.
- `platformUrl`이 없는 기념일 항목에서 외부 링크 UI가 표시되지 않는다.
- 위젯 텍스트가 생일/기념일 항목을 짧게 포맷한다.

iOS:
- Android와 동일한 DTO fixture로 디코딩 테스트를 통과한다.
- 기념일 항목이 이미지 없이 렌더링된다.

## OpenAPI 반영

`shared/openapi/openapi.yaml`에 다음을 추가한다.
- `HubCalendarEntry.entryKind`
- `HubCalendarEntry.category`의 `birthday`, `anniversary` 확장 또는 별도 `specialDayKind`
- `/v1/hub-events/calendar` query `entryKind`, `includeSpecialDays`
- `/v1/hub-events/widget-snapshot` 응답 예시에 기념일 entry

기존 클라이언트 호환성을 우선한다면 `entryKind`는 optional로 시작하고, 모바일 앱 업데이트 이후 required로 전환한다.

## 구현 단계 현황

- [x] shared schema에 `entryKind` 및 기념일 관련 enum을 추가했다.
- [x] backend에 special day catalog와 projection 함수를 추가했다.
- [x] projection 단위 테스트로 생일, n주년, 검증 필요 항목, official 제외, Gangzi/representative 분류를 검증했다.
- [x] calendar route와 widget snapshot route에 special day projection 병합을 추가했다.
- [x] OpenAPI 문서와 fixture 응답을 갱신했다.
- [x] Android DTO, mock repository, calendar policy, widget formatter를 갱신했다.
- [x] iOS DTO와 캘린더/위젯 렌더링을 갱신했다.
- [x] `docs/AI_HANDOFF.md`에 구현 상태와 검증 결과를 기록했다.

현재 production catalog에는 공식 프로필로 확인된 active 멤버 생일 10개만 포함한다. Gen1 기념일과 강지 생일은 검증 및 명시 승인 전까지 제외한다.

## 위험과 완화

- 정책 위반 데이터 유입: production projection에서 `active/upcoming`, non-official, non-former 조건을 서버에서 강제한다.
- 기념일이 긴급 굿즈/행사를 가림: widget 정렬에서 `closing_soon`과 `open` 굿즈/행사를 우선한다.
- 클라이언트 호환성 문제: `entryKind` optional 도입 후 앱 업데이트와 함께 required 전환을 검토한다.
- 출처 불명 날짜 문제: 검증 전 항목은 `verify_required`로 두고 production 응답에서 제외한다.
- 알림 정책 혼선: 초기 범위를 read-only calendar projection으로 명확히 고정한다.
