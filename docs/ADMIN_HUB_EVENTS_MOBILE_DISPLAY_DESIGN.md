# 어드민 굿즈/행사 모바일 표시 기능 구성

## 목적

서버 어드민 콘솔에서 생성하고 게시한 `굿즈/행사` 데이터를 Android와 iOS 앱의 `굿즈/행사` 목록, 캘린더, 상세 화면에서 동일한 공개 API 계약으로 표시한다.

이 기능은 모바일 앱이 외부 플랫폼을 직접 조회하지 않고, 백엔드가 검증한 `HubEvent` 공개 DTO만 소비하는 구조를 유지한다. 어드민 콘솔은 생성/수정/게시/취소의 작성 도구이고, 모바일 앱은 게시된 행사만 읽는 클라이언트다.

## 현재 코드 분석 요약

백엔드는 이미 어드민 작성 경계와 공개 읽기 경계를 분리하고 있다.

- 어드민 라우트: `backend/stellive-hub-api/src/routes/adminHubEventRoutes.ts`
- 어드민 검증/게시 서비스: `backend/stellive-hub-api/src/hub-events/hubEventAdminService.ts`
- 공개 읽기 라우트: `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`
- 공개 읽기/상세/요약 서비스: `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- Prisma 저장소: `backend/stellive-hub-api/src/hub-events/hubEventRepository.ts`
- 캘린더 투영: `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`

공개 API는 다음 모바일 표면에 필요한 계약을 이미 가진다.

- `GET /v1/hub-events`: 게시된 행사 목록
- `GET /v1/hub-events/:id`: 게시된 행사 상세
- `GET /v1/hub-events/calendar`: 날짜 범위별 캘린더 투영
- `GET /v1/hub-events/widget-snapshot`: 위젯용 compact 투영
- `GET /v1/bootstrap`: 초기 요약과 위젯 스냅샷

Android는 `HubRepository`가 현재 `bootstrap()` 중심이고, `ServerHubRepository`가 서버 응답 중 라이브 상태를 주로 병합한다. `HubApi.kt`에는 아직 `GET /v1/hub-events`, `GET /v1/hub-events/:id`, `GET /v1/hub-events/calendar` 호출이 없다. `MainActivity`의 굿즈/행사 화면과 상세 화면은 `MockHubRepository`가 가진 `hubEvents`와 `calendarDaysForFilter("all")`에 강하게 묶여 있다.

iOS는 `HubAPIClient.hubEventsCalendar(from:to:timezone:)`가 이미 있지만 `ServerHubStore`가 bootstrap만 적용하고, `HubEventsView`와 상세 진입은 `MockHubStore.calendarDays(for:)`와 `hubEvents` 기반으로 남아 있다. 상세 화면 컴포넌트인 `HubEventDetailView`는 존재하지만, 서버 상세 API에서 최신 게시 데이터를 불러오는 store 경계가 아직 연결되지 않았다.

백엔드 운영상 핵심 전제는 `HUB_EVENTS_STORAGE_MODE=prisma`다. 기본값인 `memory` 모드에서는 공개 읽기 API가 시드/메모리 데이터 중심으로 동작할 수 있으므로, 어드민에서 저장한 DB 행사가 모바일 공개 API에 나타나려면 Prisma 모드와 마이그레이션 적용이 필요하다.

## 사용자 흐름

1. 운영자가 서버 어드민 콘솔에서 굿즈/행사 초안을 만든다.
2. 어드민 서비스가 제목, 출처 URL, 분류, 참여 방식, 기수/멤버, 기간, 이미지 메타데이터 정책을 검증한다.
3. 운영자가 행사를 `published` 상태로 게시한다.
4. 백엔드는 게시된 행사만 공개 API에 노출한다.
5. Android/iOS 앱은 `굿즈/행사` 화면 진입 또는 새로고침 시 공개 API를 호출한다.
6. 목록/캘린더 행을 누르면 앱은 `eventId`로 `GET /v1/hub-events/:id`를 호출하거나 최신 캐시에 있는 동일 ID를 사용한다.
7. 상세 화면은 서버 DTO의 제목, 요약, 기간, 장소, 출처, 구매/티켓 URL, 허용된 이미지 메타데이터만 렌더링한다.

## 기능 범위

포함한다.

- 게시된 어드민 행사를 모바일 목록에 표시
- 게시된 어드민 행사를 모바일 캘린더에 표시
- 캘린더/목록/푸시 딥링크의 `stellivehub://hub-events/{id}`를 상세 화면으로 연결
- 상세 진입 시 `GET /v1/hub-events/:id`로 최신 행사 로드
- 네트워크 실패 시 기존 앱 내 목업 또는 마지막 성공 캐시로 graceful fallback
- 위젯 스냅샷은 compact read-only projection으로 유지

