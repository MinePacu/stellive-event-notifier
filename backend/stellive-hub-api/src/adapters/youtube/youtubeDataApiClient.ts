import type { YoutubeUploadCandidate } from "./youtubeAtomParser.js";
import {
  recordExternalApiCall,
  resultStatusFromError,
  resultStatusFromHttpStatus,
  type ExternalApiCallLogger
} from "../../observability/externalApiCallLogger.js";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface YoutubeDataApiClientOptions {
  apiKey: string;
  fetch?: FetchLike;
  apiCallLogger?: ExternalApiCallLogger;
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
    }
  | {
    status: "quota_exceeded" | "error";
    candidates: [];
    pagesFetched: number;
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

export type YoutubeFetchPlaylistItemsPageResult =
  | {
      status: "ok";
      items: YoutubeMusicPlaylistItem[];
      nextPageToken?: string;
      pagesFetched: 1;
      quotaUnits: number;
    }
  | {
      status: "quota_exceeded" | "error";
      items: [];
      nextPageToken?: undefined;
      pagesFetched: 0;
      quotaUnits: number;
    };

export type YoutubeFetchVideosResult = {
  status: "ok" | "quota_exceeded" | "error";
  items: YoutubeVideoDetail[];
};

export interface YoutubeChannelProfile {
  channelId: string;
  title?: string;
  customUrl?: string;
  handle?: string;
  profileImageUrl?: string;
  fetchedAt: string;
}

export type YoutubeFetchChannelProfilesResult =
  | {
      status: "ok";
      profiles: YoutubeChannelProfile[];
      quotaUnits: number;
    }
  | {
      status: "quota_exceeded" | "error";
      profiles: [];
      quotaUnits: number;
    };

export interface YoutubeListUploadsInput {
  channelId: string;
  uploadsPlaylistId: string;
  maxPages: number;
  maxResults?: number;
  etag?: string;
}

export interface YoutubeMusicPlaylistItem {
  playlistItemId?: string;
  videoId: string;
  title: string;
  publishedAt: string;
  position?: number;
  channelId?: string;
  channelTitle?: string;
  privacyStatus?: string;
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
  dimension?: string;
  definition?: string;
  caption?: string;
  privacyStatus?: string;
  embeddable?: boolean;
  madeForKids?: boolean;
  liveBroadcastContent?: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
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
  snippet?: {
    title?: string;
    customUrl?: string;
    handle?: string;
    thumbnails?: Record<string, YoutubeThumbnail | undefined>;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface YoutubePlaylistItem {
  id?: string;
  snippet?: {
    title?: string;
    channelId?: string;
    channelTitle?: string;
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
    dimension?: string;
    definition?: string;
    caption?: string;
  };
  status?: {
    privacyStatus?: string;
    embeddable?: boolean;
    madeForKids?: boolean;
  };
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
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

function pickChannelProfileThumbnail(thumbnails: Record<string, YoutubeThumbnail | undefined> | undefined): YoutubeThumbnail | undefined {
  return [thumbnails?.high, thumbnails?.medium, thumbnails?.default].find((thumbnail) => httpsUrl(thumbnail?.url));
}

function httpsUrl(value: string | undefined): string | undefined {
  return value?.startsWith("https://") ? value : undefined;
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

    const response = await this.fetchAndRecord(url, "youtube.channels.list", 1);
    const body = await response.json() as YoutubeListWrapper<YoutubeChannelItem>;
    const item = body.items?.find((candidate) => candidate.id === channelId) ?? body.items?.[0];
    const uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;
    if (!response.ok || !uploadsPlaylistId) return { status: "not_found", channelId };

    return { status: "ok", channelId, uploadsPlaylistId, etag: body.etag };
  }

  async fetchChannelProfilesByIds(channelIds: string[]): Promise<YoutubeFetchChannelProfilesResult> {
    const profiles: YoutubeChannelProfile[] = [];
    let quotaUnits = 0;
    const uniqueIds = Array.from(new Set(channelIds.map((id) => id.trim()).filter(Boolean)));

    for (const ids of chunk(uniqueIds, 50)) {
      if (ids.length === 0) continue;
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("id", ids.join(","));
      url.searchParams.set("key", this.options.apiKey);

      quotaUnits += 1;
      const response = await this.fetchAndRecord(url, "youtube.channels.list", 1);
      const body = await response.json() as YoutubeListWrapper<YoutubeChannelItem>;
      if (!response.ok) {
        return {
          status: response.status === 403 ? "quota_exceeded" : "error",
          profiles: [],
          quotaUnits,
        };
      }

      profiles.push(...(body.items ?? []).flatMap((item) => this.toChannelProfile(item)));
    }

    return { status: "ok", profiles, quotaUnits };
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
      url.searchParams.set("maxResults", String(Math.min(50, Math.max(1, Math.trunc(input.maxResults ?? 50)))));
      url.searchParams.set("key", this.options.apiKey);
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      quotaUnits += 1;
      const headers = input.etag && page === 0 ? { "if-none-match": input.etag } : undefined;
      const response = await this.fetchAndRecord(url, "youtube.playlistItems.list", 1, headers ? { headers } : undefined);
      if (response.status === 304) return { status: "not_modified", candidates: [], pagesFetched: 0, quotaUnits };

      const body = await response.json() as YoutubeListWrapper<YoutubePlaylistItem>;
      if (!response.ok) {
        return {
          status: response.status === 403 ? "quota_exceeded" : "error",
          candidates: [],
          pagesFetched,
          quotaUnits,
        };
      }
      pagesFetched += 1;
      if (page === 0) etag = body.etag ?? etag;
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
      const page = await this.fetchPlaylistItemsPage({ playlistId, pageToken });
      quotaUnits += page.quotaUnits;
      if (page.status !== "ok") {
        return {
          status: page.status,
          items: [],
          pagesFetched,
          quotaUnits,
        };
      }

      pagesFetched += page.pagesFetched;
      items.push(...page.items);
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }

    return { status: "ok", items, pagesFetched, quotaUnits };
  }

  async fetchPlaylistItemsPage(input: {
    playlistId: string;
    pageToken?: string;
  }): Promise<YoutubeFetchPlaylistItemsPageResult> {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails,status");
    url.searchParams.set("playlistId", input.playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", this.options.apiKey);
    if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);

    const response = await this.fetchAndRecord(url, "youtube.playlistItems.list", 1);
    const body = await response.json() as YoutubeListWrapper<YoutubePlaylistItem>;
    if (!response.ok) {
      return {
        status: response.status === 403 ? "quota_exceeded" : "error",
        items: [],
        pagesFetched: 0,
        quotaUnits: 1,
      };
    }

    return {
      status: "ok",
      items: (body.items ?? []).flatMap((item) => this.toMusicPlaylistItem(item)),
      nextPageToken: body.nextPageToken,
      pagesFetched: 1,
      quotaUnits: 1,
    };
  }

  async fetchVideos(videoIds: string[]): Promise<YoutubeFetchVideosResult> {
    return this.getVideoDetails(videoIds);
  }

  async getVideoDetails(videoIds: string[]): Promise<YoutubeFetchVideosResult> {
    const details: YoutubeVideoDetail[] = [];
    for (const ids of chunk(videoIds, 50)) {
      if (ids.length === 0) continue;
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet,contentDetails,status,liveStreamingDetails");
      url.searchParams.set("id", ids.join(","));
      url.searchParams.set("key", this.options.apiKey);

      const response = await this.fetchAndRecord(url, "youtube.videos.list", 1);
      const body = await response.json() as YoutubeListWrapper<YoutubeVideoItem>;
      // A failed chunk must never be reported as a successful (partial) result: callers
      // treat a missing detail as "private", so swallowing a 403/5xx here would hide
      // whole pages of the catalog. Surface the failure and let the caller retry.
      if (!response.ok) {
        return { status: response.status === 403 ? "quota_exceeded" : "error", items: [] };
      }
      details.push(...(body.items ?? []).flatMap((item) => this.toVideoDetail(item)));
    }
    return { status: "ok", items: details };
  }

  private async fetchAndRecord(url: URL, operation: string, quotaUnits: number, init?: RequestInit): Promise<Response> {
    const requestedAt = new Date();
    try {
      const response = await this.fetchImpl(url.toString(), init);
      const resultStatus = resultStatusFromHttpStatus(response.status, { quotaStatusCode: 403 });
      await recordExternalApiCall(this.options.apiCallLogger, {
        source: "youtube",
        operation,
        method: init?.method ?? "GET",
        url: url.toString(),
        statusCode: response.status,
        resultStatus,
        quotaUnits,
        rateLimited: response.status === 429,
        errorCode: response.ok || response.status === 304 ? undefined : `http_${response.status}`,
        errorReason: response.ok || response.status === 304 ? undefined : resultStatus,
        requestedAt
      });
      return response;
    } catch (error) {
      const resultStatus = resultStatusFromError(error);
      await recordExternalApiCall(this.options.apiCallLogger, {
        source: "youtube",
        operation,
        method: init?.method ?? "GET",
        url: url.toString(),
        resultStatus,
        quotaUnits: 0,
        errorCode: resultStatus,
        errorReason: resultStatus,
        requestedAt
      });
      throw error;
    }
  }

  private toChannelProfile(item: YoutubeChannelItem): YoutubeChannelProfile[] {
    if (!item.id) return [];
    const thumbnail = pickChannelProfileThumbnail(item.snippet?.thumbnails);
    return [{
      channelId: item.id,
      title: item.snippet?.title,
      customUrl: item.snippet?.customUrl,
      handle: item.snippet?.handle,
      profileImageUrl: thumbnail?.url,
      fetchedAt: new Date().toISOString(),
    }];
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
      playlistItemId: item.id,
      videoId,
      title: item.snippet?.title ?? "",
      publishedAt: normalizeDate(item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt),
      position: item.snippet?.position,
      channelId: item.snippet?.channelId,
      channelTitle: item.snippet?.channelTitle,
      privacyStatus: item.status?.privacyStatus,
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
      dimension: item.contentDetails?.dimension,
      definition: item.contentDetails?.definition,
      caption: item.contentDetails?.caption,
      privacyStatus: item.status?.privacyStatus,
      embeddable: item.status?.embeddable,
      madeForKids: item.status?.madeForKids,
      liveBroadcastContent: item.snippet?.liveBroadcastContent,
      scheduledStartTime: item.liveStreamingDetails?.scheduledStartTime
        ? normalizeDate(item.liveStreamingDetails.scheduledStartTime)
        : undefined,
      actualStartTime: item.liveStreamingDetails?.actualStartTime
        ? normalizeDate(item.liveStreamingDetails.actualStartTime)
        : undefined,
      actualEndTime: item.liveStreamingDetails?.actualEndTime
        ? normalizeDate(item.liveStreamingDetails.actualEndTime)
        : undefined,
      thumbnailUrl: thumbnail?.url,
      thumbnailWidth: thumbnail?.width,
      thumbnailHeight: thumbnail?.height,
    }];
  }
}

export default YoutubeDataApiClient;
