import type { MusicCatalogItem, MusicItemType, MusicMemberRole } from "../../../../shared/schemas/domain.js";
import { getPrismaClient } from "../storage/prisma.js";

export type SourcePlaylistRawCategoryHint = "COVER" | "SINGLE" | "EP" | "ORIGINAL" | "OTHERS";
export type MusicSort = "publishedAt_desc" | "publishedAtDesc" | "playlistOrder";

export interface MusicMemberUpsertInput {
  id: string;
  nameKo: string;
  nameEn: string;
  aliases: string[];
  generationOrGroup?: string | null;
  isGraduated?: boolean;
  youtubeChannelId?: string | null;
}

export interface SourcePlaylistUpsertInput {
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  rawCategoryHint: SourcePlaylistRawCategoryHint;
  memberId?: string | null;
  isActive: boolean;
}

export interface MusicItemUpsertInput {
  youtubeVideoId: string;
  title: string;
  normalizedTitle?: string | null;
  description?: string | null;
  type: MusicItemType;
  sourcePlaylistId?: string | null;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  duration?: string | null;
  durationSeconds?: number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  isPublic: boolean;
  privacyStatus?: string | null;
  embeddable?: boolean | null;
  madeForKids?: boolean | null;
  dimension?: string | null;
  definition?: string | null;
  caption?: string | null;
  tags?: unknown;
  isAvailable?: boolean;
  isExcluded?: boolean;
  exclusionReason?: string | null;
  classificationStatus?: string;
  isInstrumental?: boolean;
  specialFlags?: unknown;
  fetchedAt?: Date | null;
  lastSeenAt: Date;
  playlistPosition?: number | null;
  rawCategoryHint?: string | null;
}

export interface MusicItemSourcePlaylistInput {
  musicItemId: string;
  sourcePlaylistId: string;
  youtubePlaylistItemId?: string | null;
  sourcePlaylistTitle?: string | null;
  sourcePlaylistPosition?: number | null;
  sourcePlaylistType: string;
  seenAt: Date;
}

export interface MusicItemMemberInput {
  memberId: string;
  role: MusicMemberRole;
  confidence?: number;
  source?: string;
}

export interface MusicItemOverrideInput {
  musicItemId: string;
  youtubeVideoId: string;
  forcedType?: string | null;
  forcedMemberIds?: string[] | null;
  forceExcluded?: boolean;
  exclusionReason?: string | null;
  note?: string | null;
}

export interface MusicListFilters {
  type?: "all" | "cover" | "original" | "other";
  memberId?: string;
  cursor?: string;
  limit?: number;
  sort?: MusicSort;
  includeGraduated?: boolean;
  includeInstrumental?: boolean;
  includeExcluded?: boolean;
}

export interface MarkMissingFromSourceInput {
  sourcePlaylistId: string;
  seenYoutubeVideoIds: string[];
  missingCheckedAt: Date;
}

export interface MusicSourcePlaylistRecord {
  id: string;
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  rawCategoryHint: SourcePlaylistRawCategoryHint;
  memberId?: string | null;
}