포함하지 않는다.

- 모바일 앱에서 행사 생성, 수정, 삭제
- 외부 플랫폼 직접 호출
- unauthorized crawling, login-cookie scraping, private cafe 수집
- 공식 로고, 프로필 이미지 바이너리, 팬아트, 캡처 이미지 번들링
- 공식 YouTube live scheduled/started/ended 행사 생성

## 공개 API 데이터 계약

모바일 목록과 상세는 `HubEvent`를 기준으로 한다.

필수 필드:

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

선택 필드:

- `summary`
- `memberId`
- `announcedAt`
- `startsAt`
- `endsAt`
- `purchaseUrl`
- `ticketUrl`
- `venueName`
- `venueAddress`
- `image`

캘린더는 `HubCalendarResponse.days[].entries[]`를 기준으로 한다. 각 entry는 상세 진입에 필요한 `eventId`, `appDeepLink`, `platformUrl`을 포함해야 한다. 특수일 entry는 `entryKind != "hub_event"`로 구분되며 상세 화면 진입 대상이 아니다.

## 상태와 표시 정책

백엔드는 공개 응답에서 effective status를 계산한다. 모바일은 서버 status를 다시 해석해 보안/정책 결정을 하지 않고 표시와 정렬 보조에만 사용한다.

상태 표시 우선순위:

1. `closing_soon`
2. `open`
3. `upcoming`
4. `announced`
5. `cancelled`
6. `ended`

`cancelled`와 `ended`는 상세 접근이 가능하지만, 위젯과 기본 preview에서는 후순위다. 삭제된 행사와 미게시 초안은 공개 API에 절대 나오지 않는다.

## 상세 화면 로드 정책

상세 화면은 다음 순서로 데이터를 결정한다.

1. `eventId`가 없거나 딥링크 형식이 잘못되면 목록 화면으로 복귀한다.
2. 메모리 캐시에 같은 `eventId`의 최신 `HubEvent`가 있으면 즉시 skeleton 없이 표시한다.
3. 동시에 또는 직후 `GET /v1/hub-events/:id`를 호출해 최신 게시 상태를 가져온다.
4. 서버가 `200`을 반환하면 상세 화면을 최신 DTO로 갱신한다.
5. 서버가 `404`를 반환하면 “게시되지 않았거나 삭제된 행사” 상태를 표시하고 목록으로 돌아갈 수 있게 한다.
6. 네트워크 실패 시 캐시가 있으면 캐시 상세와 stale 안내를 표시하고, 캐시가 없으면 재시도 상태를 표시한다.

상세 화면은 `purchaseUrl`, `ticketUrl`, `sourceUrl` 중 사용 가능한 외부 URL을 버튼으로 제공하되, 앱 내 상세 진입 자체는 항상 `eventId` 기반이다.

## Android 구성

추가 또는 변경할 경계:

- `core/network/HubApi.kt`: 공개 목록, 상세, 캘린더 API 메서드 추가
- `core/network/HubApiModels.kt`: `HubEventDto`, `HubEventsListResponseDto`, `HubCalendarResponseDto` 매핑 보강
- `feature/home/HubRepository.kt`: `hubEvents`, `calendarDays`, `hubEventDetail(id)` 읽기 계약 추가
- `feature/home/ServerHubRepository.kt`: 공개 API 호출, 캐시, fallback 병합
- `feature/home/MockHubRepository.kt`: fallback 전용으로 유지하고 서버 성공 시 표시 데이터의 주 소스가 되지 않게 조정
- `MainActivity.kt`: 굿즈/행사 목록/캘린더/상세가 repository read state를 사용하도록 연결
- `feature/calendar/HubCalendarDeepLinkPolicy.kt`: `entryKind == HUB_EVENT`만 상세 진입 허용 유지

