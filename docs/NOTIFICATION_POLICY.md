# Notification Policy

## Scopes

Supported preference scopes:
- `global`
- `generation`
- `member`
- `platform`
- `event_type`
- `generation_platform`
- `generation_event_type`
- `member_platform`
- `member_event_type`

Generations/categories include `gen1`, `gen2`, `gen3`, `gamja`, `official`, and `gen4-upcoming`.

## Defaults

- Global notifications: on
- 1기생/2기생/3기생/감자/기타: on
- upcoming: off
- Delivery mode: standard
- Realtime mode: off until user enables it
- CHZZK chat: off
- Official YouTube upload: on
- Official YouTube live events: unsupported and not generated

## Hub Event Notifications

Hub event notification types are `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_milestone_due`, `event_updated`, and `event_cancelled`. The MVP enables announced, sales-open, deadline-soon, milestone-due, and cancelled by default, while updated starts disabled.

Hub event notifications are standard delivery by default. Global off, generation/category, member, event type, quiet hours, keyword filters, and rate limits still apply. Realtime best-effort does not enable disabled hub event notifications.

Hub event worker delivery treats `event_sales_open`, `event_deadline_soon`, `event_milestone_due`, and `event_cancelled` as immediate-push candidates only after preference resolution allows the event. Schedule candidates are queued for their current schedule timestamp and revalidated before delivery, so past-on-registration, moved, or cancelled items are not sent. `event_announced` and `event_updated` remain summary/default delivery unless later policy changes explicitly promote them. Disabled preferences, global off, quiet hours, keyword blocks, and rate limits still downgrade to app-history-only or skipped delivery before any FCM/APNs send.

## Resolution

Global off blocks all notifications. Member explicit overrides can override generation/category settings. Platform and event-type settings apply to the event. More specific member/generation platform and event-type rules can override broader platform/event-type rules. Quiet hours, keyword block, and rate limit always apply last.

Service-wide announcements are enabled by default and use only the allowlisted `service_all`, `service_incident`, `service_maintenance`, and `service_version_update` topics. `global=false` or `serviceAnnouncementsEnabled=false` unsubscribes the device from all four topics. The backend synchronizes membership after token and preference updates; mobile clients must not subscribe to arbitrary topics directly.

## Load Reduction

Notification noise and push-volume reduction policies are defined in [Notification Load Reduction Policy](NOTIFICATION_LOAD_REDUCTION_POLICY.md). These policies may downgrade delivery to summary push or app-history-only delivery, but they must not bypass user preferences, quiet hours, keyword rules, rate limits, or unsupported official YouTube live exclusions.

## Examples

- `global=false` means every notification is off.
- `gen2=false` plus `neneko-mashiro=true explicitOverride` allows Neneko Mashiro notifications.
- `youtube=false` plus `tenko-shibuki/youtube=true explicitOverride` allows Tenko Shibuki YouTube notifications.
- `gamja=false` plus `gangzi=true explicitOverride` allows Gangzi notifications.
- `official=false` plus `stellive-official=true explicitOverride` allows official YouTube upload notifications.
- Official YouTube live events are never generated even if a setting exists.

## Tap Action

`open_app` opens an app deep link. `open_platform` opens the original platform URL. Both values are included in push payloads and user-visible local history.

## Push Notification Images

A single verified HTTPS image URL may be included only in provider visual notification fields when it comes from normalized `PlatformEvent.thumbnailUrl` and passes policy validation. Image URLs must not be included in data payload keys.

Raw provider payloads, private platform responses, image binaries, logos, profile images, posters, screenshots, fan art, copied media, production device tokens, OAuth tokens, API keys, Firebase service accounts, and unverified image URLs must never be included.

The calendar and widget surfaces are read-only schedule projections and do not send push notifications or bypass global, platform, event-type, generation, member, quiet-hours, keyword, or rate-limit preference resolution.
