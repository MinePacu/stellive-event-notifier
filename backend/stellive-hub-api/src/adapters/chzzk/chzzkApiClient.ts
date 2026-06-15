import z from "zod";
import type { AdapterHealthStatus } from "../../admin/adminTypes.js";
import type { PlatformApiStateRepository } from "../../repositories/platformApiStateRepository.js";

const liveListUrl = "https://openapi.chzzk.naver.com/open/v1/lives";
const channelsUrl = "https://openapi.chzzk.naver.com/open/v1/channels";
const channelUrl = "https://chzzk.naver.com/live";

const liveItemSchema = z
  .object({
    channelId: z.string().optional(),
    liveId: z.union([z.string(), z.number()]).optional(),
    liveTitle: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
    liveStatus: z.string().optional(),
    openDate: z.string().optional(),
    liveStartDate: z.string().optional(),
    channelImageUrl: z.string().nullable().optional(),
    concurrentUserCount: z.union([z.number(), z.string()]).optional(),
    viewerCount: z.union([z.number(), z.string()]).optional(),
    liveUrl: z.string().nullable().optional()
  })
  .passthrough();

const liveListResponseSchema = z
  .object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().nullable().optional(),
    content: z
      .object({
        page: z
          .object({
            next: z.string().nullable().optional()
          })
          .passthrough()
          .optional(),
        data: z.array(liveItemSchema).default([])
      })
      .passthrough()
  })
  .passthrough();

const channelItemSchema = z
  .object({
    channelId: z.string().optional(),
    channelImageUrl: z.string().nullable().optional()
  })
  .passthrough();

const channelResponseSchema = z
  .object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().nullable().optional(),
    content: z
      .object({
        data: z.array(channelItemSchema).default([])
      })
      .passthrough()
  })
  .passthrough();

export interface ChzzkNormalizedLiveStatus {
  channelId: string;
  isLive: boolean;
  title?: string;
  channelImageUrl?: string;
  openDate?: string;
  viewerCount?: number;
  platformUrl?: string;
  sourceVerificationState: "verified" | "verify_required";
}

interface ChzzkChannelMetadata {
  channelId: string;
  channelImageUrl?: string;
  sourceVerificationState: "verified" | "verify_required";
}

interface ChzzkApiClientOptions {
  clientId: string;
  clientSecret: string;
  stateRepository: Pick<PlatformApiStateRepository, "upsertAdapterHealth">;
  fetch?: typeof fetch;
  timeoutMs?: number;
  liveListPageSize?: number;
}

function isLiveStatus(status: string | undefined): boolean {
  return status === "OPEN" || status === "LIVE";
}

