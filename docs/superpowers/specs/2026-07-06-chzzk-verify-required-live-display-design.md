# CHZZK Unverified Live Display Defense Design

## Goal

Prevent `sourceVerificationState != "verified"` CHZZK status rows from appearing as confirmed LIVE broadcasts in bootstrap responses, Android, or iOS, while avoiding false live-ended events and false transition timestamps.

## Scope

This change covers five bounded defenses:

1. Sanitize mobile bootstrap live status output.
2. Stop persisting `verify_required` rows as live in the CHZZK adapter.
3. Preserve event and transition semantics when verification fails.
4. Add matching Android and iOS display guards.
5. Reject channel-only live-list entries as proof of a live broadcast and document the page-limit operational mitigation.

No production environment values, database records, migrations, deployments, or UI redesigns are included.

## Server Bootstrap Boundary

`BootstrapService` will map persisted live statuses through a mobile-display transformation before returning them. A status whose `sourceVerificationState` is not `verified` will retain its identity and verification state but return:

- `isLive: false`
- no `title`
- no `viewerCount`
- no `startedAt`

Verified live and verified offline statuses remain unchanged. This boundary protects already-installed app versions even if historical database rows still contain `verify_required + isLive=true`.

## CHZZK Adapter Persistence

`ChzzkOpenApiAdapter` will persist an unverified observation as non-live with live-only fields cleared. It will not preserve `previous.isLive` in the newly written row.

Transition calculation will require a verified observation. For `verify_required`, `lastTransitionAt` remains the previous value even when the persisted display-safe `isLive` changes from true to false. Event creation requires both the previous and current observations to be verified. A verification failure therefore creates neither a started nor an ended event, and the first verified observation after an unverified row re-establishes the baseline without emitting a potentially duplicate transition event.

This intentionally separates the persisted display state from the transition/event state: unverified data is safe to display but is not treated as evidence of a real broadcast transition.

## Mobile Defense

Android and iOS network DTOs will retain `sourceVerificationState`. Their server-to-domain mapping will compute effective live display as:

```text
displayLive = response.isLive && response.sourceVerificationState == "verified"
```

When `displayLive` is false, live-only title, viewer count, start time, and platform URL will be cleared during mapping. Existing views can therefore continue using their current `isLive` checks without showing a LIVE badge, elapsed time, CHZZK button, or `방송 제목 확인 중` fallback for unverified data.

Missing verification state is treated as unverified. This is fail-closed and consistent with the core requirement.

## CHZZK Live-List Normalization

Explicit `status` or `liveStatus` remains authoritative. If neither exists, an entry is considered live only when at least one live-specific signal is present: nonblank title, open/start date, or live ID. A matching entry containing only a channel ID is normalized as verified offline rather than live.

The existing status-less live-list test will remain valid by using its live title as evidence. A new channel-only regression test will cover the fail-closed behavior.

## Operations Documentation

The default `CHZZK_LIVE_LIST_MAX_PAGES` value will not change. The environment example or directly relevant operations document will explain that frequent page-limit-driven `verify_required` results should be investigated by temporarily raising the configured value to the 30–50 range while monitoring CHZZK API usage.

## Testing Strategy

All behavior changes follow red-green TDD:

- Backend bootstrap tests cover unverified live sanitization and unchanged verified live/offline rows.
- Adapter tests cover previous-live plus `verify_required`, no events, cleared live data, and preserved `lastTransitionAt`; existing verified transition tests remain green.
- API client tests cover channel-only entries and status-less entries with live evidence.
- Android mapping tests cover unverified and verified live responses; UI policy tests confirm the fallback cannot be reached for mapped unverified data where applicable.
- iOS mapping tests cover the same verified/unverified cases.

Focused tests run first for each layer, followed by the backend test suite, Android unit tests, and CLI-available iOS unit tests.

## Compatibility and Data Impact

No schema or database rewrite is needed. Existing contaminated rows become harmless to bootstrap immediately after server deployment. Subsequent unverified polls overwrite status rows with display-safe non-live values without generating ended events or updating transition timestamps. The first later verified observation re-establishes a trusted baseline without emitting a transition from the unverified row; normal event generation resumes between consecutive verified observations.
