import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { songGenerationFilterValues, songTypeValues } from "../../../shared/schemas/domain.js";
import type { SongFacetsResponse, SongListResponse } from "../../../shared/schemas/mobileApi.js";

describe("mobile song API contract", () => {
  it("documents optional assumed premiere metadata in OpenAPI", () => {
    const openapi = readFileSync(new URL("../../../shared/openapi/openapi.yaml", import.meta.url), "utf8");
    expect(openapi).toContain("YoutubePremiereMetadata:");
    expect(openapi.match(/premiere:\n\s+\$ref: \"#\/components\/schemas\/YoutubePremiereMetadata\"/g)).toHaveLength(2);
  });

  it("keeps mobile song type values explicit and stable", () => {
    expect(songTypeValues).toEqual(["original", "cover", "unknown"]);
  });

  it("limits mobile song generation filters to active member generations", () => {
    expect(songGenerationFilterValues).toEqual(["all", "gen1", "gen2", "gen3"]);
    expect(songGenerationFilterValues).not.toContain("gamja");
    expect(songGenerationFilterValues).not.toContain("official");
    expect(songGenerationFilterValues).not.toContain("gen4-upcoming");
  });

  it("models song facets without exposing non-song categories", () => {
    const response = {
      summary: { total: 128, original: 31, cover: 97 },
      generationFilters: [
        { id: "all", label: "전체", count: 128 },
        { id: "gen1", label: "1기생", count: 38 },
        { id: "gen2", label: "2기생", count: 45 },
        { id: "gen3", label: "3기생", count: 45 },
      ],
      memberFilters: [
        { id: "all", label: "전체", generationId: "all", count: 128 },
        { id: "ayatsuno-yuni", label: "아야츠노 유니", generationId: "gen1", count: 18 },
      ],
      typeFilters: [
        { id: "all", label: "전체", count: 128 },
        { id: "original", label: "오리지널", count: 31 },
        { id: "cover", label: "커버", count: 97 },
      ],
      displaySettings: {
        summaryCards: { songs: true, live: true, hubEvents: true, home: true },
      },
      serverTime: "2026-06-22T00:00:00.000Z",
    } satisfies SongFacetsResponse;

    expect(response.generationFilters.map((filter) => filter.id)).toEqual(["all", "gen1", "gen2", "gen3"]);
    expect(JSON.stringify(response)).not.toContain("gamja");
    expect(JSON.stringify(response)).not.toContain("official");
  });

  it("models song list items with runtime YouTube thumbnail metadata only", () => {
    const response = {
      items: [
        {
          id: "youtube:video:abc123",
          youtubeVideoId: "abc123",
          title: "별빛 항로",
          memberId: "akane-lize",
          memberName: "아카네 리제",
          generationId: "gen2",
          generationName: "2기생",
          type: "original",
          sourceUrl: "https://www.youtube.com/watch?v=abc123",
          thumbnail: {
            url: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
            width: 1280,
            height: 720,
          },
          publishedAt: "2026-06-21T12:00:00.000Z",
          premiere: {
            classification: "assumed",
            state: "scheduled",
            scheduledStartAt: "2026-07-01T12:00:00.000Z",
            actualStartAt: null,
            actualEndAt: null,
          },
        },
      ],
      nextCursor: null,
      serverTime: "2026-06-22T00:00:00.000Z",
    } satisfies SongListResponse;

    expect(response.items[0].thumbnail?.width / response.items[0].thumbnail!.height).toBeCloseTo(16 / 9, 3);
    expect(JSON.stringify(response)).not.toContain("base64");
    expect(JSON.stringify(response)).not.toContain("assetPath");
  });
});
