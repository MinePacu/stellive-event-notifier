# Mobile Song Page Full Fetch and iOS Thumbnail Fix Design Plan

## Goal

Android/iOS 노래 페이지가 서버에 저장된 공식 커버곡 목록을 누락 없이 사용할 수 있게 하고, iOS에서 일부 YouTube thumbnail URL 이미지가 로드되지 않을 때 사용자에게 빈 영역이 보이지 않도록 한다.

## Current Diagnosis

- 서버 DB에는 공식 Stellive cover playlist 기준 `cover` 244건이 저장되어 있다.
- 현재 공개 API 커서 순회는 `limit=100` 기준 100건 + 100건 + 0건으로 끝난다. DB 저장 실패가 아니라 API cursor 조건 결함이다.
- Android/iOS는 서버 첫 페이지를 `limit=30`으로 한 번만 가져온 뒤 그 일부 목록에 클라이언트 페이지네이션을 적용한다.
- Android thumbnail은 같은 URL에서 정상 로드되는 반면 iOS는 `AsyncImage` 단일 URL 로드 실패 시 fallback URL 재시도 없이 placeholder로 끝난다.

## Required Behavior

### Server pagination dependency

- 모바일 전체 수집이 실제 244건에 도달하려면 백엔드 `/v1/music` cursor가 먼저 안정적이어야 한다.
- `publishedAt_desc` 정렬 cursor는 `publishedAt + id` 복합 cursor로 처리한다.
- `playlistOrder` 정렬 cursor는 `playlistPosition + publishedAt + id` 기준으로 처리한다.
- 기존 `nextCursor` 응답 필드는 유지하되, cursor 값은 내부적으로 복합 cursor를 encode한 문자열로 바꿔도 된다.
- 이전 단일 `id` cursor가 들어와도 가능한 한 깨지지 않게 처리한다.

### Mobile full fetch

- Android/iOS는 노래 페이지 refresh 시 서버 cursor를 끝까지 따라가서 전체 server-side page를 모은다.
- 서버 요청 `limit`은 최대 허용값인 `100`을 사용한다.
- 클라이언트 UI 페이지네이션은 서버에서 받은 전체 목록에 대해 기존 page size 20으로 유지한다.
- 중복 `id` 또는 `youtubeVideoId`가 내려오면 최초 항목 순서를 유지하고 중복을 제거한다.
- 안전장치로 최대 요청 페이지 수와 최대 항목 수를 둔다.
  - 권장값: 10 pages, 1000 items.
  - 현재 cover 244, original 24 기준 충분하다.
- 첫 페이지부터 실패하면 기존 fallback/mock 또는 기존 cache를 사용한다.
- 중간 페이지 실패 시 이미 받은 항목이 있으면 부분 목록을 표시하되, crash는 발생하지 않게 한다.

### iOS thumbnail fallback

- iOS `SongThumbnailView`는 backend `thumbnailUrl`을 1순위로 사용한다.
- `thumbnailUrl` 로드 실패 시 `youtubeVideoId` 기반 fallback URL을 순차 시도한다.
  - `https://i.ytimg.com/vi/{videoId}/hqdefault.jpg`
  - `https://i.ytimg.com/vi/{videoId}/mqdefault.jpg`
  - `https://i.ytimg.com/vi/{videoId}/default.jpg`
- fallback URL도 실패하면 기존 placeholder를 표시한다.
- 모바일 앱에는 YouTube Data API key, `youtube.googleapis.com`, `/youtube/v3` 호출을 추가하지 않는다. 이미 공개 이미지 CDN URL만 렌더링한다.

## Scope

### In scope

- Backend public music cursor 안정화.
- Android server song fetch가 `nextCursor`를 끝까지 순회하도록 변경.
- iOS server song fetch가 `nextCursor`를 끝까지 순회하도록 변경.
- iOS thumbnail fallback loader 또는 fallback view 구현.
- 변경된 코드와 직접 연결된 focused tests.

### Out of scope

- YouTube sync worker 재설계.
- 공식 playlist ID 변경.
- 신규 이미지 라이브러리 추가.
- Android thumbnail loader 대규모 교체.
- 서버 API 응답 DTO 필드명 변경.
- 앱 UI 전체 리디자인.

## File Responsibilities

### Backend

- `backend/stellive-hub-api/src/repositories/musicRepository.ts`
  - public music list cursor encode/decode와 정렬별 pagination 조건을 담당한다.
- `backend/stellive-hub-api/test/musicRepository.test.ts`
  - cursor 조건이 정렬 기준과 일치하는지 repository call arguments로 검증한다.

### Android

- `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/ServerHubRepository.kt`
  - `/v1/music`, `/v1/members/:id/music` cursor 순회와 중복 제거를 담당한다.
- `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/ServerHubRepositoryTest.kt`
  - `nextCursor`가 있을 때 여러 페이지를 합치는지 검증한다.

### iOS

- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
  - `api.music`, `api.memberMusic` cursor 순회와 중복 제거를 담당한다.
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - thumbnail fallback URL 후보 생성과 순차 로드 UI를 담당한다.
- `ios/StelliveHubiOS/StelliveHubiOSTests/HubAPIClientTests.swift` 또는 `SongUiPolicyTests.swift`
  - 가능한 경우 URL 후보 생성 같은 pure helper를 테스트한다.

## Token-Minimized Work Strategy

- 먼저 위 파일만 읽고 수정한다.
- repository 전체 검색은 다음 패턴으로 제한한다.
  - `nextCursor`
  - `limit = 30`
  - `thumbnailUrl`
  - `SongThumbnailView`
- 기존 작동하는 UI 구조는 유지하고 full fetch/fallback만 바꾼다.
- 새 추상화는 중복 제거 또는 테스트 가능성에 필요한 경우에만 만든다.
- 실패 로그 전체를 붙이지 말고 focused test 실패 요약만 확인한다.

## Focused Test Strategy

변경된 코드와 직접 연관된 테스트만 실행한다.

- Backend:

```bash
rtk npm test -- musicRepository
```

- Android:

```bash
rtk ./gradlew :app:testDebugUnitTest --tests dev.stellive.hub.ServerHubRepositoryTest --tests dev.stellive.hub.SongUiPolicyTest
```

- iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination "id=89B0B46A-8515-47E7-A122-681498F16C66" -only-testing:StelliveHubiOSTests/HubAPIClientTests -only-testing:StelliveHubiOSTests/SongUiPolicyTests
```

Broader build/test는 focused tests가 공통 모델 compile 오류를 드러낼 때만 수행한다.

## Acceptance Criteria

- `/v1/music?type=cover&limit=100` cursor 순회로 기본 필터 기준 cover 242건 이상에 도달한다.
- include 조건을 완화한 내부 확인에서 DB cover 244건과 API 순회 결과가 일치한다.
- Android song refresh는 `nextCursor`를 끝까지 따라가고, 받은 전체 목록에서 20개 단위 client pagination을 적용한다.
- iOS song refresh도 동일하게 전체 목록을 받은 뒤 client pagination을 적용한다.
- iOS thumbnail은 backend URL 실패 시 YouTube public thumbnail fallback URL을 시도하고, 모두 실패하면 placeholder를 표시한다.
- 모바일 앱은 YouTube Data API를 직접 호출하지 않는다.
