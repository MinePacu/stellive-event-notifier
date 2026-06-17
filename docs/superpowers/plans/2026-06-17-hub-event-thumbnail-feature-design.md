# Hub Event Thumbnail Feature Design

**Source Issues:** GitHub `#38`, GitLab `#21`

**Goal:** Allow goods/event registration to include a safe thumbnail image URL that can appear in app goods/event surfaces and supported notification contexts without storing image binaries or breaking image-free fallback layouts.

**Token Policy:** Keep implementation prompts and reviews scoped to files named in this document. Use `rtk` for shell commands. Prefer targeted `rg`, focused tests, and small patches over broad repository reads. Do not inspect unrelated Android/iOS live-page, CHZZK, CI, or settings files unless a named test failure requires it.

## Problem

Operators need to register goods/events with a representative thumbnail so users can identify event content faster in the app and, where push providers support it, in notifications.

The project already has a metadata-only `HubEvent.image` policy. This feature should complete the registration and delivery workflow around that existing contract instead of adding a second thumbnail model.

## Non-Negotiable Constraints

- Do not commit or store image binaries, base64, screenshots, copied CDN assets, official logos, fan art, profile images, or private platform payloads.
- Store only metadata: URL, source label, source URL, policy state, and alt text.
- Display only HTTPS URLs with `policyState` of `official_runtime_url` or `third_party_allowed`.
- Treat `none`, `verify_required`, `blocked`, missing URL, non-HTTPS URL, and image load failure as normal text-first fallback states.
- User notification preferences, quiet hours, dedupe, rate limits, and global off remain authoritative.
- Push payloads must not expose secrets, raw admin input, raw provider payloads, or local file paths.
- Existing calendar/widget/read APIs must continue to work when `image` is absent.

## User Experience

Admin registration:

- Goods/event create and update paths accept optional thumbnail metadata.
- The admin flow should make URL provenance explicit through `policyState`, `sourceLabel`, and `sourceUrl`.
- Invalid image metadata is rejected before persistence.

Mobile app:

- Android and iOS goods/event list/detail surfaces may show the thumbnail when policy allows it.
- If the thumbnail is unavailable, blocked, unverified, or fails to load, the card remains text-first with no empty image placeholder copy.
- Automatic refresh should update thumbnail changes together with other goods/event fields.

Notifications:

- Push payloads may include a thumbnail URL only when the same display policy allows it and provider constraints are satisfied.
- App deep links and event IDs remain the primary behavior; image delivery is optional.
- If provider image support fails, the notification still arrives without image.

## Functional Requirements

- Backend admin create/update accepts optional `image` metadata for `HubEvent`.
- Backend validation rejects unsafe URL schemes, local paths, binary-like fields, and displayable images without source metadata.
- Backend read APIs return normalized `image` metadata for goods/event list and detail responses.
- Calendar/widget projections remain image-independent unless a later issue explicitly expands them.
- Notification job creation keeps dedupe based on event identity and event update semantics, not image fetch state.
- Push payload factory includes allowed thumbnail URL only in image-capable payload fields.
- Android decodes optional image metadata and gates display through `HubEventImagePolicy`.
- iOS decodes optional image metadata and gates display through the existing image policy helper or an equivalent pure helper.
- Tests cover allowed, blocked, unverified, invalid, missing, and load-failure paths.

## Data Contract

Reuse existing `HubEvent.image` shape:

```ts
type HubEventImagePolicyState =
  | "none"
  | "official_runtime_url"
  | "third_party_allowed"
  | "verify_required"
  | "blocked";

interface HubEventImage {
  policyState: HubEventImagePolicyState;
  url?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  altText?: string;
}
```

Registration uses the same metadata shape. No separate `thumbnailUrl` field should be added unless the codebase already exposes a compatibility alias that must be preserved.

## Refresh Behavior

- Foreground app refresh should fetch the latest goods/event API response and replace stale thumbnail metadata in the local view state.
- Background notification tap should reload event detail or list data before rendering the destination.
- Thumbnail-only updates should be treated as content changes for UI refresh, but they must not create duplicate notification jobs unless the event update policy explicitly allows an `event_updated` notification.

## Acceptance Criteria

- A goods/event can be registered with allowed HTTPS thumbnail metadata.
- A goods/event can be registered without a thumbnail and still renders normally.
- Unsafe image metadata is rejected by backend admin validation.
- Android and iOS display allowed thumbnails and collapse cleanly on blocked/missing/load-failure states.
- Supported push payloads include the allowed thumbnail URL without making image delivery required.
- Existing notification preference and dedupe rules are unchanged.
- Focused backend, Android, and iOS tests pass.

## Out Of Scope

- Image upload, proxying, resizing, caching, or moderation pipelines.
- Downloading and bundling remote images.
- Calendar widget image rendering.
- New storage tables for image binaries.
- Scraping platform pages to discover images.
- Changing member catalog, live status, CHZZK, YouTube, X, or CI behavior.
