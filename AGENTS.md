# Stellive Notification Hub Agent Rules

These rules apply from the repository root to every subdirectory. Read this file before changing code, docs, tests, seeds, or generated configuration.

This project is an unofficial open-source fan project with no direct monetization plan. Non-profit and open-source status does not remove copyright, portrait/publicity, trademark, platform API, or terms-of-service obligations.

Non-negotiable rules:
- Do not include Former members in the MVP member catalog, notification targets, UI filters, or seed data.
- The member catalog may include only `active` or `upcoming` entries.
- Gangzi is not a generation member. Include Gangzi as a `representative` entry in the `gamja` category with `roleLabel: "스텔라이브 대표"`.
- The `official` category is displayed as `기타` and includes Stellive official YouTube and X notification targets.
- Stellive official YouTube supports upload notifications only. Do not create official YouTube live scheduled/started/ended notifications.
- Prefer official APIs and platform terms. Do not implement unauthorized crawling, login-cookie scraping, private cafe collection, or bypass access.
- Never commit API secrets, tokens, OAuth credentials, raw private platform responses, or production device tokens.
- Do not commit profile image binaries, official logos, fan art, captured images, or unauthorized member assets.
- Use placeholder avatars by default. Show platform API image URLs only conditionally and with fallback behavior.
- Do not clone Samsung One UI, Apple Settings, CHZZK, YouTube, X, Naver, or Stellive proprietary logos/assets/designs.
- Android may reference the general mood of spacious mobile settings UIs; iOS may reference grouped settings patterns. Both must remain original.
- Keep a server-mediated/API-first event ingestion architecture. A lightweight backend or managed control plane handles protected API access, dedupe, preference enforcement, and push fan-out; mobile apps handle settings UI, local history/cache, deep links, and foreground display.
- User notification preferences are authoritative. Global off blocks every notification.
- Users must be able to configure global, platform, event type, generation/category, and individual member/Gangzi/official-channel notification settings.
- Users must be able to enable `realtime_best_effort`. It never guarantees instant delivery and must not bypass API, OS, push-service, battery, or rate-limit policies.
- `chzzk_chat` is off by default and should require explicit filters before push delivery.

Before starting new work, read:
- `docs/PROJECT_RULES.md`
- `docs/NOTIFICATION_POLICY.md`
- `docs/REALTIME_DELIVERY.md`
- `docs/AI_HANDOFF.md`
