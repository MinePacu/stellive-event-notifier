import type {
  MobileSongType,
  SongCatalogItem,
  SongCatalogGenerationId,
  SongFacetSummary,
  SongFilterCount,
  SongGenerationFilterId,
} from "../../../../shared/schemas/domain.js";
import { getPrismaClient } from "../storage/prisma.js";

export type SongListTypeFilter = "all" | "original" | "cover";

export interface SongListFilters {
  generationId?: SongGenerationFilterId;
  memberId?: string;
  type?: SongListTypeFilter;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface SongFacetsResult {
  summary: SongFacetSummary;
  generationFilters: SongFilterCount[];
  memberFilters: SongFilterCount[];
  typeFilters: SongFilterCount[];
}

export interface SongRepository {
  listSongs(filters: SongListFilters): Promise<{ items: SongCatalogItem[]; nextCursor?: string | null }>;
  facets(filters: Omit<SongListFilters, "cursor" | "limit">): Promise<SongFacetsResult>;
}

export interface YoutubeSongUpsertInput {
  youtubeVideoId: string;
  youtubeChannelId: string;
  dedupeKey: string;
  title: string;
  memberId: string;
  memberName: string;
  generationId: SongCatalogGenerationId;
  generationName: string;
  songType: MobileSongType;
  classificationConfidence?: number;
  sourceUrl: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  duration?: string;
  privacyStatus?: string;
  youtubePresentationType?: "regular" | "premiere_assumed";
  youtubePremiereState?: "scheduled" | "live" | "completed" | "unknown" | null;
  youtubeScheduledStartAt?: string | null;
  youtubeActualStartAt?: string | null;
  youtubeActualEndAt?: string | null;
  youtubeMetadataFetchedAt?: Date | null;
  listingPriority?: number;
  publishedAt: string;
}

interface SongRecord {
  id: string;
  youtubeVideoId: string;
  title: string;
  memberId: string;
  memberName: string;
  generationId: string;
  generationName: string;
  songType: string;
  sourceUrl: string;
  thumbnailUrl?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  youtubePresentationType?: string | null;
  youtubePremiereState?: string | null;
  youtubeScheduledStartAt?: Date | null;
  youtubeActualStartAt?: Date | null;
  youtubeActualEndAt?: Date | null;
  listingPriority?: number | null;
  publishedAt: Date;
}

interface SongCursorPayload {
  v: 2;
  listingPriority: number;
  scheduledStartAt: string | null;
  publishedAt: string;
  id: string;
}

interface SongDelegate {
  song: {
    upsert(args: { where: { dedupeKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<SongRecord>;
    findMany(args: Record<string, unknown>): Promise<SongRecord[]>;
  };
}

function toDate(value: string): Date {
  return new Date(value);
}

function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function decodeSongCursor(cursor: string | undefined): SongCursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<SongCursorPayload>;
    if (parsed.v === 2 && typeof parsed.id === "string" && typeof parsed.listingPriority === "number" && typeof parsed.publishedAt === "string") {
      return parsed as SongCursorPayload;
    }
  } catch {
    return null;
  }
  return null;
}

function encodeSongCursor(record: SongRecord): string {
  const payload: SongCursorPayload = {
    v: 2,
    listingPriority: record.listingPriority ?? 2,
    scheduledStartAt: record.youtubeScheduledStartAt?.toISOString() ?? null,
    publishedAt: record.publishedAt.toISOString(),
    id: record.id,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function appendSongCursor(where: Record<string, unknown>, cursor: SongCursorPayload | null): void {
  if (!cursor) return;
  const scheduledStartAt = cursor.scheduledStartAt ? new Date(cursor.scheduledStartAt) : null;
  const branches: Record<string, unknown>[] = [{ listingPriority: { gt: cursor.listingPriority } }];
  if (cursor.listingPriority < 2) {
    branches.push(...(scheduledStartAt
      ? [
          { listingPriority: cursor.listingPriority, youtubeScheduledStartAt: { gt: scheduledStartAt } },
          { listingPriority: cursor.listingPriority, youtubeScheduledStartAt: scheduledStartAt, id: { gt: cursor.id } },
        ]
      : [
          { listingPriority: cursor.listingPriority, youtubeScheduledStartAt: { not: null } },
          { listingPriority: cursor.listingPriority, youtubeScheduledStartAt: null, id: { gt: cursor.id } },
        ]));
  } else {
    const publishedAt = new Date(cursor.publishedAt);
    branches.push(
      { listingPriority: cursor.listingPriority, publishedAt: { lt: publishedAt } },
      { listingPriority: cursor.listingPriority, publishedAt, id: { gt: cursor.id } },
    );
  }
  where.AND = [{ OR: branches }];
}

function toSongCatalogItem(record: SongRecord): SongCatalogItem {
  return {
    id: record.id,
    youtubeVideoId: record.youtubeVideoId,
    title: record.title,
    memberId: record.memberId,
    memberName: record.memberName,
    generationId: record.generationId as SongCatalogGenerationId,
    generationName: record.generationName,
    type: record.songType as MobileSongType,
    sourceUrl: record.sourceUrl,
    thumbnail: record.thumbnailUrl && record.thumbnailWidth && record.thumbnailHeight ? {
      url: record.thumbnailUrl,
      width: record.thumbnailWidth,
      height: record.thumbnailHeight,
    } : undefined,
    publishedAt: record.publishedAt.toISOString(),
    ...(record.youtubePresentationType === "premiere_assumed" && record.youtubePremiereState
      ? {
          premiere: {
            classification: "assumed" as const,
            state: record.youtubePremiereState as "scheduled" | "live" | "completed" | "unknown",
            scheduledStartAt: record.youtubeScheduledStartAt?.toISOString() ?? null,
            actualStartAt: record.youtubeActualStartAt?.toISOString() ?? null,
            actualEndAt: record.youtubeActualEndAt?.toISOString() ?? null,
          },
        }
      : {}),
  };
}

function listWhere(filters: SongListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.generationId && filters.generationId !== "all") where.generationId = filters.generationId;
  if (filters.memberId && filters.memberId !== "all") where.memberId = filters.memberId;
  if (filters.type && filters.type !== "all") where.songType = filters.type;
  if (filters.q?.trim()) {
    const query = filters.q.trim();
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { memberName: { contains: query, mode: "insensitive" } },
    ];
  }
  return where;
}

const emptyGenerationFilters: SongFilterCount[] = [
  { id: "all", label: "전체", count: 0 },
  { id: "gen1", label: "1기생", count: 0 },
  { id: "gen2", label: "2기생", count: 0 },
  { id: "gen3", label: "3기생", count: 0 },
];

const emptyTypeFilters: SongFilterCount[] = [
  { id: "all", label: "전체", count: 0 },
  { id: "original", label: "오리지널", count: 0 },
  { id: "cover", label: "커버", count: 0 },
];

export class EmptySongRepository implements SongRepository {
  async listSongs(): Promise<{ items: SongCatalogItem[]; nextCursor: null }> {
    return { items: [], nextCursor: null };
  }

