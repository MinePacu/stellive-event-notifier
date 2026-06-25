# Mobile Song Page Status, Recent Cover, And Discovery Sync Design Plan

## Goal

Android 노래 페이지 UI 안정성/일관성을 개선하고, Android/iOS 홈에 최근 커버곡을 추가하며, 공식 playlist 반영 지연을 줄이기 위한 서버 보조 동기화 경로를 설계한다.

## Scope

- Android 노래 페이지의 멤버 필터 선택 버튼을 iOS 노래 페이지의 선택형 필터 카드 UX와 최대한 맞춘다.
- Android 노래 페이지의 상단 타이틀과 바로 아래 설명 카드가 사실상 같은 내용을 반복하지 않도록 정리한다.
- Android 홈/라이브/노래/굿즈·행사 페이지에 작은 서버 연결 상태 표기를 추가한다.
- Android 노래 페이지 검색창에서 입력 후 포커스가 풀릴 때 앱이 중지되는 문제를 해결한다.
- Android/iOS 홈에 최근 커버곡 섹션을 추가한다.
- 서버는 1시간마다 공식 채널과 활동 멤버 채널의 최근 업로드를 확인하여, 공식 playlist에 늦게 들어오는 커버/오리지널 후보를 DB에 보완 저장한다.

## Current Diagnosis

### Android song page member filter button

현재 Android 노래 페이지는 별도 멤버 선택 페이지를 가지고 있지만 진입 버튼이 `compactEventCard("멤버", "...곡")` 형태라 iOS의 grouped filter UX보다 크고 설명형 카드처럼 보인다. 멤버 필터는 목록 조작 UI이므로 노래 설명 카드보다 작고, 선택 상태와 결과 수가 즉시 보이는 pill/card 형태가 더 적합하다.

### Android title/card duplication

Android 노래 페이지는 상단 타이틀이 이미 `노래`인데, 바로 아래 카드도 `노래` 제목과 서버 캐시 설명을 반복한다. 사용자는 같은 헤더가 두 번 나온 것으로 인식할 수 있다. 상단 페이지 타이틀은 유지하고, 아래 카드는 제거하거나 아주 작은 서버 상태/데이터 출처 표시로 바꾼다.

### Server connection status card

Android에는 `serverConnectionDebugLogs`와 debug 연결 로그 개념이 있지만, 일반 사용자가 홈/라이브/노래/굿즈·행사에서 “서버 데이터인지, 캐시/오프라인 fallback인지”를 빠르게 알 수 있는 작은 상태 표기가 부족하다. 기존 라이브 데이터 카드가 크면 화면 밀도가 나빠지므로, 한 줄 compact status strip로 통일한다.

권장 표시:

- `서버 연결됨 · 방금 갱신`
- `서버 지연 · 캐시 표시 중`
- `오프라인 · 기본 데이터 표시 중`

### Android song search focus crash

검색창 입력 때마다 `renderSongs()`를 즉시 호출하는 구조는 포커스/IME가 살아 있는 `EditText`를 렌더링 중 제거할 수 있다. 포커스가 풀리는 순간 text/focus callback이 다시 발생하면 화면 재구성과 callback이 겹쳐 앱 중지로 이어질 수 있다. 검색어 state 갱신과 목록 재렌더를 분리하고, debounce 또는 IME action/명시적 clear 버튼 중심으로 렌더를 제한해야 한다.

### Home recent covers

iOS/Android 모두 서버의 `/v1/music` 기반 곡 목록을 이미 수집하므로, 홈 화면에는 별도 YouTube 호출 없이 서버/스토어에 적재된 `type=cover` 최신곡 일부만 노출하면 된다. 홈은 요약 화면이므로 3~5개만 보여주고, “노래 전체 보기” 링크로 이동한다.

### Official playlist delay

현재 안정적인 기준 데이터는 공식 cover/original playlist sync다. 다만 공식 채널이 playlist에 영상을 늦게 추가하면 앱 반영도 늦어진다. 이를 줄이려면 playlist sync를 대체하지 말고, 보조 discovery sync를 추가한다.

보조 discovery sync는 `search.list`를 사용하지 않는다. 채널별 uploads playlist를 YouTube Data API로 조회한다.

```text
scheduler hourly
  -> channels.list(part=contentDetails) for official + active member channel IDs
  -> relatedPlaylists.uploads
  -> playlistItems.list(recent 1 page by default)
  -> videos.list(50-id chunks)
  -> classify cover/original candidate
  -> videoId dedupe
  -> DB upsert as discovered candidate
```

## Product Behavior

### Android song page

- 상단 title bar는 기존 Android 앱 title bar를 그대로 사용한다.
- 페이지 설명성 큰 카드는 제거하거나 작은 “서버 캐시 기반” 상태 strip로 축소한다.
- 기수/타입 필터는 현재 구조를 유지한다.
- 멤버 필터 진입 버튼은 iOS와 비슷한 작은 선택형 row/card로 변경한다.
- 선택된 멤버 이름, 결과 곡 수, chevron 또는 선택 pill을 표시한다.
- 검색어 입력 중에는 화면이 매 입력마다 파괴적으로 재렌더되지 않게 한다.

### Android server status strip

홈, 라이브, 노래, 굿즈·행사 페이지 상단 또는 주요 섹션 직전에 동일한 compact component를 둔다.

