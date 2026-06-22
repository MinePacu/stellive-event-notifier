import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RouteGenericInterface,
  RouteShorthandOptions
} from "fastify";
import { authenticateBearerToken } from "../admin/adminAuth.js";
import { AdminHealthService } from "../admin/adminHealthService.js";
import type {
  AdapterHealth,
  AdminOverview,
  DeliveryAttemptDiagnostic,
  LiveStatusDiagnostic,
  NotificationJobDiagnostic,
  WebhookSubscriptionDiagnostic
} from "../admin/adminTypes.js";
import type { ChzzkLiveAdapterCounts } from "../adapters/chzzk/chzzkOpenApiAdapter.js";
import type { NotificationWorkerDrainInput, NotificationWorkerDrainResult } from "../jobs/notificationWorker.js";
import type { AppEnv } from "../config/env.js";
import { productionHubCalendarSpecialDays } from "../hub-events/hubCalendarSpecialDayCatalog.js";
import { buildSpecialDayOccurrences } from "../hub-events/hubCalendarSpecialDayMaterializer.js";
import {
  HubCalendarSpecialDayOccurrenceRepository,
  type MaterializeSpecialDayYearResult
} from "../hub-events/hubCalendarSpecialDayOccurrenceRepository.js";
import { HubEventRepository, type HubEventStatusReconcileResult } from "../hub-events/hubEventRepository.js";
import { NotificationJobRepository } from "../jobs/notificationJobRepository.js";
import { DeliveryAttemptRepository } from "../repositories/deliveryAttemptRepository.js";
import { LiveStatusRepository } from "../repositories/liveStatusRepository.js";
import { PlatformApiStateRepository } from "../repositories/platformApiStateRepository.js";
import { WebhookSubscriptionRepository } from "../repositories/webhookSubscriptionRepository.js";

interface LimitQuery {
  limit?: string | number;
}

type MaybePromise<T> = T | Promise<T>;
type ProtectedHandler<RouteGeneric extends RouteGenericInterface = RouteGenericInterface> = (
  request: FastifyRequest<RouteGeneric>,
  reply: FastifyReply
) => MaybePromise<unknown>;

export interface InternalRouteDependencies {
  adminHealthService: {
    overview(): MaybePromise<AdminOverview>;
  };
  notificationJobs: {
    listDiagnostics(limit: number): MaybePromise<NotificationJobDiagnostic[]>;
  };
  webhookSubscriptions: {
    listDiagnostics(limit: number): MaybePromise<WebhookSubscriptionDiagnostic[]>;
  };
  liveStatus: {
    listDiagnostics(limit: number): MaybePromise<LiveStatusDiagnostic[]>;
  };
  deliveryAttempts: {
    listRecent(limit: number): MaybePromise<DeliveryAttemptDiagnostic[]>;
  };
  adapterHealth: {
    getState(source: string, key: string): MaybePromise<{ value: unknown } | null>;
    listAdapterHealth(): MaybePromise<AdapterHealth[]>;
  };
  notificationWorker?: {
    drain(input: NotificationWorkerDrainInput): MaybePromise<NotificationWorkerDrainResult>;
  };
  youtubeSubscriptionScheduler?: {
    renewSubscriptions(): MaybePromise<{
      status: "ok" | "partial_failure";
      renewed: number;
      failed: number;
      skipped: number;
    }>;
  };
  youtubeSongBackfillScheduler?: {
    backfill(): MaybePromise<{
      status: "ok";
      checkedChannels: number;
      skippedChannels: number;
      pagesFetched: number;
      quotaUnits: number;
      ingested: number;
      skipped: number;
      notModified: number;
      failed: number;
    }>;
    reconcile(): MaybePromise<{
      status: "ok";
      checkedChannels: number;
      skippedChannels: number;
      pagesFetched: number;
      quotaUnits: number;
      ingested: number;
      skipped: number;
      notModified: number;
      failed: number;
    }>;
  };
  chzzkLiveAdapter?: {
    pollLiveStatuses(): MaybePromise<ChzzkLiveAdapterCounts>;
  };
  specialDayYearMaterializer: {
    materializeYear(input: { targetYear?: number; dryRun?: boolean; now?: Date }): MaybePromise<MaterializeSpecialDayYearResult>;
  };
  hubEventStatuses: {
    reconcileDueStatuses(now: Date): MaybePromise<HubEventStatusReconcileResult>;
  };
  now?: () => Date;
}

export interface InternalRouteOptions {
  env: AppEnv;
  dependencies?: Partial<InternalRouteDependencies>;
}

const neverCheckedAt = new Date(0).toISOString();

