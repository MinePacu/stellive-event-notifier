# 스텔라이브 이벤트 알리미

스텔라이브 관련 굿즈·행사 일정, 멤버 기념일, 플랫폼 이벤트를 한곳에서 확인하고, 사용자의 알림 설정에 따라 Android/iOS 푸시와 앱 내 기록으로 전달하는 비공식 오픈소스 MVP입니다.

> [!NOTE]
> 이 README의 안내문은 GitHub Alerts 문법을 사용합니다. `NOTE`와 `WARNING`은 GitHub와 GitLab에서 모두 렌더링되는 공통 유형이라 두 플랫폼에서 같은 의미로 읽을 수 있습니다.

> [!WARNING]
> 이 프로젝트는 스텔라이브, CHZZK, YouTube, Naver와 공식 관계가 없습니다. Apache License 2.0은 원본 코드와 문서에만 적용되며, 각 권리자가 보유한 이름·초상·상표·플랫폼 데이터·API 응답·제3자 콘텐츠에 대한 권리를 부여하지 않습니다.

## 한눈에 보기

| 영역 | 제공 기능 |
| --- | --- |
| Android | 알림 설정, 로컬 기록·캐시, 딥링크, 굿즈·행사 캘린더, 위젯 데이터, FCM 수신 |
| iOS | SwiftUI 기반 알림 설정, 일정·위젯 데이터, 딥링크, 로컬 상태 관리, FCM 수신 |
| Backend | Fastify API, 기기·선호도 관리, 굿즈·행사 관리, CHZZK 상태 캐시, 음악 동기화, 알림 작업 처리 |
| Shared | 멤버 카탈로그 seed, 공통 도메인 스키마, OpenAPI 문서 |

## 현재 구현 범위

- 굿즈·행사: 공개 조회, 월간 캘린더, 위젯 스냅샷, 관리자 생성·검증·게시·취소·감사 로그
- 기념일: 멤버 생일과 세대 기념일을 읽기 전용 calendar entry로 제공
- 라이브: backend가 CHZZK Open API를 조회·정규화·캐시하고, 앱은 backend DTO만 소비
- 음악: 서버가 공식 COVER/ORIGINAL YouTube playlist를 동기화하고, 공개 음악 목록·상세·멤버별 조회를 제공
- 알림: 서버가 사용자 선호도와 부하 완화 정책을 적용해 FCM을 발송하며, credential이 없을 때는 안전하게 비활성화
- 운영: 관리자 콘솔, 내부 scheduler 경로, API·worker 분리 운영, Docker Compose/Nginx/PM2 확장 안내

## 핵심 정책

- 멤버 카탈로그와 MVP 대상에는 `active`·`upcoming` 멤버만 포함합니다. Former 멤버는 포함하지 않습니다.
- Gangzi는 세대 멤버가 아닌 `gamja` 카테고리의 `representative`이며, 표시 라벨은 `스텔라이브 대표`입니다.
- `official`은 앱에서 `기타`로 표시하며 공식 YouTube 대상을 포함합니다. 공식 YouTube는 업로드 알림만 지원합니다.
- 사용자 설정이 항상 우선합니다. `global=false`는 모든 푸시 알림을 차단합니다.
- `realtime_best_effort`는 전달 전략일 뿐이며 opt-out, quiet hours, OS·플랫폼·rate-limit 정책을 우회하지 않습니다.
- 외부 플랫폼에는 공식 API와 약관을 우선 적용합니다. 로그인 쿠키 스크래핑, private cafe 수집, 접근 우회는 구현하지 않습니다.
- OAuth token, Firebase 서비스 계정, production device token, raw private response, 이미지 바이너리·공식 로고·팬아트·캡처물은 커밋하지 않습니다.

## 저장소 구조

```text
android/StelliveHubAndroid/        Android 앱
ios/StelliveHubiOS/                iOS SwiftUI 앱과 Xcode 프로젝트
backend/stellive-hub-api/          Fastify TypeScript API와 worker
shared/schemas/                    공통 도메인 및 모바일 API 타입
shared/member-catalog/             멤버 카탈로그 seed
shared/openapi/                    OpenAPI 문서
docs/                              정책, 아키텍처, API·운영 설계
mockups/                           UI mockup
```

