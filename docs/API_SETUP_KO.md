# API 설정

## 운영 모델

MVP 기본 경로는 API 우선의 경량 컨트롤 플레인이다. 백엔드는 외부 플랫폼 API 접근, 이벤트 정규화, 중복 제거, 사용자 설정 적용, 푸시 작업 생성을 맡고, 모바일 앱은 서버가 정규화한 DTO만 사용한다.

Docker는 로컬 재현과 선택적 셀프호스팅용이다. 운영 계획은 저비용 관리형 스토리지, DB 기반 작업, FCM, 선택적 스케줄러를 우선한다.

## 관리자 콘솔

백엔드는 제한된 운영 작업을 위해 `/admin` 콘솔을 제공할 수 있다. 기본값은 비활성이다. SSH 터널, VPN, 내부망 같은 maintainer 전용 경로에서만 활성화한다. 외부 노출 시 HTTPS와 인증이 필요하다.

필수 환경 변수:

```env
ADMIN_CONSOLE_ENABLED=true
ADMIN_CONSOLE_TOKEN=
ADMIN_CONSOLE_COOKIE_SECURE=true
INTERNAL_API_TOKEN=
```

빈 문자열, `replace_with_*`, `verify_required` 같은 placeholder 값은 설정 완료로 보지 않는다. `/admin`과 `/v1/internal/*`는 같은 origin에서 통제된 접근만 전제로 하며, 임의의 브라우저 코드 호출용 CORS API가 아니다.

로컬 접속:

```text
http://localhost:4000/admin/login
```

로그인 화면에는 `ADMIN_CONSOLE_TOKEN`을 입력하고, 내부 API 호출 필드에는 `INTERNAL_API_TOKEN`을 입력한다. 토큰을 URL query string에 넣지 않는다.

## CHZZK

CHZZK Developers/Open API 또는 문서화된 허용 endpoint만 사용한다. 모바일 앱은 CHZZK를 직접 호출하지 않고, CHZZK credential을 저장하지 않는다. 로그인 쿠키, private endpoint, private WebSocket, `NID_AUT`, `NID_SES`는 사용하지 않는다.

CHZZK 개발자 콘솔 redirect URL:

```text
https://<backend-public-origin>/v1/auth/chzzk/callback
http://localhost:4000/v1/auth/chzzk/callback
```

백엔드 환경 변수:

```env
CHZZK_CLIENT_ID=
CHZZK_CLIENT_SECRET=
CHZZK_REDIRECT_URI=http://localhost:4000/v1/auth/chzzk/callback
CHZZK_OAUTH_SCOPES=
CHZZK_AUTH_STATE_SECRET=
CHZZK_OAUTH_ENABLED=false
CHZZK_ACCESS_TOKEN=
CHZZK_REFRESH_TOKEN=
CHZZK_TOKEN_REFRESH_SKEW_SECONDS=300
CHZZK_LIVE_POLLING_ENABLED=false
```

## OCI 서버-앱 CHZZK 테스트

