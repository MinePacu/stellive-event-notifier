import type { AppEnv } from "../config/env.js";
import { loadEnv } from "../config/env.js";
import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import { DeliveryAttemptRepository, emptyDailyDeliveryQueueTrend } from "../repositories/deliveryAttemptRepository.js";
import { ExternalApiCallLogRepository, emptyExternalApiCallTrend } from "../repositories/externalApiCallLogRepository.js";
import { PlatformApiStateRepository } from "../repositories/platformApiStateRepository.js";
import { getPrismaClient } from "../storage/prisma.js";
import { getConfiguredSecretState } from "./adminAuth.js";
import type { AdapterHealth, AdminOverview } from "./adminTypes.js";

interface AdminPrismaClient {
  $queryRaw(strings: TemplateStringsArray): Promise<unknown>;
}

const neverCheckedAt = new Date(0).toISOString();
const defaultAdapterHealth: AdapterHealth[] = [
  { source: "youtube", status: "disabled", reason: "youtube_websub_disabled", lastCheckedAt: neverCheckedAt },
  { source: "chzzk", status: "verify_required", reason: "chzzk_allowed_api_not_confirmed", lastCheckedAt: neverCheckedAt },
  { source: "x", status: "disabled", reason: "x_no_free_official_api", lastCheckedAt: neverCheckedAt },
  { source: "naver_cafe", status: "disabled", reason: "naver_cafe_search_disabled", lastCheckedAt: neverCheckedAt }
];

export class AdminHealthService {
  constructor(
    private readonly env: AppEnv = loadEnv(),
    private readonly jobs = new NotificationJobRepository(),
    private readonly deliveryAttempts = new DeliveryAttemptRepository(),
    private readonly externalApiCalls = new ExternalApiCallLogRepository(),
    private readonly platformApiState = new PlatformApiStateRepository(),
    private readonly prisma: AdminPrismaClient = getPrismaClient() as unknown as AdminPrismaClient
  ) {}

  async overview(): Promise<AdminOverview> {
    const [queue, recentDelivery, dailyDeliveryQueue, externalApiDaily, adapterState, database] = await Promise.all([
      this.readQueueSummary(),
      this.readRecentDeliverySummary(),
      this.readDailyDeliveryQueue(),
      this.readExternalApiDaily(),
      this.readAdapterHealth(),
      this.databaseStatus()
    ]);
    const adapterBySource = new Map(adapterState.map((adapter) => [adapter.source, adapter]));

    return {
      service: {
        name: "stellive-hub-api",
        environment: this.env.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime())
      },
      database,
      featureFlags: this.featureFlags(),
      secrets: this.secretReadiness(),
      queue,
      adapters: defaultAdapterHealth.map((fallback) => adapterBySource.get(fallback.source) ?? fallback),
      recentDelivery,
      dailyDeliveryQueue,
      externalApiCalls: {
        daily: externalApiDaily
      }
    };
  }

  private featureFlags(): AdminOverview["featureFlags"] {
    return {
      YOUTUBE_WEBSUB_ENABLED: this.env.YOUTUBE_WEBSUB_ENABLED,
      YOUTUBE_DATA_API_FALLBACK_ENABLED: this.env.YOUTUBE_DATA_API_FALLBACK_ENABLED,
      X_API_COST_POLICY: this.env.X_API_COST_POLICY,
      X_FREE_API_ENABLED: this.env.X_FREE_API_ENABLED,
      X_FREE_STREAM_ENABLED: this.env.X_FREE_STREAM_ENABLED,
      X_FREE_POLLING_ENABLED: this.env.X_FREE_POLLING_ENABLED,
      NAVER_CAFE_SEARCH_ENABLED: this.env.NAVER_CAFE_SEARCH_ENABLED,
      CHZZK_LIVE_POLLING_ENABLED: this.env.CHZZK_LIVE_POLLING_ENABLED,
      DB_NOTIFICATION_QUEUE_ENABLED: this.env.DB_NOTIFICATION_QUEUE_ENABLED,
      FOREGROUND_SSE_ENABLED: this.env.FOREGROUND_SSE_ENABLED,
      ADMIN_CONSOLE_ENABLED: this.env.ADMIN_CONSOLE_ENABLED
    };
  }

  private secretReadiness(): AdminOverview["secrets"] {
    return getConfiguredSecretState({
      DATABASE_URL: this.env.DATABASE_URL,
      INTERNAL_API_TOKEN: this.env.INTERNAL_API_TOKEN,
      ADMIN_CONSOLE_TOKEN: this.env.ADMIN_CONSOLE_TOKEN,
      FCM_PROJECT_ID: this.env.FCM_PROJECT_ID,
      FCM_CLIENT_EMAIL: this.env.FCM_CLIENT_EMAIL,
      FCM_PRIVATE_KEY: this.env.FCM_PRIVATE_KEY,
      YOUTUBE_API_KEY: this.env.YOUTUBE_API_KEY,
      YOUTUBE_WEBSUB_CALLBACK_URL: this.env.YOUTUBE_WEBSUB_CALLBACK_URL,
      YOUTUBE_WEBSUB_VERIFY_TOKEN: this.env.YOUTUBE_WEBSUB_VERIFY_TOKEN,
      X_BEARER_TOKEN: this.env.X_BEARER_TOKEN,
      NAVER_CLIENT_ID: this.env.NAVER_CLIENT_ID,
      NAVER_CLIENT_SECRET: this.env.NAVER_CLIENT_SECRET,
      CHZZK_CLIENT_ID: this.env.CHZZK_CLIENT_ID,
      CHZZK_CLIENT_SECRET: this.env.CHZZK_CLIENT_SECRET,
      CHZZK_ACCESS_TOKEN: this.env.CHZZK_ACCESS_TOKEN,
      CHZZK_REFRESH_TOKEN: this.env.CHZZK_REFRESH_TOKEN
    });
  }

  private async readQueueSummary(): Promise<AdminOverview["queue"]> {
    try {
      return await this.jobs.summarize();
    } catch {
      return { queued: 0, locked: 0, completed: 0, failed: 0 };
    }
  }

  private async readRecentDeliverySummary(): Promise<AdminOverview["recentDelivery"]> {
    try {
      return await this.deliveryAttempts.summarizeRecent();
    } catch {
      return { sent: 0, queued: 0, skipped: 0, failed: 0 };
    }
  }

  private async readDailyDeliveryQueue(): Promise<AdminOverview["dailyDeliveryQueue"]> {
    try {
      return await this.deliveryAttempts.summarizeDailyBuckets({ days: 14, timezone: "Asia/Seoul" });
    } catch {
      return emptyDailyDeliveryQueueTrend(14);
    }
  }

  private async readExternalApiDaily(): Promise<AdminOverview["externalApiCalls"]["daily"]> {
    try {
      return await this.externalApiCalls.summarizeDaily({ days: 14, timezone: "Asia/Seoul" });
    } catch {
      return emptyExternalApiCallTrend(14);
    }
  }

  private async readAdapterHealth(): Promise<AdapterHealth[]> {
    try {
      return await this.platformApiState.listAdapterHealth();
    } catch {
      return [];
    }
  }

  private async databaseStatus(): Promise<AdminOverview["database"]> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", reason: "database_ready" };
    } catch {
      return { status: "degraded", reason: "database_unavailable" };
    }
  }
}
