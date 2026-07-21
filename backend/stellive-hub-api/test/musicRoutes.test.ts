import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { MusicCatalogDetail, MusicCatalogItem } from "../../../shared/schemas/domain.js";
import { ResponseCache } from "../src/cache/responseCache.js";
import registerMusicRoutes from "../src/routes/musicRoutes.js";

const item: MusicCatalogItem = {
  id: "music-1",
  youtubeVideoId: "video-1",
  title: "유니 cover",
  type: "cover",
  publishedAt: "2026-06-21T12:00:00.000Z",
  catalogAddedAt: "2026-07-01T00:00:00.000Z",
  thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
  duration: "PT3M21S",
  durationSeconds: 201,
  isInstrumental: false,
  specialFlags: [],
  members: [{ id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "main" }],
  youtubeUrl: "https://www.youtube.com/watch?v=video-1",
  sourcePlaylistId: "source-1",
  premiere: {
    classification: "assumed",
    state: "scheduled",
    scheduledStartAt: "2026-07-01T12:00:00.000Z",
    actualStartAt: null,
    actualEndAt: null,
  },
};

const detailItem: MusicCatalogDetail = {
  ...item,
  sourcePlaylists: [{
    youtubePlaylistId: "PL_PRIMARY",
    title: "COVER",
    type: "cover",
    youtubeUrl: "https://www.youtube.com/playlist?list=PL_PRIMARY",
    isPrimary: true,
  }],
};

