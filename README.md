# 스텔라이브 알림 허브

스텔라이브 관련 플랫폼 알림을 한곳에서 확인하고, 사용자별 알림 설정에 따라 Android/iOS 푸시와 앱 내 기록으로 전달하기 위한 비공식 오픈소스 MVP입니다. 기본 운영 모델은 모바일 앱과 API-first 경량 control plane을 조합하는 구조입니다.

이 저장소는 스텔라이브, CHZZK, YouTube, X, Naver와 공식 제휴, 보증, 후원 관계가 없습니다. 프로젝트의 원본 코드와 문서는 Apache License 2.0으로 배포되지만, 이 라이선스는 각 권리자가 보유한 이름, 초상, 상표, 로고, 플랫폼 데이터, API 응답, 제3자 콘텐츠에 대한 권리를 부여하지 않습니다.

## 현재 상태

현재 구현은 로컬 개발, 정책 검증, 초기 운영 방식 검토를 위한 MVP skeleton입니다.

- Android 앱: Kotlin, XML/ViewBinding, Material Components, Hilt, Retrofit, Room/DataStore skeleton, FCM 서비스 placeholder.
- iOS 앱: SwiftUI 기반 화면, mock store, 알림 권한 서비스, foreground realtime stream client skeleton.
- Backend/control plane: Fastify TypeScript API skeleton, mock adapter, preference resolution, delivery attempt 기록, lightweight job policy skeleton, Prisma schema persistence contract.
- Shared: 공통 도메인 타입, member catalog seed, OpenAPI 초안.

실제 플랫폼 연동, Firebase 프로젝트 연결, production 인증, managed storage, database-backed job 구현은 아직 TODO입니다.

## 주요 기능

- CHZZK, YouTube, X 공식/허용 API 기반 이벤트 수집 구조.
- Naver Cafe 자동 수집은 MVP에서 보류하며, 재도입 시 공개 Search API 등 명확히 허용된 경로만 사용합니다.
- API-first 경량 control plane 기반 이벤트 정규화, 중복 제거, 알림 설정 해석, 푸시 전송 구조.
- managed storage와 database-backed job을 우선하고, Redis/BullMQ는 트래픽이 필요할 때 같은 job adapter 뒤에 추가하는 확장 경로.
- Android/iOS 홈, 라이브 상태, 알림 기록, 설정 화면의 MVP UI.
- 사용자에게 보이는 알림 기록은 기본적으로 기기 로컬 저장소에 보관합니다.
- 전체, 플랫폼, 이벤트 타입, 그룹, 개별 항목 단위 알림 설정 모델.
- `realtime_best_effort` 전달 모드와 선택형 foreground refresh 구조.
- quiet hours, keyword allow/block, rate limit을 고려하는 preference resolution 모델.
- 앱 소유 placeholder avatar와 외부 API 이미지 URL fallback 정책.

## 저장소 구조

```text
android/StelliveHubAndroid      Android 앱
ios/StelliveHubiOS              iOS SwiftUI 앱과 Xcode 프로젝트
backend/stellive-hub-api        Fastify TypeScript API/control plane
shared/schemas                  공통 도메인 타입
shared/member-catalog           카탈로그 seed
shared/openapi                  OpenAPI 초안
docs                            정책, 아키텍처, API 준비 문서
mockups                         UI mockup
```

## Backend 실행

MVP 운영 방향은 self-hosted PostgreSQL/Redis를 필수로 요구하지 않는 API-first 경량 control plane입니다. 로컬 개발은 Node 실행을 기본으로 하고, mock/in-memory 상태 또는 managed database를 붙여 검증합니다.

로컬 Node 실행:

```bash
cd backend/stellive-hub-api
npm install
npm run dev
```

기본 포트는 `4000`입니다.

Docker Compose 실행:

```bash
cd backend/stellive-hub-api
cp .env.example .env
docker compose up
```

Docker Compose는 PostgreSQL, Redis, API를 함께 띄우는 로컬 개발/자가호스팅 옵션입니다. 비용과 기존 OCI 서버 부하를 줄이는 기본 운영 방향은 managed storage, database-backed job, 경량 worker를 우선합니다.

주요 endpoint:

- `GET /health`
- `GET /v1/bootstrap`
- `POST /v1/devices/register`
- `PUT /v1/devices/token`
- `GET /v1/generations`
- `GET /v1/members`
- `GET /v1/live-status` - CHZZK 라이브 상태. 방송 중 항목은 가능한 경우 `startedAt`으로 시작 시각을 내려주고, 앱은 이를 기준으로 진행 시간을 표시합니다.
- `GET /v1/preferences`
- `PUT /v1/preferences`
- `GET /v1/preferences/resolved`
- `GET /v1/realtime/status`
- `GET /v1/events/stream`
- `GET /v1/notifications/delivery-attempts`
- `POST /v1/dev/mock-events`

