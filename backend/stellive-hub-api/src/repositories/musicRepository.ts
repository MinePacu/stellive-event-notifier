import type { MusicCatalogItem, MusicItemType, MusicMemberRole } from "../../../../shared/schemas/domain.js";
import { getPrismaClient } from "../storage/prisma.js";

export interface MusicMemberUpsertInput {
  id: string;
  nameKo: string;
  nameEn: string;
  aliases: string[];
  youtubeChannelId?: string | null;
}

export interface SourcePlaylistUpsertInput {
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  rawCategoryHint: "COVER" | "SINGLE" | "EP" | "OTHERS";
  memberId?: string | null;
  isActive: boolean;
}

export interface MusicItemUpsertInput {
  youtubeVideoId: string;
  title: string;
  description?: string | null;
  type: MusicItemType;
  sourcePlaylistId?: string | null;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  duration?: string | null;
  channelId?: string | null;
  channelTitle?: string | null;
  isPublic: boolean;
  lastSeenAt: Date;
  playlistPosition?: number | null;
  rawCategoryHint?: string | null;
}

export interface MusicItemMemberInput {
  memberId: string;
  role: MusicMemberRole;
}

export interface MusicListFilters {
  type?: "all" | "cover" | "original" | "other";
  memberId?: string;
  cursor?: string;
  limit?: number;
}

export interface MarkMissingFromSourceInput {
  sourcePlaylistId: string;
  seenYoutubeVideoIds: string[];
  missingCheckedAt: Date;
}

export interface MusicRepositoryDelegate {
  musicMember?: {
    upsert(args: unknown): Promise<unknown>;
  };
  sourcePlaylist?: {
    upsert(args: unknown): Promise<unknown>;
  };
  musicItem?: {
    upsert?(args: unknown): Promise<unknown>;
    findMany?(args: unknown): Promise<MusicItemRecord[]>;
    updateMany?(args: unknown): Promise<{ count: number }>;
  };
  musicItemMember?: {
    deleteMany(args: unknown): Promise<unknown>;
    createMany(args: unknown): Promise<unknown>;
  };
}

interface MusicItemRecord {
  id: string;
  youtubeVideoId: string;
  title: string;
  type: string;
  publishedAt?: Date | null;
  thumbnailUrl?: string | null;
  duration?: string | null;
  sourcePlaylistId?: string | null;
  members?: Array<{
    role: string;
    member: {
      id: string;
      nameKo: string;
      nameEn: string;
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

export class PrismaMusicRepository {
  constructor(private readonly prisma: MusicRepositoryDelegate = getPrismaClient() as unknown as MusicRepositoryDelegate) {}

  async upsertMember(input: MusicMemberUpsertInput): Promise<unknown> {
    return this.prisma.musicMember!.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        nameKo: input.nameKo,
        nameEn: input.nameEn,
        aliases: input.aliases,
        youtubeChannelId: input.youtubeChannelId,
      },
      update: {
        nameKo: input.nameKo,
        nameEn: input.nameEn,
        aliases: input.aliases,
        youtubeChannelId: input.youtubeChannelId,
      },
    });
  }

  async upsertSourcePlaylist(input: SourcePlaylistUpsertInput): Promise<unknown> {
    return this.prisma.sourcePlaylist!.upsert({
      where: { youtubePlaylistId: input.youtubePlaylistId },
      create: input,
      update: input,
    });
  }

  async upsertMusicItem(input: MusicItemUpsertInput): Promise<unknown> {
    const data = {
      youtubeVideoId: input.youtubeVideoId,
      title: input.title,
      description: input.description,
      type: input.type,
      sourcePlaylistId: input.sourcePlaylistId,
      publishedAt: toNullableDate(input.publishedAt),
      thumbnailUrl: input.thumbnailUrl,
      thumbnailWidth: input.thumbnailWidth,
      thumbnailHeight: input.thumbnailHeight,
      duration: input.duration,
      channelId: input.channelId,
      channelTitle: input.channelTitle,
      isPublic: input.isPublic,
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

  async replaceMusicItemMembers(musicItemId: string, links: MusicItemMemberInput[]): Promise<void> {
    await this.prisma.musicItemMember!.deleteMany({ where: { musicItemId } });
    if (links.length === 0) return;
    await this.prisma.musicItemMember!.createMany({
      data: links.map((link) => ({ musicItemId, memberId: link.memberId, role: link.role })),
      skipDuplicates: true,
    });
  }

  async listMusicItems(filters: MusicListFilters): Promise<{ items: MusicCatalogItem[]; nextCursor: string | null }> {
    const limit = filters.limit ?? 30;
    const where: Record<string, unknown> = { isPublic: true };
    if (filters.type && filters.type !== "all") where.type = filters.type;
    if (filters.memberId) where.members = { some: { memberId: filters.memberId } };
    if (filters.cursor) where.id = { gt: filters.cursor };

    const records = await this.prisma.musicItem!.findMany!({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: limit + 1,
      include: { members: { include: { member: true } } },
    });

    return {
      items: records.slice(0, limit).map(toMusicCatalogItem),
      nextCursor: records.length > limit ? records[limit].id : null,
    };
  }

  async markMissingFromSource(input: MarkMissingFromSourceInput): Promise<{ missingCount: number }> {
    const result = await this.prisma.musicItem!.updateMany!({
      where: {
        sourcePlaylistId: input.sourcePlaylistId,
        youtubeVideoId: { notIn: input.seenYoutubeVideoIds },
      },
      data: {
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