Android 앱은 CHZZK, YouTube, Naver 등 외부 플랫폼 API를 직접 호출하지 않는다.

## iOS 구성

추가 또는 변경할 경계:

- `Services/HubAPIClient.swift`: 이미 있는 calendar 호출을 유지하고 목록/상세 호출 추가
- `Services/ServerHubStore.swift`: bootstrap 외에 공개 목록/상세/캘린더 로딩과 캐시를 소유
- `Services/MockHubStore.swift`: fallback/preview 데이터로 유지
- `Views/HubEventsView.swift`: `store.calendarDays`와 `store.hubEvents`가 서버 성공 데이터를 반영하도록 연결
- `Views/HubEventsCalendarView.swift`: entry 탭 시 `eventId` 상세 경로로 이동
- `Views/HubEventDetailView.swift`: 서버 상세 loading/error/stale 상태를 감싸는 container 추가

iOS 위젯은 `HubCalendarWidgetStore`의 compact snapshot을 계속 사용하며 외부 API나 어드민 API를 직접 호출하지 않는다.

## 백엔드 운영 전제

어드민 콘솔에서 추가한 데이터가 모바일 공개 API에 보이려면 다음 조건을 만족해야 한다.

- Prisma 마이그레이션이 적용되어 `HubEvent` 테이블이 존재한다.
- API 서버가 `HUB_EVENTS_STORAGE_MODE=prisma`로 실행된다.
- 어드민 콘솔의 저장/게시 동작이 `HubEventRepository`에 기록된다.
- 공개 API는 `publicationState = "published"`이고 `deletedAt = null`인 레코드만 반환한다.
- `/v1/admin/hub-events/*`는 어드민 인증이 필요하지만 `/v1/hub-events*` 공개 읽기 경로는 모바일 앱이 접근 가능한 origin에서 제공된다.

## 토큰 최소화 운영 방식

분석과 구현 중 토큰 사용량을 줄이기 위해 다음 방식을 사용한다.

- 파일 탐색은 `CODEMAP.md`에서 후보 파일을 먼저 좁힌 뒤 `rtk rg`로 직접 확인한다.
- 셸 명령은 항상 `rtk`를 붙여 실행한다.
- 큰 파일은 전체 출력 대신 `rtk rg -n`으로 심볼/문자열 위치를 찾고 필요한 줄 범위만 `rtk proxy sed -n`으로 읽는다.
- 백엔드, Android, iOS를 한 번에 전수 탐색하지 않고 `HubEvent`, `HubCalendar`, `ServerHubRepository`, `HubAPIClient`, `HubEventDetail` 키워드 중심으로 추적한다.
- 테스트도 전체 실행 전에 변경 경계별 focused test를 먼저 실행한다.
- 문서/계획에서는 기존 문서 링크를 재사용하고, 이미 확정된 정책은 요약만 남겨 중복을 줄인다.

## 수용 기준

- 어드민에서 게시한 행사가 `GET /v1/hub-events`에 나타난다.
- 같은 행사가 `GET /v1/hub-events/:id`에서 상세 DTO로 조회된다.
- 같은 행사가 날짜 범위가 겹칠 때 `GET /v1/hub-events/calendar`에 나타난다.
- Android 굿즈/행사 목록과 캘린더가 서버 게시 행사를 표시한다.
- Android 상세 화면이 서버 상세 DTO를 로드하고 404/네트워크 실패를 처리한다.
- iOS 굿즈/행사 목록과 캘린더가 서버 게시 행사를 표시한다.
- iOS 상세 화면이 서버 상세 DTO를 로드하고 404/네트워크 실패를 처리한다.
- Former member, Gangzi generation member, official YouTube live event, unauthorized image asset, raw provider payload가 새 데이터 경로에 들어오지 않는다.
