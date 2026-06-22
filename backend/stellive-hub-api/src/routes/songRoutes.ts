import type { FastifyInstance } from "fastify";
import { songGenerationFilterValues } from "../../../../shared/schemas/domain.js";
import type { SongFacetsResponse, SongListResponse } from "../../../../shared/schemas/mobileApi.js";
import { EmptySongRepository, type SongListFilters, type SongListTypeFilter, type SongRepository } from "../repositories/songRepository.js";

const mobileSongTypeFilters = ["all", "original", "cover"] as const;
const songGenerationFilterSet = new Set<string>(songGenerationFilterValues);
const mobileSongTypeFilterSet = new Set<string>(mobileSongTypeFilters);

export interface SongRouteDependencies {
  songs?: SongRepository;
}

export interface SongRouteOptions {
  dependencies?: SongRouteDependencies;
}

interface SongQuery {
  generationId?: string;
  memberId?: string;
  type?: string;
  q?: string;
  cursor?: string;
  limit?: string;
}

function parseSongFilters(query: SongQuery): { filters?: SongListFilters; error?: { statusCode: number; payload: { error: string } } } {
  if (query.generationId && !songGenerationFilterSet.has(query.generationId)) {
    return { error: { statusCode: 400, payload: { error: "unsupported_song_generation_filter" } } };
  }

  if (query.type && !mobileSongTypeFilterSet.has(query.type)) {
    return { error: { statusCode: 400, payload: { error: "unsupported_song_type_filter" } } };
  }

  let limit: number | undefined;
  if (query.limit !== undefined) {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return { error: { statusCode: 400, payload: { error: "invalid_limit" } } };
    }
    limit = parsedLimit;
  }

  return {
    filters: {
      generationId: query.generationId as SongListFilters["generationId"],
      memberId: query.memberId,
      type: query.type as SongListTypeFilter | undefined,
      q: query.q,
      cursor: query.cursor,
      limit,
    },
  };
}

export async function registerSongRoutes(app: FastifyInstance, options: SongRouteOptions = {}) {
  const songs = options.dependencies?.songs ?? new EmptySongRepository();

  app.get<{ Querystring: SongQuery }>("/v1/songs/facets", async (request, reply) => {
    const parsed = parseSongFilters(request.query);
    if (parsed.error) return reply.code(parsed.error.statusCode).send(parsed.error.payload);

    const facets = await songs.facets(parsed.filters ?? {});
    const response: SongFacetsResponse = {
      ...facets,
      displaySettings: {
        summaryCards: { songs: true, live: true, hubEvents: true, home: true },
      },
      serverTime: new Date().toISOString(),
    };

    return reply.header("Cache-Control", "private, max-age=60").send(response);
  });

  app.get<{ Querystring: SongQuery }>("/v1/songs", async (request, reply) => {
    const parsed = parseSongFilters(request.query);
    if (parsed.error) return reply.code(parsed.error.statusCode).send(parsed.error.payload);

    const list = await songs.listSongs(parsed.filters ?? {});
    const response: SongListResponse = {
      items: list.items,
      nextCursor: list.nextCursor ?? null,
      serverTime: new Date().toISOString(),
    };

    return reply.header("Cache-Control", "private, max-age=30").send(response);
  });
}

export default registerSongRoutes;