async function buildRouteApp(cachePolicy = { ttlMs: 300_000, staleMs: 600_000 }) {
  const repository = {
    listMusicItems: vi.fn(async () => ({ items: [item], nextCursor: "next" })),
    getMusicItem: vi.fn(async (id: string) => (id === "music-1" ? detailItem : null)),
    listMusicMembers: vi.fn(async () => [
      { id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni" },
    ]),
  };
  const app = Fastify({ logger: false });
  await registerMusicRoutes(app, {
    repository,
    cache: new ResponseCache(),
    cachePolicy,
    registerMembersListRoute: true,
  });
  return { app, repository };
}

describe("music routes", () => {
  it("GET /v1/music validates query returns cached music list", async () => {
    const { app, repository } = await buildRouteApp();

    const response = await app.inject({ method: "GET", url: "/v1/music?type=cover&limit=20&sort=publishedAt_desc" });
    const cached = await app.inject({ method: "GET", url: "/v1/music?sort=publishedAt_desc&limit=20&type=cover" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=300, stale-while-revalidate=600");
    expect(response.json()).toEqual({ items: [item], nextCursor: "next", serverTime: expect.any(String) });
    expect(cached.json()).toEqual(response.json());
    expect(repository.listMusicItems).toHaveBeenCalledTimes(1);
    expect(repository.listMusicItems).toHaveBeenCalledWith({
      type: "cover",
      limit: 20,
      sort: "publishedAt_desc",
    });
  });

  it("normalizes the default and publishedAtDesc alias into one repository sort and cache entry", async () => {
    const { app, repository } = await buildRouteApp();
    const cursor = Buffer.from(JSON.stringify({
      v: 3,
      sort: "publishedAt_desc",
      publishedAt: "2026-07-01T00:00:00.000Z",
      id: "music-1",
    })).toString("base64url");

    const defaultResponse = await app.inject({ method: "GET", url: `/v1/music?cursor=${cursor}` });
    const aliasResponse = await app.inject({ method: "GET", url: `/v1/music?sort=publishedAtDesc&cursor=${cursor}` });
    const canonicalResponse = await app.inject({ method: "GET", url: `/v1/music?sort=publishedAt_desc&cursor=${cursor}` });
    await app.close();

    expect(defaultResponse.statusCode).toBe(200);
    expect(aliasResponse.json()).toEqual(defaultResponse.json());
    expect(canonicalResponse.json()).toEqual(defaultResponse.json());
    expect(repository.listMusicItems).toHaveBeenCalledTimes(1);
    expect(repository.listMusicItems).toHaveBeenCalledWith({
      type: "all",
      cursor,
      sort: "publishedAt_desc",
    });
  });

  it("keeps playlistOrder in a separate cache entry", async () => {
    const { app, repository } = await buildRouteApp();

    await app.inject({ method: "GET", url: "/v1/music" });
    await app.inject({ method: "GET", url: "/v1/music?sort=playlistOrder" });
    await app.close();

    expect(repository.listMusicItems).toHaveBeenCalledTimes(2);
    expect(repository.listMusicItems).toHaveBeenNthCalledWith(1, { type: "all", sort: "publishedAt_desc" });
    expect(repository.listMusicItems).toHaveBeenNthCalledWith(2, { type: "all", sort: "playlistOrder" });
  });

  it("rejects a cursor issued for a different sort", async () => {
    const { app, repository } = await buildRouteApp();
    const cursor = Buffer.from(JSON.stringify({
      v: 3,
      sort: "playlistOrder",
      playlistPosition: 1,
      publishedAt: "2026-07-01T00:00:00.000Z",
      id: "music-1",
    })).toString("base64url");

    const response = await app.inject({ method: "GET", url: `/v1/music?sort=publishedAt_desc&cursor=${cursor}` });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_music_query" });
    expect(repository.listMusicItems).not.toHaveBeenCalled();
  });

  it("GET /v1/music accepts official playlist sort and include filters", async () => {
    const { app, repository } = await buildRouteApp();

    const response = await app.inject({
      method: "GET",
      url: "/v1/music?type=original&sort=playlistOrder&includeGraduated=true&includeInstrumental=true&includeExcluded=true",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(repository.listMusicItems).toHaveBeenCalledWith({
      type: "original",
      sort: "playlistOrder",
      includeGraduated: true,
      includeInstrumental: true,
      includeExcluded: true,
    });
  });

  it("uses the injected cache policy for cache-control headers", async () => {
    const { app } = await buildRouteApp({ ttlMs: 12_900, staleMs: 34_800 });

    const response = await app.inject({ method: "GET", url: "/v1/music" });
    await app.close();

    expect(response.headers["cache-control"]).toBe("private, max-age=12, stale-while-revalidate=34");
  });

  it("rejects invalid list query values", async () => {
    const { app } = await buildRouteApp();
    const response = await app.inject({ method: "GET", url: "/v1/music?type=live&limit=300" });
    const invalidSort = await app.inject({ method: "GET", url: "/v1/music?sort=newest" });
    const rawCursor = await app.inject({ method: "GET", url: "/v1/music?cursor=music-legacy-id" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_music_query" });
    expect(invalidSort.statusCode).toBe(400);
    expect(rawCursor.statusCode).toBe(400);
  });

  it("GET /v1/music/:id returns detail or 404", async () => {
    const { app } = await buildRouteApp();
    const detail = await app.inject({ method: "GET", url: "/v1/music/music-1" });
    const missing = await app.inject({ method: "GET", url: "/v1/music/missing" });
    await app.close();

    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual(detailItem);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: "music_not_found" });
  });

  it("GET /v1/members and /v1/members/:id/music use music repository only", async () => {
    const { app, repository } = await buildRouteApp();

    const members = await app.inject({ method: "GET", url: "/v1/members" });
    const memberMusic = await app.inject({ method: "GET", url: "/v1/members/ayatsuno-yuni/music?type=all" });
    await app.close();

    expect(members.statusCode).toBe(200);
    expect(members.json()).toEqual({ items: [{ id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni" }] });
    expect(memberMusic.statusCode).toBe(200);
    expect(repository.listMusicItems).toHaveBeenLastCalledWith({
      type: "all",
      memberId: "ayatsuno-yuni",
      sort: "publishedAt_desc",
    });
  });
});
