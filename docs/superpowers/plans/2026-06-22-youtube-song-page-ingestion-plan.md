# YouTube Song Page Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a low-load server-mediated YouTube song catalog for the new `노래` tab, with unified Android/iOS UI and filters for all generation members, generation, individual member, original songs, and cover songs.

**Architecture:** The backend owns all YouTube API/WebSub access, normalizes uploads into a durable song catalog, classifies each item as `original`, `cover`, or `unknown`, and exposes cached mobile read APIs. Mobile apps never call YouTube directly; they render the same shared DTO shape and keep matching filter semantics. WebSub is the primary ingestion path and YouTube Data API is limited to one-time channel verification, initial backfill, and capped reconciliation.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Vitest, shared TypeScript schemas, Kotlin Android views, SwiftUI, XCTest, Android unit tests.

---

## Requirements From GitLab #23 And GitHub #45

- Move the bottom-tab `알림 기록` entry into settings.
- Add a bottom-tab `노래` page in the vacated position.
- Let users explore YouTube upload songs by all generation members, generation, individual member, and song type.
- Song type filters are `전체`, `오리지널`, and `커버`.
- Generation category filters on the song page include only `전체`, `1기생`, `2기생`, and `3기생`.
- Exclude `감자` and `기타` from song-page generation category filters.
- Keep Android and iPhone UI as structurally identical as platform conventions allow.
- Do not use a horizontal member rail as the main member selector. Ten generation members should be handled with a compact selected-state card plus a searchable member selection sheet/page.
- Song rows should preserve YouTube video thumbnail proportions instead of using square artwork. Store and expose thumbnail width/height metadata from the YouTube API and render a video-shaped slot in mobile UI.
- Add a dedicated settings page for screen display configuration so users can choose whether major summary cards are shown per page. Start with the song page summary card and design the setting so live/goods-events/home summary cards can be added later.
- Match backend DTO parsing to the actual YouTube Data API JSON response bodies for `channels.list`, `playlistItems.list`, and `videos.list`.

## Non-Negotiable Policy Constraints

- Do not include Former members.
- Gangzi remains a `gamja` representative, not a generation member, and is not shown in song-page generation filters.
- Stellive official remains `official`/`기타` for notification settings, but is not part of MVP song-page generation filters.
- Official YouTube can only create `official_youtube_upload` notifications. Do not create official YouTube live scheduled, started, or ended notifications.
- Use official YouTube API/WebSub paths only. Do not scrape HTML, use login cookies, bypass access, or store private/raw provider payloads long term.
- Do not commit API keys, OAuth credentials, raw private responses, official logos, thumbnails, screenshots, fan art, or profile image binaries.
- Mobile UI uses placeholders by default for members and channels. Runtime YouTube video thumbnail URLs may be exposed as HTTPS API-provided display URLs with fallback, but binaries are never stored or committed.

## Functional Design

### Song Page Scope

The MVP `노래` page is a member-song catalog, not a general official-channel upload feed.

Visible filters:

| Filter area | Values | Notes |
| --- | --- | --- |
| Generation | `전체`, `1기생`, `2기생`, `3기생` | `감자`, `기타`, and `4기생 upcoming` are not shown. |
| Song type | `전체`, `오리지널`, `커버` | `unknown` items appear only in `전체` if product wants review visibility; recommended MVP hides unknown from user-facing type counts until classified. |
| Member | `전체 멤버`, then active generation members in the selected generation | Gangzi, official channel, placeholder, and Former entries are excluded. |
| Search | title, member Korean name, member English name, normalized keyword | Search runs against backend-indexed fields, not YouTube live queries. |
| Summary card visibility | `showSongsSummaryCard` | Controlled from a dedicated settings page for screen display configuration. |

Song rows show:

- placeholder music mark or app-owned placeholder avatar;
- song title;
- member name and generation;
- upload date;
- tags: `오리지널` or `커버`, `YouTube 업로드`, and generation/member context;
- source URL action controlled by existing tap-action policy if later reused for notifications.
- YouTube video thumbnail slot rendered from normalized `thumbnail.url`, `thumbnail.width`, and `thumbnail.height`; use the returned aspect ratio and a 16:9 video fallback instead of square art.

Member selection pattern:

- The primary song page shows the selected scope summary, for example `전체 멤버` or `2기생 전체`.
- It may show up to four quick-pick member cards in a compact two-column grid.
- A `멤버 선택` action opens a searchable full member selector sheet/page containing all ten generation members.
- Android and iOS use the same order, labels, counts, and selected-state semantics; only the native presentation changes.

