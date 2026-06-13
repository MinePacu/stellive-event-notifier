# 굿즈/행사 목록 모드 날짜 탐색 개선 설계

작성일: 2026-06-13

## 배경

현재 `굿즈/행사` 캘린더 화면은 상단에서 `목록 / 캘린더` 표시 방식을 전환하고, 그 아래에서 `일별 / 기간별` 표시 범위를 전환한다.

문제는 `목록` 모드에서 선택 날짜 또는 선택 기간을 바로 바꿀 수 있는 조작면이 충분히 드러나지 않는다는 점이다. 특히 선택한 범위에 일정이 없을 때 화면에는 빈 상태만 남고, 사용자는 다른 날짜를 보려면 `캘린더` 모드로 다시 전환한 뒤 날짜를 고르고 다시 `목록`으로 돌아와야 한다.

이 문서는 iOS와 Android 양쪽에서 동일하게 적용할 `목록` 모드 날짜 탐색 UX를 정의한다.

## 관련 문서

- `docs/PROJECT_RULES.md`
- `docs/NOTIFICATION_POLICY.md`
- `docs/REALTIME_DELIVERY.md`
- `docs/HUB_EVENTS_READ_API_DESIGN.md`
- `docs/HUB_EVENT_ANNIVERSARY_CALENDAR_DESIGN.md`
- `docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui.md`
- `docs/superpowers/plans/2026-06-13-goods-events-calendar-confirmed-ui-code-design.md`

## 목표

- `목록` 모드에서도 선택 날짜 또는 선택 기간을 즉시 변경할 수 있게 한다.
- iOS와 Android가 같은 상호작용 규칙, 상태 모델, 접근성 문구를 사용한다.
- 빈 상태에서도 날짜 이동 조작을 유지해 사용자가 막히지 않게 한다.
- 기존 `/v1/hub-events/calendar` read-only projection을 그대로 사용한다.
- 캘린더 UI 변경이 알림 전송, 선호도 해석, 플랫폼 어댑터, 관리자 CRUD로 번지지 않게 한다.

## 비목표

- 일정 생성, 수정, 삭제 기능을 추가하지 않는다.
- 푸시 알림 정책이나 `realtime_best_effort` 동작을 바꾸지 않는다.
- 외부 플랫폼 API, 크롤링, 로그인 쿠키 수집, private cafe 수집을 추가하지 않는다.
- 공식 로고, 포스터, 상품 이미지, 캡처 이미지, 팬아트 표시 정책을 변경하지 않는다.
- `목록` 모드에서 무한 스크롤형 전체 일정 피드를 새로 만들지 않는다.

## 정책 제약

- `굿즈/행사` 캘린더는 읽기 전용 schedule projection이다.
- Former member는 seed, 필터, 테스트, UI에 포함하지 않는다.
- Gangzi는 `gamja` category의 `representative`로만 취급한다.
- `official` category는 `기타`로 표시한다.
- 공식 YouTube live scheduled/started/ended 이벤트는 생성하거나 표시하지 않는다.
- 캘린더와 위젯 화면은 push notification을 보내지 않으며 사용자 알림 선호도를 우회하지 않는다.

## UX 원칙

1. `목록` 모드는 단순한 결과 목록이 아니라 현재 선택 범위의 목록 표현이다.
2. 선택 범위를 바꾸는 조작은 결과 유무와 무관하게 항상 보인다.
3. `일별`과 `기간별`은 동일한 위치에서 날짜 탐색을 제공하되, 조작 단위만 다르다.
4. 빠른 이동은 한 손 조작이 가능해야 하고, 정밀 선택은 별도 선택면으로 분리한다.
5. 날짜 변경 후 표시 방식은 유지한다. 사용자가 `목록`에서 날짜를 바꾸면 계속 `목록`에 머문다.

## 제안 UI

상단 구조를 다음 순서로 고정한다.

```text
굿즈/행사 캘린더
서버에서 동기화된 일정만 표시합니다.

[ 목록 ] [ 캘린더 ]
[ 일별 ] [ 기간별 ]

목록 날짜 탐색 헤더
결과 목록 또는 빈 상태
```

`목록 날짜 탐색 헤더`는 `viewMode == list`일 때 항상 표시한다. `calendar` 모드에서는 기존 월 이동 행과 월 그리드를 유지한다.

### 일별 목록 헤더

일별 모드에서는 다음 요소를 한 줄 또는 두 줄로 표시한다.

