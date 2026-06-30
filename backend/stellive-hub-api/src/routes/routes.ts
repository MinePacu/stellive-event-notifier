import type { FastifyInstance } from "fastify";
import { CatalogService } from "../catalog/catalog.js";
import { productionHubCalendarSpecialDays } from "../hub-events/hubCalendarSpecialDayCatalog.js";
import type { SpecialDayOccurrence } from "../hub-events/hubCalendarSpecialDayMaterializer.js";
import { HubEventService, type HubEventReadPort } from "../hub-events/hubEventService.js";
import { shouldDropEventBeforeStorage } from "../events/eventGuards.js";
import { resolveNotificationDelivery } from "../notification/loadReductionPolicy.js";
import { PreferenceResolutionService } from "../preferences/preferenceResolution.js";
import { RealtimeDeliveryService } from "../realtime/realtimeDeliveryService.js";
import { LiveStatusRepository } from "../repositories/liveStatusRepository.js";
import { registerAppRoutes } from "./appRoutes.js";
import registerHubEventReadRoutes from "./hubEventReadRoutes.js";
import registerMusicRoutes from "./musicRoutes.js";
import registerSongRoutes from "./songRoutes.js";
import type { DeliveryAttempt, HubCalendarSpecialDay, PlatformEvent, UserNotificationPreference } from "../types.js";
import type { BootstrapResponse, MobilePlatform } from "../../../../shared/schemas/mobileApi.js";
import type { SongRepository } from "../repositories/songRepository.js";
import type { Member } from "../types.js";

const catalog = new CatalogService();
const defaultHubEvents = new HubEventService(catalog);
const preferenceResolution = new PreferenceResolutionService();
const realtime = new RealtimeDeliveryService();
const preferences = new Map<string, UserNotificationPreference[]>();
const deliveryAttempts: DeliveryAttempt[] = [];
const devDeviceId = "dev-device";

export interface AppRouteDependencies {
  hubEvents?: HubEventReadPort;
  songs?: SongRepository;
  hubCalendarSpecialDays?: HubCalendarSpecialDay[];
  hubCalendarSpecialDayOccurrences?: {
    listRange(filters: {
      from: Date;
      to: Date;
      generationId?: string;
      memberId?: string;
      kind?: string;
    }): Promise<SpecialDayOccurrence[]>;
  };
  bootstrap?: {
    getBootstrap(input: {
      deviceId?: string;
      platform?: MobilePlatform;
      appVersion?: string;
      locale?: string;
      timezone?: string;
    }): Promise<BootstrapResponse>;
  };
  memberProfileImages?: {
    hydrateMembers(members: Member[]): Promise<Member[]>;
  };
  devices?: {
    getDevice?(deviceId: string): Promise<{ deviceId: string; tokenStatus: string | undefined } | undefined>;
    register?(input: {
      deviceId?: string;
      platform: "android" | "ios";
      locale?: string;
      timezone?: string;
      appVersion?: string;
    }): Promise<{ deviceId: string; registered: true }>;
    updateToken?(input: {
      deviceId: string;
      platform: "android" | "ios";
      provider: "fcm" | "apns_via_fcm";
      token: string;
      locale?: string;
      timezone?: string;
      appVersion?: string;
    }): Promise<{ updated: true; tokenStatus: "active" }>;
  };
  preferences?: {
    listForDevice?(deviceId: string): Promise<UserNotificationPreference[]>;
    replaceForDevice?(input: {
      deviceId: string;
      preferences: UserNotificationPreference[];
      clientUpdatedAt: string;
    }): Promise<{ preferences: UserNotificationPreference[]; updatedAt: string }>;
  };
  liveStatus?: {
    listDiagnostics(limit: number): Promise<
      Array<{
        memberId: string;
        generationId: string;
          isLive: boolean;
          title?: string;
          viewerCount?: number;
          startedAt?: string;
          channelImageUrl?: string;
          platformUrl?: string;
          lastCheckedAt: string;
          sourceVerificationState: string;
      }>
    >;
  };
}

export interface AppRouteOptions {
  dependencies?: AppRouteDependencies;
}

