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
