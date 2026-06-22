import type { FastifyInstance } from "fastify";
import type { MusicCatalogItem, MusicPublicTypeFilter } from "../../../../shared/schemas/domain.js";
import { ResponseCache, type ResponseCachePolicy } from "../cache/responseCache.js";
import { toMusicCatalogDto } from "../music/musicDto.js";
import { PrismaMusicRepository } from "../repositories/musicRepository.js";

type MusicSort = "publishedAt_desc";

export interface MusicRoutesRepository {
  listMusicItems(filters: {
    type?: MusicPublicTypeFilter;
    memberId?: string;
    cursor?: string;
    limit?: number;
    sort?: MusicSort;
  }): Promise<{ items: MusicCatalogItem[]; nextCursor?: string | null }>;
  getMusicItem?(id: string): Promise<MusicCatalogItem | null>;
  listMusicMembers?(): Promise<Array<{ id: string; nameKo: string; nameEn: string }>>;
}

export interface MusicRoutesOptions {
  repository?: MusicRoutesRepository;
  cache?: ResponseCache;
  cachePolicy?: ResponseCachePolicy;
  registerMembersListRoute?: boolean;
}

const defaultCachePolicy = { ttlMs: 300_000, staleMs: 600_000 };
const validTypes = new Set(["all", "cover", "original", "other"]);

export default async function registerMusicRoutes(app: FastifyInstance, options: MusicRoutesOptions = {}) {
  const repository = options.repository ?? new PrismaMusicRepository() as unknown as MusicRoutesRepository;
  const cache = options.cache ?? new ResponseCache();
  const cachePolicy = options.cachePolicy ?? defaultCachePolicy;

  app.get("/v1/music", async (request, reply) => {
    const parsed = parseMusicListQuery(request.query as Record<string, unknown>);
    if (!parsed.ok) return reply.code(400).send({ error: "invalid_music_query" });
    setMusicCacheHeader(reply);
    const key = normalizedCacheKey("/v1/music", parsed.filters);
    return cache.getOrLoad(key, cachePolicy, async () => {
      const result = await repository.listMusicItems(parsed.filters);
      return {
        items: result.items.map(toMusicCatalogDto),
        nextCursor: result.nextCursor ?? null,
      };
    });
  });

  app.get("/v1/music/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await repository.getMusicItem?.(id);
    if (!found) return reply.code(404).send({ error: "music_not_found" });
    setMusicCacheHeader(reply);
    return toMusicCatalogDto(found);
  });

  if (options.registerMembersListRoute !== false) {
    app.get("/v1/members", async (_request, reply) => {
      setMusicCacheHeader(reply);
      return { items: await repository.listMusicMembers?.() ?? [] };
    });
  }

  app.get("/v1/members/:id/music", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = parseMusicListQuery(request.query as Record<string, unknown>, id);
    if (!parsed.ok) return reply.code(400).send({ error: "invalid_music_query" });
    setMusicCacheHeader(reply);
    const key = normalizedCacheKey(`/v1/members/${id}/music`, parsed.filters);
    return cache.getOrLoad(key, cachePolicy, async () => {
      const result = await repository.listMusicItems(parsed.filters);
      return {
        items: result.items.map(toMusicCatalogDto),
        nextCursor: result.nextCursor ?? null,
      };
    });
  });
}

function parseMusicListQuery(query: Record<string, unknown>, memberId?: string):
  | { ok: true; filters: { type?: MusicPublicTypeFilter; memberId?: string; cursor?: string; limit?: number; sort?: MusicSort } }
  | { ok: false } {
  const type = typeof query.type === "string" ? query.type : "all";
  const sort = typeof query.sort === "string" ? query.sort : "publishedAt_desc";
  const limit = typeof query.limit === "string" ? Number(query.limit) : undefined;
  const cursor = typeof query.cursor === "string" ? query.cursor : undefined;

  if (!validTypes.has(type)) return { ok: false };
  if (sort !== "publishedAt_desc") return { ok: false };
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) return { ok: false };

  return {
    ok: true,
    filters: removeUndefined({
      type: type as MusicPublicTypeFilter,
      memberId,
      cursor,
      limit,
      sort,
    }),
  };
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

function setMusicCacheHeader(reply: { header(name: string, value: string): unknown }) {
  reply.header("cache-control", "private, max-age=300, stale-while-revalidate=600");
}
