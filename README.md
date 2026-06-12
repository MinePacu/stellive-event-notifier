# 스텔라이브 이벤터 알리미

스텔라이브 관련 굿즈/행사 일정과 플랫폼 알림을 한곳에서 확인하고, 사용자별 알림 설정에 따라 Android/iOS 푸시와 앱 내 기록으로 전달하는 비공식 오픈소스 MVP입니다.

이 프로젝트는 스텔라이브, CHZZK, YouTube, X, Naver, Samsung, Apple과 공식 관계가 없습니다. 원본 코드와 문서는 Apache License 2.0으로 배포되지만, 각 권리자가 보유한 이름, 초상, 상표, 플랫폼 데이터, API 응답, 제3자 콘텐츠에 대한 권리를 부여하지 않습니다.

## 현재 범위

- Android 앱: 알림 설정, 로컬 기록/캐시, 딥링크, 굿즈/행사 화면
- iOS SwiftUI 앱: 알림 설정, 일정/위젯 데이터 표시, 딥링크, 로컬 상태
- TypeScript Fastify 백엔드: 모바일 API, 카탈로그/선호도, Hub Event CRUD/읽기, 알림 job 처리, CHZZK OAuth/라이브 상태 연동 경계
- 공통 스키마: 모바일 API DTO, 도메인 타입, OpenAPI 초안, 멤버 카탈로그 seed
- 운영 정책: 공식 API 우선, 서버 중재형 ingestion, 선호도 우선 알림 전달

## 정책 요약

- Former 멤버는 MVP 카탈로그, 알림 대상, UI 필터, seed data에 포함하지 않습니다.
- 멤버 카탈로그는 `active` 또는 `upcoming` 항목만 포함합니다.
- 강지는 generation 멤버가 아니며 `gamja` 카테고리의 `representative` 항목으로만 포함합니다.
- `official` 카테고리는 UI에서 `기타`로 표시하며, 스텔라이브 공식 YouTube/X 알림 대상을 포함합니다.
- 스텔라이브 공식 YouTube는 업로드 알림만 지원합니다. 공식 YouTube 라이브 예정/시작/종료 알림은 만들지 않습니다.
- 로그인 쿠키 수집, 비공개 카페 수집, 무단 크롤링, 접근 우회는 구현하지 않습니다.
- 실제 API secret, OAuth credential, Firebase service account, production device token은 커밋하지 않습니다.
- 프로필 이미지 바이너리, 공식 로고, 팬아트, 캡처 이미지, 무단 미디어 asset은 저장소에 커밋하지 않습니다.
- 사용자 알림 설정이 최종 기준입니다. Global off는 모든 알림을 차단합니다.
- `realtime_best_effort`는 빠른 전달을 시도할 뿐이며, 사용자 설정/OS 정책/API 제한/rate limit을 우회하지 않습니다.
- `chzzk_chat`은 기본 off이며, push 전달에는 명시적 필터가 필요합니다.

자세한 규칙은 [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md), [docs/NOTIFICATION_POLICY.md](docs/NOTIFICATION_POLICY.md), [docs/REALTIME_DELIVERY.md](docs/REALTIME_DELIVERY.md)를 먼저 확인하세요.

## 저장소 구조

```text
android/StelliveHubAndroid/     Android 앱
ios/StelliveHubiOS/             iOS SwiftUI 앱과 Xcode 프로젝트
backend/stellive-hub-api/       Fastify TypeScript API/control plane
shared/schemas/                 공통 도메인 및 모바일 API 타입
shared/member-catalog/          카탈로그 seed
shared/openapi/                 OpenAPI 문서
docs/                           정책, 아키텍처, API 문서
mockups/                        UI mockup
```

## 백엔드 실행

로컬 개발 기본 포트는 `4000`입니다.

```bash
cd backend/stellive-hub-api
npm install
npm run dev
```

Swagger UI는 서버 실행 후 `/docs`에서 확인할 수 있습니다.

Docker Compose는 PostgreSQL, Redis, API를 함께 띄우는 로컬 개발/자가호스팅 옵션입니다.

```bash
cd backend/stellive-hub-api
cp .env.example .env
docker compose up
```

Prisma 기반 저장소를 사용할 때는 migration/generate 절차를 먼저 확인하세요.

```bash
cd backend/stellive-hub-api
npm run prisma:generate
npm run prisma:migrate
```

## 주요 백엔드 API

- `GET /health`
- `GET /docs`
- `GET /v1/bootstrap`
- `POST /v1/devices/register`
- `PUT /v1/devices/token`
- `GET /v1/preferences`
- `PUT /v1/preferences`
- `GET /v1/hub-events`
- `GET /v1/hub-events/:id`
- `GET /v1/hub-events/calendar`
- `GET /v1/hub-events/widget-snapshot`
- `GET /v1/hub-events/summary`
- `GET /v1/live-status`
- `GET /v1/auth/chzzk/start`
- `GET /v1/auth/chzzk/callback`
- `GET /admin`
- `GET /v1/admin/hub-events`
- `POST /v1/admin/hub-events`
- `POST /v1/admin/hub-events/validate`
- `POST /v1/internal/jobs/notifications/drain`

Admin 및 internal API는 token/session 보호 경로입니다. production credential은 반드시 환경 변수로만 주입합니다.

## Android

```bash
cd android/StelliveHubAndroid
./gradlew assembleDebug
```

Unit test:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

FCM 설정 파일과 인증 정보는 저장소에 커밋하지 않고 로컬 환경에만 둡니다.

## iOS

Xcode에서 `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj`를 엽니다.

CLI 빌드 예시:

```bash
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Test 예시:

```bash
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

APNs/FCM 설정 파일과 인증 정보는 저장소에 커밋하지 않습니다.

## 테스트

Backend:

```bash
cd backend/stellive-hub-api
npm test
```

Android:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

iOS:

```bash
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## 개발 전 확인 문서

- [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md)
- [docs/NOTIFICATION_POLICY.md](docs/NOTIFICATION_POLICY.md)
- [docs/REALTIME_DELIVERY.md](docs/REALTIME_DELIVERY.md)
- [docs/API_IMPLEMENTATION_PLAN.md](docs/API_IMPLEMENTATION_PLAN.md)
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API_SETUP.md](docs/API_SETUP.md)
- [docs/HUB_EVENTS_READ_API_DESIGN.md](docs/HUB_EVENTS_READ_API_DESIGN.md)

## 라이선스 및 주의

프로젝트 코드와 문서는 Apache License 2.0을 따릅니다. 단, 이 라이선스는 스텔라이브 또는 제3자 플랫폼의 상표, 초상, 콘텐츠, API 응답, 이미지, 로고, 팬아트, 캡처물에 대한 사용 권리를 제공하지 않습니다.

앱과 백엔드는 플랫폼 API와 사용자 선호도 정책을 준수하는 서버 중재형 구조를 유지해야 합니다. 모바일 앱은 보호된 플랫폼 API credential을 저장하거나 직접 호출하지 않습니다.