Summary card settings pattern:

- Add a settings row named `화면 구성` under settings.
- `화면 구성` owns page-level display toggles, starting with `노래 요약 카드 표시`.
- Model the setting as a map keyed by page ID so `홈`, `라이브`, and `굿즈/행사` summary card toggles can be added without a new settings architecture.
- Default for the new song page is `showSongsSummaryCard=true` so the card appears unless the user hides it.

### Backend Data Flow

    verified catalog youtube handle/channel ID
      -> WebSub subscription for each active member channel
      -> YouTube Atom upload notification
      -> parse video ID/channel ID/title/published/link only
      -> dedupe by youtube:upload:<channelId>:<videoId>
      -> classify as original/cover/unknown
      -> persist normalized Song row
      -> expose cached /v1/songs and /v1/songs/facets to mobile

Data API is not on the hot path. WebSub receives upload notifications without polling. Data API calls are allowed only for:

1. one-time channel verification from catalog handles to channel IDs;
2. initial backfill from each channel's uploads playlist;
3. low-frequency reconciliation for missed WebSub notifications;
4. optional `videos.list` metadata recovery when Atom lacks required fields.

### Low-Load YouTube API Strategy

| Need | Preferred mechanism | Load-control rule |
| --- | --- | --- |
| New uploads | YouTube WebSub over channel Atom feed | No polling per channel for normal operation. |
| Channel ID verification | `channels.list` by handle during admin/scheduled verification | Run only when catalog changes or a channel is `verify_required`. Store result. |
| Initial history | `channels.list(part=contentDetails)` then `playlistItems.list` on uploads playlist | One-time per channel, bounded page count such as latest 50 uploads for MVP. |
| Missed upload recovery | `playlistItems.list` with saved newest seen video and ETag | Daily or less, capped to a small number of pages across all channels. |
| Video details | `videos.list` by specific video IDs | Only when Atom/backfill metadata is insufficient. Batch up to 50 IDs. |
| Mobile reads | Backend DB plus response cache | No YouTube calls during mobile API reads. |

Recommended baseline budget after initial backfill: zero Data API calls for ordinary new uploads, plus one capped reconciliation pass per day. If the WebSub lease is healthy, reconciliation should stop after the first page per channel unless it finds unseen videos.

### YouTube Data API JSON Response Shapes To Match

These shapes are based on the official YouTube Data API v3 docs checked during planning. The implementation should parse these response bodies directly and ignore fields outside the selected parts.

All three list endpoints return a list wrapper:

    {
      "kind": "youtube#channelListResponse | youtube#playlistItemListResponse | youtube#videoListResponse",
      "etag": "etag",
      "nextPageToken": "string",
      "prevPageToken": "string",
      "pageInfo": {
        "totalResults": 0,
        "resultsPerPage": 0
      },
      "items": []
    }

`channels.list` should request only the parts needed for channel verification and upload playlist discovery:

    GET https://www.googleapis.com/youtube/v3/channels
      ?part=snippet,contentDetails
      &forHandle=<youtubeHandle without @> or &id=<channelId>
      &maxResults=50

Relevant `youtube#channel` item shape:

    {
      "kind": "youtube#channel",
      "etag": "etag",
      "id": "UC...",
      "snippet": {
        "title": "string",
        "description": "string",
        "customUrl": "string",
        "publishedAt": "datetime",
        "thumbnails": {
          "default": { "url": "string", "width": 88, "height": 88 },
          "medium": { "url": "string", "width": 240, "height": 240 },
          "high": { "url": "string", "width": 800, "height": 800 }
        }
      },
      "contentDetails": {
        "relatedPlaylists": {
          "uploads": "UU..."
        }
      }
    }

`playlistItems.list` should be the low-cost backfill/reconciliation endpoint for upload history:

    GET https://www.googleapis.com/youtube/v3/playlistItems
      ?part=snippet,contentDetails,status
      &playlistId=<uploadsPlaylistId>
      &maxResults=50
      &pageToken=<nextPageToken>

