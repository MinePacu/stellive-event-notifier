# CHZZK Live API Status

확인일: 2026-06-14

## 현재 구현

- 백엔드에는 CHZZK OAuth 연결 라우트가 있다: `/v1/auth/chzzk/connect`, `/v1/auth/chzzk/callback`.
- `ChzzkApiClient`는 `https://openapi.chzzk.naver.com/open/v1/lives/{channelId}`를 호출하고, 401 시 refresh token으로 1회 재시도하며, 429/HTTP 오류는 adapter health에 기록한다.
- `ChzzkOpenApiAdapter`는 catalog의 `active`/`upcoming` `member` 또는 Gangzi `representative` 중 `chzzkChannelId`가 있는 대상만 polling한다. Former/official channel은 제외된다.
- live cache는 `LiveStatusRepository`가 Prisma `LiveStatus`에 저장한다. 저장 DTO에는 `memberId`, `generationId`, `isLive`, `title`, `viewerCount`, `startedAt`, `platformUrl`, `sourceVerificationState`, `lastCheckedAt`가 포함된다.
- 내부 스케줄러 라우트는 `POST /v1/internal/schedulers/chzzk/live-status`다. `CHZZK_LIVE_POLLING_ENABLED=false`면 disabled, OAuth token state가 없으면 `verify_required`를 반환한다.
- 공개 API는 `/v1/live-status`, 모바일 bootstrap은 `liveStatus: LiveStatus[]`를 내려줄 수 있다.
- Android/iOS 네트워크 DTO에는 bootstrap `liveStatus` 필드가 있다.

## 부족한 부분

- 기본 app wiring에서 `ChzzkOpenApiAdapter`가 실제 dependency로 조립되지 않는다. `internalRoutes`는 `chzzkLiveAdapter` 주입을 기대하지만 `buildApp`의 기본 구성은 notification worker만 만든다.
- `GET /v1/bootstrap`은 live status를 내려줄 수 있지만, Android `ServerHubRepository`는 성공 응답을 화면 모델로 변환하지 않고 `fallback.bootstrap()`을 반환한다.
- iOS `ServerHubStore`도 bootstrap 응답을 검증/등록에만 사용하고 실제 화면 상태는 `MockHubStore`를 유지한다.
- 모바일 라이브 화면은 현재 mock member의 `isLive/liveStartedAt` 값에 의존한다.
- 운영 확인 항목이 남아 있다: CHZZK developer redirect 등록, OAuth token 저장 확인, 실제 endpoint scope/rate limit 확인, scheduler 주기 설정, cache freshness/health 모니터링.

## 보완 계획

1. 백엔드 조립
   - `buildApp` 기본 dependency에 `PlatformApiStateRepository`, `LiveStatusRepository`, `ChzzkAuthClient`, `ChzzkApiClient`, `ChzzkOpenApiAdapter`, ingestion service를 연결한다.
   - `CHZZK_LIVE_POLLING_ENABLED=false` 기본값은 유지하고, token/adapter 미구성 시 push/event 생성을 하지 않게 둔다.

2. 백엔드 검증
   - `internalRoutes` 통합 테스트를 추가해 flag off, token missing, adapter missing, 정상 polling 경로를 고정한다.
   - `GET /v1/bootstrap`이 repository live status를 포함하는지 테스트한다.

3. Android 연결
   - `BootstrapResponseDto.catalog.members + liveStatus`를 `HubMember.isLive/liveStartedAt/platformUrl`로 merge한다.
   - 서버 실패 시에만 mock fallback을 사용한다.
   - live page 테스트에서 mock live 값 대신 bootstrap live status 반영을 검증한다.

4. iOS 연결
   - `BootstrapResponse.liveStatus`를 `MockHubStore`/실제 store 모델에 merge하는 mapper를 만든다.
   - 서버 실패 시 기존 mock 상태 유지, 성공 시 live page가 서버 live status를 표시하도록 테스트한다.

5. 운영 절차
   - backend-only env 설정 후 `/v1/auth/chzzk/connect`로 OAuth 연결.
   - `PlatformApiState` token metadata 확인.
   - `POST /v1/internal/schedulers/chzzk/live-status` 수동 실행 후 `GET /v1/live-status`와 bootstrap 응답 확인.
   - health가 `verify_required`가 아니고 cache freshness가 확인된 뒤에만 scheduler와 `CHZZK_LIVE_POLLING_ENABLED=true`를 켠다.
