# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/)를 참고하되, 현재 저장소는 정식 릴리스 태그가 없는 MVP 단계이므로 `Unreleased` 아래에 날짜별 변경 내역을 정리합니다.

## [Unreleased]

### 2026-07-19

#### Added
- 굿즈/행사에 제목·설명·기간·시간 정밀도·시간대·외부 링크를 가진 여러 세부 일정을 지원하고 Android/iOS 상세 화면, 캘린더 딥링크, 알림 흐름에 연결했습니다.
- 관리자 콘솔에서 세부 일정 생성·수정·복원·순서 변경·대표 일정 지정과 관련 링크 관리를 할 수 있도록 확장했습니다.
- 세부 일정과 링크, 대표 일정 제약을 shared contract·API·PostgreSQL 마이그레이션에 반영했습니다.

#### Changed
- 굿즈/행사 일정의 기간·마감 표시, 다음 일정 계산, 상태·정렬·캘린더 조회를 타임라인 기준으로 정리했습니다.
- Android/iOS 상세 화면에서 세부 일정 카드를 펼쳐 설명과 링크를 확인할 수 있도록 하고, Android 관련 링크 목록과 일정 태그 UI를 공통 스타일에 맞게 개선했습니다.
- 일정 알림과 딥링크가 세부 일정 단위 정보를 유지하도록 개선했습니다.

#### Documentation
- 굿즈/행사 타임라인과 세부 일정 운영 정책을 알림 정책 문서에 반영했습니다.

#### Tests
- API·관리자·일정 정책·알림과 Android/iOS 모델·표시·딥링크 흐름의 타임라인 회귀 테스트를 보강했습니다.

### 2026-07-17

#### Added
- 앱 서비스 운영 공지 도메인과 저장·조회·관리 API를 추가하고, 일반 안내·장애·점검·앱 업데이트 유형의 게시 상태와 FCM 발송 흐름을 연결했습니다.
- Android와 iOS에 공지 목록·상세·읽지 않음 배지·홈 중요 공지·딥링크를 추가하고, 로컬 읽음 상태와 서비스 공지 푸시 설정을 분리했습니다.
- 관리자 콘솔에 공지 작성·임시 저장·게시·해결·보관·attention revision·재발송·선택 삭제와 감사/푸시 이력 관리를 추가했습니다.

#### Changed
- 관리자 로그인과 콘솔 UI에 한국어·영어 전환, 언어 쿠키 유지, 테마 라벨, 상태 메시지 및 지역화된 날짜·숫자 표시를 적용했습니다.
- 공지 삭제는 감사 로그와 캐시 무효화를 유지하는 soft-delete 방식으로 처리하도록 운영 흐름을 정리했습니다.

#### Documentation
- 앱 서비스 공지의 데이터 모델, 공개·관리 API, 게시·푸시·읽음 정책과 운영 절차를 문서화했습니다.

#### Tests
- 공지 공개 필터, 게시·FCM 실패·재발송·attention revision·삭제 흐름과 Android/iOS 읽음·배지·홈 선정·딥링크 동작 테스트를 보강했습니다.

### 2026-07-16

#### Changed
- Android 설정 화면과 하위 페이지의 카드·행 간격과 텍스트 기준 높이를 일관되게 정리하고, 시각적 스위치와 전체 행 접근성 동작을 분리했습니다.
- Android 설정 탐색에 화면 전환 정책과 상태 복원을 적용하고, Android/iOS 설정 문구와 분류를 사용자 관점에 맞게 다듬었습니다.

#### Fixed
- Android 화면 모드 변경 뒤 설정 화면이 맨 위로 이동하거나 중복 DataStore 생성으로 앱이 종료되던 문제를 수정했습니다.

### 2026-07-14

#### Added
- Android와 iOS 노래 페이지에 곡 상세 정보, 즐겨찾기·공유·복사·관련 노래 빠른 동작을 추가했습니다.
- 노래 상세의 기본 열기 앱을 YouTube 또는 YouTube Music으로 선택하고 기기에 저장할 수 있도록 했습니다.

#### Changed
- 노래 카드에서 제목·멤버·메타데이터 영역을 우선 배치하고 즐겨찾기와 더보기 동작을 별도 영역으로 분리했습니다.
- 작은 화면의 카드 썸네일과 제목 줄 수를 조정하고 Android/iOS 상세 화면의 UI와 접근성 동작을 정리했습니다.
- 멤버 필터, 즐겨찾기·NEW 필터, 점진 목록 표시와 스크롤 복원을 노래 탐색 흐름에서 유지하도록 개선했습니다.

