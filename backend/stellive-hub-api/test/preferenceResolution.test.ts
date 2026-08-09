import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { shouldDropEventBeforeStorage } from "../src/events/eventGuards.js";
import { PreferenceResolutionService } from "../src/preferences/preferenceResolution.js";
import type { PlatformEvent, UserNotificationPreference } from "../src/types.js";

const now = "2026-06-01T00:00:00.000Z";
const preferenceResolution = new PreferenceResolutionService();
const service = {
  resolve(
    event: PlatformEvent,
    deviceId: string,
    preferences: UserNotificationPreference[],
    context: { evaluatedAt?: Date; recentNotificationsInLastMinute?: number } = {}
  ) {
    const { evaluatedAt = new Date(now), ...rateLimitContext } = context;
    return preferenceResolution.resolve(event, deviceId, preferences, { evaluatedAt, ...rateLimitContext });
  }
};

function event(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: overrides.id ?? "event-1",
    source: overrides.source ?? "youtube",
    type: overrides.type ?? "youtube_upload",
    memberId: overrides.memberId ?? "tenko-shibuki",
    generationId: overrides.generationId ?? "gen3",
    title: overrides.title ?? "title",
    body: overrides.body ?? "body",
    appDeepLink: "stellivehub://events/event-1",
    occurredAt: overrides.occurredAt ?? now,
    receivedAt: overrides.receivedAt ?? now,
    dedupeKey: "event-1",
    realtimeEligible: overrides.realtimeEligible ?? true,
    deliveryMode: overrides.deliveryMode ?? "standard"
  };
}

function pref(overrides: Partial<UserNotificationPreference>): UserNotificationPreference {
  return {
    deviceId: "device-1",
    scope: "global",
    enabled: true,
    explicitOverride: false,
    tapAction: "open_app",
    deliveryMode: "standard",
    updatedAt: now,
    ...overrides
  };
}