export interface MusicRepositoryDelegate {
  musicMember?: { upsert(args: unknown): Promise<unknown>; findMany?(args: unknown): Promise<unknown[]> };
  sourcePlaylist?: {
    upsert(args: unknown): Promise<unknown>;
    findMany?(args: unknown): Promise<MusicSourcePlaylistRecord[]>;
  };
  musicItem?: {
    upsert?(args: unknown): Promise<unknown>;
    findUnique?(args: unknown): Promise<unknown | null>;
    findMany?(args: unknown): Promise<MusicItemRecord[]>;
    updateMany?(args: unknown): Promise<{ count: number }>;
  };
  musicItemSourcePlaylist?: { upsert(args: unknown): Promise<unknown> };
  musicItemMember?: {
    deleteMany(args: unknown): Promise<unknown>;
    createMany(args: unknown): Promise<unknown>;
  };
  musicItemOverride?: {
    upsert(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown | null>;
  };
}

interface MusicItemRecord {
  id: string;
  youtubeVideoId: string;
  title: string;
  type: string;
  publishedAt?: Date | null;
  playlistPosition?: number | null;
  thumbnailUrl?: string | null;
  duration?: string | null;
  durationSeconds?: number | null;
  isInstrumental?: boolean | null;
  specialFlags?: unknown;
  classificationStatus?: string | null;
  sourcePlaylistId?: string | null;
  members?: Array<{
    role: string;
    member: {
      id: string;
      nameKo: string;
      nameEn: string;
      isGraduated?: boolean;
    };
  }>;
}

function toNullableDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function toMusicCatalogItem(record: MusicItemRecord): MusicCatalogItem {
  return {
    id: record.id,
    youtubeVideoId: record.youtubeVideoId,
    title: record.title,
    type: record.type as MusicItemType,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    thumbnailUrl: record.thumbnailUrl ?? null,
    duration: record.duration ?? null,
    durationSeconds: record.durationSeconds ?? null,
    isInstrumental: record.isInstrumental ?? false,
    specialFlags: Array.isArray(record.specialFlags) ? record.specialFlags : [],
    classificationStatus: record.classificationStatus ?? undefined,
    members: (record.members ?? []).map((link) => ({
      id: link.member.id,
      nameKo: link.member.nameKo,
      nameEn: link.member.nameEn,
      role: link.role as MusicMemberRole,
    })),
    youtubeUrl: `https://www.youtube.com/watch?v=${record.youtubeVideoId}`,
    sourcePlaylistId: record.sourcePlaylistId ?? null,
  };
}

interface MusicCursorPayload {
  v: 1;
  sort: MusicSort;
  id: string;
  publishedAt?: string | null;
  playlistPosition?: number | null;
}

function normalizedMusicSort(sort: MusicSort | undefined): MusicSort {
  return sort === "playlistOrder" ? "playlistOrder" : "publishedAt_desc";
}

function encodeMusicCursor(record: MusicItemRecord, sort: MusicSort): string {
  const payload: MusicCursorPayload = {
    v: 1,
    sort,
    id: record.id,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    playlistPosition: record.playlistPosition ?? null,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeMusicCursor(cursor: string | undefined): MusicCursorPayload | { legacyId: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<MusicCursorPayload>;
    if (parsed.v === 1 && typeof parsed.id === "string") return parsed as MusicCursorPayload;
  } catch {
    return { legacyId: cursor };
  }
  return { legacyId: cursor };
}

function appendCursorWhere(where: Record<string, unknown>, cursor: MusicCursorPayload | { legacyId: string } | null): void {
  if (!cursor) return;
  if ("legacyId" in cursor) {
    where.id = { gt: cursor.legacyId };
    return;
  }
  const publishedAt = cursor.publishedAt ? new Date(cursor.publishedAt) : null;
  if (cursor.sort === "playlistOrder") {
    const playlistPosition = cursor.playlistPosition ?? null;
    where.OR = [
      { playlistPosition: { gt: playlistPosition ?? -1 } },
      {
        playlistPosition,
        publishedAt: { lt: publishedAt ?? new Date(0) },
      },
      {
        playlistPosition,
        publishedAt,
        id: { gt: cursor.id },
      },
    ];
    return;
  }
  where.OR = [
    { publishedAt: { lt: publishedAt ?? new Date(0) } },
    {
      publishedAt,
      id: { gt: cursor.id },
    },
  ];
}

export class PrismaMusicRepository {
  constructor(private readonly prisma: MusicRepositoryDelegate = getPrismaClient() as unknown as MusicRepositoryDelegate) {}

  async upsertMember(input: MusicMemberUpsertInput): Promise<unknown> {
    const data = {
      id: input.id,
      nameKo: input.nameKo,
      nameEn: input.nameEn,
      aliases: input.aliases,
      generationOrGroup: input.generationOrGroup,
      isGraduated: input.isGraduated ?? false,
      youtubeChannelId: input.youtubeChannelId,
    };
    return this.prisma.musicMember!.upsert({
      where: { id: input.id },
      create: data,
      update: data,
    });
  }

  async upsertSourcePlaylist(input: SourcePlaylistUpsertInput): Promise<unknown> {
    return this.prisma.sourcePlaylist!.upsert({
      where: { youtubePlaylistId: input.youtubePlaylistId },
      create: input,
      update: input,
    });
  }

  async upsertOfficialSourcePlaylists(seeds: SourcePlaylistUpsertInput[]): Promise<unknown[]> {
    return Promise.all(seeds.map((seed) => this.upsertSourcePlaylist(seed)));
  }

  async listActiveSourcePlaylists(): Promise<MusicSourcePlaylistRecord[]> {
    return this.prisma.sourcePlaylist!.findMany!({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { title: "asc" }],
    });
  }

  async upsertMusicItem(input: MusicItemUpsertInput): Promise<unknown> {
    const data = {
      youtubeVideoId: input.youtubeVideoId,
      title: input.title,
      normalizedTitle: input.normalizedTitle,
      description: input.description,
      type: input.type,
      sourcePlaylistId: input.sourcePlaylistId,
      publishedAt: toNullableDate(input.publishedAt),
      thumbnailUrl: input.thumbnailUrl,
      thumbnailWidth: input.thumbnailWidth,
      thumbnailHeight: input.thumbnailHeight,
      duration: input.duration,
      durationSeconds: input.durationSeconds,
      channelId: input.channelId,
      channelTitle: input.channelTitle,
      isPublic: input.isPublic,
      privacyStatus: input.privacyStatus,
      embeddable: input.embeddable,
      madeForKids: input.madeForKids,
      dimension: input.dimension,
      definition: input.definition,
      caption: input.caption,
      tags: input.tags,
      isAvailable: input.isAvailable ?? input.isPublic,
      isExcluded: input.isExcluded ?? false,
      exclusionReason: input.exclusionReason,
      classificationStatus: input.classificationStatus ?? "AUTO_CLASSIFIED",
      isInstrumental: input.isInstrumental ?? false,
      specialFlags: input.specialFlags ?? [],
      fetchedAt: input.fetchedAt,
      lastSeenAt: input.lastSeenAt,
      playlistPosition: input.playlistPosition,
      rawCategoryHint: input.rawCategoryHint,
      missingCount: 0,
    };

    return this.prisma.musicItem!.upsert!({
      where: { youtubeVideoId: input.youtubeVideoId },
      create: data,
      update: data,
    });
  }

  async upsertMusicItemSourcePlaylist(input: MusicItemSourcePlaylistInput): Promise<unknown> {
    return this.prisma.musicItemSourcePlaylist!.upsert({
      where: {
        musicItemId_sourcePlaylistId: {
          musicItemId: input.musicItemId,
          sourcePlaylistId: input.sourcePlaylistId,
        },
      },
      create: input,
      update: input,
    });
  }

  async getMusicItemByVideoId(videoId: string): Promise<unknown | null> {
    return this.prisma.musicItem!.findUnique?.({ where: { youtubeVideoId: videoId } }) ?? null;
  }

  async getOverrideByVideoId(videoId: string): Promise<unknown | null> {
    return this.prisma.musicItemOverride!.findUnique({ where: { youtubeVideoId: videoId } });
  }

  async upsertMusicItemOverride(input: MusicItemOverrideInput): Promise<unknown> {
    const data = {
      musicItemId: input.musicItemId,
      youtubeVideoId: input.youtubeVideoId,
      forcedType: input.forcedType,
      forcedMemberIds: input.forcedMemberIds ?? undefined,
      forceExcluded: input.forceExcluded ?? false,
      exclusionReason: input.exclusionReason,
      note: input.note,
    };
    return this.prisma.musicItemOverride!.upsert({
      where: { youtubeVideoId: input.youtubeVideoId },
      create: data,
      update: data,
    });
  }

  async replaceMusicItemMembers(musicItemId: string, links: MusicItemMemberInput[]): Promise<void> {
    await this.prisma.musicItemMember!.deleteMany({ where: { musicItemId } });
    if (links.length === 0) return;
    await this.prisma.musicItemMember!.createMany({
      data: links.map((link) => ({
        musicItemId,
        memberId: link.memberId,
        role: link.role,
        confidence: link.confidence ?? 0,
        source: link.source ?? "UNKNOWN",
      })),
      skipDuplicates: true,
    });
  }

  async listMusicItems(filters: MusicListFilters): Promise<{ items: MusicCatalogItem[]; nextCursor?: string | null }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const where: Record<string, unknown> = {
      isPublic: true,
      isAvailable: true,
    };
    if (filters.type && filters.type !== "all") where.type = filters.type;
    if (filters.includeExcluded !== true) where.isExcluded = false;
    if (filters.includeInstrumental !== true) where.isInstrumental = false;
    if (filters.memberId) {
      where.members = {
        some: {
          memberId: filters.memberId,
          ...(filters.includeGraduated === true ? {} : { member: { isGraduated: false } }),
        },
      };
    } else if (filters.includeGraduated !== true) {
      where.members = { some: { member: { isGraduated: false } } };
    }
    const sort = normalizedMusicSort(filters.sort);
    appendCursorWhere(where, decodeMusicCursor(filters.cursor));

    const orderBy = sort === "playlistOrder"
      ? [{ playlistPosition: "asc" }, { publishedAt: "desc" }, { id: "asc" }]
      : [{ publishedAt: "desc" }, { id: "asc" }];

    const rows = await this.prisma.musicItem!.findMany!({
      where,
      include: { members: { include: { member: true } } },
      orderBy,
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toMusicCatalogItem),
      nextCursor: rows.length > limit && last ? encodeMusicCursor(last, sort) : null,
    };
  }

