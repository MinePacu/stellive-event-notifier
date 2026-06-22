import { describe, expect, it, vi } from "vitest";

import YoutubeDataApiClient from "../src/adapters/youtube/youtubeDataApiClient.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("YoutubeDataApiClient music playlist methods", () => {
  it("fetches playlist items across every nextPageToken page", async () => {
    const fetchImpl = vi
      .fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => jsonResponse({}))
      .mockReset()
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#playlistItemListResponse",
        nextPageToken: "page-2",
        items: [{
          snippet: {
            title: "cover one",
            position: 0,
            publishedAt: "2026-06-21T12:00:00Z",
            resourceId: { videoId: "video-1" },
          },
          contentDetails: { videoId: "video-1", videoPublishedAt: "2026-06-21T12:00:00Z" },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#playlistItemListResponse",
        items: [{
          snippet: { title: "cover two", position: 1, resourceId: { videoId: "video-2" } },
          contentDetails: { videoId: "video-2" },
        }],
      }));

    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.fetchPlaylistItems("PLmusic")).resolves.toEqual({
      status: "ok",
      items: [
        { videoId: "video-1", title: "cover one", publishedAt: "2026-06-21T12:00:00.000Z", position: 0 },
        { videoId: "video-2", title: "cover two", publishedAt: "1970-01-01T00:00:00.000Z", position: 1 },
      ],
      pagesFetched: 2,
      quotaUnits: 2,
    });

    const firstUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    const secondUrl = new URL(fetchImpl.mock.calls[1][0] as string);
    expect(firstUrl.pathname).toBe("/youtube/v3/playlistItems");
    expect(firstUrl.searchParams.get("part")).toBe("snippet,contentDetails");
    expect(firstUrl.searchParams.get("maxResults")).toBe("50");
    expect(firstUrl.searchParams.get("playlistId")).toBe("PLmusic");
    expect(firstUrl.searchParams.get("key")).toBe("test-key");
    expect(secondUrl.searchParams.get("pageToken")).toBe("page-2");
  });

  it("returns a quota failure for playlist 403 responses without retrying", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      jsonResponse({ error: { reason: "quotaExceeded" } }, { status: 403 }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.fetchPlaylistItems("PLmusic")).resolves.toEqual({
      status: "quota_exceeded",
      items: [],
      pagesFetched: 0,
      quotaUnits: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetches video details in 50-id chunks", async () => {
    const fetchImpl = vi
      .fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => jsonResponse({}))
      .mockReset()
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#videoListResponse",
        items: [{
          id: "video-1",
          snippet: {
            title: "original one",
            description: "desc",
            publishedAt: "2026-06-21T12:00:00Z",
            channelId: "UC1",
            channelTitle: "Stellive",
            liveBroadcastContent: "none",
            thumbnails: { high: { url: "https://i.ytimg.com/vi/video-1/hqdefault.jpg", width: 480, height: 360 } },
          },
          contentDetails: { duration: "PT3M21S" },
          status: { privacyStatus: "public" },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ kind: "youtube#videoListResponse", items: [] }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });
    const ids = Array.from({ length: 51 }, (_, index) => `video-${index + 1}`);

    const details = await client.fetchVideos(ids);

    expect(details).toEqual([{
      videoId: "video-1",
      title: "original one",
      description: "desc",
      publishedAt: "2026-06-21T12:00:00.000Z",
      channelId: "UC1",
      channelTitle: "Stellive",
      tags: [],
      duration: "PT3M21S",
      privacyStatus: "public",
      liveBroadcastContent: "none",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
      thumbnailWidth: 480,
      thumbnailHeight: 360,
    }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(new URL(fetchImpl.mock.calls[0][0] as string).searchParams.get("id")?.split(",")).toHaveLength(50);
  });
});
