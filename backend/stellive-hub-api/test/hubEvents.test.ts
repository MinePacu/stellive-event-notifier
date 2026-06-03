import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CatalogService } from "../src/catalog/catalog.js";
import { HubEventService } from "../src/hub-events/hubEventService.js";
import { validateHubEvent } from "../src/hub-events/hubEventPolicy.js";
import type { HubEvent, HubEventCategory, HubEventStatus } from "../src/types.js";

describe("HubEvent types", () => {
  it("supports official online_goods events without image fields", () => {
    const category: HubEventCategory = "online_goods";
    const status: HubEventStatus = "announced";

    const event: HubEvent = {
      id: "hub-event-1",
      category,
      participationMode: "online",
      status,
      title: "Official Online Goods Announcement",
      generationId: "official",
      sourceUrl: "https://example.com/events/1",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    };

    expect(event.category).toBe("online_goods");
    expect("imageUrl" in event).toBe(false);
    expect("logoUrl" in event).toBe(false);
    expect("posterUrl" in event).toBe(false);
  });
});

describe("HubEventService", () => {
  const catalog = new CatalogService();

  function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
    return {
      id: "hub-event-1",
      category: "online_goods",
      participationMode: "online",
      status: "announced",
      title: "Official Online Goods Announcement",
      generationId: "official",
      sourceUrl: "https://example.com/events/1",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      ...overrides
    };
  }

  function createService() {
    return new HubEventService(catalog, [
      hubEvent({
        id: "open-goods",
        category: "online_goods",
        participationMode: "online",
        status: "open",
        title: "Open Goods",
        generationId: "official",
        sourceLabel: "Stellive Official",
        sourceType: "official",
        startsAt: "2026-06-03T00:00:00Z",
        endsAt: "2026-06-10T00:00:00Z"
      }),
      hubEvent({
        id: "closing-goods",
        category: "online_goods",
        participationMode: "online",
        status: "open",
        title: "Closing Goods",
        memberId: "tenko-shibuki",
        generationId: "gen3",
        sourceLabel: "Tenko Shibuki",
        sourceType: "member",
        startsAt: "2026-06-02T00:00:00Z",
        endsAt: "2026-06-04T00:00:00Z"
      }),
      hubEvent({
        id: "offline-event",
        category: "offline_collab",
        participationMode: "offline",
        status: "upcoming",
        title: "Offline Event",
        generationId: "official",
        sourceLabel: "Stellive Official",
        sourceType: "official",
        startsAt: "2026-06-20T00:00:00Z",
        endsAt: "2026-06-30T00:00:00Z"
      })
    ]);
  }

  it("calculates effective status with the closing soon window", () => {
    const service = createService();

    expect(service.effectiveStatus(service.getById("open-goods")!, new Date("2026-06-03T12:00:00Z"))).toBe("open");
    expect(service.effectiveStatus(service.getById("closing-goods")!, new Date("2026-06-03T12:30:00Z"))).toBe("closing_soon");
    expect(service.effectiveStatus(service.getById("offline-event")!, new Date("2026-06-03T12:00:00Z"))).toBe("upcoming");
  });

  it("treats a regular open event as ended exactly at endsAt", () => {
    const service = createService();
    const event = hubEvent({
      id: "boundary-open-event",
      status: "open",
      generationId: "official",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      startsAt: "2026-06-03T00:00:00Z",
      endsAt: "2026-06-04T00:00:00Z"
    });

    expect(service.effectiveStatus(event, new Date("2026-06-04T00:00:00Z"))).toBe("ended");
  });

  it("keeps persisted terminal statuses and respects closing soon boundaries", () => {
    const service = createService();

    expect(
      service.effectiveStatus(
        hubEvent({
          id: "ended-event",
          status: "ended",
          generationId: "official",
          sourceLabel: "Stellive Official",
          sourceType: "official",
          startsAt: "2026-06-20T00:00:00Z",
          endsAt: "2026-06-25T00:00:00Z"
        }),
        new Date("2026-06-03T12:00:00Z")
      )
    ).toBe("ended");

    expect(
      service.effectiveStatus(
        hubEvent({
          id: "persisted-closing-soon",
          status: "closing_soon",
          generationId: "official",
          sourceLabel: "Stellive Official",
          sourceType: "official",
          startsAt: "2026-06-03T00:00:00Z",
          endsAt: "2026-06-04T00:00:00Z"
        }),
        new Date("2026-06-03T23:59:59Z")
      )
    ).toBe("closing_soon");

    expect(
      service.effectiveStatus(
        hubEvent({
          id: "persisted-closing-soon",
          status: "closing_soon",
          generationId: "official",
          sourceLabel: "Stellive Official",
          sourceType: "official",
          startsAt: "2026-06-03T00:00:00Z",
          endsAt: "2026-06-04T00:00:00Z"
        }),
        new Date("2026-06-04T00:00:00Z")
      )
    ).toBe("ended");
  });

  it("filters the list by participation mode, status, generation, and member", () => {
    const service = createService();
    const now = new Date("2026-06-03T12:30:00Z");

    expect(service.list({ participationMode: "offline" }, now).items.map((event) => event.id)).toEqual(["offline-event"]);
    expect(service.list({ status: "closing_soon" }, now).items.map((event) => event.id)).toEqual(["closing-goods"]);
    expect(service.list({ generationId: "gen3" }, now).items.map((event) => event.id)).toEqual(["closing-goods"]);
    expect(service.list({ memberId: "tenko-shibuki" }, now).items.map((event) => event.id)).toEqual(["closing-goods"]);
    expect(service.list({ limit: 1 }, now)).toEqual({
      items: [hubEvent({
        id: "closing-goods",
        category: "online_goods",
        participationMode: "online",
        status: "open",
        title: "Closing Goods",
        memberId: "tenko-shibuki",
        generationId: "gen3",
        sourceLabel: "Tenko Shibuki",
        sourceType: "member",
        startsAt: "2026-06-02T00:00:00Z",
        endsAt: "2026-06-04T00:00:00Z"
      })],
      nextCursor: "closing-goods"
    });
  });

  it("summarizes counts and preview ordering", () => {
    const service = createService();
    const summary = service.summary(new Date("2026-06-03T12:30:00Z"));

    expect(summary.openCount).toBe(1);
    expect(summary.closingSoonCount).toBe(1);
    expect(summary.upcomingCount).toBe(1);
    expect(summary.preview.map((event) => event.id)).toEqual(["closing-goods", "open-goods", "offline-event"]);
  });

  it("maps memberless non-official events to a synthetic member id", () => {
    const service = createService();
    const event = hubEvent({
      id: "gen3-memberless",
      category: "online_collab",
      participationMode: "online",
      status: "announced",
      title: "Gen 3 Memberless Event",
      generationId: "gen3",
      sourceLabel: "Gen 3 Collab",
      sourceType: "official_collab"
    });

    expect(service.toNotificationEvent(event, "event_announced").memberId).toBe("hub-event:gen3-memberless");
    expect(service.toNotificationEvent(event, "event_announced").memberId).not.toBe("stellive-official");
  });
});