Relevant `youtube#playlistItem` item shape:

    {
      "kind": "youtube#playlistItem",
      "etag": "etag",
      "id": "playlist-item-id",
      "snippet": {
        "publishedAt": "datetime",
        "channelId": "UC...",
        "title": "string",
        "description": "string",
        "thumbnails": {
          "default": { "url": "string", "width": 120, "height": 90 },
          "medium": { "url": "string", "width": 320, "height": 180 },
          "high": { "url": "string", "width": 480, "height": 360 },
          "standard": { "url": "string", "width": 640, "height": 480 },
          "maxres": { "url": "string", "width": 1280, "height": 720 }
        },
        "channelTitle": "string",
        "videoOwnerChannelTitle": "string",
        "videoOwnerChannelId": "UC...",
        "playlistId": "UU...",
        "position": 0,
        "resourceId": {
          "kind": "youtube#video",
          "videoId": "video-id"
        }
      },
      "contentDetails": {
        "videoId": "video-id",
        "videoPublishedAt": "datetime"
      },
      "status": {
        "privacyStatus": "public | private | unlisted"
      }
    }

`videos.list` should be used only for explicit video IDs that need metadata recovery or classification detail:

    GET https://www.googleapis.com/youtube/v3/videos
      ?part=snippet,contentDetails,status,statistics
      &id=<comma-separated-video-ids>

Relevant `youtube#video` item shape:

    {
      "kind": "youtube#video",
      "etag": "etag",
      "id": "video-id",
      "snippet": {
        "publishedAt": "datetime",
        "channelId": "UC...",
        "title": "string",
        "description": "string",
        "thumbnails": {
          "default": { "url": "string", "width": 120, "height": 90 },
          "medium": { "url": "string", "width": 320, "height": 180 },
          "high": { "url": "string", "width": 480, "height": 360 },
          "standard": { "url": "string", "width": 640, "height": 480 },
          "maxres": { "url": "string", "width": 1280, "height": 720 }
        },
        "channelTitle": "string",
        "tags": ["string"],
        "categoryId": "string",
        "liveBroadcastContent": "none | live | upcoming"
      },
      "contentDetails": {
        "duration": "PT3M21S",
        "dimension": "2d",
        "definition": "hd",
        "caption": "false",
        "licensedContent": false,
        "projection": "rectangular"
      },
      "status": {
        "uploadStatus": "processed",
        "privacyStatus": "public | private | unlisted",
        "license": "youtube",
        "embeddable": true,
        "publicStatsViewable": true,
        "madeForKids": false
      },
      "statistics": {
        "viewCount": "string",
        "likeCount": "string",
        "commentCount": "string"
      }
    }

Normalized backend mapping from these JSON bodies:

- `youtubeVideoId`: `playlistItem.contentDetails.videoId`, fallback `playlistItem.snippet.resourceId.videoId`, or `video.id`.
- `youtubeChannelId`: prefer `playlistItem.snippet.videoOwnerChannelId`, fallback `playlistItem.snippet.channelId` or `video.snippet.channelId`.
- `title`: `snippet.title`.
- `descriptionForClassification`: `snippet.description` plus `video.snippet.tags[]` only when `videos.list` was explicitly fetched.
- `publishedAt`: prefer `playlistItem.contentDetails.videoPublishedAt`, fallback `snippet.publishedAt`.
- `thumbnail`: choose the best HTTPS thumbnail from `maxres`, `standard`, `high`, `medium`, `default`, preserving returned `width` and `height`; do not download or persist image binaries.
- `duration`: `video.contentDetails.duration` only when `videos.list` was explicitly fetched.
- `privacyStatus`: `status.privacyStatus`; only public videos are user-visible.
- `liveBroadcastContent`: reject `live` and `upcoming` for the song catalog unless later product scope explicitly includes live archive songs.

### WebSub Subscription Rules
### WebSub Subscription Rules

- Topic URL shape: `https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>`.
- Hub URL: `https://pubsubhubbub.appspot.com/subscribe`.
- Callback route: `POST /v1/webhooks/youtube` and `GET /v1/webhooks/youtube` for verification.
- GET verification returns `hub.challenge` exactly after validating `hub.verify_token`.
- Store `leaseSeconds`, `subscribedAt`, `expiresAt`, `lastRenewAttemptAt`, and `lastSuccessfulReceiptAt` per channel.
- Renew at 80% of lease duration or at least 12 hours before expiry, whichever is earlier.
- If renewal fails, mark channel state `degraded` and schedule a capped reconciliation. Do not increase polling frequency repeatedly.
- WebSub receipt body is parsed and discarded. Persist only normalized fields, parser status, and a short diagnostic hash/error when needed.

### Classification Strategy For Original And Cover

YouTube does not provide a reliable `original` versus `cover` field. The backend should separate ingestion from classification.

