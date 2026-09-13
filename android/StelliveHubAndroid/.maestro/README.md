# Maestro QA flows

UI test automation for the Android app (`dev.minepacu.stelliveeventnotifier`), covering the 8
screens split out of `MainActivity.kt` (Home, Live, Songs, GoodsEvents, Reservations,
Announcements, Settings, History).

## Running

Prerequisite: a device/emulator connected via `adb`, unlocked, with the app installed.

```bash
# All flows
maestro test .maestro/flows

# Just the fast smoke suite
maestro test .maestro/flows --include-tags=smoke

# A single screen
maestro test .maestro/flows/songs_screen.yaml
```

Or via the Maestro MCP tools (`list_devices` → `run` with `dir: ".maestro/flows"`).

## Layout

| File | Covers |
|---|---|
| `smoke_launch.yaml` | App launches, Home renders, bottom nav present |
| `nav_bottom_tabs.yaml` | All 4 bottom tabs (Home/Live/Songs/GoodsEvents) switch correctly |
| `home_screen.yaml` | Home previews (live/songs) and top-bar shortcuts |
| `live_screen.yaml` | Status filter chips (방송 중/전체/오프라인) |
| `songs_screen.yaml` | Catalog filters, song search (RecyclerView/DiffUtil results), member filter entry |
| `goods_events_screen.yaml` | Category filters, calendar month navigation, reservations shortcut |
| `reservations_screen.yaml` | Both entry points (top-bar shortcut + in-list card), back-stack correctness |
| `announcements_screen.yaml` | List → detail navigation |
| `settings_screen.yaml` | Main screen, Targets and Platforms sub-screens |
| `settings_history_and_about.yaml` | History (reached via "기록 및 정보", not a bottom-nav tab) and App Info |

Settings coverage is split across two files to keep each flow's runtime well under typical
CI/tool timeouts — a single file covering all 6+ Settings sub-screens took long enough to
exceed the Maestro MCP tool's response timeout during authoring, even though the on-device run
itself completed. Prefer several short flows over one long one for this reason.

## App bug found (and fixed) while writing this suite

A single `back` press from **any** Settings sub-screen (Targets, Platforms, History, About, ...)
used to skip the Settings root entirely and land on Home, instead of returning to Settings.
Reproduced on-device for both Targets and History (2025-09, SM-F707N).

Root cause: `handleSystemBackPressedNow()` in `MainActivity.kt` only used incremental
one-level-back (`popScreenNow()`) for the 3 Reservation-detail screens; every other screen fell
through to `navigateBackToCurrentRootNow()`, which jumps to whichever bottom-nav tab
(`MainNavigationHistory.currentRoot`) was last selected via `selectRoot()` — a field that plain
`pushScreen()`/`select()` navigation (how Settings and its sub-screens are entered) never
updates. So from any Settings sub-screen, "current root" was always stuck at whatever tab was
active before Settings was opened (Home, on a fresh launch), and back jumped straight there.

Fixed in `fix/settings-back-stack-skips-home` by adding History and all `SETTINGS_*` sub-screens
to the same incremental-back set the Reservation-detail screens already used. `settings_screen.yaml`
and `settings_history_and_about.yaml` now assert the correct behavior (back → Settings) instead of
working around it.

The identical root cause likely also affects `HubScreen.ANNOUNCEMENT_DETAIL` (`back` probably
skips the Announcements list and lands on Home too) — not fixed here since it wasn't part of the
reported bug and `announcements_screen.yaml` doesn't currently assert where `back` from the detail
screen lands. Worth a follow-up if confirmed.

## Conventions

- Tags: `smoke` (fast, run on every change), `regression` (fuller per-screen coverage),
  plus one tag per screen area for targeted runs.
- **These flows run against a real device by default and are deliberately read-only /
  navigation-only** — they don't toggle notification switches, appearance mode, or delete
  records, since that would persist a real change on the tester's phone. If you add a flow
  that needs to mutate state, use `clearState: true` in `launchApp` (or a dedicated
  test/staging build) rather than relying on manual cleanup.
- Selectors prefer `id:` (the app's `resource-id`, stable across text/locale changes) over
  `text:` where the app assigns one; screen titles and dynamic/seeded content (song titles,
  announcement copy) use `text:`/regex since resource-ids aren't available on those views.
- Two-pane/foldable layouts (GoodsEvents, Settings detail panes) are not yet covered here —
  the flows above assume single-pane width. Add a `two_pane_fold.yaml` using
  `setOrientation`/an unfolded device profile if fold-aware regression coverage is needed.