```text
[이전]  2026년 6월 13일 토요일  [다음]
        [오늘] [날짜 선택]
```

권장 모바일 레이아웃:

- 왼쪽: 이전 날짜 버튼
- 중앙: 선택 날짜 버튼
- 오른쪽: 다음 날짜 버튼
- 보조 행 또는 trailing 영역: `오늘`, `날짜 선택`

동작:

- `이전`은 선택 날짜를 하루 전으로 이동한다.
- `다음`은 선택 날짜를 하루 뒤로 이동한다.
- `오늘`은 선택 날짜를 디바이스 timezone 기준 오늘로 이동한다.
- 중앙 날짜 또는 `날짜 선택`을 누르면 날짜 선택 sheet/dialog를 연다.
- 날짜 변경 즉시 해당 날짜가 포함된 월 범위를 `/v1/hub-events/calendar`에서 확보한다.
- 이미 로드된 월 범위 안이면 네트워크 요청 없이 로컬 projection에서 visible entries를 다시 계산할 수 있다.

빈 상태 문구:

```text
선택한 날짜에 표시할 일정이 없습니다.
다른 날짜로 이동하거나 기간별로 넓혀보세요.
```

빈 상태에서도 `이전`, `다음`, `오늘`, `날짜 선택`은 그대로 유지한다.

### 기간별 목록 헤더

기간별 모드에서는 다음 요소를 표시한다.

```text
[이전 기간]  2026.06.13 - 2026.06.20  [다음 기간]
             [이번 주] [기간 선택]
```

동작:

- `이전 기간`은 현재 선택 기간 길이만큼 이전으로 이동한다.
- `다음 기간`은 현재 선택 기간 길이만큼 다음으로 이동한다.
- 선택 기간이 미완성인 경우에는 시작일 기준 7일 범위를 기본 이동 단위로 사용한다.
- `이번 주`는 timezone 기준 이번 주 월요일부터 일요일까지 선택한다.
- 중앙 기간 또는 `기간 선택`을 누르면 range picker sheet/dialog를 연다.
- 두 번째 선택일이 첫 번째 선택일보다 앞서면 기존 설계처럼 시작/종료를 normalize한다.

빈 상태 문구:

```text
선택한 기간에 표시할 일정이 없습니다.
이전/다음 기간으로 이동하거나 기간을 다시 선택해보세요.
```

## 날짜 선택면

`목록` 모드에서 날짜 또는 기간을 정밀 선택할 때는 platform-native 선택면을 사용한다.

### iOS

- `sheet` 또는 `presentationDetents([.medium, .large])` 기반 날짜 선택면을 사용한다.
- 일별 모드는 단일 날짜 선택 후 `완료` 없이 즉시 반영하거나, 하단 `적용` 버튼으로 확정한다.
- 기간별 모드는 시작일/종료일을 명확히 표시하고 `적용`으로 확정한다.
- 선택면 안에서도 읽기 전용 캘린더임을 유지하고 추가 버튼을 두지 않는다.

### Android

- `BottomSheetDialogFragment` 또는 app-local bottom sheet 패턴을 사용한다.
- Material DatePicker를 사용할 수 있지만, 앱 디자인이 특정 플랫폼 앱을 복제하지 않게 색상과 구성은 프로젝트 UI 가이드에 맞춘다.
- 기간 선택은 시작일과 종료일을 명확히 보여주고 `적용`으로 확정한다.
- sheet 밖 목록 헤더는 선택 완료 후 즉시 갱신된다.

## 상태 모델

기존 calendar UI state에 목록 날짜 탐색에 필요한 derived state를 추가한다.

```kotlin
enum class HubEventsViewMode {
    LIST,
    CALENDAR,
}

enum class HubCalendarScopeMode {
    DAY,
    RANGE,
}

data class HubEventsCalendarUiState(
    val viewMode: HubEventsViewMode,
    val scopeMode: HubCalendarScopeMode,
    val selectedMonth: YearMonth,
    val selectedDay: LocalDate,
    val rangeStart: LocalDate?,
    val rangeEnd: LocalDate?,
    val loadedFrom: LocalDate?,
    val loadedTo: LocalDate?,
    val days: List<HubCalendarDay>,
    val visibleEntries: List<HubCalendarEntry>,
    val isLoading: Boolean,
    val errorMessage: String?,
)
```

