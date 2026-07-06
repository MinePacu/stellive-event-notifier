# Song Page UI API Communication Plan

**Goal:** Define how the Android and iPhone song page UI communicates with the server-backed YouTube song catalog API.

**Inputs:**
- `docs/mockups/song-page-mobile-preview.html`
- `docs/superpowers/plans/2026-06-22-youtube-song-page-ingestion-plan.md`

## Constraints

- Former members must not appear in song catalog rows, filters, seed data, or tests.
- Song generation filters expose only `전체`, `1기생`, `2기생`, and `3기생`.
- `gamja`, `official`, and `gen4-upcoming` are not song generation filters.
- Mobile apps do not call YouTube directly. The backend owns YouTube API access, WebSub, reconciliation, classification, dedupe, and persistence.
- Thumbnail URLs are runtime HTTPS display URLs only. Do not download, bundle, or commit thumbnail binaries.
- Cards, background colors, and title bars follow the existing Android and iPhone UI code, not the standalone mockup palette or chrome.

## Product To API Mapping

| Mockup Area | API Source | Mobile Behavior |
| --- | --- | --- |
| Summary card counts | `GET /v1/songs/facets` | Shows total classified songs, original count, and cover count when `summaryCards.songs=true`. |
| Search box | `GET /v1/songs?q=` | Debounced client request after user input settles; no YouTube call from mobile. |
| Generation chips | `GET /v1/songs?generationId=` and facets | Uses only `all`, `gen1`, `gen2`, `gen3`. |
| Song type segmented control | `GET /v1/songs?type=` | Uses `all`, `original`, `cover`; `unknown` is not visible. |
| Member selection card | `GET /v1/songs?memberId=` and facets | Shows selected state and opens full member selection instead of a wide avatar rail. |
| Song list | `GET /v1/songs` | Renders cached backend rows with YouTube-shaped thumbnail slots. |
| Empty/error states | API response or network failure | Shows no results, backend unavailable, or cached/mock fallback by platform convention. |

## Mobile API Contract

### `GET /v1/songs/facets`

Purpose: give the app aggregate data for summary cards, generation filters, member counts, and type counts without fetching every song.

Query parameters:
- `generationId`: optional `all | gen1 | gen2 | gen3`
- `memberId`: optional catalog member ID
- `type`: optional `all | original | cover`
- `q`: optional search string

Response fields:
- `summary.total`, `summary.original`, `summary.cover`
- `generationFilters[]` with `id`, `label`, `count`
- `memberFilters[]` with `id`, `label`, `generationId`, `count`
- `typeFilters[]` with `id`, `label`, `count`
- `displaySettings.summaryCards.songs` plus existing page summary-card settings
- `serverTime`

Required generation filter IDs: `all`, `gen1`, `gen2`, `gen3`.

### `GET /v1/songs`

Purpose: return the song list currently visible in the song page.

Query parameters:
- `generationId`: optional `all | gen1 | gen2 | gen3`
- `memberId`: optional catalog member ID
- `type`: optional `all | original | cover`
- `q`: optional search string
- `cursor`: optional opaque pagination cursor
- `limit`: optional integer, default `30`, maximum `50`

Each item includes:
- `id`
- `youtubeVideoId`
- `title`
- `memberId` and `memberName`
- `generationId` and `generationName`
- `type`: `original` or `cover`
- `sourceUrl`
- optional `thumbnail.url`, `thumbnail.width`, `thumbnail.height`
- `publishedAt`

Validation behavior:
- `generationId=gamja`, `generationId=official`, and `generationId=gen4-upcoming` return `400 unsupported_song_generation_filter`.
- Unknown `memberId` returns `400 unknown_member`.
- `type=unknown` returns `400 unsupported_song_type_filter` for mobile routes.
- Invalid `limit` returns `400 invalid_limit`.

Cache behavior:
- `GET /v1/songs/facets`: `Cache-Control: private, max-age=60`
- `GET /v1/songs`: `Cache-Control: private, max-age=30`
- Route handlers read normalized repository data only and never call YouTube directly.

## Backend Boundary

Data path:

~~~text
YouTube WebSub/Data API
  -> backend adapters
  -> song ingestion/classification
  -> Song persistence
  -> /v1/songs and /v1/songs/facets
  -> Android HubApi / iOS HubAPIClient
  -> platform UI state
~~~

Backend responsibilities:
- own YouTube credentials and platform API calls;
- parse only required YouTube fields;
- classify `original`, `cover`, or `unknown`;
- persist minimal normalized song rows;
- expose mobile-safe DTOs;
- enforce filter exclusions;
- avoid long-term storage of full raw platform responses.

Mobile responsibilities:
- request facets and list data from the backend;
- cache the latest successful list/facets in app memory or existing fallback structures;
- render runtime HTTPS thumbnails with placeholder fallback;
- open `sourceUrl` in YouTube/platform browser when a row is tapped;
- keep title bars and platform chrome from existing UI code.

## Android Flow

Files involved:
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApi.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`

Request flow:
1. Song tab enters screen.
2. `ServerHubRepository` requests `/v1/songs/facets` and `/v1/songs` through `HubApiClient`.
3. Successful DTOs map into Android models.
4. Failure uses cached server data if available, otherwise `MockHubRepository`.
5. Filter changes update query parameters and refresh the list.
6. Search input is debounced before calling the backend.

UI constraints:
- Use current Android title bar code and add only the needed `songs` screen/title mapping.
- Use existing card/background color tokens.
- Do not expose `감자` or `기타` as song generation chips.

## iPhone Flow

Files involved:
- `ios/StelliveHubiOS/StelliveHubiOS/Services/HubAPIClient.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`

Request flow:
1. Song tab appears in `ContentView`.
2. `SongsView` requests facets and list data from `ServerHubStore`.
3. `ServerHubStore` calls `HubAPIClient.songFacets(...)` and `HubAPIClient.songs(...)`.
4. Successful responses update published song state.
5. Failures keep the last server response or fallback mock state.
6. Filter/search changes rebuild query parameters and refresh the list.

UI constraints:
- Use existing iPhone title bar/navigation toolbar patterns.
- Use existing SwiftUI grouped rhythm and app color tokens.
- The song tab replaces bottom-tab history; history moves into settings.

## Request Timing

- Initial song tab load: request facets first, then list with default filters.
- Filter tap: request list immediately; request facets only when counts need narrowed-state updates.
- Search typing: wait for settled input before requesting list.
- Pull-to-refresh: request facets and list.
- App bootstrap: do not include the full song list in `/v1/bootstrap`.

## Verification

- Run only the tests required by the code changed in the current implementation batch.
- Backend route/contract changes use focused Vitest targets for validation, cache headers, DTO shape, and no YouTube calls from route handlers.
- Android UI/client changes use focused unit tests for tab replacement, filters, fallback, existing title bar reuse, and thumbnail ratio slots.
- iOS UI/client changes use focused XCTest targets for tab replacement, settings history entry, filters, fallback, existing title bar reuse, and thumbnail ratio slots.
- Run targeted policy scans only across changed paths plus directly related contract/catalog paths to verify no Former members, forbidden official YouTube live event types, copied assets, or secrets are introduced.
- Run broader suites only when a shared contract, route registration, app bootstrap, or cross-platform model change makes the focused tests insufficient.
