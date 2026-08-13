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

The backend applies these defaults even when a device has no stored preferences or only partial preferences. A broad `global`, `platform`, or unrelated event-type opt-in does not implicitly enable a default-off generation or event type. Unknown generation IDs remain enabled by default for backward compatibility.

## Hub Event Notifications

Hub event notification types are `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_milestone_due`, `event_updated`, and `event_cancelled`. The MVP enables announced, sales-open, deadline-soon, milestone-due, and cancelled by default, while updated starts disabled.

Hub event notifications are standard delivery by default. Global off, generation/category, member, event type, quiet hours, keyword filters, and rate limits still apply. Rate limiting uses a per-device rolling 60-second `attemptedAt` window, including both lower and upper time boundaries, and counts only `sent` delivery attempts. Realtime best-effort does not enable disabled hub event notifications.

Hub event worker delivery treats `event_sales_open`, `event_deadline_soon`, `event_milestone_due`, and `event_cancelled` as immediate-push candidates only after preference resolution allows the event. Schedule candidates are queued for their current schedule timestamp and revalidated before delivery, so past-on-registration, moved, or cancelled items are not sent. `event_announced` and `event_updated` remain summary/default delivery unless later policy changes explicitly promote them. Disabled preferences, global off, quiet hours, keyword blocks, and rate limits still downgrade to app-history-only or skipped delivery before any FCM/APNs send.

Hub event admin changes commit their audit record and every notification candidate atomically. A failure while creating any candidate leaves neither a partial Hub mutation nor a partial candidate batch. Recovery may automatically enqueue only immediate events received within 15 minutes and future Hub schedule candidates; older immediate events remain diagnostic-only so migration or repair work cannot unexpectedly send stale notifications.

## Resolution

Global off blocks all notifications. Member explicit overrides can override generation/category settings. Platform and event-type settings apply to the event. More specific member/generation platform and event-type rules can override broader platform/event-type rules.

After explicit preference rules resolve, the backend independently enforces generation and event-type defaults. `gen4-upcoming` requires an enabled matching generation/member rule or a matching generation/member platform/event-type rule. `event_updated` requires an enabled matching event-type, generation-event-type, or explicit member-event-type rule. When an event is both `gen4-upcoming` and `event_updated`, both opt-ins are required; one exact enabled `generation_event_type` or explicit `member_event_type` rule satisfies both axes. A missing opt-in resolves as `preference_default_off`, while an explicit disabled rule remains `preference_off`.

Quiet hours, keyword block, and rate limit apply after preference and default resolution.

Quiet hours are evaluated against the wall-clock time when the worker makes the dispatch decision for each recipient, never against the event's `occurredAt` or `receivedAt`. The start is inclusive and the end is exclusive; overnight windows cross midnight, equal start and end values mean always quiet, and invalid times, timezones, or evaluation dates do not activate quiet hours. A retry performs preference resolution again using its new dispatch-decision time. If that retry falls within quiet hours, the recipient is skipped and the job completes normally; quiet-hour blocks are terminal for that delivery decision and are not automatically rescheduled until the window ends.

Service-wide announcements are enabled by default and use only the allowlisted `service_all`, `service_incident`, `service_maintenance`, and `service_version_update` topics. `global=false` or `serviceAnnouncementsEnabled=false` unsubscribes the device from all four topics. Before persisting an opt-out preference snapshot or an incoming token for an already opted-out device, the backend must confirm that topic synchronization returned `synced` or `token_missing`. A `disabled`, `transient_failure`, unknown, or thrown result fails closed with `server_unavailable`, without changing the saved preference snapshot, revision, or token. Durable preference updates preflight an available revision snapshot before unsubscribing; if a concurrent write or stale client timestamp still makes the later replacement fail, the backend best-effort resynchronizes topics from the latest readable stored preferences before returning the original conflict. This compensation limits but cannot eliminate the race between topic synchronization and database replacement. Opt-in preference and token updates are persisted first; their subscription synchronization remains best-effort, and a non-`synced` result is logged without failing the update. When the topic synchronization dependency is not configured, the existing update behavior remains unchanged. Mobile clients must not subscribe to arbitrary topics directly.

## Push Token Ownership

A non-null push token has exactly one current device owner. A successful token update atomically removes the token from any prior device row before assigning it to the requesting installation; the last successfully committed claim wins. Push tokens are transport credentials, not user identity, so preferences, delivery history, and other device data are not copied from the prior row after a reinstall.

Workers revalidate the exact device/token ownership immediately before provider dispatch and skip reassigned targets. Provider invalidation is also conditional on the token used for that send, so a delayed failure cannot invalidate a newer token. These checks narrow but do not eliminate the final race between ownership validation and an external provider call; persistent token-level send reservations remain a separate hardening option.

The unique-token migration deterministically preserves the most recently updated active duplicate because the actual physical installation cannot be recovered from stored data alone. Deploy the transaction/CAS-compatible code first, then pause notification workers, summary workers, service-announcement topic publication, and `/v1/devices/token` writes before running `prisma migrate deploy`. Confirm duplicate tokens are at zero, then run plain `npm run start:service-topic-reconcile` from `backend/stellive-hub-api`. The command resynchronizes active owners in bounded batches, does not print tokens, and fails when FCM is disabled or provider failures remain unresolved. Resume token writes and publishers only after reconciliation succeeds.

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
