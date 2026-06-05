# Hub Events Design

## Summary

Add a hub event feed for official-source, time-bound goods and event information. This feature is not a live/broadcast feed. Regular CHZZK live activity, YouTube uploads, and ordinary X posts stay in the existing live status, platform event, and notification history surfaces.

The MVP focuses on information users can miss because it has a sale window, reservation window, ticketing window, venue period, or cancellation/update risk.

## Goals

- Show official-source limited goods, ticketing, and offline event information in one app surface.
- Keep broadcast/live status separate from goods and event discovery.
- Allow users to filter by goods, ticketing, offline events, status, member, and category.
- Support event-specific notifications without bypassing existing preference resolution.
- Preserve the project's catalog, API, asset, and terms-of-service rules.

## Non-Goals

- Do not include ordinary livestream start/end events in the hub event feed.
- Do not include ordinary YouTube uploads or X posts in the hub event feed.
- Do not include fan-hosted events in the MVP.
- Do not collect from private communities, login-cookie flows, unauthorized crawling, or bypass paths.
- Do not store official logos, goods images, posters, screenshots, fan art, member profile images, or copied CDN assets.
- Do not include Gangzi or representative-only events in the MVP hub event feed.

## Eligibility Rules

An item can become a hub event only when all of these are true:

- It has a public source from an official account, a member account, or an official collaboration partner.
- It is time-bound: announced, opening, closing, ongoing, ending, updated, or cancelled around a defined period.
- It is related to active members, upcoming catalog entries, or Stellive official project/channel activity.
- It is not a regular broadcast, regular upload, ordinary social post, or routine live-status change.
- It does not reference a Former member.
- It does not use Gangzi as `memberId`, and it does not use `generationId: "gamja"` for the MVP hub event feed.
- It includes a source URL and human-readable source label.

Allowed source types:

- `official`: Stellive official public source or official project source.
- `member`: active/upcoming member public source.
- `official_collab`: public source from a verified official collaboration partner.

Disallowed source types:

- Fan-hosted event sources.
- Unverified reposts or summaries.
- Private cafe/community content.
- Scraped commerce pages without an allowed API or explicit public integration path.

## Event Categories

MVP categories:

- `online_goods`: limited goods, reservation goods, period sales, restocks, or digital goods with a sale window.
- `online_collab`: official online collaboration goods or campaigns with a fixed period.
- `offline_concert`: concerts, fan meetings, or ticketed stage events.
- `offline_collab`: official offline collaboration cafes, shops, exhibitions, or venue events.
- `offline_popup`: popup stores, booths, exhibitions, or on-site sales.
- `ticketing`: ticket sale windows, pre-sale windows, general sale windows, and ticketing changes.

The UI can group these into simpler filters:

- All
- Goods
- Ticketing
- Offline
- Closing Soon

## Data Model

Add a new domain model instead of overloading `PlatformEvent`. `PlatformEvent` remains for normalized platform activity such as CHZZK, YouTube, and X events. Hub events represent curated, official-source goods and event information.

