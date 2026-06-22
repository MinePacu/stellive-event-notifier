import type { YoutubeUploadCandidate } from "./youtubeAtomParser.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface YoutubeDataApiClientOptions {
  apiKey: string;
  fetch?: FetchLike;
}

export type YoutubeUploadsPlaylistResult =
  | { status: "ok"; channelId: string; uploadsPlaylistId: string; etag?: string }
  | { status: "not_found"; channelId: string };

export type YoutubeListUploadsResult =
  | {
    status: "ok";
    candidates: YoutubeUploadCandidate[];
    pagesFetched: number;
    quotaUnits: number;
    etag?: string;
    nextPageToken?: string;
  }
  | {
    status: "not_modified";
    candidates: [];
    pagesFetched: 0;
    quotaUnits: number;
    };

export type YoutubeFetchPlaylistItemsResult =
  | {
      status: "ok";
      items: YoutubeMusicPlaylistItem[];
      pagesFetched: number;
      quotaUnits: number;
    }
  | {
      status: "quota_exceeded" | "error";
      items: [];
      pagesFetched: number;
      quotaUnits: number;
    };

export interface YoutubeListUploadsInput {
  channelId: string;
  uploadsPlaylistId: string;
  maxPages: number;
  etag?: string;
}

export interface YoutubeMusicPlaylistItem {
  videoId: string;
  title: string;
  publishedAt: string;
  position?: number;
}