사용자에게 보이는 알림 기록은 서버 API가 아니라 Android Room, iOS SwiftData/CoreData/SQLite 같은 기기 로컬 저장소를 기본으로 합니다. 서버는 dedupe, 재시도, 진단, rate limit에 필요한 짧은 delivery attempt만 보관합니다.

## Android 실행

Android Studio에서 `android/StelliveHubAndroid` 폴더를 엽니다.

CLI 빌드 예시:

```bash
cd android/StelliveHubAndroid
./gradlew assembleDebug
```

Unit test 실행:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

실제 FCM 테스트에 필요한 Firebase 설정 파일과 인증 정보는 저장소에 커밋하지 않고 로컬 환경에만 추가합니다.

## iOS 실행

Xcode에서 `ios/StelliveHubiOS/StelliveHubiOS.xcodeproj`를 엽니다.

CLI 빌드 예시:

```bash
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Swift test 실행 예시:

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

## API와 데이터 원칙

- 공식 API 또는 플랫폼 약관상 허용된 방식만 사용합니다.
- 모바일 앱은 보호된 플랫폼 API를 직접 호출하거나 장기 platform credential을 저장하지 않습니다.
- 로그인 쿠키 수집, 비공개 게시물 수집, 접근 제어 우회, 무단 크롤링은 구현하지 않습니다.
- 실제 API key, OAuth credential, Firebase service account, production device token은 커밋하지 않습니다.
- `.env.example`에는 필요한 환경 변수 이름만 기록합니다.
- 외부 플랫폼 raw payload는 최소한으로 보관하고, UI와 알림에는 정규화된 필드만 사용합니다.
- Naver Cafe 자동 수집은 MVP에서 보류하며, 재도입 시에도 명확히 허용된 공개 경로만 사용합니다.

## 알림 정책 요약

- 사용자의 알림 설정이 최종 기준입니다.
- Global off는 모든 알림을 차단합니다.
- delivery-critical 설정은 push 전달에 영향을 주기 전에 backend 또는 managed storage에 동기화되어야 합니다.
- 플랫폼, 이벤트 타입, 그룹, 개별 항목, 조합별 설정을 해석한 뒤 quiet hours, keyword rule, rate limit을 적용합니다.
- `realtime_best_effort`는 가능한 한 빠른 전달을 시도하는 모드이며 즉시 전달을 보장하지 않습니다.
- foreground refresh는 polling, manual refresh, SSE/WebSocket 중 운영 부담에 맞는 방식을 선택할 수 있으며 background push를 대체하지 않습니다.
- `chzzk_chat`은 기본 off이며, push 전달 전 명시적인 필터 설정이 필요합니다.

## 권리와 에셋 정책

- 저장소에 권리 없는 프로필 이미지, 공식 로고, 팬아트, 캡처 이미지, 복사된 CDN asset을 포함하지 않습니다.
- 기본 avatar는 앱 소유 placeholder를 사용합니다.
- 플랫폼 API가 반환한 이미지 URL은 허용되는 경우에만 runtime 표시 대상으로 사용하고 fallback을 제공합니다.
- 플랫폼 로고나 제3자 브랜드 자산을 앱 asset으로 포함하지 않습니다.

## 문서

- [Project Rules](docs/PROJECT_RULES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API-First Lightweight Plan](docs/API_FIRST_LIGHTWEIGHT_PLAN.md)
- [Notification Policy](docs/NOTIFICATION_POLICY.md)
- [Realtime Delivery](docs/REALTIME_DELIVERY.md)
- [API Setup](docs/API_SETUP.md)
- [Privacy And Terms](docs/PRIVACY_AND_TERMS.md)
- [AI Handoff](docs/AI_HANDOFF.md)

기여 또는 기능 변경 전에는 위 문서를 먼저 확인해 주세요.

## 라이선스

이 저장소의 원본 소스 코드와 문서는 별도 표기가 없는 한 Apache License 2.0으로 배포됩니다.

이 라이선스는 이 저장소의 원본 코드와 문서에만 적용되며, 스텔라이브, 멤버 이름, 초상, 퍼블리시티권, 상표, 플랫폼 로고, 제3자 콘텐츠, API 데이터 또는 각 권리자가 보유한 다른 권리를 부여하지 않습니다.

이 프로젝트는 비공식 팬 프로젝트이며 스텔라이브, CHZZK, YouTube, X, Naver 또는 앱에서 연동하는 다른 제3자 서비스와 공식 제휴, 보증, 후원 관계가 없습니다.
