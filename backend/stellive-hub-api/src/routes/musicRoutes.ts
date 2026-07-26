import type { FastifyInstance } from "fastify";
import type { MusicCatalogDetail, MusicCatalogItem, MusicPublicTypeFilter } from "../../../../shared/schemas/domain.js";
import { ResponseCache, type ResponseCachePolicy } from "../cache/responseCache.js";
import {
  createMusicCatalogDtoMapper,
  type MusicCatalogMemberMetadata,
} from "../music/musicDto.js";
import {
  isMusicCursorValidForSort,
  PrismaMusicRepository,
  type MusicSort,
} from "../repositories/musicRepository.js";

type NormalizedMusicSort = "publishedAt_desc" | "playlistOrder";

export interface MusicRoutesRepository {
  listMusicItems(filters: {
    type?: MusicPublicTypeFilter;
    memberId?: string;
    cursor?: string;
    limit?: number;
    sort?: NormalizedMusicSort;
    includeGraduated?: boolean;
    includeInstrumental?: boolean;
    includeExcluded?: boolean;
  }): Promise<{ items: MusicCatalogItem[]; nextCursor?: string | null }>;
  getMusicItem?(id: string): Promise<MusicCatalogDetail | null>;
  listMusicMembers?(): Promise<Array<{ id: string; nameKo: string; nameEn: string }>>;
}

export interface MusicRoutesOptions {
  repository?: MusicRoutesRepository;
  cache?: ResponseCache;
  cachePolicy?: ResponseCachePolicy;
  registerMembersListRoute?: boolean;
  memberMetadataById?: ReadonlyMap<string, MusicCatalogMemberMetadata>;
}

const defaultCachePolicy = { ttlMs: 300_000, staleMs: 600_000 };
const validTypes = new Set(["all", "cover", "original", "other"]);

export default async function registerMusicRoutes(app: FastifyInstance, options: MusicRoutesOptions = {}) {
  const repository = options.repository ?? new PrismaMusicRepository() as unknown as MusicRoutesRepository;
  const cache = options.cache ?? new ResponseCache();
  const cachePolicy = options.cachePolicy ?? defaultCachePolicy;
  const dtoMapper = createMusicCatalogDtoMapper(options.memberMetadataById ?? new Map());

  app.get("/v1/music", async (request, reply) => {
    const parsed = parseMusicListQuery(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: "invalid_music_query" });
    setMusicCacheHeader(reply, cachePolicy, parsed.refresh);
    const key = normalizedCacheKey("/v1/music", parsed.filters);
    const loadFresh = async () => {
      const result = await repository.listMusicItems(parsed.filters);
      return {
        items: result.items.map(dtoMapper.toMusicCatalogDto),
        nextCursor: result.nextCursor ?? null,
        serverTime: new Date().toISOString(),
      };
    };
    return parsed.refresh
      ? cache.getOrLoadFresh(key, cachePolicy, loadFresh)
      : cache.getOrLoad(key, cachePolicy, loadFresh);
  });

  app.get("/v1/music/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await repository.getMusicItem?.(id);
    if (!found) return reply.code(404).send({ error: "music_not_found" });
    setMusicCacheHeader(reply, cachePolicy);
    return dtoMapper.toMusicCatalogDetailDto(found);
  });

  if (options.registerMembersListRoute !== false) {
    app.get("/v1/members", async (_request, reply) => {
      setMusicCacheHeader(reply, cachePolicy);
      return { items: await repository.listMusicMembers?.() ?? [] };
    });
  }

  app.get("/v1/members/:id/music", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = parseMusicListQuery(request.query as Record<string, unknown>, id);
    if (!parsed.ok) return reply.code(400).send({ error: "invalid_music_query" });
    setMusicCacheHeader(reply, cachePolicy, parsed.refresh);
    const key = normalizedCacheKey(`/v1/members/${id}/music`, parsed.filters);
    const loadFresh = async () => {
      const result = await repository.listMusicItems(parsed.filters);
      return {
        items: result.items.map(dtoMapper.toMusicCatalogDto),
        nextCursor: result.nextCursor ?? null,
        serverTime: new Date().toISOString(),
      };
    };
    return parsed.refresh
      ? cache.getOrLoadFresh(key, cachePolicy, loadFresh)
      : cache.getOrLoad(key, cachePolicy, loadFresh);
  });
}

function parseMusicListQuery(query: Record<string, unknown>, memberId?: string):
| { ok: true; filters: { type?: MusicPublicTypeFilter; memberId?: string; cursor?: string; limit?: number; sort?: NormalizedMusicSort; includeGraduated?: boolean; includeInstrumental?: boolean; includeExcluded?: boolean }; refresh: boolean }
| { ok: false } {
  const type = typeof query.type === "string" ? query.type : "all";
  const requestedSort = typeof query.sort === "string" ? query.sort : "publishedAt_desc";
  const limit = typeof query.limit === "string" ? Number(query.limit) : undefined;
  const cursor = typeof query.cursor === "string" ? query.cursor : undefined;

  if (!validTypes.has(type)) return { ok: false };
  if (requestedSort !== "publishedAt_desc" && requestedSort !== "publishedAtDesc" && requestedSort !== "playlistOrder") {
    return { ok: false };
  }
  const sort: NormalizedMusicSort = requestedSort === "playlistOrder" ? "playlistOrder" : "publishedAt_desc";
  if (!isMusicCursorValidForSort(cursor, sort)) return { ok: false };
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return { ok: false };
  const includeGraduated = parseBooleanQuery(query.includeGraduated);
  const includeInstrumental = parseBooleanQuery(query.includeInstrumental);
  const includeExcluded = parseBooleanQuery(query.includeExcluded);
  const refresh = parseBooleanQuery(query.refresh);
  if (
    includeGraduated === "invalid" ||
    includeInstrumental === "invalid" ||
    includeExcluded === "invalid" ||
    refresh === "invalid"
  ) return { ok: false };

  return {
    ok: true,
    filters: removeUndefined({
      type: type as MusicPublicTypeFilter,
      memberId,
      cursor,
      limit,
      sort,
      includeGraduated,
      includeInstrumental,
      includeExcluded,
    }),
    refresh: refresh === true,
  };
}

function parseBooleanQuery(value: unknown): boolean | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return "invalid";
}

function normalizedCacheKey(path: string, filters: Record<string, unknown>): string {
  const search = Object.entries(filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return search ? `${path}?${search}` : path;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function setMusicCacheHeader(
  reply: { header(name: string, value: string): unknown },
  policy: ResponseCachePolicy,
  forceRefresh = false,
) {
  if (forceRefresh) {
    reply.header("cache-control", "no-store");
    return;
  }
  const maxAgeSeconds = Math.max(0, Math.floor(policy.ttlMs / 1_000));
  const staleSeconds = Math.max(0, Math.floor(policy.staleMs / 1_000));
  reply.header("cache-control", `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`);
}
