# Android Live Transparent Blur Top Bar Feature Design

Android live page should make the status bar and in-app title bar visually match the iOS live page direction shown in the reference image: content can pass underneath the top area, while the top controls remain readable through a translucent, blurred surface.

**Scope:** Android live page visual behavior. No backend, notification, catalog, CHZZK polling, reorder logic, member assets, or iOS behavior changes.

## User Experience

1. User opens the Android live page.
2. The system status bar area and the app title/settings bar appear as one continuous translucent overlay.
3. Live member cards scroll behind the top overlay.
4. The overlay keeps enough blur, scrim, and contrast for the settings button and collapsed title text to remain readable.
5. Pull-to-refresh and long-press drag reorder continue to work unchanged.

## Visual Rules

- Match the iOS live page direction, not Apple proprietary chrome.
- Use the existing dark live page palette and Android-native rendering.
- Top area should feel glass-like: translucent dark surface, blur where supported, subtle divider only when scrolled.
- Status bar icons should remain light and readable.
- The app title bar height and settings button hit target remain unchanged.
- Collapsed title behavior remains scroll-driven; the large live page header content does not return.
- On devices without reliable blur support, fall back to the same translucent dark scrim without layout breakage.

## Behavioral Requirements

- Edge-to-edge content is enabled only where needed for the top overlay.
- `SwipeRefreshLayout` still receives pull gestures at the top of the live list.
- Live elapsed timers continue updating.
- Member drag reorder continues working.
- Settings button remains at top right.
- TalkBack labels and touch targets remain unchanged.

## Constraints

- Do not introduce former members, official assets, profile image binaries, logos, fan art, captured images, copied media, or secrets.
- Do not clone iOS/Samsung/CHZZK proprietary UI. The target is a compatible transparent blur treatment in the existing app style.
- Do not change backend DTOs or notification policy.
- Do not alter live/offline/all filtering, member ordering persistence, or CHZZK target membership.

## Acceptance Criteria

- Android live page top status/title area visually uses translucent dark overlay with blur or graceful fallback.
- Cards can scroll under the top overlay without unreadable overlap.
- Top settings button is visible and tappable.
- Pull-to-refresh works from the top of the live page.
- Long-press drag reorder still works.
- Existing Android live page unit tests/build pass.

## Out Of Scope

- Redesigning the bottom navigation bar.
- Changing iOS implementation.
- Adding new theme modes or user settings.
- Reworking member cards.
- Adding screenshots or image assets to the repository.
