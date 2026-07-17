# Project Rules

## Status

Stellive Notification Hub is an unofficial open-source fan project. It is not affiliated with, endorsed by, or sponsored by Stellive, CHZZK, YouTube, Naver, Samsung, or Apple. No direct monetization is planned, but legal and platform restrictions still apply.

## Catalog Policy

Only `active` and `upcoming` catalog entries are allowed in the MVP. Former members are excluded from seed data, filters, notification targets, tests, and UI.

Gangzi is represented as:
- `generationId: "gamja"`
- `generationName: "감자"`
- `catalogRole: "representative"`
- `roleLabel: "스텔라이브 대표"`

Stellive official channels are represented as:
- `generationId: "official"`
- `generationName: "기타"`
- `catalogRole: "official_channel"`
- `roleLabel: "스텔라이브 공식 채널"`

The official channel item supports only `official_youtube_upload`. Official YouTube live scheduled/started/ended events must not be generated, delivered, or written to history.

## API And Data Policy

Use official APIs first. Unauthorized crawling, private cafe collection, login-cookie scraping, search-engine image copying, and bypass access are prohibited. Unknown account IDs or handles must remain `verify_required` until verified from official sources.

Secrets and tokens are documented only by name in `.env.example`. Never commit real credentials.

## Asset Policy

Do not commit profile images, official logos, fan art, captured images, or copied CDN assets. The default avatar is an app-owned placeholder. Runtime platform image URLs may be shown only when returned by official APIs and must fall back to placeholders.

## Notification Policy

Users can configure:
- Global notifications.
- Generation/category notifications: `gen1`, `gen2`, `gen3`, `gamja`, `official`, `gen4-upcoming`.
- Individual item notifications: members, Gangzi, and Stellive official channel.
- Platform notifications.
- Event-type notifications.
- Generation/category plus platform/event-type combinations.
- Member/item plus platform/event-type combinations.
- Tap action: `open_app` or `open_platform`.
- Delivery mode: `standard` or `realtime_best_effort`.

Preference resolution order:
1. Global master off blocks everything.
2. Individual explicit overrides can override generation/category settings.
3. Generation/category settings override defaults.
4. Platform settings apply.
5. Event type settings apply.
6. Specific generation/member platform combinations apply.
7. Specific generation/member event-type combinations apply.
8. Quiet hours apply.
9. Keyword block/allow rules apply.
10. Rate limits apply.

`realtime_best_effort` changes delivery strategy only after an event is allowed. It does not turn a disabled notification back on.

## Realtime Policy

Realtime mode is best-effort near-real-time. It may use YouTube WebSub, CHZZK live diff/session mechanisms, FCM high priority, APNs priority 10, and foreground SSE/WebSocket streams. It must not violate platform rate limits, OS battery policies, push-service policies, quiet hours, block lists, or user opt-outs.

## New Feature Checklist

- Confirm the feature does not reintroduce Former members.
- Confirm Gangzi remains only in `gamja`.
- Confirm official channels remain only in `official`/`기타`.
- Confirm official YouTube live events are excluded.
- Confirm all notification paths call preference resolution.
- Confirm `realtime_best_effort` does not bypass user settings.
- Confirm no secrets, logos, profile images, fan art, or screenshots are added.
- Confirm docs and tests are updated when behavior changes.