#### Fixed
- 공유·복사는 항상 검증된 일반 YouTube URL을 사용하고, 잘못된 영상 ID·HTTP·외부 호스트 링크가 열리지 않도록 보완했습니다.

### 2026-07-13

#### Added
- Android/iOS 노래 페이지에 멤버 복수 선택, 한 명 이상·모두 참여, 솔로·콜라보 및 기수 전원 빠른 선택을 지원했습니다.

#### Changed
- 멤버 조건 모델과 요약, 레거시 단일 멤버 상태 변환, 점진 목록 query key를 Android/iOS에서 동일한 정책으로 정리했습니다.
- 노래 목록의 표시 개수·스크롤 세션을 필터 조건과 함께 보존하고, 멤버 선택 화면의 프로필 이미지를 runtime URL과 placeholder fallback으로 표시하도록 개선했습니다.

#### Fixed
- Android 멤버 선택 시 목록 스크롤이 상단으로 이동하거나 프로필 이미지가 반복해서 깜빡이는 문제를 완화했습니다.
- Android/iOS 노래 페이지에서 기수 필터와 멤버 필터가 중복 적용되던 문제를 제거하고, iOS YouTube 프로필 이미지의 크기·원본 URL fallback을 보강했습니다.

### 2026-07-12

#### Added
- Android와 iOS 노래 목록에 로컬 즐겨찾기와 「보관함: 전체/즐겨찾기」 필터를 추가했습니다.
- 서버 카탈로그에 새로 들어온 노래를 NEW 배지와 「상태: 전체/새 노래」 필터로 확인할 수 있도록 했습니다.

#### Changed
- 노래 카드에서 즐겨찾기와 읽음 확인을 링크 동작과 분리하고, 기수·분류·멤버·검색·보관함·상태·정렬·페이지 필터 조합을 지원합니다.
- 음악 API와 모바일 모델에 선택적 카탈로그 추가 시각과 서버 기준 시각을 연결하고, 구형 응답을 계속 허용합니다.
- 즐겨찾기와 신규 노래 확인 상태를 향후 서버 동기화로 확장할 수 있는 로컬 저장 계층으로 분리했습니다.

### 2026-07-10

#### Fixed
- Android 굿즈/행사 달력의 요일·날짜 행을 동일 폭의 7열 가로 레이아웃으로 정렬해 좁은 화면에서도 날짜가 밀리거나 잘리지 않고 기간 막대와 열이 맞도록 수정했습니다.

### 2026-07-09

#### Added
- Android와 iOS 설정에 비공식 프로젝트 소개, 버전/빌드, Apache-2.0 라이선스, GitHub 저장소 링크, 관계 고지를 담은 compact 앱 정보 화면을 추가했습니다.

#### Changed
- Android 대화면 설정 화면을 설정 목록과 선택한 세부 설정을 함께 보는 two-pane 구조로 개선하고, compact 화면의 기존 설정 이동 흐름은 유지했습니다.
- Android 대화면 two-pane 화면에서 좌우 pane 중 어느 쪽을 스크롤해도 상단 타이틀 바의 스크롤 상태가 compact 화면과 일관되게 반응하도록 개선했습니다.

### 2026-07-08

#### Changed
- Android와 iOS 굿즈/행사 월별 피드가 각 행사의 Asia/Seoul 기준 시작일, 종료일, 제목, 이벤트 ID 순서로 안정적으로 정렬되도록 개선했습니다.
- Android 대화면 two-pane 노래 및 굿즈/행사 화면에서 좌우 pane이 각각 독립적으로 스크롤되도록 하고, two-pane 활성 시 pull-to-refresh 충돌을 피하도록 조정했습니다.

#### Fixed
- Android 굿즈/행사 월별 피드에서 같은 날짜에 겹친 기간성 행사 카드들이 잘못된 동일 기간 헤더 아래에 묶이던 문제를 수정했습니다.
- iOS 굿즈/행사 상세 화면의 핵심 안내 카드가 텍스트 폭만큼만 그려져 상세 콘텐츠 영역의 가로 폭을 채우지 못하던 문제를 수정했습니다.

### 2026-07-07

#### Added
- Firebase 서비스 계정 파일 기반 FCM 설정, 발송 rate limiter, 서비스 공지 topic 구독/해제 흐름을 추가했습니다.
- Android와 iOS 앱의 push 등록, foreground 알림 표시, 알림 payload 필드 처리를 보강했습니다.
- Backend와 모바일 push 경로의 FCM client, device registration, preferences, load reduction 정책 테스트를 보강했습니다.
- 검증된 CHZZK 라이브 상태의 방송 카테고리를 서버 수집·모바일 bootstrap 응답·Android/iOS 라이브 카드에 표시하도록 추가했습니다.

