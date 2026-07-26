import { describe, expect, it } from "vitest";

import {
  buildApp,
  createMusicMemberAliasInputs,
  createMusicMemberUpsertInputs,
  musicConfigurationWarnings,
} from "../src/app.js";
import { loadEnv } from "../src/config/env.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false",
};

describe("music app wiring", () => {
  it("builds DB upsert inputs for every target music member channel", () => {
    const inputs = createMusicMemberUpsertInputs();
    const ids = inputs.map((input) => input.id).sort();

    expect(ids).toEqual([
      "akane-lize",
      "aokumo-rin",
      "arahashi-tabi",
      "ayatsuno-yuni",
      "hanako-nana",
      "neneko-mashiro",
      "sakihane-huya",
      "shirayuki-hina",
      "tenko-shibuki",
      "yuzuha-riko",
    ]);
    expect(inputs.every((input) => typeof input.youtubeChannelId === "string" && input.youtubeChannelId.startsWith("UC"))).toBe(true);
    expect(inputs.find((input) => input.id === "stellive-official")).toBeUndefined();
  });

  it("uses the same target music members for automatic member matching", () => {
    const inputs = createMusicMemberAliasInputs();
    const ids = inputs.map((input) => input.id).sort();

    expect(ids).toEqual(createMusicMemberUpsertInputs().map((input) => input.id).sort());
    expect(ids).not.toContain("stellive-official");
    expect(inputs.find((input) => input.id === "yuzuha-riko")).toMatchObject({
      nameKo: "유즈하 리코",
      nameEn: "Yuzuha Riko",
      unitName: "Cliche",
    });
  });

  it("loadEnv parses music sync cache and official playlist defaults", () => {
    const env = loadEnv(baseEnv);

    expect(env.MUSIC_SYNC_ENABLED).toBe(false);
    expect(env.MUSIC_CACHE_TTL_SECONDS).toBe(600);
    expect(env.MUSIC_CACHE_STALE_SECONDS).toBe(600);
    expect(env.MUSIC_CACHE_MAX_ENTRIES).toBe(256);
    expect(env.MUSIC_SYNC_LOCK_SECONDS).toBe(30);
    expect(env.LIGHT_SYNC_INTERVAL_MINUTES).toBe(10);
    expect(env.FULL_SYNC_INTERVAL_MINUTES).toBe(60);
    expect(env.STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES).toBe(60);
    expect(env.MUSIC_LIGHT_SYNC_MAX_PAGES).toBe(2);
    expect(env.YOUTUBE_API_BASE_URL).toBe("https://www.googleapis.com/youtube/v3");
    expect(env.STELLIVE_MUSIC_COVER_PLAYLIST_ID).toBe("PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy");
    expect(env.STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID).toBe("PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX");
    expect(env.MUSIC_CHANNEL_DISCOVERY_SCHEDULER_BASE_URL).toBeUndefined();
  });

  it("reports fixed music configuration warning codes without secret values", () => {
    const env = loadEnv({
      ...baseEnv,
      MUSIC_SYNC_ENABLED: "true",
      MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: "true",
      YOUTUBE_API_KEY: "replace_with_super_secret_key",
      INTERNAL_API_TOKEN: "replace_with_super_secret_token",
    });

    const warnings = musicConfigurationWarnings(env, {
      channelDiscoveryServiceConfigured: false,
    });

    expect(warnings).toEqual([
      "music_sync_youtube_api_not_configured",
      "music_channel_discovery_internal_token_not_configured",
      "music_channel_discovery_service_not_configured",
    ]);
    expect(JSON.stringify(warnings)).not.toContain("super_secret");
  });

  it("buildApp registers public music routes without YouTube API key", async () => {
    const app = await buildApp({ env: baseEnv, useProcessEnv: false });

    const response = await app.inject({ method: "GET", url: "/v1/music?type=bad" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_music_query" });
  });

  it("keeps internal music sync disabled when sync disabled or API key absent", async () => {
    const app = await buildApp({
      env: { ...baseEnv, MUSIC_SYNC_ENABLED: "true" },
      useProcessEnv: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/sync-official-playlists",
      headers: { authorization: "Bearer internal-test-token" },
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "disabled", reason: "official_music_sync_not_configured" });
  });

  it("wires direct ingestion through the shared discovery processor", async () => {
    const youtubeFetch = async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      expect(url.pathname).toBe("/youtube/v3/videos");
      expect(url.searchParams.get("id")).toBe("abcdefghijk");
      return new Response(JSON.stringify({
        items: [{
          id: "abcdefghijk",
          snippet: {
            title: "untrusted external upload",
            channelId: "UC_EXTERNAL_CHANNEL",
            tags: [],
          },
          contentDetails: {},
          status: { privacyStatus: "public" },
        }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const app = await buildApp({
      env: {
        ...baseEnv,
        MUSIC_SYNC_ENABLED: "true",
        YOUTUBE_API_KEY: "youtube-secret-key",
      },
      useProcessEnv: false,
      chzzkLiveApiFetch: youtubeFetch as typeof fetch,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/music/ingest-videos",
      headers: {
        authorization: "Bearer internal-test-token",
        "content-type": "application/json",
      },
      payload: JSON.stringify({ videoIds: ["abcdefghijk"] }),
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("youtube-secret-key");
    expect(response.json()).toEqual({
      items: [{
        videoId: "abcdefghijk",
        status: "skipped",
        action: "skipped_untrusted_channel",
        classificationType: null,
        classificationReason: "untrusted_channel",
        structuredMatchKind: null,
        memberIds: [],
        reviewRequired: false,
        error: null,
      }],
      summary: {
        requested: 1,
        uniqueRequested: 1,
        fetched: 1,
        inserted: 0,
        updated: 0,
        needsReview: 0,
        skipped: 1,
        notFound: 0,
        failed: 0,
        dryRun: false,
      },
    });
  });
});