  async listReviewCandidates(filters: { limit?: number } = {}): Promise<MusicCatalogItem[]> {
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const rows = await this.prisma.musicItem!.findMany!({
      where: {
        isPublic: true,
        OR: [
          { classificationStatus: "NEEDS_REVIEW" },
          { isExcluded: true },
          { isAvailable: false },
        ],
      },
      include: { members: { include: { member: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limit,
    });
    return rows.map(toMusicCatalogItem);
  }

  async getMusicItem(id: string): Promise<MusicCatalogItem | null> {
    const record = await this.prisma.musicItem!.findUnique?.({
      where: { id },
      include: { members: { include: { member: true } } },
    }) as MusicItemRecord | null | undefined;
    return record ? toMusicCatalogItem(record) : null;
  }

  async listMusicMembers(): Promise<Array<{ id: string; nameKo: string; nameEn: string }>> {
    return this.prisma.musicMember!.findMany?.({
      where: { isGraduated: false },
      orderBy: [{ id: "asc" }],
      select: { id: true, nameKo: true, nameEn: true },
    }) as Promise<Array<{ id: string; nameKo: string; nameEn: string }>>;
  }

  async markMissingFromSource(input: MarkMissingFromSourceInput): Promise<{ missingCount: number }> {
    const result = await this.prisma.musicItem!.updateMany!({
      where: {
        sourcePlaylistId: input.sourcePlaylistId,
        youtubeVideoId: { notIn: input.seenYoutubeVideoIds },
      },
      data: {
        isPublic: false,
        isAvailable: false,
        privacyStatus: "UNKNOWN_OR_REMOVED",
        missingCount: { increment: 1 },
      },
    });
    return { missingCount: result.count };
  }
}

export interface MusicSyncRunDelegate {
  musicSyncRun?: {
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown[]>;
  };
}

export interface MusicSyncRunStartInput {
  syncType: "light" | "full" | "daily" | "manual" | "websub";
  source: string;
  sourcePlaylistId?: string | null;
  startedAt: Date;
}

export interface MusicSyncRunFinishInput {
  finishedAt: Date;
  quotaUnits: number;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  missingCount: number;
  metadata?: unknown;
}

export interface MusicSyncRunFailInput {
  finishedAt: Date;
  errorMessage: string;
  quotaUnits: number;
}

export class PrismaMusicSyncRunRepository {
  constructor(private readonly prisma: MusicSyncRunDelegate = getPrismaClient() as unknown as MusicSyncRunDelegate) {}

  async startRun(input: MusicSyncRunStartInput): Promise<{ id: string }> {
    return this.prisma.musicSyncRun!.create({
      data: {
        ...input,
        status: "running",
      },
    });
  }

  async finishRun(id: string, input: MusicSyncRunFinishInput): Promise<unknown> {
    return this.prisma.musicSyncRun!.update({
      where: { id },
      data: {
        ...input,
        status: "completed",
      },
    });
  }

  async failRun(id: string, input: MusicSyncRunFailInput): Promise<unknown> {
    return this.prisma.musicSyncRun!.update({
      where: { id },
      data: {
        ...input,
        status: "failed",
      },
    });
  }

  async listRecent(limit: number): Promise<unknown[]> {
    return this.prisma.musicSyncRun!.findMany({
      orderBy: [{ startedAt: "desc" }],
      take: limit,
    });
  }
}