#### Changed
- 알림 worker와 payload 생성 경로가 사용자 선호, load reduction 정책, best-effort 모바일 전달 조건을 더 일관되게 반영하도록 개선했습니다.
- 모바일 앱과 서버 API 간 push 관련 모델을 맞추고 서버-mediated preference enforcement 흐름을 정리했습니다.
- Android 라이브 탭 카드를 홈 라이브 카드와 맞춰 정리하고, 보이는 순서 변경 핸들 대신 카드 길게 누르기 기반 순서 변경과 접근성 이동 액션을 유지했습니다.
- Android 라이브 카드의 방송 카테고리와 CHZZK 열기 Chip을 같은 보조 row에 배치하고 정보 태그와 액션 버튼의 시각 위계를 구분했습니다.

#### Fixed
- 모바일 route dependency binding과 FCM 배포 및 token sync 경로에서 발생할 수 있는 불안정한 동작을 수정했습니다.

#### Documentation
- FCM boundary/code design과 notification policy 문서를 최신 push 전달 정책에 맞게 갱신했습니다.

#### Operations
- 서버 재빌드와 상태 확인 스크립트, local compose 설정을 FCM 운영 설정에 맞게 갱신했습니다.

### 2026-07-05

#### Changed
- 음악 탐색 worker가 시간대 경계를 고려한 peak/off-peak 주기로 실행되도록 조정했습니다.

#### Fixed
- Admin delivery/API 차트의 UTC timestamp를 KST 일자에 맞게 집계하고, hub event 상태 필터 기본값을 열린 상태로 수정했습니다.

#### Operations
- local worktree ignore, 범위 기반 pre-commit 안내, 제한된 출력의 PR·병합 및 서버 배포 보조 스크립트를 정리했습니다.
- CI가 병합과 수동 실행 중심으로 동작하도록 제한했습니다.

#### Documentation
- 영역별 agent 규칙과 codemap을 분리하고 peak 음악 탐색 일정 및 안전한 서버 재배포 절차를 문서화했습니다.

### 2026-07-04

#### Added
- 다중 API worker 운영 구성과 공용 bootstrap 데이터 부분 캐시를 추가했습니다.
- YouTube 채널 이미지 metadata 조회 캐시, DB 장애 fallback, 선택적 Redis refresh lock을 추가했습니다.

#### Performance
- Admin overview refresh를 캐시하고 delivery/API 추세 집계를 PostgreSQL로 이전했습니다.

#### Fixed
- 여러 worker가 동일 backend image와 활성 API alias를 공유하도록 하고, CHZZK live list 검증 범위를 제한했습니다.

### 2026-07-03

#### Added
- Admin dashboard에 KST 기준 delivery queue 추세와 정제된 YouTube·CHZZK 외부 API 호출 관측, 필터, chart tooltip을 추가했습니다.
- YouTube 채널 이미지 metadata를 주기적으로 캐시하고 quota 지표를 당일·14일 기준으로 분리했습니다.

#### Fixed
- CHZZK 채널별 요청을 polling cycle당 한 번의 live list scan으로 묶고 최근 API 결과 시각 표시를 복구했습니다.

### 2026-07-02

#### Changed
- Admin console의 login, sidebar, top tab, dashboard, operations, audit, settings 화면을 mockup 기반 반응형 운영 UI로 정리했습니다.

#### Fixed
- 짧은 Admin 페이지의 불필요한 세로 확장과 페이지별 content rail·간격 불일치를 수정했습니다.

### 2026-07-01

#### Added
- Admin hub event 목록에 cursor pagination을 추가하고 Operations·Audit·Settings 화면 구조를 확장했습니다.

#### Changed
- Hub event 편집 영역을 넓히고 internal token 상태는 Settings에서만 표시하도록 분리했습니다.

### 2026-06-30

#### Added
- Android/iOS 노래 멤버 필터에 서버가 캐시한 YouTube 채널 프로필 이미지 URL과 fallback 표시를 추가했습니다.

#### Fixed
- iOS 노래 요약 카운트가 필터 결과가 아닌 전체 catalog를 기준으로 계산되도록 수정하고, 멤버 선택 UI를 개선했습니다.
- 검증된 멤버 YouTube 채널 metadata를 정정했습니다.

#### Operations
- Android/iOS build·install helper와 안전장치가 포함된 서버 sync·rebuild·status 스크립트를 추가했습니다.

#### Changed
- Admin console을 sidebar·topbar·분할 편집 구조로 재배치하면서 image metadata-only 정책을 유지했습니다.

