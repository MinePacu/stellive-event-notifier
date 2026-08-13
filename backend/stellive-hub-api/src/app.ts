import cors from "@fastify/cors";
import { ResponseCache } from "./cache/responseCache.js";
import { ChzzkAuthClient } from "./adapters/chzzk/chzzkAuthClient.js";
import ChzzkApiClient from "./adapters/chzzk/chzzkApiClient.js";
import ChzzkOpenApiAdapter from "./adapters/chzzk/chzzkOpenApiAdapter.js";
import { CatalogService } from "./catalog/catalog.js";
import { MemberProfileImageHydrator } from "./catalog/memberProfileImageHydrator.js";
import ChzzkEventIngestor, { type ChzzkObservationWriter } from "./events/chzzkEventIngestor.js";
import YoutubeWebSubSubscriptionService from "./adapters/youtube/youtubeWebSubSubscriptionService.js";
import YoutubeDataApiClient from "./adapters/youtube/youtubeDataApiClient.js";
import { LiveStatusRepository } from "./repositories/liveStatusRepository.js";
import { PlatformApiStateRepository } from "./repositories/platformApiStateRepository.js";
import { ChannelImageCacheRepository } from "./repositories/channelImageCacheRepository.js";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyRequest } from "fastify";
import { Redis } from "ioredis";
import { isConfiguredSecret, loadEnv } from "./config/env.js";
import { HubEventRepository } from "./hub-events/hubEventRepository.js";
import { ServiceAnnouncementRepository } from "./announcements/serviceAnnouncementRepository.js";
import { ServiceAnnouncementReadService } from "./announcements/serviceAnnouncementReadService.js";
import { ServiceAnnouncementAdminService } from "./announcements/serviceAnnouncementAdminService.js";
import { createHubCalendarSpecialDayOccurrenceRepositoryIfAvailable } from "./hub-events/hubCalendarSpecialDayOccurrenceRepository.js";
import NotificationJobRepository from "./jobs/notificationJobRepository.js";
import NotificationWorker from "./jobs/notificationWorker.js";
import SummaryNotificationRepository from "./jobs/summaryNotificationRepository.js";
import SummaryNotificationWorker from "./jobs/summaryNotificationWorker.js";
import BootstrapService from "./mobile/bootstrapService.js";
import { PreferenceResolutionService } from "./preferences/preferenceResolution.js";
import { createFcmClient, type FcmClient } from "./push/fcmClient.js";
import { FcmRateLimiter } from "./push/fcmRateLimiter.js";
import { FcmPushSender } from "./push/pushSender.js";
import { ServiceAnnouncementSender } from "./push/serviceAnnouncement.js";
import { ServiceTopicSubscriptionService } from "./push/serviceTopicSubscription.js";
import { DeliveryAttemptRepository } from "./repositories/deliveryAttemptRepository.js";
import DeviceRepository from "./repositories/deviceRepository.js";
import { ExternalApiCallLogRepository } from "./repositories/externalApiCallLogRepository.js";
import { PrismaMusicRepository, PrismaMusicSyncRunRepository } from "./repositories/musicRepository.js";
import PlatformEventRepository from "./repositories/platformEventRepository.js";
import PreferenceRepository from "./repositories/preferenceRepository.js";
import { PrismaSongRepository } from "./repositories/songRepository.js";
import { InMemoryMusicSyncLock, RedisMusicSyncLock, type RedisMusicSyncLockClient } from "./music/musicLocks.js";
import { MusicSyncService } from "./music/musicSyncService.js";
import { OfficialStelliveMusicSyncService } from "./music/officialStelliveMusicSyncService.js";
import { MusicChannelDiscoveryReclassificationService } from "./music/musicChannelDiscoveryReclassificationService.js";
import { MusicChannelDiscoverySyncService } from "./music/musicChannelDiscoverySyncService.js";
import { MusicSourceTypeRepairService } from "./music/musicSourceTypeRepairService.js";
import { MusicVideoIngestService } from "./music/musicVideoIngestService.js";
import { officialStelliveMusicSourcePlaylistSeeds, TARGET_MUSIC_MEMBER_IDS } from "./music/musicSourcePlaylists.js";
import { WebhookSubscriptionRepository } from "./repositories/webhookSubscriptionRepository.js";
import SongIngestionService from "./songs/songIngestionService.js";
import SongBackfillService from "./songs/songBackfillService.js";
import { type AdminHubEventRouteDependencies, registerAdminHubEventRoutes } from "./routes/adminHubEventRoutes.js";
import { registerAdminServiceAnnouncementRoutes } from "./routes/adminServiceAnnouncementRoutes.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import registerChzzkAuthRoutes, { type ChzzkAuthRouteOptions } from "./routes/chzzkAuthRoutes.js";
import { type InternalRouteDependencies, registerInternalRoutes } from "./routes/internalRoutes.js";
import { type AppRouteDependencies, registerRoutes } from "./routes/routes.js";
import { registerWebhookRoutes } from "./routes/webhookRoutes.js";

