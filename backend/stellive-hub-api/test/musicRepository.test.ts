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
      youtubePresentationType: "premiere_assumed",
      youtubePremiereState: "scheduled",
      youtubeScheduledStartAt: "2026-07-01T12:00:00.000Z",
      youtubeActualStartAt: null,
      youtubeActualEndAt: null,
      youtubeMetadataFetchedAt: new Date("2026-06-28T00:00:00.000Z"),
      listingPriority: 1,
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
        youtubePremiereState: "scheduled",
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
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          thumbnailUrl: null,
          duration: null,
          durationSeconds: 201,
          isInstrumental: false,
          specialFlags: [],
          youtubePresentationType: "premiere_assumed",
          youtubePremiereState: "scheduled",
          youtubeScheduledStartAt: new Date("2026-07-01T12:00:00.000Z"),
          youtubeActualStartAt: null,
          youtubeActualEndAt: null,
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
    catalogAddedAt: "2026-07-01T00:00:00.000Z",
    premiere: {
      classification: "assumed",
      state: "scheduled",
      scheduledStartAt: "2026-07-01T12:00:00.000Z",
    },
  });
});

it("uses published date, id, and null-last cursor conditions for published music pages", async () => {
  const prisma = {
    musicItem: {
      findMany: vi.fn(async () => []),
    },
  };
  const repository = new PrismaMusicRepository(prisma);
  const cursor = Buffer.from(JSON.stringify({
    v: 3,
    sort: "publishedAt_desc",
    publishedAt: "2026-07-01T00:00:00.000Z",
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
        { publishedAt: { lt: new Date("2026-07-01T00:00:00.000Z") } },
        {
          publishedAt: new Date("2026-07-01T00:00:00.000Z"),
          id: { gt: "music-100" },
        },
        { publishedAt: null },
      ],
    }),
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: 101,
  }));
});

it("continues a published music page inside the null-date partition by id", async () => {
  const prisma = { musicItem: { findMany: vi.fn(async () => []) } };
  const repository = new PrismaMusicRepository(prisma);
  const cursor = Buffer.from(JSON.stringify({
    v: 3,
    sort: "publishedAt_desc",
    publishedAt: null,
    id: "music-null-2",
  })).toString("base64url");

  await repository.listMusicItems({ cursor, sort: "publishedAt_desc" });

  expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      publishedAt: null,
      id: { gt: "music-null-2" },
    }),
  }));
});

it("orders completed premieres only by published date and emits a v3 cursor", async () => {
  const rows = [
    {
      id: "music-a",
      youtubeVideoId: "video-a",
      title: "Older completed premiere",
      type: "cover",
      publishedAt: new Date("2025-01-01T00:00:00.000Z"),
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      listingPriority: 2,
      youtubePremiereState: "completed",
      youtubeScheduledStartAt: new Date("2025-01-02T00:00:00.000Z"),
      isInstrumental: false,
      specialFlags: [],
      members: [],
    },
    {
      id: "music-b",
      youtubeVideoId: "video-b",
      title: "Newer regular upload",
      type: "cover",
      publishedAt: new Date("2026-07-20T00:00:00.000Z"),
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
      listingPriority: 2,
      youtubePremiereState: null,
      youtubeScheduledStartAt: null,
      isInstrumental: false,
      specialFlags: [],
      members: [],
    },
  ];
  const prisma = {
    musicItem: {
      findMany: vi.fn(async ({ orderBy }: { orderBy: unknown }) => {
        expect(orderBy).toEqual([{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }]);
        return [rows[1], rows[0]];
      }),
    },
  };
  const repository = new PrismaMusicRepository(prisma);

  const result = await repository.listMusicItems({ sort: "publishedAt_desc", limit: 1 });
  const decoded = JSON.parse(Buffer.from(result.nextCursor!, "base64url").toString("utf8"));

  expect(result.items.map((entry) => entry.id)).toEqual(["music-b"]);
  expect(decoded).toEqual({
    v: 3,
    sort: "publishedAt_desc",
    publishedAt: "2026-07-20T00:00:00.000Z",
    id: "music-b",
  });
});

