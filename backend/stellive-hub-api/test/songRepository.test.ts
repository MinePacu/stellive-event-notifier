import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PrismaSongRepository } from "../src/repositories/songRepository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prismaSchema = readFileSync(resolve(__dirname, "../prisma/schema.prisma"), "utf8");

describe("Prisma song schema", () => {
  it("defines normalized song storage and YouTube channel state", () => {
    expect(prismaSchema).toContain("model Song");
    expect(prismaSchema).toContain("dedupeKey                 String   @unique");
    expect(prismaSchema).toContain("@@index([generationId])");
    expect(prismaSchema).toContain("@@index([memberId])");
    expect(prismaSchema).toContain("@@index([songType])");
    expect(prismaSchema).toContain("model YoutubeChannelState");
    expect(prismaSchema).toContain("model SongClassificationOverride");
  });
});

describe("PrismaSongRepository", () => {
  it("upserts normalized YouTube upload songs by dedupe key", async () => {
    const calls: unknown[] = [];
    const repository = new PrismaSongRepository({
      song: {
        async upsert(args: unknown) {
          calls.push(args);
          return {
            id: "song-1",
            youtubeVideoId: "abc123",
            title: "별빛 항로",
            memberId: "akane-lize",
            memberName: "아카네 리제",
            generationId: "gen2",
            generationName: "2기생",
            songType: "original",
            sourceUrl: "https://www.youtube.com/watch?v=abc123",
            thumbnailUrl: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
            thumbnailWidth: 1280,
            thumbnailHeight: 720,
            publishedAt: new Date("2026-06-21T12:00:00.000Z"),
          };
        },
        async findMany() {
          return [];
        },
      },
    });

    const song = await repository.upsertSongFromYoutubeUpload({
      youtubeVideoId: "abc123",
      youtubeChannelId: "UC123",
      dedupeKey: "youtube:upload:UC123:abc123",
      title: "별빛 항로",
      memberId: "akane-lize",
      memberName: "아카네 리제",
      generationId: "gen2",
      generationName: "2기생",
      songType: "original",
      classificationConfidence: 0.8,
      sourceUrl: "https://www.youtube.com/watch?v=abc123",
      thumbnailUrl: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
      thumbnailWidth: 1280,
      thumbnailHeight: 720,
      publishedAt: "2026-06-21T12:00:00.000Z",
    });

    expect(calls).toEqual([expect.objectContaining({
      where: { dedupeKey: "youtube:upload:UC123:abc123" },
      create: expect.objectContaining({ youtubeVideoId: "abc123", generationId: "gen2", songType: "original" }),
      update: expect.objectContaining({ title: "별빛 항로", songType: "original" }),
    })]);
    expect(song).toMatchObject({ id: "song-1", generationId: "gen2", type: "original" });
    expect(song.thumbnail).toEqual({ url: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg", width: 1280, height: 720 });
  });

  it("queries songs with supported mobile filters", async () => {
    const calls: unknown[] = [];
    const repository = new PrismaSongRepository({
      song: {
        async upsert() {
          return {
            id: "unused",
            youtubeVideoId: "unused",
            title: "unused",
            memberId: "unused",
            memberName: "unused",
            generationId: "gen1",
            generationName: "1기생",
            songType: "cover",
            sourceUrl: "https://www.youtube.com/watch?v=unused",
            publishedAt: new Date("2026-06-21T12:00:00.000Z"),
          };
        },
        async findMany(args: unknown) {
          calls.push(args);
          return [];
        },
      },
    });

    await repository.listSongs({ generationId: "gen2", type: "cover", q: "커버", limit: 10 });

    expect(calls).toEqual([expect.objectContaining({
      where: {
        generationId: "gen2",
        songType: "cover",
        OR: [
          { title: { contains: "커버", mode: "insensitive" } },
          { memberName: { contains: "커버", mode: "insensitive" } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 11,
    })]);
  });
});