iOS도 동일 개념을 Swift enum과 `@Published` state로 유지한다.

```swift
enum HubEventsViewMode: String, CaseIterable, Identifiable {
    case list
    case calendar
}

enum HubCalendarScopeMode: String, CaseIterable, Identifiable {
    case day
    case range
}
```

새 public actions:

```text
goToPreviousDay()
goToNextDay()
goToToday()
openDatePicker()
applySelectedDay(date)
goToPreviousRange()
goToNextRange()
goToCurrentWeek()
openRangePicker()
applySelectedRange(start, end)
```

## 조회 범위

목록 날짜 이동은 기존 `GET /v1/hub-events/calendar` 계약을 재사용한다.

일별 모드:

- 기본적으로 선택 날짜가 속한 월의 시작일부터 종료일까지 조회한다.
- 이전/다음으로 월 경계를 넘으면 새 월 범위를 조회한다.
- 이미 로드된 범위 안에서 움직이면 로컬 `days`에서 visible entries만 재계산한다.

기간별 모드:

- 선택 기간이 한 달 안에 있으면 해당 월 범위를 조회한다.
- 선택 기간이 월 경계를 넘으면 `from = rangeStart`, `to = rangeEnd`를 포함하는 최소 범위를 조회한다.
- 서버 또는 클라이언트는 기존 API 상한을 넘는 과도한 기간을 허용하지 않는다.

오류 시:

- 마지막 성공 응답이 있으면 stale 목록을 유지하고 헤더 아래에 재시도 affordance를 표시한다.
- 마지막 성공 응답이 없으면 빈 상태 대신 오류 상태와 `다시 시도`를 표시한다.
- 오류 상태에서도 날짜 헤더는 유지한다.

## 정렬과 그룹핑

`목록` 모드 visible entries는 선택 범위에 따라 다음 방식으로 표시한다.

일별:

- 선택 날짜의 entries만 표시한다.
- 기존 status/date/id 정렬을 유지한다.

기간별:

- 날짜 그룹 헤더를 표시한다.
- 각 날짜 안에서는 기존 status/date/id 정렬을 유지한다.
- 여러 날짜에 걸친 일정은 backend calendar projection이 제공한 occurrence 단위로 각 날짜 그룹에 나타날 수 있다.
- occurrence deduplication은 이번 설계 범위에서 하지 않는다.

## 접근성

날짜 탐색 버튼과 선택값에는 명확한 label을 제공한다.

예시:

```text
이전 날짜, 2026년 6월 12일로 이동
다음 날짜, 2026년 6월 14일로 이동
선택 날짜, 2026년 6월 13일 토요일, 일정 없음
오늘로 이동, 2026년 6월 13일
기간 선택, 2026년 6월 13일부터 2026년 6월 20일까지, 일정 2개
```

요구사항:

- 날짜 이동 버튼 tap target은 최소 44 dp/pt를 유지한다.
- 색상만으로 이전/다음/오늘 상태를 구분하지 않는다.
- VoiceOver/TalkBack에서 `목록`, `캘린더`, `일별`, `기간별` 선택 상태를 읽을 수 있어야 한다.
- 긴 한국어 날짜는 줄바꿈되어도 버튼 영역이 겹치지 않아야 한다.

## 플랫폼별 구현 메모

### Android

- `CalendarUiPolicy`에 날짜 이동과 range 이동 pure function을 둔다.
- `HubEventsCalendarViewModel`이 loaded range와 selected scope를 관리한다.
- `HubEventsCalendarView`는 목록 모드에서 `ListDateNavigationHeader`를 렌더링한다.
- XML/View 또는 Compose 여부와 관계없이 header, empty state, list는 분리된 render 함수로 유지한다.
- 기존 FAB 또는 추가 버튼은 계속 금지한다.

권장 pure functions:

```kotlin
fun previousDay(selectedDay: LocalDate): LocalDate
fun nextDay(selectedDay: LocalDate): LocalDate
fun currentWeek(today: LocalDate): ClosedRange<LocalDate>
fun shiftRange(start: LocalDate?, end: LocalDate?, direction: Int): Pair<LocalDate, LocalDate>
fun needsCalendarFetch(targetFrom: LocalDate, targetTo: LocalDate, loadedFrom: LocalDate?, loadedTo: LocalDate?): Boolean
```

### iOS