Classification sources, in priority order:

1. admin/manual override stored in DB;
2. trusted channel metadata such as tags/description when available through Data API;
3. title and description heuristics;
4. `unknown` fallback.

Initial deterministic heuristics:

- classify as `cover` when normalized title or description includes `cover`, `커버`, `歌ってみた`, `covered by`, or `covered`;
- classify as `original` when normalized title or description includes `original`, `오리지널`, `오리지널곡`, `original song`, or `official mv`, unless a cover marker also exists;
- if both original and cover markers exist, choose `unknown` and require review;
- do not infer from thumbnails, logos, captured images, comments, or unofficial third-party pages.

The user-facing MVP can hide `unknown` from `오리지널` and `커버` counts while keeping it visible in `전체` with an internal/admin review state, or it can hide `unknown` entirely until reviewed. Recommended MVP: show only classified songs in the mobile song page and track unknown counts in admin diagnostics.

### Mobile UI Consistency Contract

Android and iPhone should use the same information architecture:

1. same bottom tab order: `홈`, `라이브`, `노래`, `굿즈/행사`;
2. same top-level song metrics when `summaryCards.songs=true`: total classified songs, original count, cover count;
3. same filter order: generation chips, song type segmented control, compact member selector, search;
4. same empty states: no songs, no matching filter, backend unavailable;
5. same row fields: YouTube-ratio thumbnail slot, title, member/generation subtitle, upload date, type badge, YouTube upload badge;
6. same exclusion behavior: no `감자` or `기타` in generation filters;
7. same placeholder-first asset behavior and runtime-only YouTube thumbnail fallback behavior;
8. same `화면 구성` settings semantics for summary-card visibility.

Platform-specific differences are limited to native navigation/chrome: Android keeps the current card/chip density in `MainActivity.kt`; iOS keeps SwiftUI grouped list rhythm in `ContentView.swift` and related views.

## File Structure

### Shared Contracts

- Modify: `shared/schemas/domain.ts`
  - Add `SongType = "original" | "cover" | "unknown"`.
  - Add `SongCatalogItem`, `SongThumbnail`, `SongFacetSummary`, summary-card display settings, and request filter helpers.
- Modify: `shared/schemas/mobileApi.ts`
  - Add mobile DTOs for song list, facets, and page display settings.
- Modify: `shared/openapi/openapi.yaml`
  - Document `GET /v1/songs` and `GET /v1/songs/facets`.

### Backend

- Modify: `backend/stellive-hub-api/prisma/schema.prisma`
  - Add tables for `YoutubeChannelState`, `Song`, `SongArtist`, optional `SongClassificationOverride`, and summary-card display preferences if persisted server-side.
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeAtomParser.ts`
  - Parse YouTube Atom into minimal upload candidates.
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
  - Implement bounded official Data API calls with ETag support.
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeWebSubSubscriptionService.ts`
  - Own subscribe/renew/unsubscribe lifecycle.
- Create: `backend/stellive-hub-api/src/songs/songClassifier.ts`
  - Classify original/cover/unknown deterministically.
- Create: `backend/stellive-hub-api/src/songs/songIngestionService.ts`
  - Normalize, dedupe, classify, and persist songs.
- Create: `backend/stellive-hub-api/src/repositories/songRepository.ts`
  - Encapsulate song list/facet queries and writes.
- Create: `backend/stellive-hub-api/src/routes/songRoutes.ts`
  - Serve cached mobile song APIs.
- Modify: `backend/stellive-hub-api/src/routes/webhookRoutes.ts`
  - Add YouTube WebSub verification/receipt handling if this route exists; otherwise create it and register from `routes.ts`.
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
  - Add protected subscription renewal and capped reconciliation triggers.
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
  - Register song and webhook routes.
- Modify: `backend/stellive-hub-api/src/config/env.ts`
  - Add YouTube env names without committing secrets.
- Modify: `backend/stellive-hub-api/.env.example`
  - Document empty env variables only.

### Android

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
  - Replace `history` primary tab with `songs` and add song filter labels.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
  - Add `renderSongs()`, wire tab navigation, and move history entry into settings.
  - Add `renderDisplaySettings()` for the dedicated `화면 구성` settings page.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
  - Add Android song domain models.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
  - Add backend song response DTOs.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
  - Add local mock songs and facets.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
  - Map `/v1/songs` and `/v1/songs/facets` responses into Android models.
- Add Android tests for tab policy, generation filter exclusion, and song row formatting.

