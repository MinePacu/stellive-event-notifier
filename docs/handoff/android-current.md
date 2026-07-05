# Android Current Context

This file contains current active context only.
Do not append long historical logs here.
Move completed or stale implementation notes to `docs/handoff/archive/`.

## Active Boundaries

- Android consumes normalized backend DTOs and must not call protected CHZZK, YouTube, Firebase service-account, OAuth, or internal APIs directly.
- Keep notification preferences authoritative and preserve local history/cache, permission handling, deep links, foreground presentation, and widget behavior.
- Use placeholder avatars by default. Runtime provider image URLs require policy approval and fallback behavior.
- Do not add proprietary logos, profile binaries, fan art, captures, copied media, or cloned service designs.

## Current UI Areas

- Home, Live, Songs, and Goods/Events share server-backed state with local fallback behavior.
- Songs includes recent covers, filtering, search, and member selection without direct YouTube access.
- Live and notification surfaces consume backend live-status and push DTOs.
- Goods/Events includes list/calendar presentation, date-range formatting, special-day entries, deep links, and a home-screen widget.
- Shared top chrome, filter strips, semantic card surfaces, and external section headers should remain original Android UI patterns.

## Task Routing

- Read policy or UI documentation only when the requested Android change directly depends on it.
- Do not load backend, iOS, ops, or archived handoff context for routine Android work.
- Keep completed verification counts and historical implementation narratives out of this file.