describe("PreferenceResolutionService", () => {
  it("global off blocks every notification", () => {
    const result = service.resolve(event(), "device-1", [pref({ scope: "global", enabled: false })]);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("global_off");
  });

  it("member explicit on overrides generation off", () => {
    const result = service.resolve(event({ memberId: "neneko-mashiro", generationId: "gen2" }), "device-1", [
      pref({ scope: "generation", generationId: "gen2", enabled: false }),
      pref({ scope: "member", memberId: "neneko-mashiro", enabled: true, explicitOverride: true })
    ]);
    expect(result.shouldNotify).toBe(true);
  });

  it("member platform explicit on overrides platform off", () => {
    const result = service.resolve(event({ memberId: "tenko-shibuki", source: "youtube" }), "device-1", [
      pref({ scope: "platform", source: "youtube", enabled: false }),
      pref({ scope: "member_platform", memberId: "tenko-shibuki", source: "youtube", enabled: true, explicitOverride: true })
    ]);
    expect(result.shouldNotify).toBe(true);
  });

  it("official YouTube live event is dropped before storage", () => {
    expect(shouldDropEventBeforeStorage(event({ memberId: "stellive-official", type: "youtube_live_started" }))).toBe(true);
    expect(
      shouldDropEventBeforeStorage(
        event({ memberId: "stellive-official", type: "official_youtube_live_started" as PlatformEvent["type"] })
      )
    ).toBe(true);
  });

  it("realtime mode only applies to realtime eligible events", () => {
    const realtime = service.resolve(event({ type: "official_youtube_upload", memberId: "stellive-official", generationId: "official" }), "device-1", [
      pref({ scope: "global", deliveryMode: "realtime_best_effort" })
    ]);
    expect(realtime.deliveryMode).toBe("realtime_best_effort");
    expect(realtime.pushPriority).toBe("high");

    const standard = service.resolve(event({ type: "cafe_post", source: "naver_cafe", realtimeEligible: false }), "device-1", [
      pref({ scope: "global", deliveryMode: "realtime_best_effort" })
    ]);
    expect(standard.deliveryMode).toBe("standard");
  });

  it("global off blocks hub event notifications", () => {
    const result = service.resolve(
      event({
        source: "hub_event",
        type: "event_sales_open",
        memberId: "stellive-official",
        generationId: "official",
        realtimeEligible: false
      }),
      "device-1",
      [pref({ scope: "global", enabled: false })]
    );

    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("global_off");
  });

  it("hub event notifications stay standard by default even with realtime_best_effort delivery mode", () => {
    const result = service.resolve(
      event({
        source: "hub_event",
        type: "event_deadline_soon",
        memberId: "stellive-official",
        generationId: "official",
        realtimeEligible: false
      }),
      "device-1",
      [pref({ scope: "global", deliveryMode: "realtime_best_effort" })]
    );

    expect(result.shouldNotify).toBe(true);
    expect(result.deliveryMode).toBe("standard");
    expect(result.pushPriority).toBe("normal");
  });

  it("chzzk chat is off by default", () => {
    const result = service.resolve(event({ type: "chzzk_chat", source: "chzzk" }), "device-1", []);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("chzzk_chat_default_off");
  });

  it("chzzk chat requires explicit member filters before delivery", () => {
    const result = service.resolve(event({ type: "chzzk_chat", source: "chzzk" }), "device-1", [
      pref({ scope: "member_event_type", memberId: "tenko-shibuki", eventType: "chzzk_chat", enabled: true, explicitOverride: true })
    ]);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("chzzk_chat_filter_required");

    const allowed = service.resolve(event({ type: "chzzk_chat", source: "chzzk", title: "공지 채팅" }), "device-1", [
      pref({
        scope: "member_event_type",
        memberId: "tenko-shibuki",
        eventType: "chzzk_chat",
        enabled: true,
        explicitOverride: true,
        keywordsAllowlist: ["공지"]
      })
    ]);
    expect(allowed.shouldNotify).toBe(true);
  });

  it("quiet hours use dispatch evaluation time rather than event timestamps", () => {
    const result = service.resolve(event({ receivedAt: "2026-06-01T12:00:00.000Z" }), "device-1", [
      pref({ quietHours: { enabled: true, start: "00:00", end: "23:59", timezone: "UTC" } })
    ]);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("quiet_hours");
  });

  it("allows an event received during quiet hours when evaluated outside them", () => {
    const result = service.resolve(
      event({
        occurredAt: "2026-06-01T23:15:00.000Z",
        receivedAt: "2026-06-01T23:30:00.000Z"
      }),
      "device-1",
      [pref({ quietHours: { enabled: true, start: "22:00", end: "06:00", timezone: "UTC" } })],
      { evaluatedAt: new Date("2026-06-02T12:00:00.000Z") }
    );

    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toBe("allowed");
  });

  it("blocks an event received outside quiet hours when evaluated during them", () => {
    const result = service.resolve(
      event({
        occurredAt: "2026-06-01T11:45:00.000Z",
        receivedAt: "2026-06-01T12:00:00.000Z"
      }),
      "device-1",
      [pref({ quietHours: { enabled: true, start: "22:00", end: "06:00", timezone: "UTC" } })],
      { evaluatedAt: new Date("2026-06-01T23:00:00.000Z") }
    );

    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("quiet_hours");
  });

  it("keeps quiet-hour start inclusive and end exclusive across same-day and overnight windows", () => {
    const sameDay = pref({ quietHours: { enabled: true, start: "09:00", end: "17:00", timezone: "UTC" } });
    const overnight = pref({ quietHours: { enabled: true, start: "22:00", end: "06:00", timezone: "UTC" } });

    expect(service.resolve(event(), "device-1", [sameDay], { evaluatedAt: new Date("2026-06-01T09:00:00.000Z") }).reason).toBe(
      "quiet_hours"
    );
    expect(service.resolve(event(), "device-1", [sameDay], { evaluatedAt: new Date("2026-06-01T17:00:00.000Z") }).reason).toBe(
      "allowed"
    );
    expect(service.resolve(event(), "device-1", [overnight], { evaluatedAt: new Date("2026-06-01T22:00:00.000Z") }).reason).toBe(
      "quiet_hours"
    );
    expect(service.resolve(event(), "device-1", [overnight], { evaluatedAt: new Date("2026-06-02T06:00:00.000Z") }).reason).toBe(
      "allowed"
    );
  });

  it("keeps equal quiet-hour bounds always active and invalid values inactive", () => {
    expect(
      service.resolve(
        event(),
        "device-1",
        [pref({ quietHours: { enabled: true, start: "08:00", end: "08:00", timezone: "UTC" } })],
        { evaluatedAt: new Date("2026-06-01T12:00:00.000Z") }
      ).reason
    ).toBe("quiet_hours");
    expect(
      service.resolve(
        event(),
        "device-1",
        [pref({ quietHours: { enabled: true, start: "25:00", end: "08:00", timezone: "UTC" } })],
        { evaluatedAt: new Date("2026-06-01T12:00:00.000Z") }
      ).reason
    ).toBe("allowed");
    expect(
      service.resolve(
        event(),
        "device-1",
        [pref({ quietHours: { enabled: true, start: "08:00", end: "09:00", timezone: "Invalid/Timezone" } })],
        { evaluatedAt: new Date("2026-06-01T08:30:00.000Z") }
      ).reason
    ).toBe("allowed");
  });

  it("keyword blocklist and allowlist apply after preference resolution", () => {
    const blocked = service.resolve(event({ title: "spoiler stream" }), "device-1", [
      pref({ keywordsBlocklist: ["spoiler"] })
    ]);
    expect(blocked.shouldNotify).toBe(false);
    expect(blocked.reason).toBe("keyword_blocklist");

    const notAllowed = service.resolve(event({ title: "regular stream" }), "device-1", [
      pref({ keywordsAllowlist: ["important"] })
    ]);
    expect(notAllowed.shouldNotify).toBe(false);
    expect(notAllowed.reason).toBe("keyword_allowlist_no_match");
  });

  it("rate limit applies after keyword checks", () => {
    const result = service.resolve(
      event(),
      "device-1",
      [pref({ maxNotificationsPerMinute: 1 })],
      { recentNotificationsInLastMinute: 1 }
    );
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("rate_limited");
  });

  it("mock event ingestion drops official YouTube live events before delivery attempts", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/dev/mock-events",
      payload: { memberId: "stellive-official", generationId: "official", source: "youtube", type: "youtube_live_started" }
    });
    await app.close();

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ dropped: true, reason: "official_youtube_live_excluded" });
  });

  it("rejects removed X event inputs", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/dev/mock-events",
      payload: { memberId: "ayatsuno-yuni", generationId: "gen1", source: "x", type: "x_post" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
  });
});

