# Mobile Song Page Link Member Filter Thumbnail Design Plan

## Goal

Android/iOS 노래 페이지에서 노래 카드의 YouTube 이동, 멤버별 필터 진입 UX, 16:9 썸네일 표시 정책을 양 플랫폼에 맞춰 개선한다.

## Current Diagnosis

- iOS `SongRow`는 `Link(destination: song.youtubeUrl)` 구조라 노래 선택 시 외부 YouTube URL 이동 경로가 이미 있다.
- Android 노래 카드에는 `youtubeUrl`을 열기 위한 클릭 처리 경로가 없는 것으로 보인다. 기존 `openExternalUrl()` 유틸을 재사용하면 된다.
- 현재 노래 페이지는 기수/타입/검색/페이지네이션이 한 화면에 있고, 멤버별 필터까지 chip으로 늘리면 화면 밀도가 높아진다.
- iOS/Android 썸네일은 서버에서 받은 `thumbnailUrl` 또는 YouTube public fallback URL을 표시하되, Android는 iOS와 동일한 16:9 영역 정책이 부족하다.
- 썸네일 원본이 16:9가 아니더라도 이미지를 늘려 왜곡하면 안 된다. 16:9 컨테이너 안에서 비율을 유지하고 중앙 기준으로 채우는 정책이 적합하다.

## UX Decision: Member Filter Page

멤버별 필터는 별도 페이지로 분리한다. 단, 별도 페이지로 들어가는 비용을 줄이기 위해 선택 즉시 반영과 빠른 해제 액션을 함께 둔다.

- 멤버는 10명 이상이고 곡 수가 계속 늘어날 구조라 chip 한 줄/가로 스크롤만으로 처리하면 노래 페이지가 복잡해진다.
- 노래 페이지 상단에는 현재 선택값 요약만 둔다. 예: `멤버: 전체` 또는 `멤버: 네네코 마시로`.
- `멤버 선택` 행/버튼을 누르면 별도 선택 페이지로 이동한다.
- 선택 페이지는 기존 앱의 title bar/back navigation을 그대로 쓰고, `전체` + 현재 활동 멤버만 노출한다.
- 멤버 목록은 기수별로 묶어 보여준다. 노래 필터에는 `gen1`, `gen2`, `gen3`의 active member만 포함하고 `gamja`, `official`은 포함하지 않는다.
- 선택 페이지에서 멤버를 누르면 선택 상태를 즉시 저장하고 이전 노래 페이지로 돌아간다.
- 멤버 선택/해제 시 페이지 번호는 항상 1로 초기화한다.
- 선택된 멤버가 있을 때 노래 페이지 요약 행에는 빠른 해제 액션을 둔다. 예: `전체로 보기` 또는 trailing `X`.

이 방식은 현재 화면의 밀도를 낮추면서 Android/iOS 양쪽에서 같은 정보 구조를 만들 수 있다. 별도 bottom tab은 만들지 않는다.

## Functional Requirements

### 1. Android song card YouTube link

- Android 노래 카드 클릭 시 `song.youtubeUrl`을 `ACTION_VIEW`로 연다.
- URL이 비어 있거나 `http://`, `https://`가 아니면 클릭 가능 상태를 끄거나 no-op 처리한다.
- 모바일 앱은 계속 서버 API가 내려준 `youtubeUrl`만 사용한다. YouTube Data API나 API key는 모바일에서 사용하지 않는다.

### 2. Member filter page

- Android/iOS 모두 노래 페이지에서 `멤버 선택` 진입점을 제공한다.
- 필터 옵션은 `전체`와 `store/server bootstrap member catalog`의 active member만 사용한다.
- 선택 상태는 노래 페이지 state로 유지한다.
- 필터 적용 순서는 `type -> generation -> member -> query -> client pagination`으로 고정한다.
- 콜라보 곡은 `song.members` 중 선택 멤버가 하나라도 있으면 노출한다.
- 선택 페이지에서 멤버를 누르면 선택값을 저장하고 노래 페이지로 복귀한다.
- 노래 페이지의 멤버 요약 행은 현재 선택값과 결과 수를 보여준다.
- 선택된 멤버가 `all`이 아닐 때는 요약 행에서 바로 `전체`로 해제할 수 있어야 한다.
- 빠른 해제 액션도 페이지 번호를 1로 초기화한다.