```ts
export type HubEventCategory =
  | "online_goods"
  | "online_collab"
  | "offline_concert"
  | "offline_collab"
  | "offline_popup"
  | "ticketing";

export type HubEventParticipationMode = "online" | "offline" | "hybrid";

export type HubEventStatus =
  | "announced"
  | "upcoming"
  | "open"
  | "closing_soon"
  | "ended"
  | "cancelled";

export type HubEventSourceType = "official" | "member" | "official_collab";

export interface HubEvent {
  id: string;
  category: HubEventCategory;
  participationMode: HubEventParticipationMode;
  status: HubEventStatus;
  title: string;
  summary?: string;
  memberId?: string;
  generationId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceType: HubEventSourceType;
  announcedAt?: string;
  startsAt?: string;
  endsAt?: string;
  purchaseUrl?: string;
  ticketUrl?: string;
  venueName?: string;
  venueAddress?: string;
  notificationEligible: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Validation rules:

- `sourceUrl`, `sourceLabel`, `sourceType`, `category`, `participationMode`, `status`, `title`, and `generationId` are required.
- `sourceType` must be one of `official`, `member`, or `official_collab`.
- `memberId: "gangzi"` is rejected.
- `generationId: "gamja"` is rejected for MVP hub events.
- `memberId` must refer only to active/upcoming catalog entries when present.
- Official project events may omit `memberId` but must use `generationId: "official"`.
- No image binary, logo URL, profile image URL, poster URL, or copied CDN asset field is part of the MVP model.

## Backend Architecture

Add a small hub events service behind the existing API-first backend.

Responsibilities:

- Store normalized hub events.
- Enforce hub event eligibility rules before storage.
- Provide sorted, paginated read APIs for mobile apps.
- Compute lightweight summaries for home screen previews.
- Generate event notification jobs only after preference resolution allows them.

The MVP starts with manual or maintainer-controlled event registration. This avoids unauthorized crawling and keeps the feature useful while official integration options remain uncertain. The data shape should still allow future official API adapters to submit candidate events through the same validation boundary.

Storage fields should mirror the shared `HubEvent` model and add indexes for:

- `status`
- `category`
- `participationMode`
- `generationId`
- `memberId`
- `startsAt`
- `endsAt`
- `updatedAt`

## API Design

Public mobile APIs:

```txt
GET /v1/hub-events
GET /v1/hub-events/:id
GET /v1/hub-events/summary
```

Supported list filters:

```txt
category=online_goods|online_collab|offline_concert|offline_collab|offline_popup|ticketing
participationMode=online|offline|hybrid
status=announced|upcoming|open|closing_soon|ended|cancelled
generationId=gen1|gen2|gen3|official|gen4-upcoming
memberId=<catalog member id>
from=<ISO datetime>
to=<ISO datetime>
cursor=<opaque cursor>
limit=<number>
```

Internal admin or maintainer APIs:

```txt
POST /v1/admin/hub-events
PUT /v1/admin/hub-events/:id
```

Admin APIs are for local development and controlled operation only. They must not accept untrusted public writes.

Bootstrap behavior:

- `/v1/bootstrap` can include a compact `hubEventsSummary` and up to three home preview events.
- The full list remains on `/v1/hub-events` to keep bootstrap payloads small.

## Mobile UX

Home preview:

- Show a compact section for hub events.
- Prioritize currently open goods/sales, closing-soon events, and upcoming offline events.
- Keep the section below existing high-priority status content so live status remains easy to scan.

Hub events screen:

- Header metrics: open, upcoming, closing soon.
- Primary filters: All, Goods, Ticketing, Offline, Closing Soon.
- Secondary filters: status and generation/category.
- List events grouped by date or status.
- Use text, placeholder avatars, category labels, and status badges.
- Do not use official logos, product images, posters, or copied media.

Detail screen:

- Title and status.
- Category and participation mode.
- Related member or official project label.
- Date window: announced, starts, ends.
- Source label and source link.
- Purchase, ticket, or venue link when available.
- Notification state for event notifications.

The app should display official project events under `official`/`기타`. Gangzi remains available elsewhere in the app catalog and notification settings but is excluded from the hub event feed.

## Notification Design

Add event-specific notification types:

- `event_announced`
- `event_sales_open`
- `event_deadline_soon`
- `event_updated`
- `event_cancelled`

MVP push events:

- `event_announced`
- `event_sales_open`
- `event_deadline_soon`

Notification rules:

- Global off blocks every hub event notification.
- Generation/category and individual member settings apply when a hub event is tied to a member.
- Official project events use the `official` category.
- Event-type settings apply to hub event notification types.
- Quiet hours, keyword blocks, and rate limits apply last.
- Realtime best-effort does not bypass disabled settings.
- Hub events are standard delivery by default. Realtime best-effort can be considered later only for highly time-sensitive ticketing or sale-open alerts after the user enables it.

## Status Computation

Stored status can be authored, but the backend should be able to compute display status from dates:

- `open`: now is between `startsAt` and `endsAt`.
- `upcoming`: now is before `startsAt`.
- `closing_soon`: now is within a configured closing window before `endsAt`.
- `ended`: now is after `endsAt`.
- `cancelled`: explicit manual state and never overwritten by date computation.
- `announced`: source has been published but no actionable start/end window is available yet.

The API response should expose one effective status so mobile clients do not duplicate business logic.

## Error Handling

Registration rejects events with:

- Missing source URL or source label.
- Disallowed source type.
- Gangzi or `gamja` scope.
- Former member or unknown member references.
- Missing required date information for categories that require a start or end window.
- Unsupported category/status values.

Read APIs should:

- Return an empty list when filters match no events.
- Hide rejected or draft events from mobile clients.
- Continue serving existing cached events when future adapter ingestion fails.

## Testing

Backend tests:

- Reject Gangzi and `gamja` hub events.
- Reject Former member references.
- Reject missing source URLs and invalid source types.
- Allow official project events with `generationId: "official"` and no `memberId`.
- Filter by category, status, participation mode, generation, and member.
- Compute `closing_soon`, `open`, `upcoming`, and `ended` statuses from dates.
- Ensure hub event notification jobs call preference resolution.

Shared schema tests:

- Validate allowed categories, statuses, participation modes, and source types.
- Ensure `HubEvent` does not include image, logo, poster, or copied media fields.

Mobile tests:

- Home preview orders open, closing-soon, and upcoming events correctly.
- Hub event filters do not show Gangzi or `gamja`.
- Official project events display under `기타`.
- Detail screens show source links and do not require images.
- Disabled global notifications block event notification actions.

## Rollout Plan

1. Add shared `HubEvent` schema types and backend validation.
2. Add backend storage and read APIs with mock/manual seed data.
3. Add mobile models and repository methods.
4. Add home preview and hub event list/detail screens.
5. Add event notification type settings and preference-resolution tests.
6. Add controlled admin registration API or local seed workflow.

## MVP Decisions

- The first UI label is `굿즈/행사` because the feature excludes routine live and upload activity.
- `event_deadline_soon` defaults to 24 hours before `endsAt` for the first release.
- The first MVP build uses a repository-managed seed file or local maintainer workflow before exposing an authenticated admin API.
