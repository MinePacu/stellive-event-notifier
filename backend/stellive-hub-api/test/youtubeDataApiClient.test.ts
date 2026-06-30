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
      maxResults: 10,
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
    const requestUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("maxResults")).toBe("10");
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
        liveStreamingDetails: {
          scheduledStartTime: "2026-06-30T12:00:00Z",
          actualStartTime: "2026-06-30T12:01:00Z",
          actualEndTime: "2026-06-30T12:04:30Z",
        },
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
      scheduledStartTime: "2026-06-30T12:00:00.000Z",
      actualStartTime: "2026-06-30T12:01:00.000Z",
      actualEndTime: "2026-06-30T12:04:30.000Z",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
      thumbnailWidth: 480,
      thumbnailHeight: 360,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(firstUrl.searchParams.get("id")?.split(",")).toHaveLength(50);
    expect(firstUrl.searchParams.get("part")).toContain("liveStreamingDetails");
  });

  it("fetches channel profile thumbnails in channel id batches", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
      const url = new URL(input as string);
      const ids = url.searchParams.get("id")?.split(",") ?? [];
      return jsonResponse({
        items: ids.map((id, index) => ({
          id,
          snippet: {
            title: `Channel ${id}`,
            customUrl: `@custom-${id}`,
            handle: `@handle-${id}`,
            thumbnails: index === 0
              ? { high: { url: `https://yt.example/${id}/high.jpg` } }
              : { high: { url: `http://yt.example/${id}/high.jpg` }, medium: { url: `https://yt.example/${id}/medium.jpg` } },
          },
        })),
      });
    });
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });
    const ids = Array.from({ length: 51 }, (_, index) => `UC${index + 1}`);

    const result = await client.fetchChannelProfilesByIds(ids);

    expect(result.status).toBe("ok");
    expect(result.quotaUnits).toBe(2);
    expect(result.profiles).toHaveLength(51);
    expect(result.profiles[0]).toMatchObject({
      channelId: "UC1",
      title: "Channel UC1",
      customUrl: "@custom-UC1",
      handle: "@handle-UC1",
      profileImageUrl: "https://yt.example/UC1/high.jpg",
    });
    expect(result.profiles[1].profileImageUrl).toBe("https://yt.example/UC2/medium.jpg");
    const firstUrl = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(firstUrl.pathname).toBe("/youtube/v3/channels");
    expect(firstUrl.searchParams.get("part")).toBe("snippet");
    expect(firstUrl.searchParams.get("id")?.split(",")).toHaveLength(50);
  });

  it("returns quota_exceeded for channel profile 403 responses", async () => {
    const fetchImpl = vi.fn(async (): Promise<Response> => jsonResponse({ error: "quota" }, { status: 403 }));
    const client = new YoutubeDataApiClient({ apiKey: "test-key", fetch: fetchImpl });

    await expect(client.fetchChannelProfilesByIds(["UC1"])).resolves.toEqual({
      status: "quota_exceeded",
      profiles: [],
      quotaUnits: 1,
    });
  });
});
