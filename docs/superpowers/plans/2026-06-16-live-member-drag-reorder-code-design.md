# Live Member Drag Reorder Code Design

Implementation Plan

> REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Implement long-press drag reordering for Android and iOS live member lists while preserving the existing local priority ID ordering model.

**Architecture:** Keep ordering rules in the platform-local ordering policies. Add index-based move helpers for drag/drop while retaining offset-based helpers for accessibility actions. Replace visible row buttons with gesture-driven reorder UI and platform accessibility actions.

**Tech Stack:** Android Kotlin/View system, Android shared preferences, SwiftUI, iOS store/UserDefaults path, existing mobile member ordering policies.

## Source Feature Design

- `docs/superpowers/plans/2026-06-16-live-member-drag-reorder-feature-design.md`

## Files

Modify:

- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/LiveMemberOrderingPolicy.kt`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/LiveView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`

Test:

- Android unit tests for `LiveMemberOrderingPolicy`
- iOS tests for `LiveMemberOrderingPolicy` or store-level reorder behavior, matching the existing test structure

## Current Android Entry Points

- `MainActivity.renderLive()` renders live rows from `liveStatusFilteredMembersForUi()`.
- `liveMemberRow(...)` renders each row.
- `liveOrderControl(member)` creates the visible `"위"` and `"아래"` controls.
- `moveLiveMember(member, offset)` writes `PreferenceKeys.LIVE_MEMBER_ORDER`.
- `LiveMemberOrderingPolicy.movePriority(...)` owns the current offset-based order update.

## Current iOS Entry Points

- `LiveView` renders `ForEach(store.chzzkLiveTargets)`.
- `LiveMemberRow` receives `moveUp` and `moveDown` closures.
- `LiveMemberRow` renders `Button("위")` and `Button("아래")`.
- `MockHubStore.moveLiveMember(_:offset:)` updates `liveMemberPriorityIDs`.
- `LiveMemberOrderingPolicy.movedPriorityIDs(...)` owns current order update behavior.

## Ordering Policy Design

Add index-based move APIs.

Android target API:

```kotlin
fun movedPriority(
    priorityMemberIds: List<String>,
    orderedMembers: List<HubMember>,
    fromIndex: Int,
    toIndex: Int,
): List<String>
```

iOS target API:

```swift
static func movedPriorityIDs(
    current priorityMemberIDs: [String],
    orderedMembers: [HubMember],
    fromIndex: Int,
    toIndex: Int
) -> [String]
```

Rules:

- Clamp `fromIndex` and `toIndex` to valid row bounds.
- Return unchanged priority IDs when source and target are equal.
- Build the reordered visible ID list from `orderedMembers.map(\.id)`.
- Preserve valid hidden priority IDs not present in the current filtered list.
- Drop stale or unknown IDs.
- Keep existing offset-based helpers as wrappers for accessibility actions.

## Android Implementation Plan

- [ ] Add failing unit tests for index-based `LiveMemberOrderingPolicy.movedPriority(...)`.
- [ ] Implement index-based `movedPriority(...)`.
- [ ] Keep `movePriority(...)` or `moveLiveMember(member, offset)` as a wrapper around the index-based path where practical.
- [ ] Add `LiveDragState` to `MainActivity`.

```kotlin
private data class LiveDragState(
    val memberId: String,
    val startIndex: Int,
    var targetIndex: Int,
    val orderedIdsAtStart: List<String>,
)
```

- [ ] Add `moveLiveMember(fromIndex: Int, toIndex: Int)` that computes from `liveStatusFilteredMembersForUi()`, writes `PreferenceKeys.LIVE_MEMBER_ORDER`, and re-renders live content.
- [ ] Remove `liveOrderControl(member)` from the normal visual row layout.
- [ ] Attach long-press drag handling to reorderable live member rows.
- [ ] Translate drag Y position into a target member index using only live member row bounds.
- [ ] On `ACTION_UP`, write the new order if the target index changed.
- [ ] On `ACTION_CANCEL`, clear drag state without writing.
- [ ] Add row visual drag decoration.
- [ ] Add accessibility up/down actions to each row.
- [ ] Run Android unit tests.