type EnvOverrides = Record<string, string | boolean | number | undefined>;

export interface BuildAppOptions {
  env?: EnvOverrides;
  useProcessEnv?: boolean;
  chzzkLiveApiFetch?: typeof fetch;
  chzzkObservationWriter?: ChzzkObservationWriter;
  chzzkAuthRoutes?: {
    dependencies?: Partial<Omit<ChzzkAuthRouteOptions, "env">>;
  };
  internalRoutes?: {
    dependencies?: Partial<InternalRouteDependencies>;
  };
  adminHubEventRoutes?: {
    dependencies?: Partial<AdminHubEventRouteDependencies>;
  };
  adminServiceAnnouncementRoutes?: {
    service?: ServiceAnnouncementAdminService;
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

export type MusicConfigurationWarning =
  | "music_sync_youtube_api_not_configured"
  | "music_channel_discovery_requires_music_sync"
  | "music_channel_discovery_internal_token_not_configured"
  | "music_channel_discovery_service_not_configured";

export function musicConfigurationWarnings(
  env: AppEnv,
  services: { channelDiscoveryServiceConfigured: boolean },
): MusicConfigurationWarning[] {
  const warnings: MusicConfigurationWarning[] = [];
  if (env.MUSIC_SYNC_ENABLED && !isConfiguredSecret(env.YOUTUBE_API_KEY)) {
    warnings.push("music_sync_youtube_api_not_configured");
  }
  if (env.MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED && !env.MUSIC_SYNC_ENABLED) {
    warnings.push("music_channel_discovery_requires_music_sync");
  }
  if (env.MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED && !isConfiguredSecret(env.INTERNAL_API_TOKEN)) {
    warnings.push("music_channel_discovery_internal_token_not_configured");
  }
  if (env.MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED && !services.channelDiscoveryServiceConfigured) {
    warnings.push("music_channel_discovery_service_not_configured");
  }
  return warnings;
}

export function createMusicMemberUpsertInputs(catalog = new CatalogService()) {
  const targetIds = new Set<string>(TARGET_MUSIC_MEMBER_IDS);
  return catalog.getMembers()
    .filter((member) => targetIds.has(member.id))
    .map((member) => ({
      id: member.id,
      nameKo: member.koreanName,
      nameEn: member.englishName,
      aliases: [
        member.koreanName,
        member.englishName,
        member.platforms?.youtubeHandle,
        member.platforms?.youtubeChannelId,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      generationOrGroup: member.generationId,
      isGraduated: false,
      youtubeChannelId: member.platforms?.youtubeChannelId ?? null,
    }));
}

export function createMusicMemberAliasInputs(catalog = new CatalogService()) {
  const targetIds = new Set<string>(TARGET_MUSIC_MEMBER_IDS);
  return catalog.getMembers()
    .filter((member) => targetIds.has(member.id))
    .map((member) => ({
      id: member.id,
      nameKo: member.koreanName,
      nameEn: member.englishName,
      unitName: member.unitName,
      aliases: [
        member.koreanName,
        member.englishName,
        member.platforms?.youtubeHandle,
        member.platforms?.youtubeChannelId,
      ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
      youtubeChannelId: member.platforms?.youtubeChannelId ?? null,
    }));
}

export function createDefaultFcmClient(env: AppEnv): FcmClient {
  return createFcmClient({
    serviceAccountFile: env.FCM_SERVICE_ACCOUNT_FILE,
    projectId: env.FCM_PROJECT_ID,
    clientEmail: env.FCM_CLIENT_EMAIL,
    privateKey: env.FCM_PRIVATE_KEY,
    rateLimiter: new FcmRateLimiter({
      enabled: env.FCM_RATE_LIMIT_ENABLED,
      maxPerSecond: env.FCM_SEND_MAX_PER_SECOND,
      maxPerMinute: env.FCM_SEND_MAX_PER_MINUTE,
      burst: env.FCM_SEND_BURST
    })
  });
}

function createDefaultNotificationWorker(
  env: AppEnv,
  fcmClient = createDefaultFcmClient(env),
  summaries = new SummaryNotificationRepository()
): NotificationWorker {
  return new NotificationWorker({
    notificationJobs: new NotificationJobRepository(),
    platformEvents: new PlatformEventRepository(),
    hubEventSchedules: new HubEventRepository(),
    devices: new DeviceRepository(),
    preferences: new PreferenceRepository(),
    deliveryAttempts: new DeliveryAttemptRepository(),
    summaryNotifications: summaries,
    preferenceResolution: new PreferenceResolutionService(),
    pushSender: new FcmPushSender(fcmClient),
    random: Math.random,
    deviceBatchSize: env.NOTIFICATION_DEVICE_BATCH_SIZE,
    preferenceBatchSize: env.NOTIFICATION_PREFERENCE_BATCH_SIZE,
    deliveryAttemptBatchSize: env.DELIVERY_ATTEMPT_BATCH_SIZE
  });
}

function createDefaultSummaryNotificationWorker(
  env: AppEnv,
  fcmClient = createDefaultFcmClient(env),
  summaries = new SummaryNotificationRepository()
): SummaryNotificationWorker {
  return new SummaryNotificationWorker({
    summaries,
    platformEvents: new PlatformEventRepository(),
    hubEventSchedules: new HubEventRepository(),
    devices: new DeviceRepository(),
    preferences: new PreferenceRepository(),
    deliveryAttempts: new DeliveryAttemptRepository(),
    preferenceResolution: new PreferenceResolutionService(),
    pushSender: new FcmPushSender(fcmClient),
    random: Math.random
  });
}

function createDefaultServiceAnnouncementSender(env: AppEnv, fcmClient = createDefaultFcmClient(env)): ServiceAnnouncementSender {
  return new ServiceAnnouncementSender(fcmClient, new ExternalApiCallLogRepository());
}

function createDefaultChzzkLiveAdapter(
  env: AppEnv,
  dependencies: Partial<InternalRouteDependencies> | undefined,
  fetchImpl?: typeof fetch,
  observationWriter?: ChzzkObservationWriter
): Pick<InternalRouteDependencies, "chzzkLiveAdapter"> {
  if (dependencies?.chzzkLiveAdapter) return {};
  if (!env.CHZZK_CLIENT_ID || !env.CHZZK_CLIENT_SECRET || !env.CHZZK_REDIRECT_URI) return {};

  const stateRepository = hasChzzkStateRepository(dependencies?.adapterHealth)
    ? dependencies.adapterHealth
    : new PlatformApiStateRepository();
  const apiClient = new ChzzkApiClient({
    clientId: env.CHZZK_CLIENT_ID,
    clientSecret: env.CHZZK_CLIENT_SECRET,
    stateRepository,
    fetch: fetchImpl,
    liveListMaxPages: env.CHZZK_LIVE_LIST_MAX_PAGES,
    apiCallLogger: new ExternalApiCallLogRepository()
  });
  const ingestor = observationWriter ?? new ChzzkEventIngestor();

  return {
    chzzkLiveAdapter: new ChzzkOpenApiAdapter({
      catalog: new CatalogService(),
      apiClient,
      observationWriter: ingestor
    })
  };
}

function createDefaultSongIngestionService(): SongIngestionService {
  const catalog = new CatalogService();
  const songs = new PrismaSongRepository();

  return new SongIngestionService({
    catalog: {
      findByYoutubeChannelId(channelId) {
        const member = catalog.getMembers().find((candidate) => candidate.platforms?.youtubeChannelId === channelId);
        if (!member) return undefined;
        return {
          memberId: member.id,
          memberName: member.koreanName,
          generationId: member.generationId,
          generationName: member.generationName,
        };
      },
    },
    songs,
  });
}

function createDefaultYoutubeSubscriptionScheduler(
  env: AppEnv,
  dependencies: Partial<InternalRouteDependencies> | undefined,
  fetchImpl?: typeof fetch,
): Pick<InternalRouteDependencies, "youtubeSubscriptionScheduler"> {
  if (dependencies?.youtubeSubscriptionScheduler) return {};
  if (!env.YOUTUBE_WEBSUB_CALLBACK_URL || !env.YOUTUBE_WEBSUB_VERIFY_TOKEN) return {};

  const catalog = new CatalogService();
  const targets = catalog
    .getMembers()
    .filter((member) => member.generationId === "gen1" || member.generationId === "gen2" || member.generationId === "gen3")
    .flatMap((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      if (!channelId) return [];
      return [{
        targetId: member.id,
        channelId,
        topicUrl: `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
      }];
    });

  return {
    youtubeSubscriptionScheduler: new YoutubeWebSubSubscriptionService({
      callbackUrl: env.YOUTUBE_WEBSUB_CALLBACK_URL,
      verifyToken: env.YOUTUBE_WEBSUB_VERIFY_TOKEN,
      targets,
      subscriptions: new WebhookSubscriptionRepository(),
      fetch: fetchImpl,
    }),
  };
}

function createDefaultYoutubeSongBackfillScheduler(
  env: AppEnv,
  dependencies: Partial<InternalRouteDependencies> | undefined,
  fetchImpl?: typeof fetch,
): Pick<InternalRouteDependencies, "youtubeSongBackfillScheduler"> {
  if (dependencies?.youtubeSongBackfillScheduler) return {};
  if (!env.YOUTUBE_API_KEY) return {};

  const catalog = new CatalogService();
  const targets = catalog
    .getMembers()
    .filter((member) => member.generationId === "gen1" || member.generationId === "gen2" || member.generationId === "gen3")
    .flatMap((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      if (!channelId) return [];
      return [{ memberId: member.id, channelId }];
    });

  return {
    youtubeSongBackfillScheduler: new SongBackfillService({
      youtube: new YoutubeDataApiClient({ apiKey: env.YOUTUBE_API_KEY, fetch: fetchImpl, apiCallLogger: new ExternalApiCallLogRepository() }),
      ingestion: createDefaultSongIngestionService(),
      targets,
      maxPages: env.YOUTUBE_SONG_BACKFILL_MAX_PAGES,
      maxChannels: env.YOUTUBE_SONG_RECONCILE_MAX_CHANNELS,
    }),
  };
}

function createDefaultMemberProfileImageHydrator(
  env: AppEnv,
  dependencies: AppRouteDependencies | undefined,
  fetchImpl?: typeof fetch,
  registerClose?: (close: () => Promise<void>) => void,
): Pick<AppRouteDependencies, "memberProfileImages"> {
  if (dependencies?.memberProfileImages) return {};
  if (!env.YOUTUBE_API_KEY) return {};
  const refreshLock = env.REDIS_URL
    ? new RedisMusicSyncLock(new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    }) as unknown as RedisMusicSyncLockClient, {
      keyPrefix: "stellive-hub:channel-image-refresh-lock",
    })
    : undefined;
  if (refreshLock) registerClose?.(() => refreshLock.close());
  return {
    memberProfileImages: new MemberProfileImageHydrator({
      youtube: new YoutubeDataApiClient({ apiKey: env.YOUTUBE_API_KEY, fetch: fetchImpl, apiCallLogger: new ExternalApiCallLogRepository() }),
      channelImageCache: new ChannelImageCacheRepository(),
      ttlMs: env.CHANNEL_IMAGE_CACHE_TTL_SECONDS * 1_000,
      refreshWaitMs: env.CHANNEL_IMAGE_REFRESH_WAIT_MS,
      refreshLock,
    }),
  };
}

function createDefaultMusicSyncService(
  env: AppEnv,
  dependencies: Partial<InternalRouteDependencies> | undefined,
  fetchImpl?: typeof fetch,
  registerClose?: (close: () => Promise<void>) => void,
  warn?: (message: string) => void,
): Pick<InternalRouteDependencies, "musicSync"> {
  if (dependencies?.musicSync) return {};
  if (!env.MUSIC_SYNC_ENABLED || !env.YOUTUBE_API_KEY) return {};
  const catalog = new CatalogService();
  const members = createMusicMemberAliasInputs(catalog);
  const repository = new PrismaMusicRepository();
  const syncRuns = new PrismaMusicSyncRunRepository();
  const youtube = new YoutubeDataApiClient({ apiKey: env.YOUTUBE_API_KEY, fetch: fetchImpl, apiCallLogger: new ExternalApiCallLogRepository() });
  const locks = env.REDIS_URL
    ? new RedisMusicSyncLock(new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    }) as unknown as RedisMusicSyncLockClient)
    : new InMemoryMusicSyncLock();
  if (locks instanceof RedisMusicSyncLock) {
    registerClose?.(() => locks.close());
  } else if (env.NODE_ENV === "production") {
    warn?.("REDIS_URL is not configured; music sync locking is process-local and unsafe for multi-worker scheduling");
  }
  const syncCatalogMusicMembers = async () => {
    for (const input of createMusicMemberUpsertInputs(catalog)) {
      await repository.upsertMember(input);
    }
  };
  const service = new MusicSyncService({
    repository: repository as never,
    syncRuns,
    youtube,
    locks,
    members,
    lightMaxPages: env.MUSIC_LIGHT_SYNC_MAX_PAGES,
    lockTtlMs: env.MUSIC_SYNC_LOCK_SECONDS * 1_000,
  });
  const officialService = new OfficialStelliveMusicSyncService({
    repository: repository as never,
    syncRuns,
    youtube,
    locks,
    members,
    sourceSeeds: officialStelliveMusicSourcePlaylistSeeds.map((seed) => {
      if (seed.type === "cover") return { ...seed, youtubePlaylistId: env.STELLIVE_MUSIC_COVER_PLAYLIST_ID };
      if (seed.type === "original") return { ...seed, youtubePlaylistId: env.STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID };
      return seed;
    }),
    lightMaxPages: env.MUSIC_LIGHT_SYNC_MAX_PAGES,
    lockTtlMs: env.MUSIC_SYNC_LOCK_SECONDS * 1_000,
  });
  const discoveryTargets = catalog
    .getMembers()
    .filter((member) =>
      member.id === "stellive-official" ||
      member.generationId === "gen1" ||
      member.generationId === "gen2" ||
      member.generationId === "gen3"
    )
    .flatMap((member) => {
      const channelId = member.platforms?.youtubeChannelId;
      if (!channelId) return [];
      return [{
        memberId: member.id === "stellive-official" ? undefined : member.id,
        kind: member.id === "stellive-official" ? "stellive_official" as const : "member" as const,
        channelId,
        maxResults: member.id === "stellive-official" ? 10 : 50,
      }];
    });
  const discoveryService = new MusicChannelDiscoverySyncService({
    repository: repository as never,
    youtube,
    locks,
    members,
    targets: discoveryTargets,
    songIngestion: createDefaultSongIngestionService(),
    maxPages: env.MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES,
    lockTtlMs: env.MUSIC_SYNC_LOCK_SECONDS * 1_000,
  });
  const videoIngestService = new MusicVideoIngestService({
    youtube,
    processor: discoveryService,
  });
  const discoveryReclassificationService = new MusicChannelDiscoveryReclassificationService({
    repository,
    members,
    targets: discoveryTargets,
  });
  const sourceTypeRepairService = new MusicSourceTypeRepairService({
    repository,
  });
  return {
    musicSync: {
      syncAllMusic: async (mode) => {
        await syncCatalogMusicMembers();
        return service.syncAllMusic(mode === "light" ? "light" : "full");
      },
      syncOfficialStelliveMusicPlaylists: async (mode) => {
        await syncCatalogMusicMembers();
        return officialService.syncOfficialStelliveMusicPlaylists(mode);
      },
      discoverChannelUploads: () => discoveryService.discover(),
      reclassifyDiscoveredUploads: () => discoveryReclassificationService.reclassify(),
      repairSourceTypeMismatches: () => sourceTypeRepairService.repair(),
      ingestVideos: (input) => videoIngestService.ingestVideos(input),
      listReviewCandidates: ({ limit } = {}) => repository.listReviewCandidates?.({ limit }) ?? Promise.resolve([]),
      upsertOverride: async (videoId, input) => {
        const item = await repository.getMusicItemByVideoId(videoId) as { id?: string; youtubeVideoId?: string } | null;
        if (!item?.id) return { error: "music_item_not_found", videoId };
        return repository.upsertMusicItemOverride({
          musicItemId: item.id,
          youtubeVideoId: item.youtubeVideoId ?? videoId,
          forcedType: typeof input.forcedType === "string" ? input.forcedType : null,
          forcedMemberIds: Array.isArray(input.forcedMemberIds) ? input.forcedMemberIds.filter((value): value is string => typeof value === "string") : null,
          forceExcluded: input.forceExcluded === true,
          exclusionReason: typeof input.exclusionReason === "string" ? input.exclusionReason : null,
          note: typeof input.note === "string" ? input.note : null,
        });
      },
      listSyncRuns: (limit) => syncRuns.listRecent(limit ?? 25),
      estimateQuota: () => ({ dailyEstimate: 300, officialPlaylists: 2 }),
    },
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
  const musicCatalogCache = options.appRoutes?.dependencies?.musicCache ?? new ResponseCache({
    maxEntries: env.MUSIC_CACHE_MAX_ENTRIES,
  });
  const invalidateMusicCatalogCache = () => {
    musicCatalogCache.invalidatePrefix("/v1/music");
    musicCatalogCache.invalidatePrefix("/v1/members/");
  };
  const registerClose = (close: () => Promise<void>) => {
    app.addHook("onClose", async () => close());
  };
  await app.register(cors, { delegator: corsDelegator });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: { title: "Stellive Notification Hub API", version: "0.1.0" }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  const sharedFcmClient = createDefaultFcmClient(env);
  const announcementRepository = new ServiceAnnouncementRepository();
  const announcementReads = options.appRoutes?.dependencies?.announcements ?? new ServiceAnnouncementReadService(announcementRepository);
  const appRouteDependencies: AppRouteDependencies = {
    announcements: announcementReads,
    musicCache: musicCatalogCache,
    ...createDefaultMemberProfileImageHydrator(
      env,
      options.appRoutes?.dependencies,
      options.chzzkLiveApiFetch,
      registerClose,
    ),
    ...options.appRoutes?.dependencies,
  };
  if (!appRouteDependencies.hubEvents && env.HUB_EVENTS_STORAGE_MODE === "prisma") {
    appRouteDependencies.hubEvents = new HubEventRepository();
  }
  if (!appRouteDependencies.hubCalendarSpecialDayOccurrences && env.HUB_EVENTS_STORAGE_MODE === "prisma") {
    appRouteDependencies.hubCalendarSpecialDayOccurrences = createHubCalendarSpecialDayOccurrenceRepositoryIfAvailable();
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
      },
      announcements: announcementReads,
      memberProfileImages: appRouteDependencies.memberProfileImages,
      cacheTtlSeconds: {
        catalog: env.BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS,
        liveStatus: env.BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS,
        hubEventsSummary: env.BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS
      }
    });
  }
  if (env.HUB_EVENTS_STORAGE_MODE === "prisma" && !appRouteDependencies.serviceTopicSubscriptions) {
    const devices = new DeviceRepository();
    const preferences = new PreferenceRepository();
    appRouteDependencies.devices ??= devices;
    appRouteDependencies.preferences ??= preferences;
    appRouteDependencies.serviceTopicSubscriptions = new ServiceTopicSubscriptionService({
      fcmClient: sharedFcmClient,
      devices,
      preferences
    });
  }

  await registerRoutes(app, { dependencies: appRouteDependencies, env });
  await registerWebhookRoutes(app, {
    env,
    subscriptions: new WebhookSubscriptionRepository(),
    songIngestion: createDefaultSongIngestionService(),
  });
  await registerChzzkAuthRoutes(app, {
    env,
    ...options.chzzkAuthRoutes?.dependencies
  });
  const internalRouteDependencies: Partial<InternalRouteDependencies> = options.internalRoutes?.dependencies
    ? {
      ...createDefaultChzzkLiveAdapter(
        env,
        options.internalRoutes.dependencies,
        options.chzzkLiveApiFetch,
        options.chzzkObservationWriter
      ),
      ...createDefaultYoutubeSubscriptionScheduler(env, options.internalRoutes.dependencies, options.chzzkLiveApiFetch),
      ...createDefaultYoutubeSongBackfillScheduler(env, options.internalRoutes.dependencies, options.chzzkLiveApiFetch),
      ...createDefaultMusicSyncService(env, options.internalRoutes.dependencies, options.chzzkLiveApiFetch, registerClose, (message) => app.log.warn(message)),
      ...options.internalRoutes.dependencies
    }
    : (() => {
      const summaries = new SummaryNotificationRepository();
      return {
        notificationWorker: createDefaultNotificationWorker(env, sharedFcmClient, summaries),
        summaryNotificationWorker: createDefaultSummaryNotificationWorker(env, sharedFcmClient, summaries),
        serviceAnnouncements: createDefaultServiceAnnouncementSender(env, sharedFcmClient),
        ...createDefaultChzzkLiveAdapter(env, undefined, options.chzzkLiveApiFetch, options.chzzkObservationWriter),
        ...createDefaultYoutubeSubscriptionScheduler(env, undefined, options.chzzkLiveApiFetch),
        ...createDefaultYoutubeSongBackfillScheduler(env, undefined, options.chzzkLiveApiFetch),
        ...createDefaultMusicSyncService(env, undefined, options.chzzkLiveApiFetch, registerClose, (message) => app.log.warn(message)),
      };
    })();
  for (const code of musicConfigurationWarnings(env, {
    channelDiscoveryServiceConfigured: Boolean(internalRouteDependencies.musicSync?.discoverChannelUploads),
  })) {
    app.log.warn({ code }, "music configuration warning");
  }
  await registerInternalRoutes(app, {
    env,
    dependencies: internalRouteDependencies,
    invalidateMusicCatalogCache,
  });
  await registerAdminRoutes(app, { env });
  await registerAdminHubEventRoutes(app, { env, dependencies: options.adminHubEventRoutes?.dependencies });
  const announcementAdminService = options.adminServiceAnnouncementRoutes?.service ?? new ServiceAnnouncementAdminService({
    repository: announcementRepository,
    sender: createDefaultServiceAnnouncementSender(env, sharedFcmClient),
    invalidateCache: () => announcementReads.invalidate(),
  });
  await registerAdminServiceAnnouncementRoutes(app, { env, service: announcementAdminService });
  return app;
}
