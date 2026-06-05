# Settings Navigation Design

## Goal

Restructure the mobile settings experience from one long settings page into a short settings hub with focused child pages. The goal is to keep Home focused on live status, recent notifications, and urgent goods/events while moving notification control, delivery policy, and event policy into Settings without overwhelming one screen.

## Current Problem

The current Settings screen exposes global notification controls, delivery mode, category settings, individual item switches, platform switches, event type switches, combination settings, goods/events policy, representative policy, and realtime disclosure in one long scroll. It is technically complete but hard to scan on both Android and iOS.

This will become harder to use as more platforms, event types, quiet hours, filters, and source policies are added.

## Recommended Structure

Settings becomes a hub page. It shows only summary state and navigation rows.

Top-level rows:

- `전달 방식`
  - Standard delivery.
  - `realtime_best_effort`.
  - Quiet hours.
  - Rate limit summary.
  - Tap action.
- `대상별 알림`
  - `1기생`, `2기생`, `3기생`, `감자`, `기타`, `upcoming`.
  - Individual active/upcoming member targets.
  - Gangzi remains a representative item in `감자`.
  - Stellive official channel remains under `기타`.
- `플랫폼별 알림`
  - CHZZK.
  - YouTube.
  - X.
  - `굿즈/행사`.
  - Naver Cafe.
- `이벤트 타입별 알림`
  - CHZZK live events.
  - CHZZK chat.
  - YouTube upload.
  - YouTube live events.
  - Official X post.
  - Official YouTube upload.
  - Goods/events event types.
- `굿즈/행사`
  - Goods/events master switch.
  - Online goods.
  - Offline events.
  - Deadline-soon priority.
  - Event update/cancel options when exposed.
  - Included and excluded source policy.
- `고급 조합 설정`
  - Category plus platform.
  - Category plus event type.
  - Individual item plus platform.
  - Individual item plus event type.

## Main Settings Hub

The hub should be short enough to scan without long scrolling. Rows should show status summaries on the trailing side:

- `전달 방식`: `표준` or `실시간 우선`.
- `대상별 알림`: enabled count such as `15/16`.
- `플랫폼별 알림`: enabled count such as `4/5`.
- `이벤트 타입별 알림`: enabled count such as `12/16`.
- `굿즈/행사`: `켜짐`, `꺼짐`, or `켜짐 · 마감 임박 ON`.
- `고급 조합 설정`: simple entry text such as `예외 규칙`.

The main page should not list every switch. It should guide users to the correct child page.

## Child Pages

Each child page owns one decision area:

- Use switches for direct on/off preferences.
- Use short explanatory copy only where policy matters.
- Keep destructive or policy-sensitive defaults visible:
  - Global off blocks all notifications.
  - `realtime_best_effort` never bypasses user settings, OS policies, platform policies, quiet hours, keyword filters, or rate limits.
  - CHZZK chat starts off and requires explicit filters before push delivery.
  - Naver Cafe stays off unless an allowed official route exists.
  - Stellive official YouTube supports upload notifications only.
  - YouTube live event type rows may exist for non-official channel policy, but official YouTube live scheduled/started/ended events must remain unsupported and must not be generated.

## Goods/Events Page

The goods/events settings page should explain the feature boundary clearly:

Included in MVP:

- Official-source time-bound goods events.
- Limited reservation goods.
- Ticketing and sales-open events.
- Deadline-soon events.
- Concerts.
- Offline popups.
- Official collaborations.

Excluded in MVP:

- Routine broadcasts.
- Livestream schedules, starts, and endings.
- Uploads.
- Ordinary posts.
- Fan-hosted events.
- Representative/Gangzi events.
- Unauthorized images, logos, posters, screenshots, copied CDN assets, or fan art.

The page should continue to state that official images, logos, and posters are not stored or reused by the app.

## Platform-Specific Presentation

### iOS

Use grouped settings navigation:

- Rounded grouped sections.
- Navigation rows with trailing summaries.
- Native-feeling push navigation into child pages.
- Keep copy compact; detailed policy text belongs inside the relevant child page.

### Android

Use a concise settings hub:

- Card-like groups with simple rows.
- Clear row titles and one-line descriptions.
- Navigation arrows for child pages.
- Keep controls visually direct but not one giant scroll of toggles.

Android may reference the general mood of spacious mobile settings UIs but must not clone Samsung One UI.

## Data Flow

This is a presentation restructure. It does not change preference semantics.

The same settings state remains authoritative:

- Global setting.
- Category/generation settings.
- Individual target settings.
- Platform settings.
- Event type settings.
- Combination settings.
- Realtime delivery setting.
- Rate limit, quiet hours, and filter-related policy.

Child pages read and mutate the same preference model currently used by the long settings screen. Preference resolution order remains unchanged.

## Navigation Behavior

Settings hub rows navigate to child pages. Back navigation returns to the Settings hub. Tab navigation remains available:

- Home.
- Live.
- History.
- Settings.

Child pages should not create deeper navigation unless required for advanced combination settings. The desired maximum depth for normal use is two levels: Settings hub to one child page.

## Testing

Unit and UI verification should cover:

- Settings hub shows summary rows instead of all switches.
- Global notification off remains authoritative.
- Platform switches still affect platform preference state.
- Event type switches still affect event type preference state.
- Goods/events switches still map to hub event preference state.
- CHZZK chat remains off by default.
- Official YouTube live events remain unsupported and do not generate official live notifications even if generic YouTube live event type rows exist.
- Gangzi remains a representative `감자` item, not a generation member.
- Former members remain absent from settings, filters, and seed data.
- Home remains focused on live status, recent notifications, and urgent goods/events.

Visual verification should include:

- iOS Settings hub.
- iOS platform/event/goods-events child pages.
- Android Settings hub.
- Android platform/event/goods-events child pages.

## Mockup

The approved browser mockup is available at:

`.superpowers/brainstorm/settings-navigation/content/settings-navigation-ui.html`

It shows iOS and Android directions side by side, with interactive navigation from the Settings hub into child pages.
