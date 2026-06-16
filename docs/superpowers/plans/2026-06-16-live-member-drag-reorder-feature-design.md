# Live Member Drag Reorder Feature Design

**Goal:** Android and iOS live pages replace visible up/down reorder buttons with long-press drag reordering for CHZZK member rows.

**Scope:** Mobile UI behavior only. No backend API, notification, push, catalog, or image policy changes.

## Background

The current live page exposes member ordering through visible `"위"` and `"아래"` controls on each member row.

This is functional but visually noisy and less natural on mobile. The target interaction is:

1. User long-presses a member row.
2. The row enters reorder mode.
3. User slides the row vertically to the intended position.
4. User releases the row.
5. App persists the new local live member order.

## User Experience

### Normal State

- Live page shows the same member rows, status labels, timestamps, links, and metrics as today.
- The visible `"위"` and `"아래"` ordering buttons are removed from the normal row layout.
- A subtle drag affordance may be shown, such as a compact handle icon or reorder hint, if it fits the existing platform style.
- Tapping a row or existing row actions must continue to work when the press does not cross the long-press threshold.

### Drag State

- Long-press starts reorder mode for that row only.
- The selected row should visually lift, dim, or otherwise show that it is being moved.
- Nearby rows should slide or make room as the dragged row crosses their midpoint.
- Haptic feedback should occur at drag start and drop.
- If the live page refreshes while dragging, the safest behavior is to defer visual re-render until drop or cancel the drag without writing a partial order.

### Drop State

- Dropping on a valid position persists the reordered member IDs.
- Dropping back to the original position is a no-op.
- Cancelling the gesture keeps the previous order.
- The final UI order must match the persisted order immediately after drop.

## Ordering Semantics

The feature keeps the existing local priority-list model.

- Android continues to persist `PreferenceKeys.LIVE_MEMBER_ORDER` as a comma-separated member ID list.
- iOS continues to update `liveMemberPriorityIDs` through the existing store/UserDefaults path.
- Reorder applies only to CHZZK live targets shown on the live page.
- Official channels are not introduced into CHZZK live member reorder.
- Former members must not be introduced into catalog, seed data, filters, tests, or UI.
- Gangzi remains a `gamja` representative entry and is not treated as a generation member.
- Members without CHZZK channel IDs remain outside live target reorder.

## Filter Behavior

The live page may be filtered by status.

- Moving one visible item must not randomly reorder hidden items.
- The implementation should compute the reordered visible list, then persist a stable priority list that preserves existing relative order for hidden valid member IDs.
- Stale or unknown IDs should be ignored when rebuilding persisted order.
- The all/live/offline filters must keep working after reorder.

## Accessibility

Removing visual buttons must not remove reorder capability for accessibility users.

- Android rows expose accessibility actions named `"위로 이동"` and `"아래로 이동"`.
- iOS rows expose equivalent VoiceOver custom actions.
- Row accessibility labels should include the member name and current position.
- A successful accessibility move should announce or otherwise expose the changed position using platform-native feedback.

## Visual And Asset Constraints

- Do not add platform logos, official member profile binaries, fan art, screenshots, copied CDN images, or new bundled media assets.
- Existing placeholder/avatar fallback behavior remains unchanged.
- `channelImageUrl` handling is not part of this feature and must not be expanded here.
- The UI may use simple system-provided symbols if already acceptable in the platform codebase.

## Acceptance Criteria

- Android live page no longer shows visible `"위"` and `"아래"` reorder buttons.
- iOS live page no longer shows visible `"위"` and `"아래"` reorder buttons.
- Android users can long-press and drag a member row to change order.
- iOS users can long-press and drag a member row to change order.
- Reordered member order persists across live page re-render.
- Reordered member order persists across app restart where current app storage already supports it.
- Live/offline/all filters continue to work.
- Official channel and Former member rules remain enforced.
- Accessibility users retain up/down reorder actions.
- Notification behavior, backend API contracts, push delivery, live polling, and realtime behavior are unchanged.

## Out Of Scope

- Server-side order sync across devices.
- Account/profile settings.
- Reordering official channels.
- Reordering non-CHZZK notification targets.
- New member assets, profile image downloads, or image caching changes.
- Changes to CHZZK polling, notification preferences, push jobs, or realtime delivery.