describe("hub event routes", () => {
  it("returns a summary with a preview", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/hub-events/summary" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      preview: expect.any(Array)
    });
  });

  it("filters hub events by participation mode", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/hub-events?participationMode=offline" });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: HubEvent[] };
    expect(body.items.every((event) => event.participationMode === "offline")).toBe(true);
  });

  it("includes a compact hub events summary in bootstrap", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/bootstrap?deviceId=dev-device" });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as { hubEventsSummary?: { preview: HubEvent[] } };
    expect(body.hubEventsSummary?.preview.length).toBeLessThanOrEqual(3);
  });
});

describe("validateHubEvent", () => {
  const catalog = new CatalogService();

  function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
    return {
      id: "hub-event-1",
      category: "online_goods",
      participationMode: "online",
      status: "announced",
      title: "Official Online Goods Announcement",
      generationId: "official",
      sourceUrl: "https://example.com/events/1",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      ...overrides
    };
  }

  it("accepts official project events without member id", () => {
    expect(validateHubEvent(hubEvent(), catalog)).toEqual({ valid: true });
  });

  it("rejects excluded gangzi and gamja hub events", () => {
    expect(validateHubEvent(hubEvent({ memberId: "gangzi", generationId: "gamja" }), catalog)).toEqual({
      valid: false,
      reason: "gangzi_representative_excluded"
    });
    expect(validateHubEvent(hubEvent({ generationId: "gamja" }), catalog)).toEqual({
      valid: false,
      reason: "gamja_scope_excluded"
    });
  });

  it("rejects invalid source fields", () => {
    expect(validateHubEvent(hubEvent({ sourceUrl: "" }), catalog)).toEqual({
      valid: false,
      reason: "source_required"
    });
    expect(validateHubEvent(hubEvent({ sourceLabel: "" }), catalog)).toEqual({
      valid: false,
      reason: "source_required"
    });
    expect(validateHubEvent(hubEvent({ sourceType: "fan" as HubEvent["sourceType"] }), catalog)).toEqual({
      valid: false,
      reason: "source_type_not_allowed"
    });
  });

  it("rejects unknown members and generation mismatches", () => {
    expect(validateHubEvent(hubEvent({ memberId: "unknown-member", sourceType: "member" }), catalog)).toEqual({
      valid: false,
      reason: "member_not_allowed"
    });
    expect(validateHubEvent(hubEvent({ memberId: "tenko-shibuki", generationId: "gen2", sourceType: "member" }), catalog)).toEqual({
      valid: false,
      reason: "member_generation_mismatch"
    });
  });

  it("rejects untrusted asset fields", () => {
    expect(validateHubEvent({ ...hubEvent(), imageUrl: "https://example.com/image.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), logoUrl: "https://example.com/logo.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), posterUrl: "https://example.com/poster.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), thumbnailUrl: "https://example.com/thumb.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
    expect(validateHubEvent({ ...hubEvent(), profileImageUrl: "https://example.com/profile.png" } as HubEvent, catalog)).toEqual({
      valid: false,
      reason: "asset_fields_not_allowed"
    });
  });
});
