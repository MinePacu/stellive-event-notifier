import { describe, expect, it, vi } from "vitest";

import YoutubeDataApiClient from "../src/adapters/youtube/youtubeDataApiClient.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("YoutubeDataApiClient music playlist methods", () => {
  it("fetches playlist items with status metadata across nextPageToken pages", async () => {
    const fetchImpl = vi
      .fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => jsonResponse({}))
      .mockReset()
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#playlistItemListResponse",
        nextPageToken: "page-2",
        items: [{
          id: "playlist-item-1",
          snippet: {
            title: "cover one",
            position: 0,
            publishedAt: "2026-06-21T12:00:00Z",
            channelId: "UC_STELLIVE",
            channelTitle: "Stellive",
            resourceId: { videoId: "video-1" },
          },
          contentDetails: { videoId: "video-1", videoPublishedAt: "2026-06-21T12:00:00Z" },
          status: { privacyStatus: "public" },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#playlistItemListResponse",
        items: [{
          id: "playlist-item-2",
          snippet: { title: "cover two", position: 1, resourceId: { videoId: "video-2" } },
          contentDetails: { videoId: "video-2" },
          status: { privacyStatus: "unlisted" },
        }],
      }));

    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.fetchPlaylistItems("PLmusic")).resolves.toEqual({
      status: "ok",
      items: [
        {
          playlistItemId: "playlist-item-1",
          videoId: "video-1",
          title: "cover one",
          publishedAt: "2026-06-21T12:00:00.000Z",
          position: 0,
          channelId: "UC_STELLIVE",
          channelTitle: "Stellive",
          privacyStatus: "public",
        },
        {
          playlistItemId: "playlist-item-2",
          videoId: "video-2",
          title: "cover two",
          publishedAt: "1970-01-01T00:00:00.000Z",
          position: 1,
          channelId: undefined,
          channelTitle: undefined,
          privacyStatus: "unlisted",
        },
      ],
      pagesFetched: 2,
      quotaUnits: 2,
    });
    const firstUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(firstUrl.searchParams.get("part")).toBe("snippet,contentDetails,status");
  });

  it("stops playlist pagination when maxPages is provided", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      jsonResponse({
        kind: "youtube#playlistItemListResponse",
        nextPageToken: "page-2",
        items: [{ contentDetails: { videoId: "video-1" }, snippet: { title: "cover one" } }],
      }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.fetchPlaylistItems("PLmusic", { maxPages: 1 })).resolves.toMatchObject({
      status: "ok",
      pagesFetched: 1,
      quotaUnits: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetches video details with status and content metadata in 50-id chunks", async () => {
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
            tags: ["original"],
            liveBroadcastContent: "none",
            thumbnails: { high: { url: "https://i.ytimg.com/vi/video-1/hqdefault.jpg", width: 480, height: 360 } },
          },
          contentDetails: { duration: "PT3M21S", dimension: "2d", definition: "hd", caption: "false" },
          status: { privacyStatus: "public", embeddable: true, madeForKids: false },
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
      tags: ["original"],
      duration: "PT3M21S",
      dimension: "2d",
      definition: "hd",
      caption: "false",
      privacyStatus: "public",
      embeddable: true,
      madeForKids: false,
      liveBroadcastContent: "none",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
      thumbnailWidth: 480,
      thumbnailHeight: 360,
    }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(firstUrl.searchParams.get("part")).toBe("snippet,contentDetails,status");
    expect(firstUrl.searchParams.get("id")!.split(",")).toHaveLength(50);
  });

  it("returns quota_exceeded without retrying when playlist request is forbidden", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: 403 } }, { status: 403 }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.fetchPlaylistItems("PLmusic")).resolves.toEqual({
      status: "quota_exceeded",
      items: [],
      pagesFetched: 0,
      quotaUnits: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
