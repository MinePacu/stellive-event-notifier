# Realtime Delivery

## Definition

“최대한 실시간으로 알림 받기” is a best-effort near-real-time mode. It does not guarantee instant delivery. Delays can come from platform APIs, WebSub, stream reconnects, FCM/APNs policies, OS battery rules, network state, quiet hours, and user notification settings.

## Lightweight Backend Strategy

- X: no-paid-API only. Use official X API paths only when free access is available and rate limits are viable. If official access requires paid billing, disable X integration behind feature flags and produce no X notifications.
- YouTube: use WebSub for uploads. Use Data API fallback sparingly. Stellive official YouTube live events are excluded.
- CHZZK: use official or documented allowed live-status/session mechanisms only. Unknown production methods remain `verify_required`.
- Naver Cafe: automatic collection is deferred. If reintroduced, it must use public Search API results or another clearly allowed official path only. It is not realtime-eligible and falls back to standard delivery.
- The MVP should avoid always-on self-hosted realtime infrastructure unless a platform API requires it and the cost is acceptable.

## Queue Strategy

Realtime-eligible allowed events enter the job pipeline in priority order:
1. `chzzk_live_started`
2. `x_post`, `official_x_post`
3. `youtube_upload`, `official_youtube_upload`
4. Other allowed events

The initial MVP can use a managed database `notification_jobs` table instead of Redis/BullMQ. Every job still enforces dedupe, quiet hours, keyword filtering, user opt-outs, rate limits, and official YouTube live exclusion. Redis/BullMQ can be introduced later behind the same job adapter if the database-backed queue becomes a bottleneck.

## Push Strategy

Android realtime-best-effort events use FCM high priority only when the event is realtime-eligible and the user enabled realtime mode. iOS realtime-best-effort events request APNs priority `10` through FCM/APNs payload structure. The default iOS interruption level is `active`; time-sensitive delivery requires a separate entitlement/policy review and explicit user consent. Critical alerts are not used.

## Foreground Stream

Foreground SSE/WebSocket updates are optional and only for visible UI refresh. The MVP may use polling or manual refresh instead to reduce operating load. If streams are enabled, the app closes the connection when backgrounded. Background delivery remains push-based. Streams must be authenticated by device/session and must not include unnecessary raw payloads or personal data.

## User Disclosure

Settings UI must tell users:
- “최대한 실시간 모드는 가능한 한 빠르게 알림을 받도록 시도하지만, 플랫폼/OS/네트워크 사정으로 지연될 수 있습니다.”
- “배터리와 데이터 사용량이 증가할 수 있습니다.”
- “사용자가 꺼둔 알림, 조용한 시간, 차단 키워드, rate limit은 계속 적용됩니다.”
