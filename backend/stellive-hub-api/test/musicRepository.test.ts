import { describe, expect, it, vi } from "vitest";

import {
  PrismaMusicRepository,
  PrismaMusicSyncRunRepository,
} from "../src/repositories/musicRepository.js";

describe("PrismaMusicRepository", () => {
  it("upserts extended music members, source playlists, music items, source mappings, member links, and overrides", async () => {
    const prisma = {
      musicMember: { upsert: vi.fn(async (args: unknown) => args) },
      sourcePlaylist: { upsert: vi.fn(async () => ({ id: "source-1", youtubePlaylistId: "PL_COVER" })) },
      musicItem: {
        upsert: vi.fn(async () => ({ id: "music-1", youtubeVideoId: "video-1" })),
        findUnique: vi.fn(async () => ({ id: "music-1", youtubeVideoId: "video-1" })),
      },
      musicItemSourcePlaylist: { upsert: vi.fn(async (args: unknown) => args) },
      musicItemMember: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        createMany: vi.fn(async () => ({ count: 2 })),
      },
      musicItemOverride: {
        upsert: vi.fn(async (args: unknown) => args),
        findUnique: vi.fn(async () => ({ forcedType: "cover" })),
      },
    };

    const repository = new PrismaMusicRepository(prisma);
    await repository.upsertMember({
      id: "akane-lize",
      nameKo: "아카네 리제",
      nameEn: "Akane Lize",
      aliases: ["리제", "Lize"],
      generationOrGroup: "gen2",
      isGraduated: false,
      youtubeChannelId: "UC123",
    });
    await repository.upsertSourcePlaylist({
      youtubePlaylistId: "PL_COVER",
      title: "COVER",
      type: "cover",
      rawCategoryHint: "COVER",
      memberId: null,
      isActive: true,
    });
    const item = await repository.upsertMusicItem({
      youtubeVideoId: "video-1",
      title: "Song",
      normalizedTitle: "song",
      description: "desc",
      type: "cover",
      sourcePlaylistId: "source-1",
      publishedAt: "2026-06-22T00:00:00.000Z",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
      thumbnailWidth: 480,
      thumbnailHeight: 360,
      duration: "PT3M21S",
      durationSeconds: 201,
      channelId: "UC123",
      channelTitle: "Akane Lize",
      isPublic: true,
      privacyStatus: "public",
      embeddable: true,
      madeForKids: false,
      dimension: "2d",
      definition: "hd",
      caption: "false",
      tags: ["cover"],
      isAvailable: true,
      isExcluded: false,
      exclusionReason: null,
      classificationStatus: "AUTO_CLASSIFIED",
      isInstrumental: false,
      specialFlags: [],
      fetchedAt: new Date("2026-06-22T00:00:00.000Z"),
      lastSeenAt: new Date("2026-06-22T00:00:00.000Z"),
      playlistPosition: 0,
      rawCategoryHint: "COVER",
    });
    await repository.upsertMusicItemSourcePlaylist({
      musicItemId: "music-1",
      sourcePlaylistId: "source-1",
      youtubePlaylistItemId: "pli-1",
      sourcePlaylistTitle: "COVER",
      sourcePlaylistPosition: 0,
      sourcePlaylistType: "cover",
      seenAt: new Date("2026-06-22T00:00:00.000Z"),
    });
    await repository.replaceMusicItemMembers("music-1", [
      { memberId: "akane-lize", role: "main", confidence: 1, source: "CHANNEL_ID" },
      { memberId: "ayatsuno-yuni", role: "collaboration", confidence: 0.8, source: "TITLE" },
    ]);
    await repository.upsertMusicItemOverride({
      musicItemId: "music-1",
      youtubeVideoId: "video-1",
      forcedType: "cover",
      forcedMemberIds: ["akane-lize"],
      forceExcluded: false,
      exclusionReason: null,
      note: "confirmed",
    });

    expect(item).toEqual({ id: "music-1", youtubeVideoId: "video-1" });
    expect(prisma.musicMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ generationOrGroup: "gen2", isGraduated: false }),
      update: expect.objectContaining({ generationOrGroup: "gen2", isGraduated: false }),
    }));
    expect(prisma.musicItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        normalizedTitle: "song",
        durationSeconds: 201,
        privacyStatus: "public",
        classificationStatus: "AUTO_CLASSIFIED",
      }),
    }));
    expect(prisma.musicItemSourcePlaylist.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { musicItemId_sourcePlaylistId: { musicItemId: "music-1", sourcePlaylistId: "source-1" } },
    }));
    expect(prisma.musicItemMember.createMany).toHaveBeenCalledWith({
      data: [
        { musicItemId: "music-1", memberId: "akane-lize", role: "main", confidence: 1, source: "CHANNEL_ID" },
        { musicItemId: "music-1", memberId: "ayatsuno-yuni", role: "collaboration", confidence: 0.8, source: "TITLE" },
      ],
      skipDuplicates: true,
    });
    await expect(repository.getOverrideByVideoId("video-1")).resolves.toEqual({ forcedType: "cover" });
  });

  it("lists music items with public default filters, optional graduated/instrumental/excluded filters, and playlist sort", async () => {
    const prisma = {
      musicItem: {
        findMany: vi.fn(async () => [{
          id: "music-1",
          youtubeVideoId: "video-1",
          title: "Song",
          type: "cover",
          publishedAt: new Date("2026-06-22T00:00:00.000Z"),
          thumbnailUrl: null,
          duration: null,
          durationSeconds: 201,
          isInstrumental: false,
          specialFlags: [],
          sourcePlaylistId: "source-1",
          members: [{
            memberId: "akane-lize",
            role: "main",
            member: { id: "akane-lize", nameKo: "아카네 리제", nameEn: "Akane Lize", isGraduated: false },
          }],
        }]),
      },
    };
    const repository = new PrismaMusicRepository(prisma);

    const result = await repository.listMusicItems({
      type: "cover",
      memberId: "akane-lize",
      includeGraduated: false,
      includeInstrumental: false,
      includeExcluded: false,
      sort: "playlistOrder",
      limit: 10,
    });

    expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        type: "cover",
        isPublic: true,
        isAvailable: true,
        isExcluded: false,
        classificationStatus: { in: ["AUTO_CLASSIFIED", "MANUAL_CONFIRMED"] },
        isInstrumental: false,
        members: {
          some: {
            memberId: "akane-lize",
            member: { isGraduated: false },
          },
        },
      },
      orderBy: [{ playlistPosition: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
      take: 11,
    }));
  expect(result.items[0]).toMatchObject({
    youtubeVideoId: "video-1",
    durationSeconds: 201,
    isInstrumental: false,
  });
});