### 3. 16:9 thumbnail container

- Android/iOS 모두 노래 카드 썸네일 컨테이너는 16:9로 통일한다.
- 권장 크기:
  - iOS: `96x54` 또는 기존 행 높이에 맞춘 동등한 16:9 크기
  - Android: `112x63dp` 또는 기존 카드 여백에 맞춘 동등한 16:9 크기
- 원본 이미지 비율이 16:9가 아니어도 이미지는 stretch 하지 않는다.
- 기본 표시 정책은 center-crop이다.
  - Android: `ImageView.ScaleType.CENTER_CROP`
  - iOS: `resizable().scaledToFill().frame(width:height).clipped()`
- placeholder와 fallback 실패 UI도 동일한 16:9 영역을 사용한다.

## Scope

### In scope

- Android 노래 카드 클릭 처리.
- Android 노래 썸네일 영역 16:9화.
- iOS 노래 썸네일 영역 16:9화.
- Android/iOS 멤버 필터 선택 페이지 또는 equivalent navigation screen.
- Android/iOS 멤버 필터 빠른 해제 액션.
- 변경된 UI 정책에 대한 focused tests.

### Out of scope

- Backend music API 변경.
- YouTube sync worker 변경.
- YouTube API direct mobile call 추가.
- 신규 이미지 라이브러리 도입.
- 멤버 catalog policy 변경.
- 노래 상세 화면 신규 구현.

## File Responsibilities

### Android

- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
  - 노래 페이지 렌더링, 멤버 선택 페이지 렌더링, 노래 카드 클릭 처리, 빠른 해제 액션, 16:9 thumbnail view 구성.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt`
  - 필요한 경우 `SONG_MEMBER_FILTER` screen id 추가.
- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
  - 노래 URL validation, 멤버 필터 옵션, member matching, member filter label, quick clear 가능 여부, 16:9 thumbnail size/aspect policy helper.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/SongUiPolicyTest.kt`
  - URL validation, member filter option exclusion, selected member matching, member label/clear policy, thumbnail aspect policy 테스트.

### iOS

- `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - 멤버 선택 navigation, 선택 상태 반영, 빠른 해제 액션, 16:9 thumbnail frame/content mode 적용.
- `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`
  - member filter option exclusion, selected member matching, member label/clear policy, thumbnail aspect policy 테스트.

## Data and Policy Rules

- 멤버 필터는 active member만 포함한다.
- `gamja`, `official`은 노래 멤버 필터 옵션에서 제외한다.
- 단체곡/콜라보는 여러 `song.members` row를 그대로 활용한다.
- `youtubeUrl`은 서버 응답값을 사용하고, 모바일에서 URL을 합성하지 않는다.
- 썸네일 URL은 기존 서버 응답/fallback 정책을 유지하되, 표시 영역만 16:9로 통일한다.

## Acceptance Criteria

- Android 노래 카드를 누르면 유효한 `youtubeUrl`이 외부 브라우저/YouTube 앱으로 열린다.
- iOS 기존 YouTube 이동 동작은 유지된다.
- Android/iOS 노래 페이지에서 멤버별 필터 선택 페이지에 진입할 수 있다.
- 멤버 선택 후 노래 목록은 선택 멤버가 참여한 곡만 보여준다.
- `전체` 선택 시 멤버 필터가 해제된다.
- 선택된 멤버가 있을 때 노래 페이지에서 한 번의 탭으로 `전체` 상태로 해제할 수 있다.
- 멤버 선택 또는 빠른 해제 후 현재 페이지는 1로 초기화된다.
- 노래 썸네일 영역은 Android/iOS 모두 16:9다.
- 16:9가 아닌 원본 썸네일도 왜곡 없이 16:9 영역 안에 표시된다.
- 변경된 정책/헬퍼 테스트만 focused로 통과한다.