function sampleEvent(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  const now = new Date().toISOString();

  return {
    id: overrides.id ?? "sample-event",
    source: overrides.source ?? "chzzk",
    type: overrides.type ?? "chzzk_live_started",
    memberId: overrides.memberId ?? "ayatsuno-yuni",
    generationId: overrides.generationId ?? "gen1",
    title: overrides.title ?? "방송 시작",
    body: overrides.body ?? "Mock live event",
    appDeepLink: overrides.appDeepLink ?? "stellivehub://events/sample-event",
    platformUrl: overrides.platformUrl ?? "https://example.com",
    occurredAt: overrides.occurredAt ?? now,
    receivedAt: overrides.receivedAt ?? now,
    dedupeKey: overrides.dedupeKey ?? "sample-event",
    realtimeEligible: overrides.realtimeEligible ?? true,
    deliveryMode: overrides.deliveryMode ?? "standard",
    rawPayload: overrides.rawPayload
  };
}

export async function registerRoutes(app: FastifyInstance, options: AppRouteOptions = {}) {
  const liveStatusRepository = options.dependencies?.liveStatus ?? new LiveStatusRepository();
  const hubEvents = options.dependencies?.hubEvents ?? defaultHubEvents;
  app.get("/health", async () => ({ ok: true, service: "stellive-hub-api" }));

  await registerAppRoutes(app, {
    dependencies: options.dependencies,
    fallbackPreferences: preferences,
    fallbackBootstrap: async (query) => {
      const deviceId = String(query.deviceId ?? "dev-device");
      const members = catalog.getMembers();
      const hydratedMembers = options.dependencies?.memberProfileImages
        ? await options.dependencies.memberProfileImages.hydrateMembers(members)
        : members;
      return {
        config: {
          unofficialProject: true,
          catalogVersion: "seed-2026-06-01",
          officialYoutubeLiveExcluded: true,
          xNotificationsEnabled: false,
          xDisabledReason: "x_notifications_dropped_for_mvp",
          hubCalendarEnabled: true,
        },
        appConfig: {
          unofficialProject: true,
          catalogVersion: "seed-2026-06-01",
          officialYoutubeLiveExcluded: true,
          xNotificationsEnabled: false,
          xDisabledReason: "x_notifications_dropped_for_mvp",
          hubCalendarEnabled: true,
        },
        hubEventsSummary: await hubEvents.summary(),
        generations: catalog.getGenerations(),
        members: hydratedMembers,
        preferences: preferences.get(deviceId) ?? [],
        liveStatus: await liveStatusRepository.listDiagnostics(50).catch(() => []),
        realtime: realtime.status(),
      };
    },
  });

  app.get("/v1/generations", async () => catalog.getGenerations());
  app.get("/v1/members", async () => {
    const members = catalog.getMembers();
    return options.dependencies?.memberProfileImages
      ? options.dependencies.memberProfileImages.hydrateMembers(members)
      : members;
  });
  app.get("/v1/members/:id", async (request, reply) => {
    const member = catalog.getMember((request.params as { id: string }).id);
    if (!member) return reply.notFound("member not found");
    const hydratedMembers = options.dependencies?.memberProfileImages
      ? await options.dependencies.memberProfileImages.hydrateMembers([member])
      : [member];
    return hydratedMembers[0];
  });

  app.get("/v1/preferences/resolved", async (request) => {
    const query = request.query as { deviceId?: string; memberId?: string; generationId?: string; source?: PlatformEvent["source"]; eventType?: PlatformEvent["type"] };
    const event = sampleEvent({
      memberId: query.memberId,
      generationId: query.generationId,
      source: query.source,
      type: query.eventType
    });
    return preferenceResolution.resolve(event, query.deviceId ?? "dev-device", preferences.get(query.deviceId ?? "dev-device") ?? []);
  });

  app.get("/v1/live-status", async () => {
    const persisted = await liveStatusRepository.listDiagnostics(100).catch(() => []);
    if (persisted.length > 0) {
      return persisted.map((status) => ({
        memberId: status.memberId,
        generationId: status.generationId,
        platform: "chzzk",
        isLive: status.isLive,
        title: status.title,
        viewerCount: status.viewerCount,
        startedAt: status.startedAt,
        channelImageUrl: status.channelImageUrl,
        platformUrl: status.platformUrl,
        lastCheckedAt: status.lastCheckedAt,
        sourceVerificationState: status.sourceVerificationState
      }));
    }

    return catalog
      .getMembers()
      .filter((member) => member.catalogRole !== "official_channel" && member.platforms.chzzkChannelId)
      .map((member, index) => ({
        memberId: member.id,
        generationId: member.generationId,
        platform: "chzzk",
        isLive: index === 0,
        title: index === 0 ? "Mock live status" : undefined,
        viewerCount: index === 0 ? 1234 : undefined,
        startedAt: index === 0 ? "2026-06-02T09:00:00.000Z" : undefined,
        platformUrl: index === 0 ? "https://chzzk.naver.com/live/45e71a76e949e16a34764deb962f9d9f" : undefined,
        lastCheckedAt: new Date().toISOString(),
        sourceVerificationState: "verified"
      }));
  });

  registerHubEventReadRoutes(app, {
    hubEvents,
    hubCalendarSpecialDays: options.dependencies?.hubCalendarSpecialDays ?? productionHubCalendarSpecialDays,
    hubCalendarSpecialDayOccurrences: options.dependencies?.hubCalendarSpecialDayOccurrences
  });

  await registerSongRoutes(app, {
    dependencies: { songs: options.dependencies?.songs },
  });
  await registerMusicRoutes(app, {
    registerMembersListRoute: false,
  });

  app.get("/v1/realtime/status", async () => realtime.status());
  app.get("/v1/events/stream", async (_request, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    reply.raw.write(`event: status\ndata: ${JSON.stringify(realtime.status())}\n\n`);
  });

  app.get("/v1/notifications/delivery-attempts", async () => deliveryAttempts);

  app.post("/v1/dev/mock-events", async (request, reply) => {
    const event = sampleEvent(request.body as Partial<PlatformEvent>);
    if (shouldDropEventBeforeStorage(event)) return reply.code(202).send({ dropped: true, reason: "official_youtube_live_excluded" });
    if (!catalog.isSupportedEventForMember(event.memberId, event.type)) {
      return reply.code(202).send({ dropped: true, reason: "unsupported_event_for_member" });
    }
    const oneMinuteAgo = Date.now() - 60_000;
    const recentNotificationsInLastMinute = deliveryAttempts.filter((attempt) => {
      return attempt.deviceId === devDeviceId && attempt.status === "sent" && new Date(attempt.attemptedAt).getTime() >= oneMinuteAgo;
    }).length;
    const resolution = preferenceResolution.resolve(event, devDeviceId, preferences.get(devDeviceId) ?? [], {
      recentNotificationsInLastMinute
    });
    const deliveryDecision = resolveNotificationDelivery(event, resolution, {
      recentPushCandidatesInWindow: recentNotificationsInLastMinute
    });
    realtime.enqueue(event, resolution, deliveryDecision.deliveryLevel);
    deliveryAttempts.push({
      id: `attempt_${Date.now()}`,
      eventId: event.id,
      deviceId: devDeviceId,
      attemptedAt: new Date().toISOString(),
      deliveredAt: deliveryDecision.shouldEnqueuePush ? new Date().toISOString() : undefined,
      status: resolution.shouldNotify ? (deliveryDecision.shouldEnqueuePush ? "sent" : "queued") : "skipped",
      reason: deliveryDecision.loadReductionReason ?? resolution.reason,
      tapActionUsed: resolution.tapAction,
      title: event.title,
      body: event.body,
      source: event.source,
      eventType: event.type,
      generationId: event.generationId,
      memberId: event.memberId,
      deliveryMode: resolution.deliveryMode,
      deliveryLevel: deliveryDecision.deliveryLevel,
      loadReductionReason: deliveryDecision.loadReductionReason,
      pushPriority: resolution.pushPriority
    });
    return { event, resolution, deliveryDecision };
  });
  app.post("/v1/dev/mock-live-status", async () => ({ updated: true }));
  app.post("/v1/dev/mock-realtime-event", async () => ({ queued: true, status: realtime.status() }));
  app.post("/v1/dev/resolve-preference", async (request) => {
    const body = request.body as { event?: Partial<PlatformEvent>; deviceId?: string; preferences?: UserNotificationPreference[] };
    return preferenceResolution.resolve(sampleEvent(body.event), body.deviceId ?? "dev-device", body.preferences ?? []);
  });
}
