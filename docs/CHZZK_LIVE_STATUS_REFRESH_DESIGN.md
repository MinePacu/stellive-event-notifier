# CHZZK Live Status Refresh Design

작성일: 2026-06-15

## Background

2026-06-15 서버 점검에서 다음 불일치를 확인했다.

- 실행 중인 API 컨테이너는 `CHZZK_LIVE_POLLING_ENABLED=true`로 동작한다.
- `GET /v1/live-status` 캐시는 마지막 갱신 시각이 `2026-06-15T01:31:59Z`에서 `2026-06-15T01:32:05Z` 사이였다.
- 같은 시점에 CHZZK Open API `GET /open/v1/lives`를 서버 컨테이너에서 직접 조회하면 `yuzuha-riko`, `sakihane-huya`, `neneko-mashiro`가 live list에 존재했다.
- Android/iOS는 `GET /v1/bootstrap`의 `liveStatus`를 병합해 Live 화면을 구성한다.
- 실행 중인 서버의 `GET /v1/bootstrap` 응답에는 `liveStatus`가 없어 앱은 `서버 연결됨 · 라이브 폴링 꺼짐/데이터 없음`으로 표시했다.

따라서 문제는 CHZZK Open API나 catalog channel ID가 아니라, 서버 캐시 갱신 루프와 모바일 bootstrap 계약이다.

## Goals

- CHZZK live-status 캐시가 주기적으로 갱신되도록 한다.
- `GET /v1/bootstrap`이 모바일 계약대로 `liveStatus`를 항상 포함하도록 한다.
- Android/iOS가 서버의 normalized `LiveStatus` DTO만 사용해 Live 화면을 갱신하도록 유지한다.
- CHZZK credentials, OAuth token state, direct CHZZK host calls는 계속 backend-only로 제한한다.
- live started/ended 이벤트는 기존 ingestion, event guard, dedupe, notification job, preference resolution 경로만 사용한다.

## Non-Goals

- 앱에서 CHZZK API를 직접 호출하지 않는다.
- CHZZK 비공식 endpoint, 로그인 쿠키, private WebSocket/session bypass를 도입하지 않는다.
- `realtime_best_effort`가 사용자 알림 설정, quiet hours, keyword rules, rate limits를 우회하지 않는다.
- `chzzk_chat` push delivery를 자동 활성화하지 않는다.
- 공식 YouTube live scheduled/started/ended 이벤트를 생성하지 않는다.

## Current Failure Mode

`CHZZK_LIVE_POLLING_ENABLED`는 현재 "내부 스케줄러 라우트 실행 허용" 플래그다. API 프로세스 시작 시 자동 polling loop를 만들지 않는다. 별도 cron이나 worker가 `POST /v1/internal/schedulers/chzzk/live-status`를 호출하지 않으면 `LiveStatus` DB/cache는 stale 상태로 남는다.

또한 `routes.ts`의 fallback bootstrap 응답은 catalog, preferences, realtime status를 만들지만 `liveStatus`를 포함하지 않는다. `BootstrapService`에는 `liveStatus` 포함 코드가 있으나, 실행 환경이 fallback path를 타면 앱으로 live status가 전달되지 않는다.

## Proposed Backend Design

### 1. Preserve The Internal Scheduler Boundary

`ChzzkOpenApiAdapter.pollLiveStatuses()`와 `POST /v1/internal/schedulers/chzzk/live-status`를 canonical refresh entrypoint로 유지한다.

이 라우트는 계속 `INTERNAL_API_TOKEN`으로 보호한다. 외부 caller가 device, preference, push payload, event type을 직접 지정할 수 없어야 한다.

Refresh flow:

1. Internal scheduler calls `POST /v1/internal/schedulers/chzzk/live-status`.
2. `ChzzkOpenApiAdapter` reads catalog members with `catalogRole` `member` or `representative` and verified `chzzkChannelId`.
3. `ChzzkApiClient` calls official `GET /open/v1/lives` with `Client-Id` and `Client-Secret`.
4. The adapter writes normalized rows through `LiveStatusRepository.upsertLiveStatus`.
5. Started/ended transitions become `PlatformEvent` candidates only through existing ingestion.
6. Push delivery remains controlled by notification jobs and preference resolution.

### 2. Add A Real Refresh Driver

Add one operational refresh driver. Preferred order:

1. Deployment scheduler or cron outside the API container.
2. A dedicated backend worker service in `docker-compose.yml`.
3. In-process interval only for local development and explicit opt-in.

Recommended MVP implementation is a dedicated worker/container because it keeps scheduling separate from request handling and works with Docker-hosted backend tests.

Worker behavior:

- Runs only when `CHZZK_LIVE_POLLING_ENABLED=true`.
- Reads `INTERNAL_API_TOKEN` from backend environment or container secret.
- Calls `POST http://api:4000/v1/internal/schedulers/chzzk/live-status`.
- Uses a conservative interval, for example 60 seconds, with jitter.
- Treats 401/403 as fatal configuration error.
- Treats 429 as rate-limited and backs off.
- Logs only counts and health reason, never credentials or raw provider responses.

Suggested environment variables:

```env
CHZZK_LIVE_POLL_INTERVAL_SECONDS=60
CHZZK_LIVE_POLL_JITTER_SECONDS=10
CHZZK_LIVE_POLL_BACKOFF_SECONDS=300
```

