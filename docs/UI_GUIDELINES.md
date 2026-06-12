# UI Guidelines

## Principles

Use an original, quiet notification-management UI. Do not copy Samsung One UI, Apple Settings, CHZZK, YouTube, X, Naver, or Stellive proprietary design, icons, logos, colors, or assets.

Android may use spacious mobile settings patterns, rounded cards, large headings, and bottom navigation. iOS may use grouped lists, toggles, chevrons, and TabView patterns. Both must remain distinct from system or brand apps.

## Avatar

Use a simple placeholder avatar by default. Runtime API image URLs can be displayed only when allowed by platform terms and must fall back to placeholders. Do not transform images beyond display crop/resize/rounded corners.

## Catalog Display

Gangzi appears under `감자` and must show `스텔라이브 대표` to avoid generation-member confusion. Stellive official appears under `기타` and must show `스텔라이브 공식 채널` to avoid person/member confusion.

## Hub Events UI

Label the MVP surface as `굿즈/행사`, not a generic live or online event feed. Use text, placeholder avatars, category labels, and status badges. Do not display official logos, copied goods images, posters, screenshots, or fan art.

Gangzi remains available in the app catalog and notification settings as the `gamja` representative, but Gangzi and `gamja` are excluded from the MVP `굿즈/행사` feed.

## Notification UI

Settings must include global, delivery mode, realtime mode, generation/category, individual item, platform, event type, official channel, advanced combination, tap action, quiet hours, and chat filter structures.

Official YouTube live notification controls should be omitted or disabled as “지원하지 않음”.

Realtime text must use “가능한 한 빠르게”, “best-effort”, and “지연될 수 있음”. Do not claim guaranteed instant delivery.
## Hub Event Image Policy

`굿즈/행사` 화면은 이미지가 없는 상태를 정상 상태로 취급한다. 앱 내부에 “이미지가 없습니다” 같은 빈 이미지 안내 문구를 표시하지 않는다.

이미지는 `HubEvent.image.policyState`가 `official_runtime_url` 또는 `third_party_allowed`이고 URL이 HTTPS일 때만 렌더링을 시도한다. `none`, `verify_required`, `blocked`, URL 없음, HTTP URL, URL 파싱 실패, 이미지 로드 실패는 모두 텍스트 중심 카드/상세 레이아웃으로 fallback한다.

캘린더, 위젯, push 표시는 이미지에 의존하지 않는다. 공식 로고, 프로필 이미지, 팬아트, 캡처 이미지, 복제 CDN 자산, 앱 번들 복사 이미지는 사용하지 않는다.
