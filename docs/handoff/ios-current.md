# iOS Current Context

This file contains current active context only.
Do not append long historical logs here.
Move completed or stale implementation notes to `docs/handoff/archive/`.

## Active Boundaries

- iOS consumes normalized backend DTOs and must not call protected CHZZK, YouTube, Firebase service-account, OAuth, or internal APIs directly.
- Keep notification preferences authoritative and preserve local history/cache, permissions, deep links, foreground presentation, and app-group boundaries.
- Use placeholder avatars by default. Runtime provider image URLs require policy approval and fallback behavior.
- Do not add proprietary logos, profile binaries, fan art, captures, copied media, or cloned service designs.

## Current UI Areas

- The SwiftUI app contains Home, Live, Songs, Goods/Events, History, member detail, and Settings flows backed by server DTOs with local fallback behavior.
- Songs includes recent covers and server-backed catalog filtering without direct YouTube access.
- Live and notification surfaces consume backend live-status and push DTOs.
- Goods/Events includes list/calendar presentation, date-range formatting, special-day entries, and deep links.
- WidgetKit reads compact calendar snapshots through the configured app group; widgets do not call provider APIs.

## Task Routing

- Read policy or UI documentation only when the requested iOS or WidgetKit change directly depends on it.
- Do not load backend, Android, ops, or archived handoff context for routine iOS work.
- Keep completed verification counts and historical implementation narratives out of this file.
