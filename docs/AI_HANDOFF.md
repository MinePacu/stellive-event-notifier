# AI Handoff

This file is the current-status summary router and the only handoff entry point that may be read by default.

Do not read every current document. Select only the area directly touched by the task or changed files.

## Current Area Context

- Backend API, workers, storage, notifications, music sync, CHZZK, and YouTube: `docs/handoff/backend-current.md`
- Android UI, notifications, cache, songs, live, and goods/events: `docs/handoff/android-current.md`
- iOS, SwiftUI, WidgetKit, notifications, songs, live, and goods/events: `docs/handoff/ios-current.md`
- Deployment, internal server, containers, process managers, proxying, and operational validation: `docs/handoff/ops-current.md`
- Handoff directory usage: `docs/handoff/README.md`

## Global Constraints

- Do not add Former members to the MVP catalog, filters, seeds, or notification targets.
- Keep Gangzi as a representative in `gamja`, not as a generation member.
- Keep official channels in `official` / `기타`. Stellive official YouTube supports upload notifications only.
- Do not commit secrets, production tokens, OAuth credentials, Firebase credentials, raw private platform responses, production device tokens, or local environment values.
- Do not commit profile image binaries, official logos, fan art, captured images, copied media/CDN assets, or unauthorized member assets.
- Mobile clients consume normalized backend DTOs for protected platform data.
- YouTube API keys and other protected provider credentials are backend-only.
- User notification preferences are authoritative; global off blocks every notification.

## Archive Rule

Do not read `docs/handoff/archive/**` during normal feature work, merge-only work, routine debugging, or routine PR review.

Archived handoff files are historical records, not active instructions.

An archived file may be read only when:

- the user explicitly requests historical implementation context;
- a regression or history investigation requires old implementation details;
- a merge conflict directly references an archived handoff file; or
- a current handoff document links to that exact archived file.

Finding an archive file in search results is not permission to open it. Start from this router and load the smallest current area document needed.
