# 굿즈/행사 캘린더 기념일 지원 코드 설계

기반 기능 설계:
- `docs/HUB_EVENT_ANNIVERSARY_CALENDAR_DESIGN.md`
- GitHub: https://github.com/MinePacu/stellive-event-notifier/issues/28
- GitLab: https://gitlab.com/minepacu-group/stellive-event-notifier/-/work_items/15

## 목표

기존 HubEvent 캘린더/위젯 read projection에 멤버 생일과 기수 n주년 항목을 병합한다.

구현은 read-only 캘린더 projection으로 제한한다. `PlatformEvent`, `NotificationJob`, push payload, 알림 기록, realtime stream에는 연결하지 않는다.

## 현재 코드 경계

공유 계약:
- `shared/schemas/domain.ts`: `HubEvent`, `HubCalendarEntry`, `HubCalendarResponse`, `HubCalendarWidgetSnapshot`의 원본 타입
- `shared/schemas/mobileApi.ts`: bootstrap 응답에 `hubCalendarWidgetSnapshot` 포함
- `shared/openapi/openapi.yaml`: public API 계약

Backend:
- `backend/stellive-hub-api/src/types.ts`: shared schema re-export
- `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`: HubEvent를 calendar/widget entry로 변환
- `backend/stellive-hub-api/src/hub-events/hubEventService.ts`: HubEvent read port, filtering, summary
- `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`: list/detail/calendar/widget route와 query 검증
- `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`: read API contract 테스트