- `HubEventsCalendarViewModel`에 날짜 이동 action과 range 이동 action을 둔다.
- `HubEventsView` 또는 `HubEventsCalendarView`에서 `ListDateNavigationHeader` SwiftUI component를 분리한다.
- 날짜 선택 sheet는 `@State`로 presentation만 관리하고, 실제 선택 상태는 view model action으로 갱신한다.
- iOS grouped list rhythm은 유지하되 Apple Settings 화면을 그대로 복제하지 않는다.
- toolbar plus, add sheet, create form은 추가하지 않는다.

## 테스트 계획

### 공통 정책 테스트

- `목록 + 일별`에서 이전 날짜 이동 시 selectedDay가 하루 전으로 바뀐다.
- `목록 + 일별`에서 다음 날짜 이동 시 selectedDay가 하루 뒤로 바뀐다.
- `오늘`은 timezone 기준 오늘로 이동한다.
- `목록 + 기간별`에서 이전/다음 기간 이동은 현재 기간 길이를 유지한다.
- 미완성 range에서 이전/다음 기간 이동은 7일 기본 범위를 사용한다.
- reversed range는 시작/종료가 normalize된다.
- loaded range 안의 날짜 이동은 추가 fetch가 필요 없다고 판정한다.
- 월 경계를 넘는 날짜 이동은 fetch가 필요하다고 판정한다.
- 빈 상태에서도 date navigation action model이 존재한다.
- add/create/edit action은 노출되지 않는다.

### Android

- `CalendarUiPolicyTest`에 날짜 이동과 fetch 필요 여부 테스트를 추가한다.
- `HubEventsCalendarViewModelTest`에 list mode day/range navigation 테스트를 추가한다.
- 접근성 label 생성 테스트를 추가한다.

권장 검증:

```bash
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.stellive.hub.CalendarUiPolicyTest
rtk android/StelliveHubAndroid/gradlew -p android/StelliveHubAndroid :app:testDebugUnitTest --tests dev.stellive.hub.HubEventsCalendarViewModelTest
```

### iOS

- `HubEventsCalendarViewModelTests`에 day navigation, range navigation, reversed range, fetch boundary 테스트를 추가한다.
- VoiceOver label string을 view model 또는 policy helper에서 테스트할 수 있게 분리한다.

권장 검증:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "platform=iOS Simulator,name=iPhone 16" -only-testing:StelliveHubiOSTests/HubEventsCalendarViewModelTests
```

## 수용 기준

- iOS와 Android 모두 `목록` 모드에서 날짜 또는 기간을 바로 변경할 수 있다.
- 선택 범위에 일정이 없어도 날짜 탐색 헤더가 유지된다.
- 날짜 변경 후 사용자는 `목록` 모드에 그대로 남는다.
- `일별`은 이전/다음 날짜, 오늘, 날짜 선택을 제공한다.
- `기간별`은 이전/다음 기간, 이번 주, 기간 선택을 제공한다.
- 일정 생성, 수정, 삭제 진입점은 없다.
- `/v1/hub-events/calendar` 외 새 backend ingestion 또는 push path가 생기지 않는다.
- 공식 이미지, 로고, 포스터, 캡처 이미지, fan asset이 추가되지 않는다.
- Former member, 공식 YouTube live event, X notification delivery가 재도입되지 않는다.

## 롤아웃

1. Android/iOS view model과 policy layer에 날짜 이동 pure function을 먼저 추가한다.
2. 목록 모드 header를 mock data 기준으로 붙인다.
3. 서버 calendar response cache boundary와 fetch 필요 여부를 연결한다.
4. 빈 상태와 오류 상태에서도 header가 유지되는지 확인한다.
5. 좁은 화면, Dynamic Type, VoiceOver/TalkBack을 수동 검증한다.

## 열어둘 결정

- `이번 주`의 주 시작일을 모든 locale에서 월요일로 고정할지, 사용자 locale을 따를지 결정해야 한다. MVP 권장은 한국 사용자 맥락에 맞춰 월요일 시작이다.
- 날짜 선택 sheet/dialog는 iOS와 Android 모두 `적용` 버튼으로 확정한다. 이는 accidental tap으로 목록 범위가 즉시 바뀌는 문제를 줄이기 위한 MVP 결정이다.
- 기간별 기본 range 길이를 7일로 둘지 마지막 사용 range 길이를 저장할지 결정해야 한다. MVP 권장은 상태가 있는 동안 마지막 range 길이를 유지하고, 미완성 range에는 7일을 사용한다.
