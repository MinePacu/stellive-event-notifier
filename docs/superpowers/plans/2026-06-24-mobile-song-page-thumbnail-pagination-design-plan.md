# Mobile Song Page Thumbnail And Client Pagination Design Plan

**Goal:** iPhone/Android 노래 페이지에서 서버가 내려주는 YouTube 썸네일을 실제 카드에 표시하고, 긴 노래 목록을 클라이언트 기준 페이지 단위로 나누어 볼 수 있게 한다.

## Current State

- iOS `SongCatalogItem`에는 `thumbnailUrl`과 `thumbnail?.url`이 이미 매핑되어 있지만 `SongsView.SongThumbnailView`는 고정 placeholder만 렌더링한다.
- Android `SongCatalogItem`에도 `thumbnailUrl`이 있고 `ServerHubRepository`에서 DTO 값을 매핑하지만 `songCard(song)`에는 썸네일 영역이 없다.
- 양 플랫폼 모두 현재 필터링된 `songs` 전체를 한 화면 목록에 렌더링하므로 COVER 약 240개 이상인 경우 스크롤 목록이 길다.
- 모바일 앱은 서버 API만 호출하며 YouTube Data API key나 YouTube API endpoint를 직접 사용하지 않는다.

## Target UX

### Thumbnail

- iOS 노래 카드의 기존 thumbnail placeholder 영역에 `song.thumbnailUrl`을 우선 표시한다.
- iOS는 기존 앱에서 사용 중인 SwiftUI `AsyncImage` 패턴을 재사용한다.
- Android 노래 카드에는 iOS와 동일한 의미의 좌측 썸네일 영역을 추가한다.
- Android는 새 이미지 라이브러리를 추가하지 않고 기존 `ImageView` + background thread URL decode 패턴을 재사용한다.
- `thumbnailUrl`이 없거나 로딩에 실패하면 현재 placeholder mood를 유지한다.
- 썸네일 URL은 서버 API 응답으로 받은 HTTPS URL만 사용한다. 앱에는 YouTube API key나 직접 YouTube API 호출을 추가하지 않는다.

### Client Pagination

- 페이지 분할은 기본적으로 클라이언트에서 처리한다.
- 서버 cursor pagination은 이번 UI 개선 범위에서 사용하지 않는다.
- 클라이언트는 서버에서 받아온 현재 song list를 필터/검색 적용 후 slice한다.
- 기본 page size는 `20`개로 한다.
- 페이지 번호는 1부터 시작한다.
- 필터 또는 검색어가 바뀌면 page는 1로 reset한다.
- 목록 하단에 page control을 표시한다.
  - 이전
  - `현재 페이지 / 전체 페이지`
  - 다음
- 전체 페이지 수가 1이면 page control을 숨긴다.
- 범위를 벗어난 page는 마지막 page 이하로 clamp한다.

## Data And Policy Rules

- 노래 카드 썸네일 source priority:
  1. `SongCatalogItem.thumbnailUrl`
  2. `SongCatalogItem.thumbnail?.url`
  3. placeholder
- 페이지 계산은 화면에 표시되는 최종 목록 기준이다.
  - type filter 적용
  - generation filter 적용
  - query filter 적용
  - 그 후 pagination 적용
- pagination은 정렬 순서를 바꾸지 않는다.
- `gamja`, `official`, Former member는 노래 페이지 generation filter에 추가하지 않는다.
- 새 asset, 공식 로고, 팬아트, 캡처 이미지, 복사 media 파일을 추가하지 않는다.
- 모바일 코드에 `YOUTUBE_API_KEY`, `youtube.googleapis.com`, `/youtube/v3`를 추가하지 않는다.

## Platform-Specific Design

### iOS

- `SongsView.SongThumbnailView`가 `thumbnailUrl: String?`을 받도록 변경한다.
- URL 생성은 `URL(string:)`로 제한하고 invalid URL이면 placeholder를 렌더링한다.
- `AsyncImage` 상태별 렌더링:
  - success: resizable image, fill, clipped rounded rectangle
  - empty/loading: existing placeholder
  - failure: existing placeholder
- `SongsView`는 `songs`를 filtered list로 유지하고, 별도 computed property로 `pagedSongs`를 만든다.
- `SongRow`는 `SongThumbnailView(thumbnailUrl: song.thumbnailUrl)`을 사용한다.
- page control은 `Section("노래 목록")` 하단에 배치한다.

### Android

- `MainActivity.songCard(song)`을 horizontal layout으로 바꾸고 좌측에 thumbnail view를 둔다.
- thumbnail 크기는 카드 내에서 고정 정사각형으로 유지한다.
- `song.thumbnailUrl`이 HTTPS이면 background thread에서 decode 후 UI thread에서 bitmap을 set한다.
- 실패하거나 URL이 없으면 placeholder 영역을 표시한다.
- `MainUiPolicy`에 client pagination helper를 둔다.
  - `songPageCount(totalItems, pageSize)`
  - `songPageItems(items, page, pageSize)`
  - `coerceSongPage(page, totalItems, pageSize)`
- `MainActivity`는 `selectedSongPage` state를 갖고 필터/검색 변경 시 1로 reset한다.
- Android page control은 목록 하단 card 또는 compact row로 렌더링한다.

## Out Of Scope

- Backend schema/route 변경
- 서버 cursor pagination UI 연결
- YouTube API 직접 호출
- 새 이미지 로딩 라이브러리 추가
- 이미지 disk cache 직접 구현
- 노래 상세 화면 추가

## Acceptance Criteria

- iPhone 앱 노래 카드의 기존 썸네일 영역에 서버 `thumbnailUrl` 이미지가 표시된다.
- Android 앱 노래 카드에도 썸네일 영역이 표시된다.
- 썸네일 URL이 없거나 실패하면 양 플랫폼 모두 placeholder가 표시된다.
- iPhone/Android 모두 필터링된 노래 목록을 20개 단위로 페이지 분할한다.
- 필터 또는 검색 변경 시 페이지가 1로 돌아간다.
- 전체 페이지가 1이면 page control을 표시하지 않는다.
- 모바일 앱은 계속 서버 API만 사용한다.
