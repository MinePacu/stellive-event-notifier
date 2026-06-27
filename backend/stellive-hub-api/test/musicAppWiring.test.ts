import { describe, expect, it } from "vitest";

import { buildApp, createMusicMemberAliasInputs, createMusicMemberUpsertInputs } from "../src/app.js";
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
    const ids = createMusicMemberAliasInputs().map((input) => input.id).sort();

    expect(ids).toEqual(createMusicMemberUpsertInputs().map((input) => input.id).sort());
    expect(ids).not.toContain("stellive-official");
  });

  it("loadEnv parses music sync cache and official playlist defaults", () => {
    const env = loadEnv(baseEnv);

    expect(env.MUSIC_SYNC_ENABLED).toBe(false);
    expect(env.MUSIC_CACHE_TTL_SECONDS).toBe(600);
    expect(env.MUSIC_CACHE_STALE_SECONDS).toBe(600);
    expect(env.MUSIC_SYNC_LOCK_SECONDS).toBe(30);
    expect(env.LIGHT_SYNC_INTERVAL_MINUTES).toBe(10);
    expect(env.FULL_SYNC_INTERVAL_MINUTES).toBe(60);
    expect(env.STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES).toBe(60);
    expect(env.MUSIC_LIGHT_SYNC_MAX_PAGES).toBe(2);
    expect(env.YOUTUBE_API_BASE_URL).toBe("https://www.googleapis.com/youtube/v3");
    expect(env.STELLIVE_MUSIC_COVER_PLAYLIST_ID).toBe("PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy");
    expect(env.STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID).toBe("PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX");
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
});