function parseViewerCount(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function buildPlatformUrl(channelId: string): string {
  return `${channelUrl}/${encodeURIComponent(channelId)}`;
}

function verifiedOfflineStatus(channelId: string): ChzzkNormalizedLiveStatus {
  return {
    channelId,
    isLive: false,
    platformUrl: buildPlatformUrl(channelId),
    sourceVerificationState: "verified"
  };
}

function unverifiedStatus(channelId: string): ChzzkNormalizedLiveStatus {
  return {
    channelId,
    isLive: false,
    platformUrl: buildPlatformUrl(channelId),
    sourceVerificationState: "verify_required"
  };
}

function unverifiedChannelMetadata(channelId: string): ChzzkChannelMetadata {
  return {
    channelId,
    sourceVerificationState: "verify_required"
  };
}

function normalizeLiveStatus(
  channelId: string,
  item: z.infer<typeof liveItemSchema>
): ChzzkNormalizedLiveStatus {
  const status = item.status ?? item.liveStatus;

  return {
    channelId,
    isLive: status ? isLiveStatus(status) : true,
    title: item.liveTitle ?? item.title,
    channelImageUrl: item.channelImageUrl ?? undefined,
    openDate: item.openDate ?? item.liveStartDate,
    viewerCount: parseViewerCount(item.concurrentUserCount ?? item.viewerCount),
    platformUrl: item.liveUrl ?? buildPlatformUrl(channelId),
    sourceVerificationState: "verified"
  };
}

export class ChzzkApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly liveListPageSize: number;

  constructor(private readonly options: ChzzkApiClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.liveListPageSize = options.liveListPageSize ?? 20;
  }

  async getLiveStatus(channelId: string): Promise<ChzzkNormalizedLiveStatus> {
    const liveStatus = await this.findLiveStatus(channelId);
    if (liveStatus.sourceVerificationState !== "verified" || liveStatus.channelImageUrl) {
      return liveStatus;
    }

    const metadata = await this.getChannelMetadata(channelId);
    if (metadata.sourceVerificationState !== "verified") {
      return liveStatus;
    }

    return {
      ...liveStatus,
      channelImageUrl: metadata.channelImageUrl
    };
  }

  private async findLiveStatus(channelId: string): Promise<ChzzkNormalizedLiveStatus> {
    let next: string | undefined;

    do {
      const response = await this.fetchLiveList(next);
      if (!response.ok) {
        return this.handleLiveListError(channelId, response);
      }

      const parsed = liveListResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        await this.writeHealth("verify_required", "chzzk_live_api_response_invalid");
        return unverifiedStatus(channelId);
      }

      await this.writeHealth("enabled", "chzzk_live_api_verified");

      const match = parsed.data.content.data.find((item) => item.channelId === channelId);
      if (match) {
        return normalizeLiveStatus(channelId, match);
      }

      next = parsed.data.content.page?.next ?? undefined;
    } while (next);

    return verifiedOfflineStatus(channelId);
  }

  private async getChannelMetadata(channelId: string): Promise<ChzzkChannelMetadata> {
    const response = await this.fetchChannelMetadata(channelId);
    if (!response.ok) {
      return this.handleChannelMetadataError(channelId, response);
    }

    const parsed = channelResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      await this.writeHealth("verify_required", "chzzk_channel_api_response_invalid");
      return unverifiedChannelMetadata(channelId);
    }

    const match = parsed.data.content.data.find((item) => item.channelId === channelId);
    if (!match) {
      await this.writeHealth("verify_required", "chzzk_channel_api_channel_missing");
      return unverifiedChannelMetadata(channelId);
    }

    return {
      channelId,
      channelImageUrl: match.channelImageUrl ?? undefined,
      sourceVerificationState: "verified"
    };
  }

  private async handleLiveListError(
    channelId: string,
    response: Response
  ): Promise<ChzzkNormalizedLiveStatus> {
    if (response.status === 429) {
      await this.writeHealth("rate_limited", "chzzk_live_api_rate_limited");
      return unverifiedStatus(channelId);
    }

    if (response.status === 401 || response.status === 403) {
      await this.writeHealth("verify_required", "chzzk_live_api_auth_required");
      return unverifiedStatus(channelId);
    }

    await this.writeHealth("verify_required", `chzzk_live_api_http_${response.status}`);
    return unverifiedStatus(channelId);
  }

  private async handleChannelMetadataError(
    channelId: string,
    response: Response
  ): Promise<ChzzkChannelMetadata> {
    if (response.status === 429) {
      await this.writeHealth("rate_limited", "chzzk_channel_api_rate_limited");
      return unverifiedChannelMetadata(channelId);
    }

    if (response.status === 401 || response.status === 403) {
      await this.writeHealth("verify_required", "chzzk_channel_api_auth_required");
      return unverifiedChannelMetadata(channelId);
    }

    await this.writeHealth("verify_required", `chzzk_channel_api_http_${response.status}`);
    return unverifiedChannelMetadata(channelId);
  }

  private async fetchLiveList(next?: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = new URL(liveListUrl);
    url.searchParams.set("size", String(this.liveListPageSize));
    if (next) {
      url.searchParams.set("next", next);
    }

    try {
      return await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: this.clientAuthHeaders(),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchChannelMetadata(channelId: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = new URL(channelsUrl);
    url.searchParams.set("channelIds", channelId);

    try {
      return await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: this.clientAuthHeaders(),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private clientAuthHeaders(): Record<string, string> {
    return {
      "Client-Id": this.options.clientId,
      "Client-Secret": this.options.clientSecret,
      "Content-Type": "application/json"
    };
  }

  private async writeHealth(status: AdapterHealthStatus, reason: string): Promise<void> {
    await this.options.stateRepository.upsertAdapterHealth("chzzk", {
      source: "chzzk",
      status,
      reason,
      lastCheckedAt: new Date().toISOString()
    });
  }
}

export default ChzzkApiClient;
