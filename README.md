# 스텔라이브 알림 허브

> 스텔라이브 멤버들의 **라이브·업로드·굿즈·행사·기념일·음악·공지** 알림을 한 곳에서 받아보세요.  
> 안드로이드 · iOS · 웹 모두 지원 · 비공식 · 오픈소스 · 무료

> [!WARNING]
> 이 앱은 **스텔라이브·CHZZK·YouTube·Naver와 공식 관계가 없습니다**.  
> 플랫폼 공식 API·약관을 준수하며, 비공식 크롤링·우회·로그인 쿠키 수집은 하지 않습니다.  
> Apache License 2.0은 **소스코드·문서에만** 적용됩니다. 상표·초상·음원·영상·캡처물 등 권리물에는 적용되지 않습니다.

---

## 📱 지금 바로 시작하기

### 1️⃣ 앱 설치
| 플랫폼 | 다운로드 |
|--------|----------|
| Android | [Google Play](https://play.google.com/store/apps/details?id=com.stellive.hub) · [GitHub Release (APK)](https://github.com/StelLiveNoti/StelLiveNoti/releases) |
| iOS | [TestFlight](https://testflight.apple.com/join/STELLIVEHUB) · [App Store (준비 중)](https://apps.apple.com/app/idSTELLIVEHUB) |

> **최소 버전**: Android 8.0 (API 26) / iOS 16.0  
> 태블릿·폴더블 레이아웃 대응

### 2️⃣ 알림 허용
앱 첫 실행 시 **알림 권한 허용** → FCM 토큰 자동 등록 완료

### 3️⃣ 원하는 알림만 켜기
<details open>
<summary>🔔 알림 종류 한눈에 보기 (펼치기/접기)</summary>

| 카테고리 | 설명 | 기본값 |
|----------|------|:------:|
| 🎬 **라이브·업로드** | CHZZK 라이브 시작·종료, YouTube 업로드·쇼츠·쇼츠 업로드 | ✅ 켬 |
| 🎁 **굿즈·행사** | 공식 굿즈 발매·오프라인 행사·팝업스토어 일정 | ✅ 켬 |
| 🎂 **기념일** | 멤버 생일, 세대 결성일, 데뷔일 | ✅ 켬 |
| 🎵 **음악** | 공식 커버·오리지널 음원 업로드 | ✅ 켬 |
| 📢 **공지** | 스텔라이브 공식 공지·공식 X(트위터) 게시물 | ✅ 켬 |


> **전체 알림 끄기**: 앱 설정 → `전체 알림` 토글 하나로 전체 차단 가능  
> **조용한 시간**: 설정 → `조용한 시간대` 지정 시 해당 시간대 알림 무음 처리  
> **배터리 최적화**: Android 설정 → 배터리 최적화 예외 앱에 추가 권장

</details>

---

## ❓ 자주 묻는 질문 (FAQ)

<details>
<summary>알림이 안 와요</summary>

1. 앱 설정 → `전체 알림` 켜져 있는지 확인  
2. Android: 설정 → 앱 → 스텔라이브 알림 허브 → 알림 허용 / 배터리 최적화 예외  
   iOS: 설정 → 알림 → 스텔라이브 알림 허브 → 허용  
3. FCM 토큰 재등록: 앱 설정 → `기기 재등록` 탭 → `토큰 갱신`  
4. 플랫폼(CHZZK/YouTube) API 지연·제한 시 **베스트에포트**로 발송 → 즉각 도착 보장 안 됨  
</details>

<details>
<summary>배터리/데이터 소모가 걱정돼요</summary>
- FCM 푸시만 수신 (폴링 없음)
- 라이브 상태 조회는 **서버 측 캐시** 기반 → 단말 배터리 영향 최소화
- 조용한 시간대·전체 끄기·개별 토글로 세밀 제어 가능
</details>

<details>
<summary>공식 앱이 아니라고요?</summary>
팬이 만든 **비공식** 앱입니다. 공식 데이터는 CHZZK Open API·YouTube Data API 등 공개 API만 사용합니다. 서비스 중단·API 변경 시 알림이 지연·중단될 수 있습니다.
</details>

<details>
<summary>개인정보·데이터 수집 내역</summary>

| 수집 항목 | 용도 | 보관 기간 |
|-----------|------|-----------|
| FCM 기기 토큰 | 푸시 발송용 식별자 | 로그아웃·앱 삭제 시 즉시 폐기 |
| 알림 설정(전체/카테고리/멤버/키워드) | 선호도 기반 발송 필터링 | 사용자 삭제 요청 시 즉시 폐기 |
| 앱 버전·OS 버전·플랫폼 | 호환성·크래시 분석 | 익명 집계 후 90일 보관 |

- **제3자 제공 없음** · 광고 식별자(ADID/IDFA) 수집 안 함  
- 상세: [개인정보처리방침](docs/PRIVACY.md) · [이용약관](docs/TERMS.md)
</details>

<details>
<summary>태블릿·폴더블에서도 쓸 수 있나요?</summary>
예. Android 태블릿·폴더블, iPad 모두 대응 레이아웃 제공합니다.
</details>

<details>
<summary>버그 리포트·기능 요청·피드백</summary>
- [GitHub Issues](https://github.com/StelLiveNoti/StelLiveNoti/issues) (버그·기능 요청)  
- 이메일: stellivehub@proton.me  
- 디스코드: [StelLive Hub Community](https://discord.gg/stellivehub)
</details>

---

## 📸 화면 미리보기

| 메인 홈 | 알림 설정 | 캘린더·기념일 |
|---------|-----------|---------------|
| ![Home](mockups/home.png) | ![Settings](mockups/settings.png) | ![Calendar](mockups/calendar.png) |

> 실제 스크린샷은 `mockups/` 폴더 참조. 기기별 레이아웃은 테스트 플라이트·플레이 스토어 스크린샷 확인.

---

## ⚖️ 알아두면 좋은 한계·면책

- **비공식·베스트에포트**: 플랫폼 API·푸시·OS·배터리·네트워크 정책 따라 **즉시 도달 보장 안 함**  
- **권리 귀속**: 멤버 초상·음원·영상·로고·팬아트 등 권리는 각 권리자(스텔라이브·플랫폼·창작자)에게 있음  
- **공식 YouTube**: 업로드 알림만 지원 (라이브·쇼츠·커뮤니티 탭 미지원)  
- **데이터 소스**: CHZZK Open API / YouTube Data API v3 / 네이버 캘린더 공개 일정 — 공식 제공 범위 외 수집 안 함

---

## 🛠 개발자·기여자용 (펼치기)

<details>
<summary>개발 환경·빌드·테스트·문서 링크</summary>

### 빠른 시작
```bash
# Backend (Fastify + Prisma + PostgreSQL + Redis)
cd backend/stellive-hub-api
cp .env.example .env
docker compose up -d
npm run prisma:generate && npm run prisma:migrate
npm run dev        # http://localhost:4000/docs (Swagger)

# Android
cd android/StelliveHubAndroid
./gradlew assembleDebug

# iOS (macOS + Xcode 15+)
cd ios/StelliveHubiOS
xcodebuild -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

### 저장소 구조
```
android/StelliveHubAndroid/   # Android 앱 (Kotlin, Compose, Hilt, FCM)
ios/StelliveHubiOS/           # iOS 앱 (SwiftUI, SwiftData, FCM)
backend/stellive-hub-api/     # Fastify API + Worker (TypeScript, Prisma)
shared/schemas/               # 공통 타입·Zod 스키마
shared/member-catalog/        # 멤버 카탈로그 seed (active/upcoming만)
shared/openapi/               # OpenAPI 3.1 문서
docs/                         # 정책·아키텍처·API 설계 문서
mockups/                      # Figma/이미지 목업
scripts/                      # 빌드·배포·마이그레이션 스크립트
```

### 핵심 문서
- [프로젝트 규칙](docs/PROJECT_RULES.md) · [알림 정책](docs/NOTIFICATION_POLICY.md) · [실시간 전달 정책](docs/REALTIME_DELIVERY.md)
- [아키텍처](docs/ARCHITECTURE.md) · [API 설정](docs/API_SETUP.md) · [백엔드 확장 가이드](docs/BACKEND_SCALING.md)
- [CHZZK 라이브 상태 설계](docs/CHZZK_LIVE_STATUS_REFRESH_DESIGN.md) · [FCM 경계 설계](docs/FIREBASE_FCM_BOUNDARY_DESIGN.md)

### 📖 Wiki 문서
- [전체 Wiki 문서](https://github.com/MinePacu/stellive-event-notifier/wiki) — 사용자 가이드, 개발자 문서, 정책 참조, 프로젝트 관리

### 테스트
```bash
# Backend
cd backend/stellive-hub-api && npm run build && npm test

# Android
cd android/StelliveHubAndroid && ./gradlew testDebugUnitTest

# iOS
cd ios/StelliveHubiOS && xcodebuild test -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

### 기여 가이드
- [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md)
- 커밋 메시지: [Conventional Commits](https://www.conventionalcommits.org/)
- PR 전 `npm run lint && npm run typecheck` 통과 필수

</details>

---

## 📄 라이선스

[Apache License 2.0](LICENSE) — 소스코드·문서에 한함.  
스텔라이브·플랫폼·제3자 권리물(상표·초상·음원·영상·이미지·API 응답)에는 적용되지 않습니다.