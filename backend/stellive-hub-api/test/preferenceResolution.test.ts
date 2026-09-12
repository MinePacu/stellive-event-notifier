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

  describe("default-off preferences", () => {
    const updatedEvent = (overrides: Partial<PlatformEvent> = {}) =>
      event({
        source: "hub_event",
        type: "event_updated",
        memberId: "stellive-official",
        generationId: "official",
        realtimeEligible: false,
        ...overrides
      });

    it("allows default-on and unknown generations without stored preferences", () => {
      expect(service.resolve(event({ generationId: "gen3" }), "device-1", []).reason).toBe("allowed");
      expect(service.resolve(event({ generationId: "unknown-generation" }), "device-1", []).reason).toBe("allowed");
    });

    it.each([
      { label: "no preferences", preferences: [] },
      { label: "global on", preferences: [pref({ scope: "global", enabled: true })] },
      { label: "platform on", preferences: [pref({ scope: "platform", source: "youtube", enabled: true })] },
      { label: "event type on", preferences: [pref({ scope: "event_type", eventType: "youtube_upload", enabled: true })] }
    ])("keeps gen4-upcoming off with $label", ({ preferences }) => {
      const result = service.resolve(event({ generationId: "gen4-upcoming" }), "device-1", preferences);

      expect(result.shouldNotify).toBe(false);
      expect(result.reason).toBe("preference_default_off");
      expect(result.matchedRules.at(-1)).toBe("generation:default_off");
    });

    it.each([
      { label: "no preferences", preferences: [] },
      { label: "global on", preferences: [pref({ scope: "global", enabled: true })] },
      { label: "generation on", preferences: [pref({ scope: "generation", generationId: "official", enabled: true })] },
      {
        label: "member on",
        preferences: [pref({ scope: "member", memberId: "stellive-official", enabled: true, explicitOverride: true })]
      },
      { label: "platform on", preferences: [pref({ scope: "platform", source: "hub_event", enabled: true })] }
    ])("keeps event_updated off with $label", ({ preferences }) => {
      const result = service.resolve(updatedEvent(), "device-1", preferences);

      expect(result.shouldNotify).toBe(false);
      expect(result.reason).toBe("preference_default_off");
      expect(result.matchedRules.at(-1)).toBe("event_type:default_off");
    });

    it("allows each default-off axis only through a matching opt-in", () => {
      const generationAllowed = service.resolve(event({ generationId: "gen4-upcoming" }), "device-1", [
        pref({ scope: "generation", generationId: "gen4-upcoming", enabled: true })
      ]);
      const eventTypeAllowed = service.resolve(updatedEvent(), "device-1", [
        pref({ scope: "event_type", eventType: "event_updated", enabled: true })
      ]);

      expect(generationAllowed.reason).toBe("allowed");
      expect(eventTypeAllowed.reason).toBe("allowed");
    });

    it("requires both opt-ins when generation and event type default to off", () => {
      const combinedEvent = updatedEvent({ generationId: "gen4-upcoming", memberId: "upcoming-member" });
      const noOptIn = service.resolve(combinedEvent, "device-1", []);
      const generationOnly = service.resolve(combinedEvent, "device-1", [
        pref({ scope: "generation", generationId: "gen4-upcoming", enabled: true })
      ]);
      const eventTypeOnly = service.resolve(combinedEvent, "device-1", [
        pref({ scope: "event_type", eventType: "event_updated", enabled: true })
      ]);
      const both = service.resolve(combinedEvent, "device-1", [
        pref({ scope: "generation", generationId: "gen4-upcoming", enabled: true }),
        pref({ scope: "event_type", eventType: "event_updated", enabled: true })
      ]);

      expect(noOptIn.matchedRules).toEqual(["generation:default_off", "event_type:default_off"]);
      expect(generationOnly).toMatchObject({ shouldNotify: false, reason: "preference_default_off" });
      expect(generationOnly.matchedRules.at(-1)).toBe("event_type:default_off");
      expect(eventTypeOnly).toMatchObject({ shouldNotify: false, reason: "preference_default_off" });
      expect(eventTypeOnly.matchedRules.at(-1)).toBe("generation:default_off");
      expect(both.reason).toBe("allowed");
    });

    it("lets exact generation and member event opt-ins satisfy both default-off axes", () => {
      const combinedEvent = updatedEvent({ generationId: "gen4-upcoming", memberId: "upcoming-member" });
      const generationEvent = service.resolve(combinedEvent, "device-1", [
        pref({
          scope: "generation_event_type",
          generationId: "gen4-upcoming",
          eventType: "event_updated",
          enabled: true
        })
      ]);
      const memberEvent = service.resolve(combinedEvent, "device-1", [
        pref({
          scope: "member_event_type",
          memberId: "upcoming-member",
          eventType: "event_updated",
          enabled: true,
          explicitOverride: true
        })
      ]);
      const implicitMemberEvent = service.resolve(combinedEvent, "device-1", [
        pref({
          scope: "member_event_type",
          memberId: "upcoming-member",
          eventType: "event_updated",
          enabled: true,
          explicitOverride: false
        })
      ]);

      expect(generationEvent.reason).toBe("allowed");
      expect(memberEvent.reason).toBe("allowed");
      expect(implicitMemberEvent).toMatchObject({ shouldNotify: false, reason: "preference_default_off" });
      expect(implicitMemberEvent.matchedRules).toEqual(["generation:default_off", "event_type:default_off"]);
    });

    it("preserves global and explicit off reasons ahead of default-off gates", () => {
      const combinedEvent = updatedEvent({ generationId: "gen4-upcoming", memberId: "upcoming-member" });
      const globalOff = service.resolve(combinedEvent, "device-1", [pref({ scope: "global", enabled: false })]);
      const explicitOff = service.resolve(combinedEvent, "device-1", [
        pref({
          scope: "generation_event_type",
          generationId: "gen4-upcoming",
          eventType: "event_updated",
          enabled: false
        })
      ]);

      expect(globalOff).toMatchObject({ shouldNotify: false, reason: "global_off", matchedRules: ["global:off"] });
      expect(explicitOff).toMatchObject({ shouldNotify: false, reason: "preference_off" });
      expect(explicitOff.matchedRules).toEqual(["generation_event_type:off"]);
    });
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

  it("scopes allowlists per rule so a narrow rule cannot satisfy a broader rule's allowlist", () => {
    const rules = [
      pref({ scope: "global", keywordsAllowlist: ["important"] }),
      pref({ scope: "platform", source: "youtube", enabled: true, keywordsAllowlist: ["update"] })
    ];

    // Matches only the platform rule's allowlist; the global allowlist is still unsatisfied,
    // so the broader gate must block (previously the flattened OR let this through).
    const narrowOnly = service.resolve(event({ title: "update stream" }), "device-1", rules);
    expect(narrowOnly.shouldNotify).toBe(false);
    expect(narrowOnly.reason).toBe("keyword_allowlist_no_match");

    // Satisfies every rule that defines an allowlist.
    const allSatisfied = service.resolve(event({ title: "important update stream" }), "device-1", rules);
    expect(allSatisfied.shouldNotify).toBe(true);
    expect(allSatisfied.reason).toBe("allowed");
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

describe("disabled rules are not filter gates", () => {
  // A switched-off scope rule keeps its stored quiet_hours/blocklist/allowlist payload. Once a
  // later, explicitly enabled scope restores shouldNotify, the dead rule must not gate delivery.
  const overriddenEvent = () => event({ memberId: "neneko-mashiro", generationId: "gen2", title: "title", body: "body" });
  const enabledMemberOverride = () =>
    pref({ scope: "member", memberId: "neneko-mashiro", enabled: true, explicitOverride: true });

  it("ignores a disabled generation rule's stale allowlist", () => {
    const result = service.resolve(overriddenEvent(), "device-1", [
      pref({ scope: "generation", generationId: "gen2", enabled: false, keywordsAllowlist: ["구버전키워드"] }),
      enabledMemberOverride()
    ]);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toBe("allowed");
  });

  it("ignores a disabled member rule's stale allowlist, quiet hours, and blocklist", () => {
    const staleMemberRule = pref({
      scope: "member",
      memberId: "neneko-mashiro",
      enabled: false,
      explicitOverride: true,
      keywordsAllowlist: ["구버전키워드"],
      keywordsBlocklist: ["title"],
      quietHours: { enabled: true, start: "00:00", end: "23:59", timezone: "UTC" }
    });
    // member_event_type is applied after member, so the explicit on restores delivery.
    const result = service.resolve(overriddenEvent(), "device-1", [
      staleMemberRule,
      pref({
        scope: "member_event_type",
        memberId: "neneko-mashiro",
        eventType: "youtube_upload",
        enabled: true,
        explicitOverride: true
      })
    ]);
    expect(result.shouldNotify).toBe(true);
    expect(result.reason).toBe("allowed");
  });

  it("still honors an enabled rule's allowlist", () => {
    const result = service.resolve(overriddenEvent(), "device-1", [
      pref({ scope: "generation", generationId: "gen2", enabled: true, keywordsAllowlist: ["구버전키워드"] }),
      enabledMemberOverride()
    ]);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("keyword_allowlist_no_match");
  });

  it("still blocks everything when the global rule is disabled", () => {
    const result = service.resolve(overriddenEvent(), "device-1", [
      pref({ scope: "global", enabled: false }),
      enabledMemberOverride()
    ]);
    expect(result.shouldNotify).toBe(false);
    expect(result.reason).toBe("global_off");
  });
});

describe("GET /v1/preferences/resolved production gating", () => {
  async function injectResolved(nodeEnv: string) {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    try {
      // routes.ts reads process.env.NODE_ENV directly; keep the validated env on "test" so only
      // the dev-route gate changes.
      const app = await buildApp({ env: { NODE_ENV: "test" } });
      try {
        return await app.inject({
          method: "GET",
          url: "/v1/preferences/resolved?deviceId=dev-device&source=youtube&eventType=youtube_upload"
        });
      } finally {
        await app.close();
      }
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  }

  it("is not registered in production", async () => {
    const response = await injectResolved("production");
    expect(response.statusCode).toBe(404);
  });

  it("still resolves outside production", async () => {
    const response = await injectResolved("test");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ deviceId: "dev-device", shouldNotify: true });
  });
});