## 빠른 시작

### Backend

로컬 기본 포트는 `4000`입니다.

```bash
cd backend/stellive-hub-api
npm install
npm run dev
```

서버 실행 후 Swagger UI는 [http://localhost:4000/docs](http://localhost:4000/docs)에서 확인할 수 있습니다.

PostgreSQL·Redis·API를 함께 실행하려면 다음을 사용합니다.

```bash
cd backend/stellive-hub-api
cp .env.example .env
docker compose up
```

Prisma 저장소를 사용하는 경우에는 먼저 client 생성과 migration을 수행합니다.

```bash
cd backend/stellive-hub-api
npm run prisma:generate
npm run prisma:migrate
```

### 모바일 앱

Android:

```bash
cd android/StelliveHubAndroid
./gradlew assembleDebug
```

iOS는 Xcode에서 `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj`를 열거나 다음 명령으로 빌드합니다.

```bash
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

## 주요 API

| 구분 | 경로 |
| --- | --- |
| 상태·초기화 | `GET /health`, `GET /docs`, `GET /v1/bootstrap` |
| 기기·선호도 | `POST /v1/devices/register`, `PUT /v1/devices/token`, `GET/PUT /v1/preferences` |
| 굿즈·행사 | `GET /v1/hub-events`, `GET /v1/hub-events/:id`, `GET /v1/hub-events/calendar`, `GET /v1/hub-events/widget-snapshot`, `GET /v1/hub-events/summary` |
| 라이브·인증 | `GET /v1/live-status`, `GET /v1/auth/chzzk/start`, `GET /v1/auth/chzzk/callback` |
| 음악 | `GET /v1/music`, `GET /v1/music/:id`, `GET /v1/members/:id/music` |
| 관리자·내부 작업 | `GET /admin`, `/v1/admin/hub-events`, `/v1/internal/schedulers/*`, `/v1/internal/jobs/notifications/drain` |

관리자와 internal API는 token/session 보호 경로입니다. production credential은 환경 변수 또는 secret manager로만 주입합니다.

## 음악 동기화

YouTube API key는 backend 환경 변수 `YOUTUBE_API_KEY`로만 사용합니다. 클라이언트는 YouTube API를 직접 호출하지 않습니다. 기본 동기화는 공식 COVER/ORIGINAL playlist를 기준으로 하며, `search.list`를 사용하지 않습니다.

```bash
curl -H "Authorization: Bearer <INTERNAL_API_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"mode":"full"}' \
  http://localhost:4000/v1/internal/schedulers/music/sync-official-playlists
```

`INTERNAL_API_TOKEN`과 `YOUTUBE_API_KEY`는 문서·커밋·로그에 기록하지 마세요.

## 테스트

```bash
# Backend
cd backend/stellive-hub-api
npm run build
npm test
```

```bash
# Android
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

```bash
# iOS
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## 문서

- [프로젝트 규칙](docs/PROJECT_RULES.md) · [알림 정책](docs/NOTIFICATION_POLICY.md) · [실시간 전달 정책](docs/REALTIME_DELIVERY.md)
- [아키텍처](docs/ARCHITECTURE.md) · [API 설정](docs/API_SETUP.md) · [백엔드 확장 가이드](docs/BACKEND_SCALING.md)
- [CHZZK 라이브 상태 설계](docs/CHZZK_LIVE_STATUS_REFRESH_DESIGN.md) · [FCM 경계 설계](docs/FIREBASE_FCM_BOUNDARY_DESIGN.md)
- [굿즈·행사 Read API 설계](docs/HUB_EVENTS_READ_API_DESIGN.md) · [기념일 캘린더 설계](docs/HUB_EVENT_ANNIVERSARY_CALENDAR_DESIGN.md)

## 라이선스

프로젝트 코드와 문서는 [Apache License 2.0](LICENSE)을 따릅니다. 이 라이선스는 스텔라이브 또는 제3자 플랫폼의 상표, 초상, 콘텐츠, API 응답, 이미지, 로고, 팬아트, 캡처물에 대한 사용 권리를 제공하지 않습니다.