const fallbackAdapterHealth: AdapterHealth[] = [
  { source: "youtube", status: "disabled", reason: "youtube_websub_disabled", lastCheckedAt: neverCheckedAt },
  { source: "chzzk", status: "verify_required", reason: "chzzk_allowed_api_not_confirmed", lastCheckedAt: neverCheckedAt },
  { source: "x", status: "disabled", reason: "x_no_free_official_api", lastCheckedAt: neverCheckedAt },
  { source: "naver_cafe", status: "disabled", reason: "naver_cafe_collection_deferred", lastCheckedAt: neverCheckedAt }
];

function mergeAdapterHealthWithFallback(health: AdapterHealth[]): AdapterHealth[] {
  const healthBySource = new Map(health.map((adapter) => [adapter.source, adapter]));
  return fallbackAdapterHealth.map((fallback) => healthBySource.get(fallback.source) ?? fallback);
}

function parseInternalLimit(value: unknown, defaultLimit: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return defaultLimit;
  if (parsed <= 0) return defaultLimit;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function kstYear(value: Date): number {
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(value);
  return Number(year);
}

function parseSpecialDayMaterializationBody(
  body: unknown,
  now: Date
): { ok: true; value: { targetYear: number; dryRun: boolean; now: Date } } | { ok: false } {
  if (body !== undefined && body !== null && (typeof body !== "object" || Array.isArray(body))) return { ok: false };
  const input = (body ?? {}) as { targetYear?: unknown; dryRun?: unknown };
  if (input.targetYear !== undefined) {
    const targetYear = typeof input.targetYear === "number" ? input.targetYear : Number(input.targetYear);
    if (!Number.isInteger(targetYear) || targetYear < 2020 || targetYear > 2100) return { ok: false };
    if (input.dryRun !== undefined && typeof input.dryRun !== "boolean") return { ok: false };
    return { ok: true, value: { targetYear, dryRun: input.dryRun === true, now } };
  }
  if (input.dryRun !== undefined && typeof input.dryRun !== "boolean") return { ok: false };
  return { ok: true, value: { targetYear: kstYear(now), dryRun: input.dryRun === true, now } };
}

function hasOnlyNotificationDrainFields(body: unknown): boolean {
  if (body === undefined || body === null) return true;
  if (typeof body !== "object" || Array.isArray(body)) return false;
  return Object.keys(body).every((key) => key === "limit");
}

function readAuthorizationHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function createProtectedRoute(env: AppEnv, handler: ProtectedHandler): ProtectedHandler {
  return async (request, reply) => {
    const auth = authenticateBearerToken(readAuthorizationHeader(request.headers.authorization), env.INTERNAL_API_TOKEN);
    if (!auth.ok) {
      return reply.code(401).send({ error: auth.reason });
    }

    return handler(request, reply);
  };
}

function defaultDependencies(env: AppEnv): InternalRouteDependencies {
  const adapterHealth = new PlatformApiStateRepository();
  const specialDayOccurrences = new HubCalendarSpecialDayOccurrenceRepository();
  const hubEventRepository = new HubEventRepository();

  return {
    adminHealthService: new AdminHealthService(env),
    notificationJobs: new NotificationJobRepository(),
    webhookSubscriptions: new WebhookSubscriptionRepository(),
    liveStatus: new LiveStatusRepository(),
    deliveryAttempts: new DeliveryAttemptRepository(),
    adapterHealth,
    specialDayYearMaterializer: {
      async materializeYear(input) {
        const targetYear = input.targetYear ?? kstYear(input.now ?? new Date());
        const occurrences = buildSpecialDayOccurrences(productionHubCalendarSpecialDays, {
          targetYear,
          timezone: "Asia/Seoul"
        });
      return specialDayOccurrences.upsertYear(occurrences, {
        dryRun: input.dryRun,
        targetYear
      });
    }
    },
    hubEventStatuses: {
      reconcileDueStatuses: (now) => hubEventRepository.reconcileDueStatuses(now)
    }
  };
}

export async function registerInternalRoutes(app: FastifyInstance, options: InternalRouteOptions): Promise<void> {
  const dependencies: InternalRouteDependencies = {
    ...defaultDependencies(options.env),
    ...options.dependencies
  };

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/internal/")) return;
    if (request.method === "OPTIONS") return;

    const auth = authenticateBearerToken(readAuthorizationHeader(request.headers.authorization), options.env.INTERNAL_API_TOKEN);
    if (!auth.ok) {
      return reply.code(401).send({ error: auth.reason });
    }
  });

  app.get("/v1/internal/admin/overview", async () => dependencies.adminHealthService.overview());

  app.get<{ Querystring: LimitQuery }>("/v1/internal/adapters/health", async () => {
    const health = await dependencies.adapterHealth.listAdapterHealth();
    return mergeAdapterHealthWithFallback(health);
  });

  app.get<{ Querystring: LimitQuery }>("/v1/internal/jobs/notifications", async (request) => {
    const limit = parseInternalLimit(request.query.limit, 25);
    return dependencies.notificationJobs.listDiagnostics(limit);
  });

  app.get<{ Querystring: LimitQuery }>("/v1/internal/webhooks/subscriptions", async (request) => {
    const limit = parseInternalLimit(request.query.limit, 25);
    return dependencies.webhookSubscriptions.listDiagnostics(limit);
  });

  app.post("/v1/internal/jobs/notifications/drain", async (request, reply) => {
    const body = request.body as { limit?: unknown } | undefined;
    if (!hasOnlyNotificationDrainFields(body)) {
      return reply.code(400).send({ error: "notification_drain_body_invalid" });
    }
    const requestedLimit = parseInternalLimit(body?.limit ?? (request.query as LimitQuery).limit, 25);

    if (dependencies.notificationWorker) {
      return dependencies.notificationWorker.drain({ limit: requestedLimit });
    }

    return {
      claimed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      sent: 0,
      queued: 0,
      status: "disabled",
      reason: "notification_worker_not_configured"
    };
  });

  app.post("/v1/internal/schedulers/youtube/renew-subscriptions", async () => {
    if (!options.env.YOUTUBE_WEBSUB_ENABLED) {
      return { status: "disabled", reason: "youtube_websub_disabled" };
    }

    if (!dependencies.youtubeSubscriptionScheduler) {
      return { status: "not_available", reason: "youtube_subscription_renewal_not_configured" };
    }

    return dependencies.youtubeSubscriptionScheduler.renewSubscriptions();
  });

  app.post("/v1/internal/schedulers/youtube/song-backfill", async () => {
    if (!options.env.YOUTUBE_DATA_API_FALLBACK_ENABLED) {
      return { status: "disabled", reason: "youtube_data_api_fallback_disabled" };
    }

    if (!dependencies.youtubeSongBackfillScheduler) {
      return { status: "not_available", reason: "youtube_song_backfill_not_configured" };
    }

    return dependencies.youtubeSongBackfillScheduler.backfill();
  });

  app.post("/v1/internal/schedulers/youtube/song-reconcile", async () => {
    if (!options.env.YOUTUBE_DATA_API_FALLBACK_ENABLED) {
      return { status: "disabled", reason: "youtube_data_api_fallback_disabled" };
    }

    if (!dependencies.youtubeSongBackfillScheduler) {
      return { status: "not_available", reason: "youtube_song_backfill_not_configured" };
    }

    return dependencies.youtubeSongBackfillScheduler.reconcile();
  });

  app.post("/v1/internal/schedulers/chzzk/live-status", async () => {
    if (!options.env.CHZZK_LIVE_POLLING_ENABLED) {
      return { status: "disabled", reason: "chzzk_live_polling_disabled" };
    }

    const tokenState = await dependencies.adapterHealth.getState("chzzk", "oauth.accessToken");
    if (!tokenState) {
      return { status: "verify_required", reason: "chzzk_oauth_token_missing" };
    }

    if (!dependencies.chzzkLiveAdapter) {
      return { status: "not_available", reason: "chzzk_live_adapter_not_configured" };
    }

    const counts = await dependencies.chzzkLiveAdapter.pollLiveStatuses();
    return { status: "ok", counts };
  });

  app.post("/v1/internal/schedulers/hub-events/special-days/materialize-year", async (request, reply) => {
    const now = dependencies.now?.() ?? new Date();
    const parsed = parseSpecialDayMaterializationBody(request.body, now);
    if (!parsed.ok) return reply.code(400).send({ error: "special_day_materialization_body_invalid" });

    const result = await dependencies.specialDayYearMaterializer.materializeYear(parsed.value);
    return { ok: true, ...result };
  });

  app.post("/v1/internal/schedulers/hub-events/statuses/reconcile", async () => {
    const now = dependencies.now?.() ?? new Date();
    return dependencies.hubEventStatuses.reconcileDueStatuses(now);
  });

  app.get<{ Querystring: LimitQuery }>("/v1/internal/live-status", async (request) => {
    const limit = parseInternalLimit(request.query.limit, 50);
    return dependencies.liveStatus.listDiagnostics(limit);
  });

  app.get<{ Querystring: LimitQuery }>("/v1/internal/delivery-attempts", async (request) => {
    const limit = parseInternalLimit(request.query.limit, 25);
    return dependencies.deliveryAttempts.listRecent(limit);
  });
}

export default registerInternalRoutes;
