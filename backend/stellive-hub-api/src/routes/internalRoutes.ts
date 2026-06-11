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
import type { AppEnv } from "../config/env.js";
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
  chzzkLiveAdapter?: {
    pollLiveStatuses(): MaybePromise<ChzzkLiveAdapterCounts>;
  };
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

function parseInternalLimit(value: unknown, defaultLimit: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return defaultLimit;
  if (parsed <= 0) return defaultLimit;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
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

  return {
    adminHealthService: new AdminHealthService(env),
    notificationJobs: new NotificationJobRepository(),
    webhookSubscriptions: new WebhookSubscriptionRepository(),
    liveStatus: new LiveStatusRepository(),
    deliveryAttempts: new DeliveryAttemptRepository(),
    adapterHealth
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
    return health.length ? health : fallbackAdapterHealth;
  });

  app.get<{ Querystring: LimitQuery }>("/v1/internal/jobs/notifications", async (request) => {
    const limit = parseInternalLimit(request.query.limit, 25);
    return dependencies.notificationJobs.listDiagnostics(limit);
  });

  app.get<{ Querystring: LimitQuery }>("/v1/internal/webhooks/subscriptions", async (request) => {
    const limit = parseInternalLimit(request.query.limit, 25);
    return dependencies.webhookSubscriptions.listDiagnostics(limit);
  });

  app.post("/v1/internal/jobs/notifications/drain", async (request) => {
    const body = request.body as { limit?: unknown } | undefined;
    const requestedLimit = parseInternalLimit(body?.limit ?? (request.query as LimitQuery).limit, 25);

    return {
      claimed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      status: "not_available",
      reason: "notification_worker_not_available",
      requestedLimit
    };
  });

  app.post("/v1/internal/schedulers/youtube/renew-subscriptions", async () => {
    if (!options.env.YOUTUBE_WEBSUB_ENABLED) {
      return { status: "disabled", reason: "youtube_websub_disabled" };
    }

    return { status: "not_available", reason: "youtube_subscription_renewal_not_implemented" };
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
