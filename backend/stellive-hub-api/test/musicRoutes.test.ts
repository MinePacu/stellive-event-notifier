import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { MusicCatalogItem } from "../../../shared/schemas/domain.js";
import { ResponseCache } from "../src/cache/responseCache.js";
import registerMusicRoutes from "../src/routes/musicRoutes.js";

const item: MusicCatalogItem = {
  id: "music-1",
  youtubeVideoId: "video-1",
  title: "유니 cover",
  type: "cover",
  publishedAt: "2026-06-21T12:00:00.000Z",
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

async function buildRouteApp() {
  const repository = {
    listMusicItems: vi.fn(async () => ({ items: [item], nextCursor: "next" })),
    getMusicItem: vi.fn(async (id: string) => (id === "music-1" ? item : null)),
    listMusicMembers: vi.fn(async () => [
      { id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni" },
    ]),
  };
  const app = Fastify({ logger: false });
  await registerMusicRoutes(app, {
    repository,
    cache: new ResponseCache(),
    cachePolicy: { ttlMs: 300_000, staleMs: 600_000 },
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
    expect(response.json()).toEqual({ items: [item], nextCursor: "next" });
    expect(cached.json()).toEqual({ items: [item], nextCursor: "next" });
    expect(repository.listMusicItems).toHaveBeenCalledTimes(1);
    expect(repository.listMusicItems).toHaveBeenCalledWith({
      type: "cover",
      limit: 20,
      sort: "publishedAt_desc",
    });
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

  it("rejects invalid list query values", async () => {
    const { app } = await buildRouteApp();
    const response = await app.inject({ method: "GET", url: "/v1/music?type=live&limit=300" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_music_query" });
  });

  it("GET /v1/music/:id returns detail or 404", async () => {
    const { app } = await buildRouteApp();
    const detail = await app.inject({ method: "GET", url: "/v1/music/music-1" });
    const missing = await app.inject({ method: "GET", url: "/v1/music/missing" });
    await app.close();

    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual(item);
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