### iOS

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift`
  - Replace `history` primary tab with `songs` in `IOSPrimaryNavigationPolicy.bottomTabs`.
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
  - Render the same filter sequence as Android.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`
  - Add `알림 기록` navigation row inside settings.
  - Add a dedicated `화면 구성` settings destination for summary-card visibility toggles.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
  - Add Swift song domain models.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
  - Add local mock songs and facets.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
  - Map `/v1/songs` and `/v1/songs/facets` responses into Swift models.
- Add iOS tests for tab policy, generation filter exclusion, and song row formatting.

### Docs And Mockups

- Modify: `docs/mockups/song-page-mobile-preview.html`
  - Keep it aligned with generation filter exclusions and mobile UI consistency.
- Modify: `CODEMAP.md`
  - Add every new source/test/doc file.
- Modify: `docs/AI_HANDOFF.md` after implementation
  - Record current status, verification, and unresolved follow-ups.

## Task 1: Shared Song Contracts

**Files:**
- Modify: `shared/schemas/domain.ts`
- Modify: `shared/schemas/mobileApi.ts`
- Modify: `shared/openapi/openapi.yaml`
- Test: `backend/stellive-hub-api/test/mobileSongsContract.test.ts`

- [ ] **Step 1: Add failing contract tests**

  Test expectations:

      import { describe, expect, it } from "vitest";
      import { songTypeValues } from "../../../shared/schemas/domain.js";

      describe("mobile song contract", () => {
        it("keeps song types explicit and stable", () => {
          expect(songTypeValues).toEqual(["original", "cover", "unknown"]);
        });

        it("excludes gamja and official from song generation filters", () => {
          const filters = ["all", "gen1", "gen2", "gen3"];
          expect(filters).not.toContain("gamja");
          expect(filters).not.toContain("official");
          expect(filters).not.toContain("gen4-upcoming");
        });

        it("models YouTube thumbnail dimensions for aspect-ratio rendering", () => {
          const thumbnail = { url: "https://i.ytimg.com/vi/video-id/maxresdefault.jpg", width: 1280, height: 720 };
          expect(thumbnail.width / thumbnail.height).toBeCloseTo(16 / 9, 3);
        });

        it("keeps summary card visibility page-scoped", () => {
          const displaySettings = { summaryCards: { songs: true, live: true, hubEvents: true, home: true } };
          expect(displaySettings.summaryCards.songs).toBe(true);
        });
      });

- [ ] **Step 2: Run contract test and verify RED**

  Run: `rtk npm test -- mobileSongsContract` from `backend/stellive-hub-api`.

  Expected: FAIL because `songTypeValues` and song DTOs do not exist yet.

- [ ] **Step 3: Add shared DTOs**

  Add explicit shared types for song type, generation filters, song thumbnail dimensions, song list item, facet counts, summary-card display settings, and paginated response. Ensure generation filter values are only `all`, `gen1`, `gen2`, and `gen3`.

- [ ] **Step 4: Update OpenAPI**

  Add `GET /v1/songs` query parameters: `generationId`, `memberId`, `type`, `q`, `cursor`, `limit`.

  Add `GET /v1/songs/facets` response with generation, member, and type counts.

- [ ] **Step 5: Run contract test and OpenAPI lint/build path**

  Run: `rtk npm test -- mobileSongsContract` and `rtk npm run build` from `backend/stellive-hub-api`.

  Expected: PASS.

## Task 2: YouTube Channel State And Song Storage

**Files:**
- Modify: `backend/stellive-hub-api/prisma/schema.prisma`
- Create: `backend/stellive-hub-api/src/repositories/songRepository.ts`
- Test: `backend/stellive-hub-api/test/songRepository.test.ts`

- [ ] **Step 1: Write repository tests**

  Cover these cases:

  - upsert by `youtube:upload:<channelId>:<videoId>` dedupe key;
  - query excludes non-generation entries from generation facets;
  - query filters by generation, member, and song type;
  - unknown songs are not counted as original or cover.

- [ ] **Step 2: Run repository tests and verify RED**

  Run: `rtk npm test -- songRepository` from `backend/stellive-hub-api`.

  Expected: FAIL because repository and Prisma model do not exist.

