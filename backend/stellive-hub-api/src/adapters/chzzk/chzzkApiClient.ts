import z from "zod";
import type { AdapterHealth } from "../../admin/adminTypes.js";
import type { PlatformApiStateRepository } from "../../repositories/platformApiStateRepository.js";
import type { ChzzkAuthClient, ChzzkTokenResponse } from "./chzzkAuthClient.js";

const liveStatusUrl = "https://openapi.chzzk.naver.com/open/v1/lives";
const channelUrl = "https://chzzk.naver.com/live";

const liveContentSchema = z
  .object({
    channelId: z.string().optional(),
    liveTitle: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
    liveStatus: z.string().optional(),
    openDate: z.string().optional(),
    concurrentUserCount: z.number().int().nonnegative().optional(),
    viewerCount: z.number().int().nonnegative().optional(),
    liveUrl: z.string().url().optional(),
    platformUrl: z.string().url().optional()
  })
  .passthrough();

const liveResponseSchema = z
  .object({
    content: liveContentSchema.optional()
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
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface ChzzkApiClientConfig {
  tokenRefreshSkewSeconds?: number;
}

function readStringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const objectValue = value as Record<string, unknown>;
  if (typeof objectValue.value === "string") return objectValue.value;
  if (typeof objectValue.token === "string") return objectValue.token;
  return undefined;
}

function isLiveStatus(status: string | undefined): boolean {
  return status === "OPEN" || status === "LIVE";
}

function unverifiedStatus(channelId: string): ChzzkNormalizedLiveStatus {
  return {
    channelId,
    isLive: false,
    platformUrl: `${channelUrl}/${channelId}`,
    sourceVerificationState: "verify_required"
  };
}

function normalizeLiveStatus(channelId: string, body: unknown): ChzzkNormalizedLiveStatus {
  const parsed = liveResponseSchema.safeParse(body);
  const content = parsed.success ? parsed.data.content : undefined;

  if (!content) return unverifiedStatus(channelId);

  return {
    channelId: content.channelId ?? channelId,
    isLive: isLiveStatus(content.status ?? content.liveStatus),
    title: content.liveTitle ?? content.title,
    openDate: content.openDate,
    viewerCount: content.concurrentUserCount ?? content.viewerCount,
    platformUrl: content.liveUrl ?? content.platformUrl ?? `${channelUrl}/${channelId}`,
    sourceVerificationState: "verified"
  };
}

export class ChzzkApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly authClient: Pick<ChzzkAuthClient, "refreshAccessToken">,
    private readonly stateRepository: Pick<PlatformApiStateRepository, "getState" | "upsertState" | "upsertAdapterHealth">,
    private readonly config: ChzzkApiClientConfig = {},
    options: ChzzkApiClientOptions = {}
  ) {
    void this.config;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getLiveStatus(channelId: string): Promise<ChzzkNormalizedLiveStatus> {
    const token = await this.getAccessToken();
    const response = await this.fetchLiveStatus(channelId, token);

    if (response.status === 401) {
      const refreshedToken = await this.refreshAccessToken();
      const retryResponse = await this.fetchLiveStatus(channelId, refreshedToken);
      return this.handleLiveResponse(channelId, retryResponse);
    }

    return this.handleLiveResponse(channelId, response);
  }

  private async handleLiveResponse(channelId: string, response: Response): Promise<ChzzkNormalizedLiveStatus> {
    if (response.status === 429) {
      await this.writeHealth("rate_limited", "chzzk_live_api_rate_limited");
      return unverifiedStatus(channelId);
    }

    if (!response.ok) {
      await this.writeHealth("verify_required", `chzzk_live_api_http_${response.status}`);
      return unverifiedStatus(channelId);
    }

    return normalizeLiveStatus(channelId, await response.json());
  }

  private async fetchLiveStatus(channelId: string, accessToken: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(`${liveStatusUrl}/${encodeURIComponent(channelId)}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getAccessToken(): Promise<string> {
    const state = await this.stateRepository.getState("chzzk", "oauth.accessToken");
    const token = readStringValue(state?.value);
    if (!token) throw new Error("chzzk_access_token_unavailable");
    return token;
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshState = await this.stateRepository.getState("chzzk", "oauth.refreshToken");
    const refreshToken = readStringValue(refreshState?.value);
    if (!refreshToken) throw new Error("chzzk_refresh_token_unavailable");

    const token = await this.authClient.refreshAccessToken({ refreshToken });
    await this.storeTokenResponse(token);
    return token.accessToken;
  }

  private async storeTokenResponse(token: ChzzkTokenResponse): Promise<void> {
    const refreshedAt = new Date();
    const expiresAt = new Date(refreshedAt.getTime() + token.expiresIn * 1000);

    await this.stateRepository.upsertState("chzzk", "oauth.accessToken", token.accessToken, "enabled");
    await this.stateRepository.upsertState("chzzk", "oauth.refreshToken", token.refreshToken, "enabled");
    await this.stateRepository.upsertState("chzzk", "oauth.expiresAt", expiresAt.toISOString(), "enabled");
    await this.stateRepository.upsertState("chzzk", "oauth.tokenType", token.tokenType, "enabled");
    await this.stateRepository.upsertState("chzzk", "oauth.lastRefreshedAt", refreshedAt.toISOString(), "enabled");

    if (token.scope) {
      await this.stateRepository.upsertState("chzzk", "oauth.scope", token.scope, "enabled");
    }
  }

  private async writeHealth(status: AdapterHealth["status"], reason: string): Promise<void> {
    await this.stateRepository.upsertAdapterHealth("chzzk", {
      source: "chzzk",
      status,
      reason,
      lastCheckedAt: new Date().toISOString()
    });
  }
}

export default ChzzkApiClient;