  async facets(): Promise<SongFacetsResult> {
    return {
      summary: { total: 0, original: 0, cover: 0 },
      generationFilters: emptyGenerationFilters,
      memberFilters: [{ id: "all", label: "전체", generationId: "all", count: 0 }],
      typeFilters: emptyTypeFilters,
    };
  }
}

export class PrismaSongRepository implements SongRepository {
  constructor(private readonly prisma: SongDelegate = getPrismaClient() as unknown as SongDelegate) {}

  async upsertSongFromYoutubeUpload(input: YoutubeSongUpsertInput): Promise<SongCatalogItem> {
    const data = {
      youtubeVideoId: input.youtubeVideoId,
      youtubeChannelId: input.youtubeChannelId,
      dedupeKey: input.dedupeKey,
      title: input.title,
      memberId: input.memberId,
      memberName: input.memberName,
      generationId: input.generationId,
      generationName: input.generationName,
      songType: input.songType,
      classificationConfidence: input.classificationConfidence,
      sourceUrl: input.sourceUrl,
      thumbnailUrl: input.thumbnailUrl,
      thumbnailWidth: input.thumbnailWidth,
      thumbnailHeight: input.thumbnailHeight,
      duration: input.duration,
      privacyStatus: input.privacyStatus,
      ...(input.youtubePresentationType !== undefined ? {
        youtubePresentationType: input.youtubePresentationType,
        youtubePremiereState: input.youtubePremiereState ?? null,
        youtubeScheduledStartAt: toDateOrNull(input.youtubeScheduledStartAt),
        youtubeActualStartAt: toDateOrNull(input.youtubeActualStartAt),
        youtubeActualEndAt: toDateOrNull(input.youtubeActualEndAt),
        youtubeMetadataFetchedAt: input.youtubeMetadataFetchedAt ?? null,
        listingPriority: input.listingPriority ?? 2,
      } : {}),
      publishedAt: toDate(input.publishedAt),
    };

    const record = await this.prisma.song.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: {
        ...data,
        youtubePresentationType: input.youtubePresentationType ?? "regular",
        youtubePremiereState: input.youtubePremiereState ?? null,
        youtubeScheduledStartAt: toDateOrNull(input.youtubeScheduledStartAt),
        youtubeActualStartAt: toDateOrNull(input.youtubeActualStartAt),
        youtubeActualEndAt: toDateOrNull(input.youtubeActualEndAt),
        youtubeMetadataFetchedAt: input.youtubeMetadataFetchedAt ?? null,
        listingPriority: input.listingPriority ?? 2,
      },
      update: data,
    });
    return toSongCatalogItem(record);
  }

  async listSongs(filters: SongListFilters): Promise<{ items: SongCatalogItem[]; nextCursor: string | null }> {
    const limit = filters.limit ?? 30;
    const where = listWhere(filters);
    appendSongCursor(where, decodeSongCursor(filters.cursor));
    const records = await this.prisma.song.findMany({
      where,
      orderBy: [{ listingPriority: "asc" }, { youtubeScheduledStartAt: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
      take: limit + 1,
    });
    const visible = records.slice(0, limit);
    const last = visible.at(-1);
    const nextCursor = records.length > limit && last ? encodeSongCursor(last) : null;
    return { items: visible.map(toSongCatalogItem), nextCursor };
  }

  async facets(): Promise<SongFacetsResult> {
    return new EmptySongRepository().facets();
  }
}
