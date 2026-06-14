import cors from "@fastify/cors";
import { ChzzkAuthClient } from "./adapters/chzzk/chzzkAuthClient.js";
import ChzzkApiClient from "./adapters/chzzk/chzzkApiClient.js";
import ChzzkOpenApiAdapter from "./adapters/chzzk/chzzkOpenApiAdapter.js";
import { CatalogService } from "./catalog/catalog.js";
import ChzzkEventIngestor from "./events/chzzkEventIngestor.js";
import { LiveStatusRepository } from "./repositories/liveStatusRepository.js";
import { PlatformApiStateRepository } from "./repositories/platformApiStateRepository.js";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyRequest } from "fastify";
import { loadEnv } from "./config/env.js";
import { HubEventRepository } from "./hub-events/hubEventRepository.js";
import NotificationJobRepository from "./jobs/notificationJobRepository.js";
import NotificationWorker from "./jobs/notificationWorker.js";
import BootstrapService from "./mobile/bootstrapService.js";
import { PreferenceResolutionService } from "./preferences/preferenceResolution.js";
import { createFcmClient } from "./push/fcmClient.js";
import { FcmPushSender } from "./push/pushSender.js";
import { DeliveryAttemptRepository } from "./repositories/deliveryAttemptRepository.js";
import DeviceRepository from "./repositories/deviceRepository.js";
import PlatformEventRepository from "./repositories/platformEventRepository.js";
import PreferenceRepository from "./repositories/preferenceRepository.js";
import { type AdminHubEventRouteDependencies, registerAdminHubEventRoutes } from "./routes/adminHubEventRoutes.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import registerChzzkAuthRoutes, { type ChzzkAuthRouteOptions } from "./routes/chzzkAuthRoutes.js";
import { type InternalRouteDependencies, registerInternalRoutes } from "./routes/internalRoutes.js";
import { type AppRouteDependencies, registerRoutes } from "./routes/routes.js";

type EnvOverrides = Record<string, string | boolean | number | undefined>;

export interface BuildAppOptions {
  env?: EnvOverrides;
  useProcessEnv?: boolean;
  chzzkLiveApiFetch?: typeof fetch;
  chzzkAuthRoutes?: {
    dependencies?: Partial<Omit<ChzzkAuthRouteOptions, "env">>;
  };
  internalRoutes?: {
    dependencies?: Partial<InternalRouteDependencies>;
  };
  adminHubEventRoutes?: {
    dependencies?: Partial<AdminHubEventRouteDependencies>;
  };
  appRoutes?: {
    dependencies?: AppRouteDependencies;
  };
}

const testDatabaseUrl = "postgresql://stellive:stellive@localhost:5432/stellive_hub_test";
const publicCorsOptions = { origin: "*" };
const privilegedCorsOptions = { origin: false };

type AppEnv = ReturnType<typeof loadEnv>;
type BootstrapDevicePort = Pick<DeviceRepository, "getDevice">;
type BootstrapPreferencePort = Pick<PreferenceRepository, "listForDevice">;
type BootstrapLiveStatusPort = Pick<LiveStatusRepository, "listDiagnostics">;
type BootstrapHubEventsPort = Pick<HubEventRepository, "summary">;

function createDefaultNotificationWorker(env: AppEnv): NotificationWorker {
  const fcmClient = createFcmClient({
    projectId: env.FCM_PROJECT_ID,
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKey: env.FCM_PRIVATE_KEY
  });

  return new NotificationWorker({
    notificationJobs: new NotificationJobRepository(),
    platformEvents: new PlatformEventRepository(),
    devices: new DeviceRepository(),
    preferences: new PreferenceRepository(),
    deliveryAttempts: new DeliveryAttemptRepository(),
    preferenceResolution: new PreferenceResolutionService(),
    pushSender: new FcmPushSender(fcmClient)
  });
}

function createDefaultChzzkLiveAdapter(
  env: AppEnv,
  dependencies: Partial<InternalRouteDependencies> | undefined,
  fetchImpl?: typeof fetch
): Pick<InternalRouteDependencies, "chzzkLiveAdapter"> {
  if (dependencies?.chzzkLiveAdapter) return {};
  if (!env.CHZZK_CLIENT_ID || !env.CHZZK_CLIENT_SECRET || !env.CHZZK_REDIRECT_URI) return {};

  const stateRepository = hasChzzkStateRepository(dependencies?.adapterHealth)
    ? dependencies.adapterHealth
    : new PlatformApiStateRepository();
  const liveStatusRepository = hasChzzkLiveStatusRepository(dependencies?.liveStatus)
    ? dependencies.liveStatus
    : new LiveStatusRepository();
  const authClient = new ChzzkAuthClient({
    clientId: env.CHZZK_CLIENT_ID,
    clientSecret: env.CHZZK_CLIENT_SECRET,
    redirectUri: env.CHZZK_REDIRECT_URI
  });
  const apiClient = new ChzzkApiClient(
    authClient,
    stateRepository,
    { tokenRefreshSkewSeconds: env.CHZZK_TOKEN_REFRESH_SKEW_SECONDS },
    { fetch: fetchImpl }
  );
  const ingestor = new ChzzkEventIngestor();

  return {
    chzzkLiveAdapter: new ChzzkOpenApiAdapter({
      catalog: new CatalogService(),
      apiClient,
      liveStatusRepository,
      ingestEvent: (event) => ingestor.ingest(event)
    })
  };
}

