import { z } from "zod";
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
    concurrentUserCount: z.union([z.number(), z.string()]).optional(),
    viewerCount: z.union([z.number(), z.string()]).optional(),
    liveUrl: z.string().url().optional()
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

export interface ChzzkNormalizedLiveStatus {
  channelId: string;
  isLive: boolean;
  title?: string;
  openDate?: string;
  viewerCount?: number;
  platformUrl?: string;
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
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function platformUrl(channelId: string): string {
  return `${channelUrl}/${encodeURIComponent(channelId)}`;
}

function verifiedOfflineStatus(channelId: string): ChzzkNormalizedLiveStatus {
  return {
    channelId,
    isLive: false,
    platformUrl: platformUrl(channelId),
    sourceVerificationState: "verified"
  };
}

function unverifiedStatus(channelId: string): ChzzkNormalizedLiveStatus {
  return {
    channelId,
    isLive: false,
    platformUrl: platformUrl(channelId),
    sourceVerificationState: "verify_required"
  };
}

function normalizeLiveStatus(channelId: string, item: z.infer<typeof liveItemSchema>): ChzzkNormalizedLiveStatus {
  const normalizedChannelId = item.channelId ?? channelId;
  return {
    channelId: normalizedChannelId,
    isLive: isLiveStatus(item.status ?? item.liveStatus),
    title: item.liveTitle ?? item.title,
    openDate: item.openDate ?? item.liveStartDate,
    viewerCount: parseViewerCount(item.concurrentUserCount ?? item.viewerCount),
    platformUrl: item.liveUrl ?? platformUrl(normalizedChannelId),
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
    let next: string | undefined;

    do {
      const response = await this.fetchLiveList(next);
      if (!response.ok) return this.handleLiveListError(channelId, response);

      const parsed = liveListResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        await this.writeHealth("verify_required", "chzzk_live_api_response_invalid");
        return unverifiedStatus(channelId);
      }

      await this.writeHealth("enabled", "chzzk_live_api_verified");

      const match = parsed.data.content.data.find((item) => item.channelId === channelId);
      if (match) return normalizeLiveStatus(channelId, match);

      next = parsed.data.content.page?.next ?? undefined;
    } while (next);

    return verifiedOfflineStatus(channelId);
  }

  private async handleLiveListError(channelId: string, response: Response): Promise<ChzzkNormalizedLiveStatus> {
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

  private async fetchLiveList(next?: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = new URL(liveListUrl);
    url.searchParams.set("size", String(this.liveListPageSize));
    if (next) url.searchParams.set("next", next);

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