### 2026-06-29

#### Changed
- Android/iOS 노래 카드, 전체 목록 정렬, 최근 노래 데이터 소스와 로딩 표시를 일관되게 정리했습니다.

#### Fixed
- Android에서 하위 화면 뒤로가기는 현재 root tab으로 복귀하고 root에서는 두 번째 동작으로 종료하도록 수정했습니다.

### 2026-06-28

#### Added
- YouTube premiere metadata를 shared schema, backend, Android/iOS 노래 카드에 연결했습니다.

#### Changed
- iOS event hero tag 가독성과 모바일 설정 navigation·event detail 표현을 개선했습니다.

#### Fixed
- Android top bar 정책 회귀와 iOS 노래 filter·pagination 안정성 문제를 수정했습니다.

### 2026-06-27

#### Changed
- Android 공통 chrome, card, filter와 양 플랫폼 event detail hero·navigation UI를 개선했습니다.

#### Fixed
- Android filter chip의 checked-state crash, 상단 clipping, hero tag·scrim 표시를 수정했습니다.
- 멤버 채널 음악 탐색은 강한 제목 metadata를 요구하고 review/excluded 항목을 공개 목록에서 제외하도록 분류를 강화했습니다.
- 공식 playlist source가 제공한 음악 type을 탐색 업데이트가 덮어쓰지 않도록 보호하고 repair 경로를 추가했습니다.

### 2026-06-26

#### Added
- 음악 대상 멤버의 검증된 YouTube channel ID를 catalog와 DB 입력에 반영했습니다.

### 2026-06-25

#### Added
- Android/iOS 홈에 최근 cover 영역을 추가하고, backend에 멤버 채널 upload 탐색 service·worker·internal route 기반을 추가했습니다.

### 2026-06-24

#### Added
- 공식 COVER/ORIGINAL playlist 동기화와 관련 음악 metadata를 backend에 추가하고 Android/iOS 노래 페이지에 연결했습니다.
- 노래 thumbnail, 20개 단위 client pagination, 멤버별 filter와 YouTube 이동을 추가했습니다.

#### Fixed
- cursor pagination으로 전체 노래를 가져오고 iOS thumbnail fallback이 동작하도록 수정했습니다.

#### Documentation
- YouTube API key를 서버 환경 변수로만 사용하는 공식 playlist sync 설정과 모바일 rollout을 문서화했습니다.

### 2026-06-23

#### Added
- 음악 shared DTO·OpenAPI·Prisma model, source playlist seed, 분류·멤버 매칭, quota-aware light/full sync를 추가했습니다.
- 메모리 lock, stale-while-revalidate response cache, 공개 music·detail·member route와 보호된 internal sync route를 추가했습니다.
- 선택적 reconciliation·WebSub hook과 환경 설정 기반 disabled-safe wiring을 추가했습니다.

#### Documentation
- 서버 전용 YouTube Data API 사용, cache, quota 계산과 수동 sync 절차를 문서화했습니다.

### 2026-06-22

#### Fixed
- Admin에서 검토가 필요한 hub event image metadata draft가 손실되지 않도록 보존했습니다.

#### Added
- 서버 기반 노래 페이지와 backend YouTube ingestion·repository·route, Android/iOS song tab의 초기 구조를 추가했습니다.

### 2026-06-21

#### Added
- Android/iOS 월간 calendar에 여러 날 일정의 duration bar stacking과 날짜 범위 표시를 추가했습니다.

#### Fixed
- start-only event 종료 처리, Android special-day card, canonical event dedupe와 image metadata draft 검증을 수정했습니다.

#### Operations
- 로컬 생성 경로 ignore와 workspace context 설정을 정리했습니다.

### 2026-06-20

#### Added
- 월 단위 굿즈·행사 calendar 탐색과 date-range 전달, backend hub event status reconcile worker를 추가했습니다.

#### Fixed
- iOS event hero text가 frame 밖으로 벗어나지 않도록 수정했습니다.

#### Documentation
- README의 프로젝트명, Android/iOS/backend 구현 상태와 정책·실행 안내를 갱신했습니다.

### 2026-06-19

#### Changed
- Admin에서 게시한 hub event를 모바일 목록·calendar·detail에 연결하고 양 플랫폼 상세 화면을 정리했습니다.

#### Fixed
- 종료 시각이 없는 일정을 저장·표시할 수 있게 하고 굿즈·행사 화면에 pull-to-refresh를 추가했습니다.

### 2026-06-18

