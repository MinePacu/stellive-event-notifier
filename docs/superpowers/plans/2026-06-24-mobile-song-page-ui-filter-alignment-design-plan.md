# Mobile Song Page UI And Filter Alignment Design Plan

**Goal:** iPhone/Android 노래 페이지의 화면 구성을 동일하게 맞추고, 중복 필터와 동작하지 않는 기수 필터를 수정한다.

**Current issues from screenshots:**

- iPhone 노래 페이지와 Android 노래 페이지의 화면 구조가 다르다.
- Android 필터 영역에 `전체`가 두 번 노출되어 기수 필터와 타입 필터가 한 줄 칩 그룹처럼 혼재되어 보인다.
- iPhone/Android 모두 official music API 응답의 `members[]`를 기준으로 기수 필터를 계산하지 않아 `1기생/2기생/3기생` 필터가 실제 목록에 반영되지 않는다.
- iPhone 헤더 metric 값이 숫자가 아니라 `(facets.sum...)` 형태의 literal text로 표시된다.

## Target UX

Android 노래 페이지는 iPhone 노래 페이지의 구성을 기준으로 맞춘다.

- 상단:
  - 기존 각 플랫폼의 title bar/navigation shell은 유지한다.
  - 노래 화면 상단 우측 filter/settings action은 기존 앱 패턴을 유지한다.
- Header card:
  - 아이콘 `♪`
  - 제목 `노래`
  - 설명 `YouTube 기반 오리지널/커버 곡 목록`
  - metric 3개:
    - 전체
    - 오리지널
    - 커버
  - metric 값은 실제 현재 표시 대상 목록 기준 숫자여야 한다.
- Search section:
  - 제목 `검색`
  - placeholder `노래 제목 또는 멤버 검색`
- Filter section:
  - 제목 `필터`
  - 첫 번째 segmented row: `전체`, `1기생`, `2기생`, `3기생`
  - 두 번째 segmented row: `전체`, `오리지널`, `커버`
  - 두 row를 시각적으로 분리해 Android에서 `전체`가 중복 오류처럼 보이지 않게 한다.
- Song list:
  - 제목 `노래 목록`
  - 카드 구성은 iPhone과 동일하게 `thumbnail placeholder + title + member/type + date`로 맞춘다.
  - URL은 카드 본문 텍스트로 노출하지 않는다. 탭/클릭 대상만 `youtubeUrl`을 사용한다.

## Data And Filter Design

Official music API item은 최상위 `generationId`를 제공하지 않는다.

```text
SongCatalogItem
- type
- members[]
  - id
  - nameKo
  - nameEn
  - role
```

따라서 기수 필터는 다음 방식으로 적용한다.

- 앱 bootstrap/catalog의 active member 목록에서 `memberId -> generationId` 맵을 만든다.
- 노래 row의 `members[].id` 중 하나라도 선택된 generation에 속하면 해당 row를 표시한다.
- `selectedGenerationId == "all"`이면 generation filtering을 적용하지 않는다.
- member가 없는 group/official row는 `all`에서만 표시한다.
- Former member, `gamja`, `official`은 노래 페이지 generation filter로 노출하지 않는다.

타입 필터는 기존 official music item의 `type`으로 적용한다.

- `all`: 전체
- `original`: 오리지널
- `cover`: 커버

`other`는 현재 노래 페이지 기본 filter에 노출하지 않는다. 서버가 `other`를 지원하더라도 MVP UI는 official cover/original catalog 중심으로 유지한다.

## Platform Alignment Rules

- Android가 iPhone의 노래 페이지 정보 구조를 따른다.
- iPhone의 metric literal bug는 수정한다.
- 양 플랫폼 모두 같은 policy helper를 둔다.
  - generation filter option list
  - type filter option list
  - member display text
  - song matches generation
  - song matches query
  - visible songs
  - visible facets/count summary
- Android/iOS의 색상, title bar, bottom navigation, card color는 기존 코드의 플랫폼별 리소스를 그대로 사용한다.
- 새 이미지/로고/썸네일 asset을 repo에 추가하지 않는다.

## Acceptance Criteria

- Android 노래 페이지 구성이 iPhone 노래 페이지와 같은 순서가 된다:
  - header card
  - search
  - filter
  - song list
- Android filter UI에서 `전체`가 중복 오류처럼 한 줄에 두 번 보이지 않는다.
- iPhone header metric 값이 `(facets.sum...)` literal이 아니라 숫자로 표시된다.
- Android/iOS 모두 `1기생`, `2기생`, `3기생` 선택 시 해당 generation 멤버가 포함된 곡만 표시한다.
- Android/iOS 모두 `전체`, `오리지널`, `커버` 타입 필터가 정상 동작한다.
- Android/iOS 모두 검색은 title과 `members[]` 표시명 기준으로 동작한다.
- 모바일 앱은 계속 서버 API만 호출하고 YouTube API key를 포함하지 않는다.
