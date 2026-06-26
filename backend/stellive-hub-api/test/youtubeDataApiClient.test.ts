import { describe, expect, it, vi } from "vitest";
import YoutubeDataApiClient from "../src/adapters/youtube/youtubeDataApiClient.js";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("YoutubeDataApiClient", () => {
  it("reads upload playlist ids from channel list responses", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => jsonResponse({
      kind: "youtube#channelListResponse",
      etag: "channel-etag",
      pageInfo: { totalResults: 1, resultsPerPage: 1 },
      items: [{
        kind: "youtube#channel",
        etag: "item-etag",
        id: "UC123",
        contentDetails: { relatedPlaylists: { uploads: "UU123" } },
      }],
    }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.getUploadsPlaylistId("UC123")).resolves.toEqual({
      status: "ok",
      channelId: "UC123",
      uploadsPlaylistId: "UU123",
      etag: "channel-etag",
    });

    const url = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/youtube/v3/channels");
    expect(url.searchParams.get("part")).toBe("contentDetails");
    expect(url.searchParams.get("id")).toBe("UC123");
    expect(url.searchParams.get("key")).toBe("test-key");
  });

  it("lists uploads with ETag support and a page cap", async () => {
    const fetchImpl = vi
      .fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => jsonResponse({}))
      .mockReset()
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#playlistItemListResponse",
        etag: "page-1",
        nextPageToken: "next-page",
        pageInfo: { totalResults: 2, resultsPerPage: 1 },
        items: [{
          kind: "youtube#playlistItem",
          etag: "item-1",
          snippet: {
            title: "별빛 original song",
            channelId: "UC123",
            publishedAt: "2026-06-21T12:00:00Z",
            resourceId: { kind: "youtube#video", videoId: "video-1" },
            thumbnails: { medium: { url: "https://i.ytimg.com/vi/video-1/mqdefault.jpg", width: 320, height: 180 } },
          },
          contentDetails: { videoId: "video-1", videoPublishedAt: "2026-06-21T12:00:00Z" },
          status: { privacyStatus: "public" },
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        kind: "youtube#playlistItemListResponse",
        etag: "page-2",
        items: [{
          kind: "youtube#playlistItem",
          etag: "item-2",
          snippet: {
            title: "커버 cover",
            channelId: "UC123",
            publishedAt: "2026-06-20T12:00:00Z",
            resourceId: { kind: "youtube#video", videoId: "video-2" },
          },
          contentDetails: { videoId: "video-2" },
        }],
      }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.listUploads({
      channelId: "UC123",
      uploadsPlaylistId: "UU123",
      maxPages: 1,
      etag: "stored-etag",
    })).resolves.toEqual({
      status: "ok",
      candidates: [{
        videoId: "video-1",
        channelId: "UC123",
        title: "별빛 original song",
        sourceUrl: "https://www.youtube.com/watch?v=video-1",
        publishedAt: "2026-06-21T12:00:00.000Z",
        updatedAt: "2026-06-21T12:00:00.000Z",
        thumbnailUrl: "https://i.ytimg.com/vi/video-1/mqdefault.jpg",
        thumbnailWidth: 320,
        thumbnailHeight: 180,
        privacyStatus: "public",
      }],
      pagesFetched: 1,
      quotaUnits: 1,
      etag: "page-1",
      nextPageToken: "next-page",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({ "if-none-match": "stored-etag" });
  });

  it("returns not_modified for 304 playlist responses", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => new Response(null, { status: 304 }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.listUploads({
      channelId: "UC123",
      uploadsPlaylistId: "UU123",
      maxPages: 1,
      etag: "stored-etag",
    })).resolves.toEqual({
      status: "not_modified",
      candidates: [],
      pagesFetched: 0,
      quotaUnits: 1,
    });
  });

  it("normalizes video detail metadata in batches of 50 ids", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> => jsonResponse({
      kind: "youtube#videoListResponse",
      etag: "videos-etag",
      pageInfo: { totalResults: 1, resultsPerPage: 1 },
      items: [{
        kind: "youtube#video",
        etag: "video-etag",
        id: "video-1",
        snippet: {
          title: "별빛",
          channelId: "UC123",
          tags: ["original"],
          liveBroadcastContent: "none",
          thumbnails: { high: { url: "https://i.ytimg.com/vi/video-1/hqdefault.jpg", width: 480, height: 360 } },
        },
        contentDetails: { duration: "PT3M21S" },
        status: { privacyStatus: "public" },
      }],
    }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });
    const ids = Array.from({ length: 51 }, (_, index) => `video-${index + 1}`);

    const details = await client.getVideoDetails(ids);

    expect(details[0]).toEqual({
      videoId: "video-1",
      channelId: "UC123",
      title: "별빛",
      tags: ["original"],
      duration: "PT3M21S",
      privacyStatus: "public",
      liveBroadcastContent: "none",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
      thumbnailWidth: 480,
      thumbnailHeight: 360,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(firstUrl.searchParams.get("id")?.split(",")).toHaveLength(50);
  });
});