### 3. Keep Cache Freshness Explicit

Every `LiveStatus` DTO should expose enough normalized metadata for diagnostics:

- `memberId`
- `generationId`
- `platform`
- `isLive`
- `title`
- `viewerCount`
- `startedAt`
- `platformUrl`
- `lastCheckedAt`
- `sourceVerificationState`

Admin/internal diagnostics should report:

- Latest `lastCheckedAt`.
- Oldest `lastCheckedAt`.
- Count of live members.
- Count of `verified`, `verify_required`, and `rate_limited` rows.
- Adapter health reason from `PlatformApiState`.

Mobile UI can show a concise source label derived from data presence and freshness. It should not infer "polling off" from an empty `liveStatus` array alone.

## Mobile Bootstrap Contract

`GET /v1/bootstrap` must include `liveStatus` in every backend mode.

Required response shape:

```json
{
  "config": {},
  "catalog": {},
  "preferences": [],
  "liveStatus": [],
  "hubEventsSummary": {},
  "serverTime": "2026-06-15T00:00:00.000Z"
}
```

If the backend has no rows yet, return `liveStatus: []` explicitly. Do not omit the field.

Fallback bootstrap must load `LiveStatusRepository.listDiagnostics()` and map rows to the same `LiveStatus` DTO shape as `BootstrapService`. This prevents Android/iOS from diverging depending on whether Prisma-backed bootstrap is active.

The app label should distinguish these cases:

- `서버 liveStatus`: response contains live status rows.
- `서버 연결됨 · liveStatus 없음`: response explicitly contains an empty array.
- `서버 연결 실패 · 앱 내 목업`: network or decode failure.
- `서버 연결됨 · liveStatus 오래됨`: rows exist but `lastCheckedAt` is older than the freshness threshold.

Avoid the phrase `라이브 폴링 꺼짐` unless the backend explicitly sends a disabled/health state.

## Android/iOS Reflection

Android and iOS should continue to merge server status by `memberId`.

For each CHZZK target:

- If a matching server row exists, use `isLive`, `title`, `viewerCount`, `startedAt`, `platformUrl`, and `lastCheckedAt`.
- If no matching row exists, show offline with a backend-source label, not mock live data.
- Official channel rows must not create official YouTube live UI or notifications.
- Gangzi remains a `representative` under `gamja`.

The Live page should show:

- Live/offline filters.
- Broadcast title when live.
- Elapsed time from `startedAt`.
- Viewer count when `viewerCount` exists.
- `CHZZK에서 보기` or platform link when `platformUrl` exists.
- Source/freshness label based on backend DTOs.

## Tests

Backend tests:

- `mobileBootstrap.test.ts` proves fallback bootstrap includes `liveStatus`.
- `mobileBootstrap.test.ts` proves empty live status is serialized as `liveStatus: []`, not omitted.
- `liveStatus` tests prove stale rows expose `lastCheckedAt`.
- `internalRoutes` tests prove `CHZZK_LIVE_POLLING_ENABLED=false` blocks scheduler execution.
- Scheduler/worker tests inject fake HTTP and verify interval, backoff, and no secret logging.

Android tests:

- Server bootstrap with 3 live rows renders all 3 as live.
- Empty `liveStatus: []` does not keep mock live state.
- Stale `lastCheckedAt` shows stale source label.
- Missing `viewerCount` hides viewer count without layout breakage.

iOS tests:

- `ServerLiveStatusMappingTests` covers the same 3-live-row fixture.
- Empty `liveStatus: []` clears mock live state for CHZZK targets.
- `LiveView` shows title, elapsed time, viewer count, and CHZZK link when provided.

## Verification Plan

Local backend:

```bash
cd backend/stellive-hub-api
rtk npm run build
rtk npm test -- liveStatus
rtk npm test -- mobileBootstrap
```

Android:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

iOS:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Server read-only checks after deployment:

```bash
curl -s http://192.168.50.9:4000/v1/live-status
curl -s http://192.168.50.9:4000/v1/bootstrap
```

Expected deployment state:

- `/v1/live-status` `lastCheckedAt` is within the configured freshness window.
- `/v1/live-status` live count matches CHZZK Open API for catalog channels.
- `/v1/bootstrap` contains `liveStatus`.
- Android/iOS Live pages show `서버 liveStatus` or a freshness label, not `라이브 폴링 꺼짐`, when polling is enabled.

## Rollout

1. Add backend contract fix for `/v1/bootstrap`.
2. Add tests for fallback bootstrap live status.
3. Add scheduler worker or deployment cron.
4. Deploy backend to `minepacu@192.168.50.9`.
5. Trigger one manual refresh through the protected internal scheduler during deployment.
6. Verify `/v1/live-status`, `/v1/bootstrap`, Android Live page, and iOS Live page.
7. Record adapter health, cache freshness, and mobile screenshots in handoff notes.

## Open Questions

- Should Docker-hosted test backend use a dedicated worker container by default, or should scheduled polling stay disabled unless explicitly requested?
- What freshness threshold should mobile use before showing stale status: 2 minutes, 5 minutes, or 10 minutes?
- Should `/v1/bootstrap` include adapter health summary so mobile can distinguish disabled polling from empty live rows without another endpoint?