- 높이는 기존 live/status card보다 작게 유지한다.
- 상태 텍스트, 마지막 갱신 시각, fallback 여부만 표시한다.
- debug 로그 원문은 표시하지 않는다.
- 사용자가 탭해도 별도 상세 화면은 만들지 않는다. 필요 시 debug mode에서만 로그 화면을 유지한다.

### iOS home recent covers

- 기존 grouped list 스타일을 유지한다.
- “최근 커버곡” Section을 추가한다.
- 각 row는 노래 제목, 멤버, 게시일, 썸네일이 이미 안전하게 표시 가능하면 썸네일을 표시한다.
- row tap은 기존 SongsView/SongRow의 YouTube link 정책을 재사용하거나 노래 페이지로 이동한다.

### Android home recent covers

- 홈에 “최근 커버곡” compact list를 추가한다.
- 최대 3~5개만 노출한다.
- row tap은 기존 Android song card의 외부 YouTube 열기 정책을 재사용한다.
- “노래 전체 보기” 액션은 Songs tab으로 이동한다.

### Backend discovery sync

- 기본 주기: 60분.
- 기본 최근 조회 범위: 채널별 uploads playlist 첫 1페이지.
- 대상 채널:
  - Stellive official YouTube channel.
  - active/upcoming member catalog 중 검증된 `youtubeChannelId`가 있는 멤버 채널.
- Former members는 MVP 대상에서 제외한다.
- `videoId` 기준으로 기존 DB 항목과 dedupe한다.
- 기존 공식 playlist에서 이미 수집된 곡은 덮어쓰지 않는다.
- manual override는 자동 discovery보다 우선한다.
- 분류가 확실하지 않은 영상은 삭제하지 않고 `NEEDS_REVIEW` 또는 `isExcluded=true` 후보로 보존한다.
- 클라이언트 기본 응답은 계속 `isAvailable=true`, `isExcluded=false`, `includeGraduated=false`, `includeInstrumental=false` 기준이다.

## Classification Policy For Discovery

보조 discovery는 공식 playlist보다 신뢰도가 낮다. 따라서 자동 노출을 보수적으로 한다.

- 채널이 멤버 개인 채널이면 해당 멤버를 높은 confidence로 연결한다.
- 제목/설명에 `Cover`, `커버`, `歌ってみた`, `covered by`가 있으면 `cover` 후보로 분류한다.
- 제목/설명에 `Original`, `오리지널`, `MV`, `Music Video`와 멤버/스텔라이브 공식 문맥이 있으면 `original` 후보로 분류한다.
- shorts, teaser, trailer, preview, behind, making, live clip, 3D live 후보는 기본 노출에서 제외하거나 review 상태로 둔다.
- ambiguous 후보는 `NEEDS_REVIEW`로 저장하고 기본 API 응답에서는 숨긴다.
- 공식 playlist sync가 나중에 같은 `videoId`를 발견하면 playlist 기준 type/source가 우선한다.

## Data And API Impact

### Mobile

기존 `/v1/music` 응답을 우선 재사용한다. 홈 최근 커버곡 때문에 별도 endpoint를 추가하지 않아도 된다.

권장 호출:

```text
GET /v1/music?type=cover&limit=5&sort=publishedAt_desc
```

이미 앱 store가 전체 music list를 수집한다면 클라이언트에서 최신 cover만 계산해도 된다. 중복 네트워크 호출을 줄이려면 기존 store cache를 우선 사용한다.

### Backend

보조 discovery가 필요로 하는 최소 확장:

- YouTube client에 `channels.list(part=contentDetails)` 지원 추가.
- `MusicChannelDiscoverySyncService` 추가.
- internal scheduler endpoint 또는 기존 music sync endpoint에 `mode=channel_discovery` 추가.
- env flag 추가:

```env
MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED=false
MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES=60
MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES=1
```

## Non-goals

- 모바일에서 YouTube API를 직접 호출하지 않는다.
- `search.list`를 기본 동기화 로직에 추가하지 않는다.
- Former members를 catalog, seed, filter, target에 추가하지 않는다.
- 공식 playlist sync를 제거하지 않는다.
- discovery 후보를 사람이 검토하기 전에 과도하게 자동 노출하지 않는다.
- 이번 범위에서 새로운 이미지 자산, 공식 로고, 프로필 이미지 바이너리를 추가하지 않는다.

## Acceptance Criteria

- Android 노래 페이지의 멤버 필터 선택 버튼이 iOS와 비슷한 작은 선택형 UI로 표시된다.
- Android 노래 페이지에서 `노래` 타이틀과 같은 의미의 큰 설명 카드가 중복 표시되지 않는다.
- Android 홈/라이브/노래/굿즈·행사 페이지에 작은 서버 연결 상태 표기가 표시된다.
- Android 노래 검색창에서 입력 후 포커스가 풀려도 앱이 중지되지 않는다.
- Android/iOS 홈에 최근 커버곡이 표시된다.
- 최근 커버곡은 서버 DB/API 또는 앱 store cache에서만 가져오며 모바일 YouTube API 호출은 없다.
- 서버가 1시간 주기로 공식/멤버 채널 uploads playlist를 조회할 수 있는 구조를 가진다.
- discovery sync는 `search.list`를 사용하지 않고, `videoId` dedupe와 manual override 우선순위를 지킨다.
- 공식 playlist에 나중에 들어온 같은 `videoId`는 playlist source 기준으로 보정된다.