describe("CHZZK live notification policy", () => {
  const liveStarted = () =>
    event({
      source: "chzzk",
      type: "chzzk_live_started",
      memberId: "ayatsuno-yuni",
      generationId: "gen1",
      title: "spoiler live",
      body: "stream started"
    });

  it("applies global, platform, event type, generation, and member rules to chzzk_live_started", () => {
    expect(service.resolve(liveStarted(), "device-1", [pref({ scope: "global", enabled: false })]).reason).toBe("global_off");
    expect(service.resolve(liveStarted(), "device-1", [pref({ scope: "platform", source: "chzzk", enabled: false })]).shouldNotify).toBe(false);
    expect(service.resolve(liveStarted(), "device-1", [pref({ scope: "event_type", eventType: "chzzk_live_started", enabled: false })]).shouldNotify).toBe(false);
    expect(service.resolve(liveStarted(), "device-1", [pref({ scope: "generation", generationId: "gen1", enabled: false })]).shouldNotify).toBe(false);
    expect(
      service.resolve(liveStarted(), "device-1", [
        pref({ scope: "member", memberId: "ayatsuno-yuni", enabled: false, explicitOverride: true })
      ]).shouldNotify
    ).toBe(false);
  });

  it("applies quiet hours, keyword block rules, and rate limits to chzzk_live_started", () => {
    expect(
      service.resolve(liveStarted(), "device-1", [
        pref({ quietHours: { enabled: true, start: "00:00", end: "23:59", timezone: "UTC" } })
      ]).reason
    ).toBe("quiet_hours");

    expect(service.resolve(liveStarted(), "device-1", [pref({ keywordsBlocklist: ["spoiler"] })]).reason).toBe("keyword_blocklist");
    expect(
      service.resolve(liveStarted(), "device-1", [pref({ maxNotificationsPerMinute: 1 })], {
        recentNotificationsInLastMinute: 1
      }).reason
    ).toBe("rate_limited");
  });
});
