# Goods and Events UI Rework Design

## Decision

The approved UI direction is `A: status-first list` for `굿즈/행사`.

The approved home direction is to move settings-oriented content out of Home and into Settings. Home becomes a current-status dashboard focused on:

- current live status
- recent notification history
- urgent or closing-soon `굿즈/행사`

This design builds on the existing `codex/hub-events` implementation. The new branch keeps the previously implemented hub event data model, backend policies, API routes, Android models, iOS models, and initial MVP screens, then refines the mobile information architecture and UI.

## Goals

- Make Home match the app purpose: a notification hub users open to check what is happening now.
- Keep `굿즈/행사` visible without turning Home into a generic event catalog.
- Preserve policy constraints from the existing hub event implementation.
- Keep iOS and Android native to their platform conventions while using the same product structure.
- Avoid official logos, posters, product images, screenshots, or reused assets.

## Non-Goals

- No new backend event categories.
- No representative or Gangzi entries in the MVP `굿즈/행사` feed.
- No fan-hosted events.
- No routine live streams, uploads, ordinary posts, or broadcast schedules inside `굿즈/행사`.
- No image-based event cards.
- No bottom navigation expansion for `굿즈/행사` in this pass. It remains reachable from Home and from relevant notification history entries.

## Information Architecture

### Home

Home should answer: "What should I check now?"

Primary sections:

1. `지금 라이브`
   - Shows the current live count and a compact list of live members.
   - Uses placeholder avatars or text initials only.
   - Shows platform and elapsed live time when available.

2. `최근 알림`
   - Shows the most recent notification events across supported platforms.
   - Includes `굿즈/행사` notification types when they occur.
   - Uses event-type labels and timestamps instead of policy explanations.

3. `마감 임박 굿즈/행사`
   - Shows only urgent or closing-soon hub events.
   - If there are no urgent events, show a compact empty state rather than a large informational panel.
   - Tapping opens the full `굿즈/행사` screen or the event detail when there is only one clear item.

Home should not show:

- member catalog policy explanations
- Former-member policy text
- global delivery policy text
- realtime delivery caveats
- CHZZK chat caveats
- official YouTube live exclusion caveats
- platform/member/category preference summaries

Those belong in Settings.

### Goods and Events

The `굿즈/행사` screen uses a status-first list.

Top content:

- title: `굿즈/행사`
- subtitle: official-source, time-bound goods and event information
- compact counts for `진행 중`, `예정`, `마감 임박`
- horizontal filters: `전체`, `굿즈`, `티켓`, `오프라인`, `마감 임박`

List behavior:

- sort by status urgency first, then relevant date, then stable id
- `마감 임박` and `진행 중` appear before future informational items
- each row shows:
  - title
  - status badge
  - category
  - participation mode
  - source label
  - relevant date or venue when available
  - short summary when useful

The list should not use official imagery. Text, badges, placeholder icons, and system colors are sufficient.

### Goods and Events Detail

Detail should answer: "Is this official, when does it happen, and where do I go?"

Sections:

1. title and status
2. summary
3. key facts:
   - category
   - participation mode
   - source label
   - start/end or deadline
   - venue when available
4. official links:
   - source link
   - purchase link
   - ticket link

Only HTTPS links are opened. If a link is absent or invalid, the row is omitted.

### Settings

Settings should answer: "How do I want to receive notifications?"

Move or emphasize these settings-oriented concepts here:

- global notification toggle
- platform notification settings
- event type settings
- generation/category/member settings
- Gangzi and official-channel settings
- `realtime_best_effort`
- `chzzk_chat` default-off and explicit-filter requirement
- official YouTube upload-only behavior
- Former-member exclusion policy
- `굿즈/행사` inclusion/exclusion policy

This does not require every setting to become fully interactive in the same pass. The MVP implementation can reorganize visible sections first and keep existing preference behavior intact.

## iOS UI

iOS should use the existing SwiftUI `NavigationStack` and grouped/list patterns.

Home:

- Use a plain or grouped list with small section headers.
- Replace the current large policy-heavy header with a compact current-status header or remove the header entirely if the sections are clear enough.
- Place `지금 라이브` first.
- Place `최근 알림` second.
- Place `마감 임박 굿즈/행사` third.
- Keep text sizes modest and avoid marketing-style hero composition.

Goods and Events:

- Keep native list navigation.
- Use compact chips for filters.
- Keep status badges as text chips.
- Use `마감 임박` in red, `진행 중` in teal, `예정` in blue or neutral.
- Avoid nested cards inside cards.

Detail:

- Use `List` with `Section`.
- Use `LabeledContent` for facts.
- Use native `Link` rows for official URLs.

Settings:

- Keep grouped settings style.
- Add or reorganize sections so policy and preference content no longer needs to live on Home.

## Android UI

Android should keep the current native view construction style and bottom navigation.

Home:

- Top copy should describe current status, not policy.
- Place current live status first.
- Show recent notification cards next.
- Show closing-soon `굿즈/행사` compactly.
- Use bottom navigation as-is: Home, Live, History, Settings.

Goods and Events:

- Keep `GOODS_EVENTS` as a non-bottom-tab screen that maps back to Home for bottom-nav selection.
- Use summary counts and filter chips.
- Use status-first cards.
- Cards should be compact and readable, not poster-like.

Detail:

- Add a dedicated detail surface if the current Android MVP only has static list cards.
- Detail should show facts and official links, matching the iOS information hierarchy.

Settings:

- Move policy and preference explanations here.
- Keep global settings authoritative.
- Do not weaken existing preference rules.

## Data and Policy Constraints

The UI must continue to respect the existing hub event policy:

- include only official, member, or official-collab sources
- exclude fan-hosted events
- exclude representative/Gangzi events from MVP `굿즈/행사`
- exclude Former members
- exclude routine broadcasts, livestreams, uploads, and ordinary social posts
- do not store or display copied official images, logos, posters, screenshots, fan art, or unauthorized member assets
- use server-mediated event ingestion and user preferences for notification behavior

## Empty and Error States

Home:

- If no one is live, show a compact `현재 라이브 없음` state.
- If no recent notifications exist, show a compact `최근 알림 없음` state.
- If no closing-soon hub events exist, show `마감 임박 항목 없음` and a link to full `굿즈/행사`.

Goods and Events:

- If filters produce no result, show a short empty state and keep filters visible.
- If data cannot load later when API integration is added, show a retry row and preserve cached content when available.

Settings:

- Policy text should be concise and placed near the setting it explains.

## Accessibility

- Status badges must be readable as text, not color alone.
- Rows should combine title, status, category, source, and date in accessibility labels.
- Tap targets should remain large enough on both platforms.
- Long Korean titles should wrap to two lines before shrinking.
- Dynamic type should not cause badge/title overlap.

## Testing

Android:

- Update UI policy tests for Home title/role copy.
- Add tests for status ordering if ordering is moved into shared Android UI policy.
- Add navigation history coverage if detail navigation is introduced.

iOS:

- Keep model and preference tests passing.
- Add tests for ordered home preview content if logic moves into `MockHubStore`.
- Verify `HubEventDetailView` still filters non-HTTPS links.

Manual verification:

- Home shows current-status sections first.
- Settings contains policy/preference content that used to be on Home.
- `굿즈/행사` screen uses status-first ordering and filters.
- No official image/logo/poster assets are introduced.