it("converts a v2 published cursor using only publishedAt and id", async () => {
  const prisma = { musicItem: { findMany: vi.fn(async () => []) } };
  const repository = new PrismaMusicRepository(prisma);
  const cursor = Buffer.from(JSON.stringify({
    v: 2,
    sort: "publishedAt_desc",
    listingPriority: 0,
    scheduledStartAt: "2030-01-01T00:00:00.000Z",
    publishedAt: "2026-07-01T00:00:00.000Z",
    id: "music-100",
  })).toString("base64url");

  await repository.listMusicItems({ cursor, sort: "publishedAt_desc" });

  expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      OR: [
        { publishedAt: { lt: new Date("2026-07-01T00:00:00.000Z") } },
        { publishedAt: new Date("2026-07-01T00:00:00.000Z"), id: { gt: "music-100" } },
        { publishedAt: null },
      ],
    }),
  }));
});

it("walks every published page once with dates descending, nulls last, and ids ascending", async () => {
  const record = (id: string, publishedAt: string | null, completedPremiere = false) => ({
    id,
    youtubeVideoId: `video-${id}`,
    title: id,
    type: "cover",
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
    listingPriority: completedPremiere ? 0 : 2,
    youtubePremiereState: completedPremiere ? "completed" : null,
    youtubeScheduledStartAt: completedPremiere ? new Date("2030-01-01T00:00:00.000Z") : null,
    isInstrumental: false,
    specialFlags: [],
    members: [],
  });
  const ordered = [
    record("music-20-a", "2026-07-20T00:00:00.000Z", true),
    record("music-20-b", "2026-07-20T00:00:00.000Z"),
    record("music-19", "2026-07-19T00:00:00.000Z"),
    record("music-18", "2026-07-18T00:00:00.000Z", true),
    record("music-17", "2026-07-17T00:00:00.000Z"),
    record("music-16", "2026-07-16T00:00:00.000Z"),
    record("music-null-a", null),
    record("music-null-b", null, true),
  ];
  const prisma = {
    musicItem: {
      findMany: vi.fn(async ({ where, take }: { where: Record<string, any>; take: number }) => {
        let page = ordered;
        if (Array.isArray(where.OR)) {
          page = ordered.filter((entry) => where.OR.some((condition: Record<string, any>) => {
            if (condition.publishedAt === null) return entry.publishedAt === null;
            if (condition.publishedAt?.lt) {
              return entry.publishedAt !== null && entry.publishedAt < condition.publishedAt.lt;
            }
            return entry.publishedAt?.getTime() === condition.publishedAt?.getTime() && entry.id > condition.id.gt;
          }));
        } else if (where.publishedAt === null) {
          page = ordered.filter((entry) => entry.publishedAt === null && entry.id > where.id.gt);
        }
        return page.slice(0, take);
      }),
    },
  };
  const repository = new PrismaMusicRepository(prisma);
  const seen: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await repository.listMusicItems({ sort: "publishedAt_desc", cursor, limit: 2 });
    seen.push(...page.items.map((entry) => entry.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  expect(seen).toEqual(ordered.map((entry) => entry.id));
  expect(new Set(seen).size).toBe(ordered.length);
});

it("rejects raw-id legacy cursors that cannot reproduce the active sort tuple", async () => {
  const prisma = { musicItem: { findMany: vi.fn(async () => []) } };
  const repository = new PrismaMusicRepository(prisma);

  await expect(repository.listMusicItems({
    cursor: "music-legacy-id",
    sort: "publishedAt_desc",
  })).rejects.toThrow("invalid_music_cursor");
  expect(prisma.musicItem.findMany).not.toHaveBeenCalled();
});

it("emits a v3 playlist cursor without premiere-priority fields", async () => {
  const row = {
    id: "music-playlist",
    youtubeVideoId: "video-playlist",
    title: "Playlist song",
    type: "cover",
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    playlistPosition: 7,
    listingPriority: 0,
    youtubeScheduledStartAt: new Date("2030-01-01T00:00:00.000Z"),
    isInstrumental: false,
    specialFlags: [],
    members: [],
  };
  const prisma = { musicItem: { findMany: vi.fn(async () => [row, { ...row, id: "music-next" }]) } };
  const repository = new PrismaMusicRepository(prisma);

  const result = await repository.listMusicItems({ sort: "playlistOrder", limit: 1 });

  expect(JSON.parse(Buffer.from(result.nextCursor!, "base64url").toString("utf8"))).toEqual({
    v: 3,
    sort: "playlistOrder",
    playlistPosition: 7,
    publishedAt: "2026-07-01T00:00:00.000Z",
    id: "music-playlist",
  });
});

it("uses playlist position, published date, and id cursor conditions for playlist order music pages", async () => {
  const prisma = {
    musicItem: {
      findMany: vi.fn(async () => []),
    },
  };
  const repository = new PrismaMusicRepository(prisma);
  const cursor = Buffer.from(JSON.stringify({
    v: 2,
    sort: "playlistOrder",
    listingPriority: 2,
    scheduledStartAt: null,
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

  it("marks missing source items by last seen time without a video id list", async () => {
    const prisma = { musicItem: { updateMany: vi.fn(async () => ({ count: 2 })) } };
    const repository = new PrismaMusicRepository(prisma);
    const syncStartedAt = new Date("2026-06-22T00:00:00.000Z");

    await expect(repository.markMissingFromSourceByLastSeen({
      sourcePlaylistId: "source-1",
      seenAtOrAfter: syncStartedAt,
      missingCheckedAt: new Date("2026-06-22T00:10:00.000Z"),
    })).resolves.toEqual({ missingCount: 2 });

    expect(prisma.musicItem.updateMany).toHaveBeenCalledWith({
      where: { sourcePlaylistId: "source-1", lastSeenAt: { lt: syncStartedAt } },
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

  it("returns primary-first deduplicated source playlists for music detail", async () => {
    const primary = {
      id: "source-1",
      youtubePlaylistId: "PL_PRIMARY",
      title: "Primary",
      type: "cover" as const,
      rawCategoryHint: "COVER" as const,
      memberId: null,
    };
    const secondary = {
      id: "source-2",
      youtubePlaylistId: "PL_SECONDARY",
      title: "Secondary",
      type: "other" as const,
      rawCategoryHint: "OTHERS" as const,
      memberId: null,
    };
    const findUnique = vi.fn(async () => ({
      id: "music-1",
      youtubeVideoId: "video-1",
      title: "Song",
      type: "cover",
      sourcePlaylistId: primary.id,
      specialFlags: ["short_or_preview", 123, null],
      sourcePlaylist: primary,
      sourcePlaylists: [
        { sourcePlaylist: secondary },
        { sourcePlaylist: primary },
      ],
      members: [],
    }));
    const repository = new PrismaMusicRepository({ musicItem: { findUnique } });

    await expect(repository.getMusicItem("music-1")).resolves.toMatchObject({
      specialFlags: ["short_or_preview"],
      sourcePlaylists: [
        {
          youtubePlaylistId: "PL_PRIMARY",
          youtubeUrl: "https://www.youtube.com/playlist?list=PL_PRIMARY",
          isPrimary: true,
        },
        {
          youtubePlaylistId: "PL_SECONDARY",
          youtubeUrl: "https://www.youtube.com/playlist?list=PL_SECONDARY",
          isPrimary: false,
        },
      ],
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "music-1" },
      include: {
        members: { include: { member: true } },
        sourcePlaylist: true,
        sourcePlaylists: { include: { sourcePlaylist: true } },
      },
    });
  });

  it("bulk loads existing discovery metadata by YouTube video id", async () => {
    const rows = [{ id: "music-1", youtubeVideoId: "video-1", title: "Song", type: "cover" }];
    const prisma = { musicItem: { findMany: vi.fn(async () => rows) } };
    const repository = new PrismaMusicRepository(prisma);

    await expect(repository.getMusicItemsByVideoIds(["video-1", "video-2"])).resolves.toEqual(rows);
    expect(prisma.musicItem.findMany).toHaveBeenCalledWith({
      where: { youtubeVideoId: { in: ["video-1", "video-2"] } },
    });
  });

  it("preserves existing premiere fields when a sync upsert has no broadcast metadata", async () => {
    const upsert = vi.fn(async (_args: unknown) => ({ id: "music-1", youtubeVideoId: "video-1" }));
    const repository = new PrismaMusicRepository({ musicItem: { upsert } });

    await repository.upsertMusicItem({
      youtubeVideoId: "video-1",
      title: "Song",
      type: "cover",
      isPublic: true,
      lastSeenAt: new Date("2026-06-28T00:00:00.000Z"),
    });

    const args = upsert.mock.calls[0][0] as { create: Record<string, unknown>; update: Record<string, unknown> };
    expect(args.create).toMatchObject({ youtubePresentationType: "regular", listingPriority: 2 });
    expect(args.update).not.toHaveProperty("youtubePresentationType");
    expect(args.update).not.toHaveProperty("youtubePremiereState");
    expect(args.update).not.toHaveProperty("createdAt");
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