- [ ] **Step 3: Add Prisma models**

  Add models with these minimum fields:

      YoutubeChannelState:
        memberId, channelId, topicUrl, status, subscribedAt, expiresAt, lastRenewAttemptAt, lastSuccessfulReceiptAt, etag, newestVideoId

      Song:
        id, youtubeVideoId, youtubeChannelId, dedupeKey, title, memberId, generationId, songType, classificationConfidence, sourceUrl, thumbnailUrl, thumbnailWidth, thumbnailHeight, duration, privacyStatus, publishedAt, createdAt, updatedAt

      SongClassificationOverride:
        youtubeVideoId, songType, reason, updatedBy, updatedAt

- [ ] **Step 4: Implement repository**

  Repository methods:

  - `upsertSongFromYoutubeUpload(candidate)`;
  - `listSongs(filters)`;
  - `songFacets()`;
  - `upsertYoutubeChannelState(state)`;
  - `channelsNeedingWebSubRenewal(now)`.

- [ ] **Step 5: Run tests**

  Run: `rtk npm test -- songRepository` and `rtk npm run prisma:generate`.

  Expected: PASS.

## Task 3: Atom Parser And Song Classifier

**Files:**
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeAtomParser.ts`
- Create: `backend/stellive-hub-api/src/songs/songClassifier.ts`
- Test: `backend/stellive-hub-api/test/youtubeAtomParser.test.ts`
- Test: `backend/stellive-hub-api/test/songClassifier.test.ts`

- [ ] **Step 1: Write parser tests**

  Required assertions:

  - parser extracts only `videoId`, `channelId`, `title`, `publishedAt`, `updatedAt`, and `sourceUrl`;
  - parser ignores live-event fields and does not classify official live events;
  - invalid or missing video/channel IDs return a typed parse error without raw payload persistence.

- [ ] **Step 2: Write classifier tests**

  Required assertions:

  - `커버`, `cover`, `歌ってみた`, and `covered by` classify as `cover`;
  - `오리지널`, `original song`, and `official mv` classify as `original` when no cover marker is present;
  - mixed original and cover markers classify as `unknown`;
  - empty metadata classifies as `unknown`.

- [ ] **Step 3: Run parser/classifier tests and verify RED**

  Run: `rtk npm test -- youtubeAtomParser songClassifier`.

  Expected: FAIL because parser/classifier do not exist.

- [ ] **Step 4: Implement parser and classifier**

  Keep the parser dependency-light and reject any attempt to persist full raw Atom XML.

- [ ] **Step 5: Run tests**

  Run: `rtk npm test -- youtubeAtomParser songClassifier`.

  Expected: PASS.

## Task 4: WebSub Routes And Subscription Renewal

**Files:**
- Create/Modify: `backend/stellive-hub-api/src/routes/webhookRoutes.ts`
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeWebSubSubscriptionService.ts`
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Modify: `backend/stellive-hub-api/src/config/env.ts`
- Modify: `backend/stellive-hub-api/.env.example`
- Test: `backend/stellive-hub-api/test/youtubeWebSubRoutes.test.ts`
- Test: `backend/stellive-hub-api/test/youtubeWebSubSubscriptionService.test.ts`

- [ ] **Step 1: Write route tests**

  Required assertions:

  - GET verification validates token and returns `hub.challenge` exactly;
  - POST rejects oversized bodies;
  - POST passes parsed candidates to ingestion service;
  - invalid Atom payload returns 202 with diagnostic state when retry would not help, or 400 when validation clearly fails before parsing.

- [ ] **Step 2: Write subscription service tests**

  Required assertions:

  - topic URL uses stored channel ID;
  - renewal candidates are selected before expiry;
  - failed renewal marks channel `degraded` without increasing reconciliation frequency;
  - no secret values are logged.

- [ ] **Step 3: Run tests and verify RED**

  Run: `rtk npm test -- youtubeWebSubRoutes youtubeWebSubSubscriptionService`.

  Expected: FAIL because routes/service do not exist.

- [ ] **Step 4: Implement route and renewal service**

  Add env names only:

      YOUTUBE_API_KEY=
      YOUTUBE_WEBSUB_CALLBACK_URL=
      YOUTUBE_WEBSUB_VERIFY_TOKEN=
      YOUTUBE_SONG_BACKFILL_MAX_PAGES=1
      YOUTUBE_SONG_RECONCILE_MAX_CHANNELS=10

- [ ] **Step 5: Run tests**

  Run: `rtk npm test -- youtubeWebSubRoutes youtubeWebSubSubscriptionService`.

  Expected: PASS.

## Task 5: Data API Client, Backfill, And Capped Reconciliation