#### Changed
- 굿즈·행사 상세 layout과 thumbnail 표시를 개선했습니다.
- Android OLED dark mode와 알림 대상 toggle을 개선하고, iOS Xcode navigator group을 기능별로 정리했습니다.

### 2026-06-17

#### Changed
- Admin hub event editor를 compact filter와 section 기반 full-width layout으로 재설계했습니다.

#### Fixed
- draft ID 보존과 image metadata field validation을 정비했습니다.

#### Operations
- CI workflow rule을 단순화했습니다.

### 2026-06-16

#### Added
- CHZZK offline channel image fallback과 Android live top bar glass를 추가했습니다.

#### Changed
- Android/iOS live page 순서, 상태 표시와 새로고침 동작을 개선했습니다.

#### Fixed
- widget snapshot에서 hub event가 우선되도록 수정했습니다.

### 2026-06-15

#### Added
- CHZZK bootstrap UI, auth client와 mobile live data 새로고침을 연결했습니다.

#### Fixed
- CHZZK polling을 공식 client-auth live list 흐름에 맞추고 fallback 진단과 Admin 날짜 표시 오류를 수정했습니다.

#### Documentation
- bootstrap contract와 CHZZK 연동 문서를 구현 상태에 맞게 정리했습니다.

### 2026-06-14

#### Added
- Backend CHZZK live polling adapter와 `/v1/bootstrap` live status를 Android/iOS live page에 연결했습니다.
- 모바일 hub base URL을 환경별로 설정할 수 있게 했습니다.

#### Changed
- 굿즈·행사 날짜 navigation과 top bar 간격을 개선했습니다.

#### Documentation
- CHZZK live API 구현 설계를 추가했습니다.

### 2026-06-13

#### Added
- 검증된 멤버 생일 special-day catalog와 굿즈·행사 calendar deep link를 추가했습니다.

#### Documentation
- hub event image metadata-only 정책, Firebase FCM server boundary와 기념일 calendar 설계를 문서화했습니다.

### 2026-06-12

#### Added
- hub event admin CRUD·read API, notification worker와 metadata-only image 정책을 추가했습니다.

#### Operations
- Android 및 backend CI를 GitHub/GitLab에 추가하고 pipeline cache·실행 시간을 조정했습니다.

#### Documentation
- 비공식 팬 프로젝트의 README, 프로젝트명과 hub event read API 계획을 갱신했습니다.

### 2026-06-11

#### Added
- 공식 CHZZK Open API adapter를 구현하고 굿즈·행사 calendar mobile mockup을 추가했습니다.

### 2026-06-09

#### Added
- Admin console auto-refresh를 추가했습니다.

### 2026-06-08

#### Added
- Admin console·login에 dark theme control, token persistence와 live uptime 표시를 추가했습니다.

#### Fixed
- 초기화되지 않은 adapter check timestamp가 노출되지 않도록 수정했습니다.

#### Documentation
- Admin console dark mode 설계와 구현 계획을 추가했습니다.

### 2026-06-06

#### Added
- 알림 부하 절감 정책과 Fastify TypeScript API 구현 기반을 추가했습니다.

### 2026-06-05

#### Added
- 알림 기록 filter와 load reduction 정책을 추가했습니다.

#### Changed
- iOS grouped screen 간격과 Android live·history 화면을 단순화했습니다.

### 2026-06-04

#### Changed
- 알림 설정을 하위 페이지로 분리하고 Android/iOS 설정 navigation과 공통 UI를 개선했습니다.

### 2026-06-03

#### Added
- 비공식 알림 허브 MVP에 Android/iOS 알림 설정, 로컬 기록·cache, deep link와 Fastify backend·shared member catalog·OpenAPI 기반을 추가했습니다.
- hub event shared type·policy validation·service·read API·notification type과 Android/iOS 목록·상세 화면을 추가했습니다.
- Android/iOS home dashboard와 상태 selector를 추가했습니다.

#### Fixed
- hub event 입력 limit·경계·외부 link, iOS 정렬, Android preference ID·navigation·title 처리를 안정화했습니다.

#### Documentation
- hub event 정책, UI 재작업 설계와 구현 계획을 추가했습니다.

### 2026-06-02

#### Added
- 저장소와 초기 프로젝트 문서 구조를 생성했습니다.

---

이 프로젝트는 스텔라이브 및 관련 플랫폼과 공식 관계가 없는 비공식·비영리 오픈소스 팬 프로젝트입니다. [Apache License 2.0](LICENSE)은 제3자의 상표, 초상, 콘텐츠, 플랫폼 데이터, API 응답, 이미지 또는 로고에 대한 사용 권리를 부여하지 않습니다.