function hasChzzkStateRepository(value: unknown): value is Pick<PlatformApiStateRepository, "getState" | "upsertState" | "upsertAdapterHealth"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "getState" in value &&
    "upsertState" in value &&
    "upsertAdapterHealth" in value
  );
}

function hasChzzkLiveStatusRepository(value: unknown): value is Pick<LiveStatusRepository, "getByMemberId" | "upsertLiveStatus"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "getByMemberId" in value &&
    "upsertLiveStatus" in value
  );
}

function hasBootstrapDevicePort(value: unknown): value is BootstrapDevicePort {
  return typeof value === "object" && value !== null && "getDevice" in value;
}

function hasBootstrapPreferencePort(value: unknown): value is BootstrapPreferencePort {
  return typeof value === "object" && value !== null && "listForDevice" in value;
}

function hasBootstrapLiveStatusPort(value: unknown): value is BootstrapLiveStatusPort {
  return typeof value === "object" && value !== null && "listDiagnostics" in value;
}

function hasBootstrapHubEventsPort(value: unknown): value is BootstrapHubEventsPort {
  return typeof value === "object" && value !== null && "summary" in value;
}

function isPrivilegedRoutePath(url: string): boolean {
  return (
    url === "/admin" ||
    url.startsWith("/admin?") ||
    url.startsWith("/admin/") ||
    url.startsWith("/v1/admin/") ||
    url.startsWith("/v1/internal/")
  );
}

function corsDelegator(request: FastifyRequest, callback: (error: Error | null, options?: { origin: string | boolean }) => void) {
  callback(null, isPrivilegedRoutePath(request.url) ? privilegedCorsOptions : publicCorsOptions);
}

function resolveEnvInput(options: BuildAppOptions): NodeJS.ProcessEnv | Record<string, string | boolean | number | undefined> {
  const envInput = options.useProcessEnv === false ? options.env ?? {} : { ...process.env, ...options.env };
  const nodeEnv = typeof envInput.NODE_ENV === "string" ? envInput.NODE_ENV : process.env.NODE_ENV;

  if (!envInput.DATABASE_URL && nodeEnv === "test") {
    return { ...envInput, DATABASE_URL: testDatabaseUrl };
  }

  return envInput;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = loadEnv(resolveEnvInput(options));
  const app = Fastify({ logger: true });
  await app.register(cors, { delegator: corsDelegator });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: { title: "Stellive Notification Hub API", version: "0.1.0" }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  const appRouteDependencies: AppRouteDependencies = { ...options.appRoutes?.dependencies };
  if (!appRouteDependencies.hubEvents && env.HUB_EVENTS_STORAGE_MODE === "prisma") {
    appRouteDependencies.hubEvents = new HubEventRepository();
  }
  if (env.HUB_EVENTS_STORAGE_MODE === "prisma" && !appRouteDependencies.bootstrap) {
    const devices = hasBootstrapDevicePort(appRouteDependencies.devices)
      ? appRouteDependencies.devices
      : new DeviceRepository();
    const preferences = hasBootstrapPreferencePort(appRouteDependencies.preferences)
      ? appRouteDependencies.preferences
      : new PreferenceRepository();
    const liveStatus = hasBootstrapLiveStatusPort(appRouteDependencies.liveStatus)
      ? appRouteDependencies.liveStatus
      : new LiveStatusRepository();
    const hubEvents = hasBootstrapHubEventsPort(appRouteDependencies.hubEvents)
      ? appRouteDependencies.hubEvents
      : new HubEventRepository();
    appRouteDependencies.bootstrap = new BootstrapService({
      catalog: new CatalogService(),
      devices,
      preferences,
      liveStatus: {
        listDiagnostics: async () =>
          (await liveStatus.listDiagnostics(50)).map((status) => ({
            ...status,
            platform: "chzzk" as const
          }))
      },
      hubEvents: {
        summary: async () => hubEvents.summary()
      }
    });
  }

  await registerRoutes(app, { dependencies: appRouteDependencies });
  await registerChzzkAuthRoutes(app, {
    env,
    ...options.chzzkAuthRoutes?.dependencies
  });
  const internalRouteDependencies: Partial<InternalRouteDependencies> = options.internalRoutes?.dependencies
    ? {
        ...createDefaultChzzkLiveAdapter(env, options.internalRoutes.dependencies, options.chzzkLiveApiFetch),
        ...options.internalRoutes.dependencies
      }
    : {
        notificationWorker: createDefaultNotificationWorker(env),
        ...createDefaultChzzkLiveAdapter(env, undefined, options.chzzkLiveApiFetch)
      };
  await registerInternalRoutes(app, { env, dependencies: internalRouteDependencies });
  await registerAdminRoutes(app, { env });
  await registerAdminHubEventRoutes(app, { env, dependencies: options.adminHubEventRoutes?.dependencies });
  return app;
}
