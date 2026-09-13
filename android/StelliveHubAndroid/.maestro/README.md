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

## Known app bug found while writing this suite

A single `back` press from **any** Settings sub-screen (Targets, Platforms, History, About, ...)
skips the Settings root entirely and lands on Home, instead of returning to Settings. Reproduced
on-device for both Targets and History (2025-09, SM-F707N). Settings sub-screens only render a
`topBarBack` icon (no `topBarSettings`), so the flows here work around it by going back to Home
and re-entering Settings from the top-bar icon rather than asserting `back` returns to Settings.
This is almost certainly not the intended navigation-stack behavior and is worth its own fix —
not addressed here since it's outside this task's scope (setting up test automation).

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