Suggested helpers:

```kotlin
private fun moveLiveMember(fromIndex: Int, toIndex: Int)
private fun moveLiveMember(member: HubMember, offset: Int)
private fun liveMemberIndexAt(yInContentList: Float): Int?
private fun decorateDraggedLiveRow(row: View, dragging: Boolean)
private fun clearLiveDragState()
```

Android accessibility:

- Row label includes member name and current position.
- `"위로 이동"` calls `moveLiveMember(member, -1)`.
- `"아래로 이동"` calls `moveLiveMember(member, 1)`.

## iOS Implementation Plan

- [ ] Add failing tests for index-based `LiveMemberOrderingPolicy.movedPriorityIDs(...)`.
- [ ] Implement index-based `movedPriorityIDs(...)`.
- [ ] Add store method for index-based move.

```swift
func moveLiveMember(fromIndex: Int, toIndex: Int)
```

- [ ] Keep `moveLiveMember(_ member: HubMember, offset: Int)` for accessibility actions.
- [ ] Remove visible `Button("위")` and `Button("아래")` from `LiveMemberRow`.
- [ ] Prefer SwiftUI `List` with `.onMove` if it provides the required long-press reorder behavior without forcing a visible edit-mode button.
- [ ] If `List.onMove` is not suitable, implement custom row drag/drop with `@State private var draggingMemberID: String?`, `.onDrag`, and `.onDrop`.
- [ ] Ensure `TimelineView` elapsed-time refresh and live status rendering stay unchanged.
- [ ] Add VoiceOver accessibility actions for up/down movement.
- [ ] Run iOS tests or document the exact simulator/tooling blocker.

Preferred SwiftUI shape:

```swift
ForEach(store.chzzkLiveTargets) { member in
    LiveMemberRow(
        member: member,
        moveUp: { store.moveLiveMember(member, offset: -1) },
        moveDown: { store.moveLiveMember(member, offset: 1) }
    )
    .accessibilityAction(named: "위로 이동") {
        store.moveLiveMember(member, offset: -1)
    }
    .accessibilityAction(named: "아래로 이동") {
        store.moveLiveMember(member, offset: 1)
    }
}
```

The final visual row must not render the up/down buttons in normal UI.

## Verification Commands

Android:

```bash
cd android/StelliveHubAndroid
rtk ./gradlew :app:testDebugUnitTest
```

iOS:

```bash
rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17'
```

Repository check:

```bash
rtk git status --short
```

## Manual QA

Android:

- Open live tab.
- Switch between all/live/offline filters.
- Long-press a middle member row, drag it to top, and release.
- Leave the live tab and return.
- Restart the app if persistence is expected for Android local storage.
- Confirm no visible `"위"` or `"아래"` row buttons remain.
- Confirm TalkBack exposes up/down reorder actions.

iOS:

- Open live tab.
- Long-press a member row and drag it below another row.
- Confirm row order changes after drop.
- Leave the live tab and return.
- Restart the app if persistence is expected for iOS local storage.
- Confirm no visible `"위"` or `"아래"` row buttons remain.
- Confirm VoiceOver exposes up/down reorder actions.
- Confirm live elapsed timer still updates.

## Acceptance Criteria

- Android live rows reorder by long press and vertical drag.
- iOS live rows reorder by long press and vertical drag.
- Visible up/down buttons are removed from normal UI.
- Accessibility up/down actions remain available.
- `live_member_order` and `liveMemberPriorityIDs` semantics remain compatible with existing ordering behavior.
- Filtering live/offline/all does not corrupt hidden member order.
- No backend, notification, push, realtime, catalog, or image policy changes are introduced.
- Android unit tests pass.
- iOS tests pass or an exact tooling blocker is documented.

## Out Of Scope

- Cross-device order sync.
- Server-side order persistence.
- Reordering official channels.
- Reordering non-CHZZK notification targets.
- Redesigning the live page.
- Adding member profile assets or changing image policy.
- Changing live polling, push delivery, or realtime behavior.