**Files:**
- Create: `backend/stellive-hub-api/src/adapters/youtube/youtubeDataApiClient.ts`
- Create: `backend/stellive-hub-api/src/songs/songBackfillService.ts`
- Modify: `backend/stellive-hub-api/src/routes/internalRoutes.ts`
- Test: `backend/stellive-hub-api/test/youtubeDataApiClient.test.ts`
- Test: `backend/stellive-hub-api/test/songBackfillService.test.ts`

- [ ] **Step 1: Write low-load client tests**

  Required assertions:

  - parser fixtures match official `channelListResponse`, `playlistItemListResponse`, and `videoListResponse` JSON wrappers with `kind`, `etag`, `pageInfo`, and `items[]`;
  - channel parsing reads `contentDetails.relatedPlaylists.uploads` from `youtube#channel` items;
  - playlist item parsing reads video IDs from `contentDetails.videoId` and `snippet.resourceId.videoId`;
  - video parsing reads `snippet.tags[]`, `contentDetails.duration`, `status.privacyStatus`, `snippet.liveBroadcastContent`, and thumbnail width/height;
  - client sends `If-None-Match` when an ETag is stored;
  - 304 responses do not enqueue processing;
  - playlist page count respects `YOUTUBE_SONG_BACKFILL_MAX_PAGES`;
  - reconciliation stops after first page when no unseen videos are found;
  - `videos.list` batches up to 50 IDs.

- [ ] **Step 2: Run tests and verify RED**

  Run: `rtk npm test -- youtubeDataApiClient songBackfillService`.

  Expected: FAIL because client/service do not exist.

- [ ] **Step 3: Implement Data API client**

  Implement only these operations:

  - resolve channel by handle when channel ID is missing;
  - get uploads playlist ID for a channel;
  - list uploads playlist items with page cap and ETag;
  - fetch video details by explicit IDs for metadata recovery.

- [ ] **Step 4: Implement backfill/reconciliation service**

  Rules:

  - backfill is admin/internal-triggered, not per app launch;
  - reconciliation is scheduled and capped;
  - service records quota-unit estimates in diagnostics;
  - service never stores full raw API responses long term.

- [ ] **Step 5: Run tests**

  Run: `rtk npm test -- youtubeDataApiClient songBackfillService`.

  Expected: PASS.

## Task 6: Mobile Song API

**Files:**
- Create: `backend/stellive-hub-api/src/routes/songRoutes.ts`
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Test: `backend/stellive-hub-api/test/songRoutes.test.ts`

- [ ] **Step 1: Write route tests**

  Required assertions:

  - `GET /v1/songs/facets` returns only `all`, `gen1`, `gen2`, and `gen3` generation filters;
  - `GET /v1/songs?generationId=gamja` returns 400 or an empty validated result according to shared contract; recommended: 400 `unsupported_song_generation_filter`;
  - `GET /v1/songs?type=original` returns only original songs;
  - search does not call YouTube and uses repository data only;
  - each song item can include `thumbnail: { url, width, height }` and the API never returns downloaded image bytes;
  - display settings include `summaryCards.songs` so the app can hide the song summary card;
  - responses include cache headers suitable for short client/proxy caching.

- [ ] **Step 2: Run route tests and verify RED**

  Run: `rtk npm test -- songRoutes`.

  Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement route**

  Suggested cache behavior:

  - facets: `Cache-Control: private, max-age=60`;
  - list: `Cache-Control: private, max-age=30`;
  - no YouTube API calls from route handlers.

- [ ] **Step 4: Register route and run tests**

  Run: `rtk npm test -- songRoutes` and `rtk npm run build`.

  Expected: PASS.

## Task 7: Android Song UI

**Files:**
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MainUiPolicy.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/model/Models.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/core/network/HubApiModels.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/MockHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/minepacu/stelliveeventnotifier/feature/home/ServerHubRepository.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/MainUiPolicyTest.kt`
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/minepacu/stelliveeventnotifier/SongUiPolicyTest.kt`

- [ ] **Step 1: Write Android policy tests**

  Required assertions:

  - primary nav labels are `홈`, `라이브`, `노래`, `굿즈/행사`;
  - settings contains an `알림 기록` row;
  - settings contains a dedicated `화면 구성` page with `노래 요약 카드 표시`;
  - song generation filters are `전체`, `1기생`, `2기생`, `3기생`;
  - no `감자` or `기타` filter appears on the song page.
  - member selection is not implemented as the primary horizontal scroll rail; it exposes a selected-state card and a full member selection action.
  - song rows render a YouTube thumbnail ratio slot using thumbnail width/height instead of square artwork.