Android:
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`: 캘린더 DTO enum/data class
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarUiPolicy.kt`: 캘린더 정렬/라벨 정책
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/calendar/CalendarWidgetTextFormatter.kt`: 위젯 문구
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt`: mock calendar projection
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/*Calendar*Test.kt`: 캘린더/위젯 테스트

iOS:
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubCalendarWidgetStore.swift`: 위젯 snapshot 저장
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubCalendarWidgetStoreTests.swift`: snapshot 저장/로드 테스트
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift`: bootstrap decoding 테스트
- `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`: enum display policy 테스트

## Shared Schema 변경

`shared/schemas/domain.ts`에 다음 타입을 추가한다.

```ts
export type HubCalendarEntryKind =
  | "hub_event"
  | "member_birthday"
  | "generation_anniversary";

export type HubCalendarSpecialDayKind =
  | "member_birthday"
  | "generation_anniversary";

export type HubCalendarSpecialDayPolicyState =
  | "catalog_verified"
  | "verify_required";

export type HubCalendarSpecialDay = {
  id: string;
  kind: HubCalendarSpecialDayKind;
  title: string;
  generationId: "gen1" | "gen2" | "gen3" | "gamja" | "gen4-upcoming";
  memberId?: string;
  month: number;
  day: number;
  startYear?: number;
  activeStatus: ActiveStatus;
  catalogRole?: "member" | "representative";
  sourceLabel: "카탈로그";
  policyState: HubCalendarSpecialDayPolicyState;
};
```

`HubEventCategory`는 기존 굿즈/행사 도메인 의미가 강하므로 기념일 값을 직접 섞지 않는다. 대신 `HubCalendarEntry`에 calendar 전용 필드를 추가한다.

```ts
export type HubCalendarEntry = {
  id: string;
  eventId: string;
  entryKind: HubCalendarEntryKind;
  specialDayKind?: HubCalendarSpecialDayKind;
  specialDayLabel?: string;
  category: HubEventCategory;
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
};
```

호환성:
- 기존 HubEvent entry는 `entryKind: "hub_event"`를 넣는다.
- 생일/기념일 entry는 `category: "online_goods"` 같은 가짜 값을 쓰지 않고, category를 optional로 바꾸는 선택지도 있다.
- 하위 호환을 우선하면 `category`는 유지하고 `specialDayKind`로 UI 분기를 한다. 이 경우 기념일 entry category는 `online_goods`가 아니라 OpenAPI major 변경 전까지 `online_collab` 등으로 오염시키지 않도록 backend/mobile이 category 배지를 숨긴다.
- 더 엄밀한 계약을 원하면 `HubCalendarEntry.category?: HubEventCategory`로 바꾸고 모바일 null 처리 테스트를 함께 추가한다.

권장안은 `category?: HubEventCategory` 전환이다. 캘린더 entry는 HubEvent만이 아니므로 domain 타입이 이를 표현해야 한다.

## Backend 모듈 설계

새 파일:
- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts`
- `backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts`

`hubCalendarSpecialDays.ts` exports:

```ts
export type SpecialDayProjectionOptions = {
  from: Date;
  to: Date;
  timezone: string;
  now: Date;
  generationId?: string;
  memberId?: string;
  includeVerifyRequired?: boolean;
};

export function buildSpecialDayEntries(
  specialDays: HubCalendarSpecialDay[],
  options: SpecialDayProjectionOptions
): HubCalendarEntry[];

export function anniversaryYearFor(
  displayYear: number,
  startYear: number
): number | undefined;
```

`buildSpecialDayEntries` 책임:
- `policyState === "catalog_verified"`만 production projection에 포함한다.
- `generationId === "official"`인 입력은 방어적으로 drop한다.
- `activeStatus`가 `active` 또는 `upcoming`이 아닌 입력은 drop한다.
- `kind === "member_birthday"`는 `memberId`가 없으면 drop한다.
- `kind === "generation_anniversary"`는 `startYear`가 없거나 `anniversaryYear <= 0`이면 drop한다.
- 요청 범위의 각 연도에 대해 `month/day`가 범위 안이면 entry를 만든다.
- `displayTimeText`는 `"종일"`로 고정한다.
- `platformUrl`은 설정하지 않는다.

원천 데이터:
- 초기 구현은 `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDayCatalog.ts`에 정적 배열로 둔다.
- 실제 생일/시작일 값이 검증되지 않은 항목은 배열에 넣지 않거나 `verify_required`로 둔다.
- 추후 admin 편집이 필요해지면 Prisma 모델로 승격한다.

```ts
export const hubCalendarSpecialDays: HubCalendarSpecialDay[] = [
  {
    id: "anniversary:gen3:debut",
    kind: "generation_anniversary",
    title: "스텔라이브 3기",
    generationId: "gen3",
    month: 5,
    day: 19,
    startYear: 2024,
    activeStatus: "active",
    sourceLabel: "카탈로그",
    policyState: "catalog_verified"
  }
];
```

## Calendar 병합 설계

최종 구현 결정: Android/iOS DTO와 OpenAPI 호환성을 유지하기 위해 `HubCalendarEntry.category`는 필수 `HubEventCategory`로 유지한다. Special day entry는 `category: "online_goods"`를 사용하지만, UI와 정책 분기는 반드시 `entryKind`, `specialDayKind`, `specialDayLabel`을 기준으로 한다. `category?: HubEventCategory` 전환은 별도 breaking-change 정리 작업으로 미룬다.

`backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`를 다음처럼 확장한다.

```ts
export type CalendarResponseOptions = {
  from: Date;
  to: Date;
  timezone: string;
  now: Date;
  includeSpecialDays?: boolean;
  entryKinds?: HubCalendarEntryKind[];
  generationId?: string;
  memberId?: string;
};

export function buildHubCalendarResponse(
  events: HubEvent[],
  options: CalendarResponseOptions,
  specialDays: HubCalendarSpecialDay[] = []
): HubCalendarResponse;
```

처리 순서:
1. 기존 HubEvent를 `entryKind: "hub_event"` entry로 변환한다.
2. `includeSpecialDays !== false`이면 `buildSpecialDayEntries`를 호출한다.
3. `entryKinds`가 있으면 병합 후 entry kind로 필터링한다.
4. 날짜별로 group한다.
5. 날짜 내부 정렬은 `compareCalendarEntries`에서 처리한다.

`buildHubCalendarWidgetSnapshot`도 동일하게 optional specialDays 인자를 받는다.

위젯 정렬은 기존 status rank만으로는 부족하므로 다음 comparator를 분리한다.
- `compareCalendarEntries`: 캘린더 날짜 내 표시용
- `compareWidgetEntries`: 임박/진행 HubEvent 우선, 그 다음 당일/다가오는 special day

## Route Query 설계

`backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`에 query 검증을 추가한다.

추가 query:
- `includeSpecialDays`: `true`, `false`, 생략
- `entryKind`: 단일 값 또는 comma-separated 문자열. 허용값은 `hub_event`, `member_birthday`, `generation_anniversary`

검증 실패:
- 잘못된 boolean은 `400 invalid_hub_event_query`, `field: "includeSpecialDays"`
- 잘못된 entry kind는 `400 invalid_hub_event_query`, `field: "entryKind"`

기존 `generationId`, `memberId` 필터는 special day projection에도 전달한다.

## OpenAPI 설계

`shared/openapi/openapi.yaml` 변경:
- `HubCalendarEntryKind` schema 추가
- `HubCalendarSpecialDayKind` schema 추가
- `HubCalendarEntry.entryKind` required 추가
- `HubCalendarEntry.specialDayKind`, `specialDayLabel` optional 추가
- `HubCalendarEntry.category`를 optional로 바꾸는 경우 required 목록에서 제거
- `/v1/hub-events/calendar` parameters에 `includeSpecialDays`, `entryKind` 추가
- `/v1/hub-events/widget-snapshot` 예시에 birthday/anniversary entry 추가

호환성 단계:
- 1차 PR에서는 `entryKind`를 required로 추가해 backend/mobile을 함께 수정한다.
- 외부 배포 앱과의 호환이 필요하면 먼저 optional로 배포하고 다음 버전에서 required로 올린다.

## Android 코드 설계

`Models.kt`:
- `enum class HubCalendarEntryKind { HUB_EVENT, MEMBER_BIRTHDAY, GENERATION_ANNIVERSARY }`
- `enum class HubCalendarSpecialDayKind { MEMBER_BIRTHDAY, GENERATION_ANNIVERSARY }`
- `HubCalendarEntry`에 `entryKind`, `specialDayKind`, `specialDayLabel` 추가
- `HubEventCategory`가 nullable이 되면 Android data class도 `HubEventCategory?`로 변경

`CalendarUiPolicy.kt`:
- `statusLabel(entry: HubCalendarEntry)` overload를 추가해 special day label을 우선한다.
- 기존 `statusLabel(status: HubEventStatus)`는 HubEvent용으로 유지한다.
- `entryComparator`는 special day가 ended/cancelled보다 앞서고, `closing_soon/open` HubEvent보다 뒤에 오도록 조정한다.

`CalendarWidgetTextFormatter.kt`:
- birthday: subtitle은 `"생일 · 종일"` 또는 `"생일"`로 짧게 표시
- anniversary: `specialDayLabel`이 있으면 `"2주년 · 종일"` 형태로 표시
- `platformUrl == null`인 항목에서 외부 이동 문구를 만들지 않는다.

`MockHubRepository.kt`:
- fixture에 `entryKind` 기본값을 넣는다.
- active/upcoming 멤버 생일과 gen anniversary mock entry를 추가한다.
- `official` filter에는 special day mock을 넣지 않는다.

Android tests:
- `CalendarUiPolicyTest`: special day 정렬과 label
- `CalendarWidgetTextFormatterTest`: birthday/anniversary subtitle
- `CalendarProjectionTest`: filter별 special day 포함/제외

## iOS 코드 설계

DTO 위치는 기존 모델 파일을 먼저 확인하고, 현재 `HubCalendarWidgetSnapshot`이 정의된 파일에 맞춰 확장한다.

추가 타입:

```swift
enum HubCalendarEntryKind: String, Codable {
    case hubEvent = "hub_event"
    case memberBirthday = "member_birthday"
    case generationAnniversary = "generation_anniversary"
}

enum HubCalendarSpecialDayKind: String, Codable {
    case memberBirthday = "member_birthday"
    case generationAnniversary = "generation_anniversary"
}
```

`HubCalendarEntry`:
- `let entryKind: HubCalendarEntryKind`
- `let specialDayKind: HubCalendarSpecialDayKind?`
- `let specialDayLabel: String?`
- `category`가 optional이 되면 `HubEventCategory?`로 변경

Tests:
- `HubAPIClientTests` bootstrap fixture에 special day entry를 추가해 decoding 확인
- `HubCalendarWidgetStoreTests` snapshot 저장/로드에 새 필드 포함
- `PreferenceStateTests` 또는 별도 calendar policy test에서 special day display label 확인

## 정책 방어 코드

special day projection은 catalog source가 잘못 들어와도 아래 항목을 drop해야 한다.

```ts
function isAllowedSpecialDay(day: HubCalendarSpecialDay): boolean {
  if (day.policyState !== "catalog_verified") return false;
  if (day.generationId === "official") return false;
  if (day.activeStatus !== "active" && day.activeStatus !== "upcoming") return false;
  if (day.catalogRole === "official_channel") return false;
  return true;
}
```

Former member 방어는 `activeStatus` 타입만으로는 부족할 수 있다. catalog join이 가능하면 member catalog의 `activeStatus`와 `catalogRole`을 다시 확인한다.

권장:
- `member_birthday`는 `CatalogService`로 `memberId`를 lookup한다.
- lookup 실패, former, official_channel이면 drop한다.
- Gangzi는 `catalogRole === "representative"`와 `generationId === "gamja"`일 때만 허용한다.

## 테스트 순서

Backend TDD:
1. `backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts`에 active member birthday projection 테스트를 추가하고 실패 확인
2. `buildSpecialDayEntries` 최소 구현
3. Former/official/verify_required 제외 테스트 추가
4. n주년 계산 테스트 추가
5. calendar route `includeSpecialDays=false`, `entryKind` query 테스트 추가
6. widget snapshot priority 테스트 추가

Android TDD:
1. `CalendarWidgetTextFormatterTest`에 birthday subtitle 테스트 추가
2. 모델/formatter 최소 구현
3. `CalendarUiPolicyTest`에 special day 정렬 테스트 추가
4. `CalendarProjectionTest`에 mock repository filter 테스트 추가

iOS TDD:
1. API fixture decoding 테스트에 새 필드 추가
2. DTO 확장
3. widget store round-trip 테스트 갱신

## 검증 명령

Backend:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubCalendarSpecialDays
rtk npm test -- hubEventReadRoutes
rtk npm run build
rtk npm test
```

Android:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew testDebugUnitTest --tests dev.stellive.hub.CalendarWidgetTextFormatterTest
rtk ./gradlew testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
rtk ./gradlew testDebugUnitTest
```

iOS:

```bash
cd ios/StelliveHubiOS
rtk xcodebuild test -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Shared/OpenAPI:

```bash
rtk rg "HubCalendarEntryKind|member_birthday|generation_anniversary" shared docs backend android ios
```

## Rollout 순서

1. shared schema와 OpenAPI를 확장한다.
2. backend special day projection과 route query를 구현한다.
3. Android/iOS DTO를 schema 변경에 맞춰 갱신한다.
4. mock repositories와 fixtures를 새 response shape로 맞춘다.
5. widget snapshot과 bootstrap decoding을 검증한다.
6. `docs/AI_HANDOFF.md`에 구현 상태, 테스트 결과, 미검증 실제 날짜 데이터를 기록한다.

## 비구현 결정

초기 구현에서 하지 않는다:
- DB migration으로 special day admin CRUD 추가
- 생일/기념일 push notification type 추가
- 외부 API나 크롤링으로 생일/기수 날짜 자동 수집
- 기념일 이미지, 로고, profile asset 표시
- official channel anniversary 표시

이 결정은 정책 위험을 줄이고 기존 calendar/widget read path에만 변경을 제한하기 위한 것이다.