export interface YoutubeVideoDetail {
  videoId: string;
  channelId?: string;
  channelTitle?: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  tags: string[];
  duration?: string;
  privacyStatus?: string;
  liveBroadcastContent?: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

interface YoutubeListWrapper<T> {
  kind?: string;
  etag?: string;
  nextPageToken?: string;
  items?: T[];
}

interface YoutubeChannelItem {
  id?: string;
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface YoutubePlaylistItem {
  snippet?: {
    title?: string;
    channelId?: string;
    publishedAt?: string;
    position?: number;
    resourceId?: {
      videoId?: string;
    };
    thumbnails?: Record<string, YoutubeThumbnail | undefined>;
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
  status?: {
    privacyStatus?: string;
  };
}

interface YoutubeVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    tags?: string[];
    liveBroadcastContent?: string;
    thumbnails?: Record<string, YoutubeThumbnail | undefined>;
  };
  contentDetails?: {
    duration?: string;
  };
  status?: {
    privacyStatus?: string;
  };
}

interface YoutubeThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

function normalizeDate(value: string | undefined): string {
  if (!value) return new Date(0).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function pickThumbnail(thumbnails: Record<string, YoutubeThumbnail | undefined> | undefined): YoutubeThumbnail | undefined {
  return thumbnails?.maxres ?? thumbnails?.standard ?? thumbnails?.high ?? thumbnails?.medium ?? thumbnails?.default;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export class YoutubeDataApiClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: YoutubeDataApiClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getUploadsPlaylistId(channelId: string): Promise<YoutubeUploadsPlaylistResult> {
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", channelId);
    url.searchParams.set("key", this.options.apiKey);

    const response = await this.fetchImpl(url.toString());
    const body = await response.json() as YoutubeListWrapper<YoutubeChannelItem>;
    const item = body.items?.find((candidate) => candidate.id === channelId) ?? body.items?.[0];
    const uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;
    if (!response.ok || !uploadsPlaylistId) return { status: "not_found", channelId };

    return { status: "ok", channelId, uploadsPlaylistId, etag: body.etag };
  }

  async listUploads(input: YoutubeListUploadsInput): Promise<YoutubeListUploadsResult> {
    const candidates: YoutubeUploadCandidate[] = [];
    let pageToken: string | undefined;
    let etag: string | undefined;
    let pagesFetched = 0;
    let quotaUnits = 0;
    const maxPages = Math.max(1, Math.trunc(input.maxPages));

    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet,contentDetails,status");
      url.searchParams.set("playlistId", input.uploadsPlaylistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", this.options.apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      quotaUnits += 1;
      const headers = input.etag && page === 0 ? { "if-none-match": input.etag } : undefined;
      const response = await this.fetchImpl(url.toString(), headers ? { headers } : undefined);
      if (response.status === 304) return { status: "not_modified", candidates: [], pagesFetched: 0, quotaUnits };

      const body = await response.json() as YoutubeListWrapper<YoutubePlaylistItem>;
      if (!response.ok) break;
      pagesFetched += 1;
      etag = body.etag ?? etag;
      candidates.push(...(body.items ?? []).flatMap((item) => this.toUploadCandidate(input.channelId, item)));
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }

    return { status: "ok", candidates, pagesFetched, quotaUnits, etag, nextPageToken: pageToken };
  }

  async fetchPlaylistItems(
    playlistId: string,
    options: { maxPages?: number } = {},
  ): Promise<YoutubeFetchPlaylistItemsResult> {
    const items: YoutubeMusicPlaylistItem[] = [];
    let pageToken: string | undefined;
    let pagesFetched = 0;
    let quotaUnits = 0;
    const maxPages = options.maxPages ? Math.max(1, Math.trunc(options.maxPages)) : Number.POSITIVE_INFINITY;

    while (pagesFetched < maxPages) {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", this.options.apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      quotaUnits += 1;
      const response = await this.fetchImpl(url.toString());
      const body = await response.json() as YoutubeListWrapper<YoutubePlaylistItem>;
      if (!response.ok) {
        return {
          status: response.status === 403 ? "quota_exceeded" : "error",
          items: [],
          pagesFetched,
          quotaUnits,
        };
      }

      pagesFetched += 1;
      items.push(...(body.items ?? []).flatMap((item) => this.toMusicPlaylistItem(item)));
      pageToken = body.nextPageToken;
      if (!pageToken) break;
    }

    return { status: "ok", items, pagesFetched, quotaUnits };
  }

  async fetchVideos(videoIds: string[]): Promise<YoutubeVideoDetail[]> {
    return this.getVideoDetails(videoIds);
  }

  async getVideoDetails(videoIds: string[]): Promise<YoutubeVideoDetail[]> {
    const details: YoutubeVideoDetail[] = [];
    for (const ids of chunk(videoIds, 50)) {
      if (ids.length === 0) continue;
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet,contentDetails,status");
      url.searchParams.set("id", ids.join(","));
      url.searchParams.set("key", this.options.apiKey);

      const response = await this.fetchImpl(url.toString());
      const body = await response.json() as YoutubeListWrapper<YoutubeVideoItem>;
      if (!response.ok) continue;
      details.push(...(body.items ?? []).flatMap((item) => this.toVideoDetail(item)));
    }
    return details;
  }

  private toUploadCandidate(channelId: string, item: YoutubePlaylistItem): YoutubeUploadCandidate[] {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
    if (!videoId) return [];
    const thumbnail = pickThumbnail(item.snippet?.thumbnails);
    const publishedAt = normalizeDate(item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt);
    return [{
      videoId,
      channelId,
      title: item.snippet?.title ?? "",
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt,
      updatedAt: publishedAt,
      thumbnailUrl: thumbnail?.url,
      thumbnailWidth: thumbnail?.width,
      thumbnailHeight: thumbnail?.height,
      privacyStatus: item.status?.privacyStatus,
    }];
  }

  private toMusicPlaylistItem(item: YoutubePlaylistItem): YoutubeMusicPlaylistItem[] {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
    if (!videoId) return [];
    return [{
      videoId,
      title: item.snippet?.title ?? "",
      publishedAt: normalizeDate(item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt),
      position: item.snippet?.position,
    }];
  }

  private toVideoDetail(item: YoutubeVideoItem): YoutubeVideoDetail[] {
    if (!item.id) return [];
    const thumbnail = pickThumbnail(item.snippet?.thumbnails);
    return [{
      videoId: item.id,
      channelId: item.snippet?.channelId,
      channelTitle: item.snippet?.channelTitle,
      title: item.snippet?.title,
      description: item.snippet?.description,
      publishedAt: item.snippet?.publishedAt ? normalizeDate(item.snippet.publishedAt) : undefined,
      tags: item.snippet?.tags ?? [],
      duration: item.contentDetails?.duration,
      privacyStatus: item.status?.privacyStatus,
      liveBroadcastContent: item.snippet?.liveBroadcastContent,
      thumbnailUrl: thumbnail?.url,
      thumbnailWidth: thumbnail?.width,
      thumbnailHeight: thumbnail?.height,
    }];
  }
}

export default YoutubeDataApiClient;