it("uses published date and id cursor conditions for publishedAt descending music pages", async () => {
  const prisma = {
    musicItem: {
      findMany: vi.fn(async () => []),
    },
  };
  const repository = new PrismaMusicRepository(prisma);
  const cursor = Buffer.from(JSON.stringify({
    v: 1,
    sort: "publishedAt_desc",
    publishedAt: "2026-06-01T00:00:00.000Z",
    id: "music-100",
  })).toString("base64url");

  await repository.listMusicItems({
    type: "cover",
    cursor,
    limit: 100,
    sort: "publishedAt_desc",
  });

  expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      OR: [
        { publishedAt: { lt: new Date("2026-06-01T00:00:00.000Z") } },
        {
          publishedAt: new Date("2026-06-01T00:00:00.000Z"),
          id: { gt: "music-100" },
        },
      ],
    }),
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 101,
  }));
});

it("uses playlist position, published date, and id cursor conditions for playlist order music pages", async () => {
  const prisma = {
    musicItem: {
      findMany: vi.fn(async () => []),
    },
  };
  const repository = new PrismaMusicRepository(prisma);
  const cursor = Buffer.from(JSON.stringify({
    v: 1,
    sort: "playlistOrder",
    playlistPosition: 100,
    publishedAt: "2026-06-01T00:00:00.000Z",
    id: "music-100",
  })).toString("base64url");

  await repository.listMusicItems({
    type: "cover",
    cursor,
    limit: 100,
    sort: "playlistOrder",
  });

  expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      OR: [
        { playlistPosition: { gt: 100 } },
        {
          playlistPosition: 100,
          publishedAt: { lt: new Date("2026-06-01T00:00:00.000Z") },
        },
        {
          playlistPosition: 100,
          publishedAt: new Date("2026-06-01T00:00:00.000Z"),
          id: { gt: "music-100" },
        },
      ],
    }),
    orderBy: [{ playlistPosition: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
    take: 101,
  }));
});

  it("marks missing source items conservatively without hard deleting", async () => {
    const prisma = { musicItem: { updateMany: vi.fn(async () => ({ count: 3 })) } };
    const repository = new PrismaMusicRepository(prisma);

    await expect(repository.markMissingFromSource({
      sourcePlaylistId: "source-1",
      seenYoutubeVideoIds: ["video-1"],
      missingCheckedAt: new Date("2026-06-22T00:00:00.000Z"),
    })).resolves.toEqual({ missingCount: 3 });

    expect(prisma.musicItem.updateMany).toHaveBeenCalledWith({
      where: { sourcePlaylistId: "source-1", youtubeVideoId: { notIn: ["video-1"] } },
      data: {
        isPublic: false,
        isAvailable: false,
        privacyStatus: "UNKNOWN_OR_REMOVED",
        missingCount: { increment: 1 },
      },
    });
  });

  it("lists active source playlists for sync wiring", async () => {
    const prisma = {
      sourcePlaylist: {
        upsert: vi.fn(),
        findMany: vi.fn(async () => [{
          id: "source-1",
          youtubePlaylistId: "PL_COVER",
          title: "COVER",
          type: "cover" as const,
          rawCategoryHint: "COVER" as const,
          memberId: null,
        }]),
      },
    };
    const repository = new PrismaMusicRepository(prisma);

    await expect(repository.listActiveSourcePlaylists()).resolves.toEqual([{
      id: "source-1",
      youtubePlaylistId: "PL_COVER",
      title: "COVER",
      type: "cover",
      rawCategoryHint: "COVER",
      memberId: null,
    }]);
    expect(prisma.sourcePlaylist.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { title: "asc" }],
    });
  });

  it("lists and repairs source-backed type mismatches", async () => {
    const prisma = {
      musicItem: {
        findMany: vi.fn(async () => [{
          id: "music-1",
          youtubeVideoId: "video-1",
          title: "Original Song",
          type: "cover",
          rawCategoryHint: "COVER",
          classificationStatus: "AUTO_CLASSIFIED",
          sourcePlaylist: {
            type: "original",
            rawCategoryHint: "ORIGINAL",
          },
        }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const repository = new PrismaMusicRepository(prisma);

    await expect(repository.listSourceTypeMismatches()).resolves.toEqual([{
      id: "music-1",
      youtubeVideoId: "video-1",
      title: "Original Song",
      type: "cover",
      rawCategoryHint: "COVER",
      classificationStatus: "AUTO_CLASSIFIED",
      sourcePlaylist: {
        type: "original",
        rawCategoryHint: "ORIGINAL",
      },
    }]);
    await repository.repairMusicItemSourceType("music-1", "original", "ORIGINAL");

    expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourcePlaylistId: { not: null },
        classificationStatus: { notIn: ["MANUAL_CONFIRMED", "MANUAL_EXCLUDED"] },
      }),
    }));
    expect(prisma.musicItem.updateMany).toHaveBeenCalledWith({
      where: { id: "music-1" },
      data: {
        type: "original",
        rawCategoryHint: "ORIGINAL",
        classificationStatus: "AUTO_CLASSIFIED",
        isExcluded: false,
        exclusionReason: null,
      },
    });
  });
});

describe("PrismaMusicSyncRunRepository", () => {
  it("creates, finishes, fails, lists sync runs", async () => {
    const prisma = {
      musicSyncRun: {
        create: vi.fn(async () => ({ id: "run-1" })),
        update: vi.fn(async (args: unknown) => args),
        findMany: vi.fn(async () => [{ id: "run-1", status: "completed" }]),
      },
    };
    const repository = new PrismaMusicSyncRunRepository(prisma);

    await expect(repository.startRun({
      syncType: "light",
      source: "youtube",
      sourcePlaylistId: "source-1",
      startedAt: new Date("2026-06-22T00:00:00.000Z"),
    })).resolves.toEqual({ id: "run-1" });
    await repository.finishRun("run-1", {
      finishedAt: new Date("2026-06-22T00:01:00.000Z"),
      quotaUnits: 2,
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      missingCount: 0,
    });
    await repository.failRun("run-1", {
      finishedAt: new Date("2026-06-22T00:01:00.000Z"),
      errorMessage: "youtube_forbidden",
      quotaUnits: 1,
    });
    await expect(repository.listRecent(10)).resolves.toEqual([{ id: "run-1", status: "completed" }]);
  });
});
