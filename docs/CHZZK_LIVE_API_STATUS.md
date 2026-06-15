# CHZZK Live API Status

확인일: 2026-06-14

추가 확인일: 2026-06-15

- CHZZK Developers 공개 페이지는 JavaScript SPA이며, HTML은 `https://ssl.pstatic.net/static/nng/glive-open/resource/p/static/js/main.16e89f8a.js`를 참조한다.
- 해당 공식 정적 번들에서 확인된 개발자센터 화면 라우트는 `/application`, `/service`이고, scope UI 관련 문자열은 `scopeGroups`, `scopeList`, `LIVE_SERVICE`, `LIVE_MANAGE`, `LIVE_COMMERCIAL`이다.
- 같은 번들에서는 `open/v1/...` live-status endpoint path, 요청 파라미터 형식, 성공 응답 schema를 확정할 수 없었다.
- 서버에서 대표 catalog channel 1개와 저장된 access token으로 현재 구현 endpoint `GET https://openapi.chzzk.naver.com/open/v1/lives/{channelId}`를 1회 probe했다. token, channel ID, raw provider body는 출력하지 않았다.
- probe 결과는 HTTP `404`였고, adapter health의 `chzzk_live_api_http_404`와 일치한다.
- 결론: 현재 증거만으로 endpoint/identifier/권한 중 어느 쪽이 원인인지 확정할 수 없다. 인증된 개발자 콘솔 문서/API 또는 공식 문서 페이지에서 live-status endpoint contract를 추가 확인해야 한다.
- Catalog identifier 확인: `shared/member-catalog/members.seed.json` 기준 13명 중 `chzzkChannelId` 보유 항목은 11개이고, 모두 pollable CHZZK target이다. Pollable target은 `active` 상태의 `member` 또는 `representative`만 포함하며, `official_channel`과 `former`는 포함하지 않는다. Gangzi는 `gamja`의 `representative`로 포함된다.
- 저장된 CHZZK ID 11개는 모두 32자 hex 형식이다. 대표 ID 1개는 공개 `https://chzzk.naver.com/live/{id}` URL에서 `HEAD` 200을 반환했다. 이는 현재 저장값이 공개 CHZZK live URL slug로는 유효함을 뜻하지만, Open API가 동일한 identifier type을 요구한다는 증거는 아니다.
- App authorization/scope 확인: 서버 `.env`의 `CHZZK_OAUTH_SCOPES`와 `/v1/auth/chzzk/start` redirect는 3개 scope token으로 일치했다. token response에 저장된 `oauth.scope`는 8개 token으로, 설정값과 normalized set이 서로 subset 관계가 아니었다. scope 값은 문서와 로그에 출력하지 않았다.
- CHZZK Developers 정적 번들에는 `/clients`, `/scopes`, `/user/getUserStatus`, `approvedScope` 같은 개발자센터 API/UI 문자열이 있으나, 비로그인 probe로는 앱 review state, endpoint entitlement, channel linkage, OAuth account/channel authorization을 확인할 수 없었다. 이 항목은 maintainer가 로그인된 CHZZK Developers console에서 확인해야 한다.
- Phase 4 재검증 결과 scheduler는 `200`으로 실행되지만 `checked=11`, `updated=11`, `verifyRequired=11`, `eventsCreated=0`이며 adapter health는 계속 `verify_required / chzzk_live_api_http_404`다.

추가 확인일: 2026-06-15 (공식 GitBook 문서 확인)

- 공식 CHZZK GitBook 문서의 Live API는 `GET /open/v1/lives`를 라이브 목록 조회 endpoint로 명시한다. 특정 channel ID를 path parameter로 받는 `GET /open/v1/lives/{channelId}` endpoint는 Live 문서에 없다.
- 공식 Live 문서에 따르면 라이브 목록 조회는 사용자 Access Token이 아니라 애플리케이션 등록 후 Client 인증이 필요하다.
- 공식 참고사항 문서는 Open API 도메인을 `https://openapi.chzzk.naver.com`로 명시하고, Client 인증 API는 `Client-Id`, `Client-Secret`, `Content-Type: application/json` header를 사용한다고 설명한다.
- 공식 Channel 문서의 채널 정보 조회 endpoint는 `GET /open/v1/channels`이며, `channelIds` query parameter로 최대 20개 channel ID를 받는다.
- 서버에서 real secret 값을 출력하지 않고 공식 Client 인증 방식으로 probe한 결과 `GET /open/v1/lives?size=1`은 `status=200`, `code=200`, `dataCount=1`, `hasPage=true`를 반환했다.
- 같은 방식으로 `GET /open/v1/channels?channelIds={catalogId}`는 `status=200`, `code=200`, `dataCount=1`을 반환했다.
- 결론: 현재 `ChzzkApiClient`의 `GET /open/v1/lives/{channelId}` + Bearer Access Token 방식은 공식 문서와 맞지 않는다. 다음 코드 변경은 Client 인증 기반으로 `GET /open/v1/lives` 목록을 조회한 뒤 catalog `chzzkChannelId`와 response `channelId`를 매칭하는 방향이어야 한다. 개별 channel metadata 검증은 `GET /open/v1/channels?channelIds=...`를 사용할 수 있다.

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
