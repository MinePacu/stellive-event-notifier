import type { FastifyInstance } from "fastify";
import { CatalogService } from "../catalog/catalog.js";
import { HubEventService } from "../hub-events/hubEventService.js";
import { shouldDropEventBeforeStorage } from "../events/eventGuards.js";
import { resolveNotificationDelivery } from "../notification/loadReductionPolicy.js";
import { PreferenceResolutionService } from "../preferences/preferenceResolution.js";
import { RealtimeDeliveryService } from "../realtime/realtimeDeliveryService.js";
import type { DeliveryAttempt, PlatformEvent, UserNotificationPreference } from "../types.js";

const catalog = new CatalogService();
const hubEvents = new HubEventService(catalog);
const preferenceResolution = new PreferenceResolutionService();
const realtime = new RealtimeDeliveryService();
const preferences = new Map<string, UserNotificationPreference[]>();
const deliveryAttempts: DeliveryAttempt[] = [];
const devDeviceId = "dev-device";

function parseHubEventLimit(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
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
    body: overrides.body ?? "mock event",
    appDeepLink: "stellivehub://events/sample-event",
    platformUrl: "https://example.com",
    occurredAt: now,
    receivedAt: now,
    dedupeKey: "sample-event",
    realtimeEligible: overrides.realtimeEligible ?? true,
    deliveryMode: overrides.deliveryMode ?? "standard"
  };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, service: "stellive-hub-api" }));

  app.get("/v1/bootstrap", async (request) => {
    const deviceId = String((request.query as { deviceId?: string }).deviceId ?? "dev-device");
    return {
      appConfig: { unofficialProject: true, catalogVersion: "seed-2026-06-01", officialYoutubeLiveExcluded: true },
      hubEventsSummary: hubEvents.summary(),
      generations: catalog.getGenerations(),
      members: catalog.getMembers(),
      preferences: preferences.get(deviceId) ?? [],
      realtime: realtime.status()
    };
  });

  app.post("/v1/devices/register", async (request) => {
    const body = request.body as { deviceId?: string; platform?: string; locale?: string; timezone?: string };
    return { deviceId: body.deviceId ?? `device_${Date.now()}`, platform: body.platform ?? "android", registered: true };
  });

  app.put("/v1/devices/token", async () => ({ updated: true }));

  app.get("/v1/generations", async () => catalog.getGenerations());
  app.get("/v1/members", async () => catalog.getMembers());
  app.get("/v1/members/:id", async (request, reply) => {
    const member = catalog.getMember((request.params as { id: string }).id);
    if (!member) return reply.notFound("member not found");
    return member;
  });

  app.get("/v1/preferences", async (request) => preferences.get(String((request.query as { deviceId?: string }).deviceId ?? "dev-device")) ?? []);
  app.put("/v1/preferences", async (request) => {
    const body = request.body as { deviceId?: string; preferences?: UserNotificationPreference[] };
    const deviceId = body.deviceId ?? "dev-device";
    preferences.set(deviceId, body.preferences ?? []);
    return { deviceId, preferences: preferences.get(deviceId) };
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

  app.get("/v1/live-status", async () =>
    catalog
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
        lastCheckedAt: new Date().toISOString()
      }))
  );

  app.get("/v1/hub-events/summary", async () => hubEvents.summary());
  app.get("/v1/hub-events", async (request) => {
    type HubEventListFilters = NonNullable<Parameters<typeof hubEvents.list>[0]>;
    const query = request.query as {
      category?: HubEventListFilters["category"];
      participationMode?: HubEventListFilters["participationMode"];
      status?: HubEventListFilters["status"];
      generationId?: string;
      memberId?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit?: string | number;
    };

    return hubEvents.list(
      {
        category: query.category,
        participationMode: query.participationMode,
        status: query.status,
        generationId: query.generationId,
        memberId: query.memberId,
        from: query.from,
        to: query.to,
        cursor: query.cursor,
        limit: parseHubEventLimit(query.limit)
      },
      new Date()
    );
  });
  app.get("/v1/hub-events/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const event = hubEvents.getById(id);
    if (!event) return reply.notFound("hub event not found");
    return event;
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