- [ ] **Step 2: Run Android tests and verify RED**

  Run: `rtk ./gradlew :app:testDebugUnitTest --tests dev.minepacu.stelliveeventnotifier.MainUiPolicyTest --tests dev.minepacu.stelliveeventnotifier.SongUiPolicyTest` from `android/StelliveHubAndroid`.

  Expected: FAIL until policy and UI exist.

- [ ] **Step 3: Implement Android UI**

  Keep the order and row fields aligned with the mockup and iOS plan. Use the YouTube thumbnail URL only as a runtime HTTPS display URL with fallback; never store or bundle image binaries.

- [ ] **Step 4: Run Android tests**

  Run the same focused test command.

  Expected: PASS.

## Task 8: iOS Song UI

**Files:**
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/ContentView.swift`
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/SongsView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/SettingsView.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/ServerHubStore.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`
- Test: `ios/StelliveHubiOS/StelliveHubiOSTests/SongUiPolicyTests.swift`

- [ ] **Step 1: Write iOS policy tests**

  Required assertions:

  - primary nav labels are `홈`, `라이브`, `노래`, `굿즈/행사`;
  - settings exposes `알림 기록`;
  - settings exposes a dedicated `화면 구성` destination with `노래 요약 카드 표시`;
  - song generation filters are `전체`, `1기생`, `2기생`, `3기생`;
  - no `감자` or `기타` filter appears on the song page.
  - member selection is not implemented as the primary horizontal scroll rail; it exposes a selected-state card and a full member selection action.
  - song rows render a YouTube thumbnail ratio slot using thumbnail width/height instead of square artwork.

- [ ] **Step 2: Run iOS tests and verify RED**

  Run: `rtk xcodebuild test -project ios/StelliveHubiOS/StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:StelliveHubiOSTests/SongUiPolicyTests`.

  Expected: FAIL until policy and UI exist.

- [ ] **Step 3: Implement iOS UI**

  Keep the same screen order and filter semantics as Android. SwiftUI may use native `Picker`/segmented style and a sheet for full member selection, but labels, counts, empty states, thumbnail ratio behavior, and row data must match Android.

- [ ] **Step 4: Run iOS tests**

  Run the same focused XCTest command.

  Expected: PASS.

## Task 9: End-To-End Verification And Docs

**Files:**
- Modify: `docs/mockups/song-page-mobile-preview.html`
- Modify: `CODEMAP.md`
- Modify: `docs/AI_HANDOFF.md`

- [ ] **Step 1: Verify policy grep**

  Run: `rtk rg -n "Former|gamja|official|official_youtube|youtube_live|scrap|cookie|thumbnail|logo" shared backend android ios docs`.

  Expected: matches are policy references, explicit exclusions, or existing safe code only.

- [ ] **Step 2: Run backend verification**

  Run from `backend/stellive-hub-api`: `rtk npm run build` and `rtk npm test`.

  Expected: PASS.

- [ ] **Step 3: Run mobile focused tests**

  Run Android and iOS focused tests from Tasks 7 and 8.

  Expected: PASS, or document simulator/sandbox blockers in `docs/AI_HANDOFF.md`.

- [ ] **Step 4: Update docs**

  Update `CODEMAP.md` for new files and update `docs/AI_HANDOFF.md` with completed status, verification, and any blocked checks.

## Self-Review

- Spec coverage: the plan covers the song tab, generation/member/type filters, gamja/official exclusion from generation categories, efficient non-horizontal member selection, YouTube thumbnail ratio handling, summary-card display settings, backend YouTube ingestion, actual YouTube Data API JSON response shapes, low-load operation, and Android/iOS UI consistency.
- Placeholder scan: the plan avoids unresolved placeholder markers and does not leave backend behavior unspecified. Unknown song classification is explicitly modeled as `unknown` with a recommended MVP visibility rule.
- Type consistency: `SongType`, route names, filter values, and dedupe key shape are consistent across shared contracts, backend tasks, and mobile UI tasks.
- Policy check: the plan keeps YouTube access backend-only, excludes official YouTube live events, avoids media asset storage, and does not reintroduce Former members.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-youtube-song-page-ingestion-plan.md`.

Recommended execution order: backend contract and storage first, ingestion second, mobile API third, Android/iOS UI last. This keeps mobile work tied to a stable DTO contract and minimizes rework.
