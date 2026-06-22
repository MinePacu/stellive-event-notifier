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
  publishedAt: Date;
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
      publishedAt: toDate(input.publishedAt),
    };

    const record = await this.prisma.song.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: data,
      update: data,
    });
    return toSongCatalogItem(record);
  }

  async listSongs(filters: SongListFilters): Promise<{ items: SongCatalogItem[]; nextCursor: string | null }> {
    const limit = filters.limit ?? 30;
    const records = await this.prisma.song.findMany({
      where: listWhere(filters),
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: limit + 1,
    });
    const visible = records.slice(0, limit);
    const nextCursor = records.length > limit ? records[limit].id : null;
    return { items: visible.map(toSongCatalogItem), nextCursor };
  }

  async facets(): Promise<SongFacetsResult> {
    return new EmptySongRepository().facets();
  }
}