1. OCI 인스턴스는 Oracle Linux 기준으로 준비한다. 서버는 `PORT=4000`에서 실행하고, 운영 테스트는 가능하면 HTTPS reverse proxy 뒤의 public origin을 사용한다.
2. CHZZK Developers에서 애플리케이션 ID가 사용할 client ID/secret의 앱과 일치하는지 확인한다. 현재 백엔드는 애플리케이션 ID를 env로 소비하지 않으며, 콘솔 대조용 metadata로만 사용한다.
3. CHZZK Developers redirect URL에 `https://<oci-public-origin>/v1/auth/chzzk/callback`을 등록한다. SSH 터널 테스트가 필요할 때만 `http://localhost:4000/v1/auth/chzzk/callback`도 등록한다.
4. OCI 서버의 backend env에는 서버 전용 값만 둔다: `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI=https://<oci-public-origin>/v1/auth/chzzk/callback`, CHZZK Developers에서 선택한 공식 scope 문자열인 `CHZZK_OAUTH_SCOPES`, `CHZZK_AUTH_STATE_SECRET`, `CHZZK_OAUTH_ENABLED=true`, `INTERNAL_API_TOKEN`, `PORT=4000`.
5. 첫 검증에서는 `CHZZK_LIVE_POLLING_ENABLED=false`를 유지한다. secret은 shell history, Git, 앱 설정, 로그에 남기지 않는다.
6. Oracle Linux 방화벽, OCI Security List/NSG, reverse proxy가 앱에서 접근할 public origin을 허용하는지 확인한다. `/v1/internal/*`는 공개 브라우저 호출용이 아니며 maintainer 토큰으로만 호출한다.
7. source 동기화 후 OCI 서버에서 배포본을 다시 build/restart한다: `npm install`, `npm run build`, 그 다음 `npm start` 또는 systemd/Docker 재시작. 실행 프로세스는 `dist/backend/stellive-hub-api/src/index.js`를 사용하므로 source 동기화만으로는 부족하다.
8. maintainer 브라우저에서 `https://<oci-public-origin>/v1/auth/chzzk/start`를 열고 OAuth를 완료한다. 현재 코드는 `/connect`가 아니라 `/start`를 등록한다.
9. OCI 서버 또는 maintainer 환경에서 `Authorization: Bearer <INTERNAL_API_TOKEN>`로 `POST https://<oci-public-origin>/v1/internal/schedulers/chzzk/live-status`를 호출한다.
10. `GET https://<oci-public-origin>/v1/live-status`와 `GET https://<oci-public-origin>/v1/bootstrap?platform=ios` 또는 `?platform=android`가 정규화된 `liveStatus` rows를 반환하는지 확인한다. CHZZK token, OAuth state, raw provider payload가 포함되면 안 된다.
11. 앱에는 CHZZK credential을 넣지 않는다. Android `HUB_BASE_URL`, iOS `HUB_BASE_URL`에는 `https://<oci-public-origin>/`만 설정한다.
12. 앱을 실행해 라이브 페이지를 확인한다. bootstrap 성공 시 서버 `liveStatus`가 화면 상태에 반영되고, API 실패 시 mock fallback 상태를 유지한다.
13. OAuth metadata가 존재하고 scheduler health가 `verify_required`가 아니며 live-status cache freshness가 확인된 뒤에만 `CHZZK_LIVE_POLLING_ENABLED=true`를 켠다.

## 스케줄러 활성화 순서

1. OAuth 연결과 live-status endpoint scope 검증 전까지 `CHZZK_LIVE_POLLING_ENABLED=false`를 유지한다. scope 변경 후에는 기존 토큰에 권한이 추가되지 않으므로 `/v1/auth/chzzk/start`에서 OAuth를 다시 진행한다.
2. `INTERNAL_API_TOKEN`으로 `GET /v1/internal/admin/overview`를 호출해 CHZZK credential/token readiness를 확인한다.
3. `INTERNAL_API_TOKEN`으로 `POST /v1/internal/schedulers/chzzk/live-status`를 호출한다. token metadata가 없으면 `verify_required`가 정상이다.
4. `/v1/live-status`와 `/v1/bootstrap`이 provider token state나 raw provider payload 없이 정규화된 live status만 노출하는지 확인한다.
5. stored OAuth state를 읽을 수 있고 adapter health가 `verify_required`가 아닐 때만 polling을 활성화한다.
6. 승인된 주기로 platform scheduler 또는 cron이 internal route를 호출하게 한다.
7. realtime fan-out을 넓히기 전 adapter health, live-status cache freshness, dedupe count, notification job volume을 모니터링한다.

## X

X 연동은 no-paid-API 경로가 확인될 때만 설계한다. 무료 공식 API 접근이 불가능하거나 rate limit상 유용하지 않으면 feature flag 뒤에 비활성으로 둔다. scraping 또는 login-cookie 대안은 구현하지 않는다.

## YouTube

Stellive official YouTube `UC2b4WRE5BZ6SIUWBeJU8rwg` / `@stellive_official`은 MVP에서 업로드 알림만 지원한다. 공식 YouTube live 예정/시작/종료 알림은 수집하지 않는다.

## Naver

private cafe 글, 로그인 전용 글, cookie 인증 페이지, 일반 cafe HTML 페이지를 수집하지 않는다. 필요한 경우 공개 검색 결과만 허용된 API 범위에서 사용한다.

## Firebase

FCM을 푸시 전송에 사용한다. service account credential은 환경 변수 또는 secret store에만 둔다. production device token, credential, raw private response를 commit하지 않는다.

## Hub Events Storage

`HUB_EVENTS_STORAGE_MODE=memory`가 로컬 기본값이다. Prisma migration 적용 후에만 `HUB_EVENTS_STORAGE_MODE=prisma`를 설정한다. 공개 read API는 published, non-deleted `HubEvent`만 반환하고, admin route는 인증된 CRUD와 상태 변경을 처리한다.
