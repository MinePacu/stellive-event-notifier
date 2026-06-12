import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CatalogService } from "../src/catalog/catalog.js";
import { HubEventService } from "../src/hub-events/hubEventService.js";
import { validateHubEvent, validateHubEventForAdmin } from "../src/hub-events/hubEventPolicy.js";
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
  async function injectHubEvents(url: string) {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url });
    await app.close();
    return response;
  }

  it("returns a summary with a preview", async () => {
    const response = await injectHubEvents("/v1/hub-events/summary");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      preview: expect.any(Array)
    });
  });

  it("filters hub events by participation mode", async () => {
    const response = await injectHubEvents("/v1/hub-events?participationMode=offline");
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: HubEvent[] };
    expect(body.items.every((event) => event.participationMode === "offline")).toBe(true);
  });

  it("includes a compact hub events summary in bootstrap", async () => {
    const response = await injectHubEvents("/v1/bootstrap?deviceId=dev-device");
    expect(response.statusCode).toBe(200);
    const body = response.json() as { hubEventsSummary?: { preview: HubEvent[] } };
    expect(body.hubEventsSummary?.preview.length).toBeLessThanOrEqual(3);
  });

  it("rejects invalid limit values", async () => {
    const response = await injectHubEvents("/v1/hub-events?limit=foo");

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_hub_event_query", field: "limit" });
  });

  it("rejects zero or negative limit values", async () => {
    const zeroResponse = await injectHubEvents("/v1/hub-events?limit=0");
    const negativeResponse = await injectHubEvents("/v1/hub-events?limit=-1");

    expect(zeroResponse.statusCode).toBe(400);
    expect(zeroResponse.json()).toEqual({ error: "invalid_hub_event_query", field: "limit" });
    expect(negativeResponse.statusCode).toBe(400);
    expect(negativeResponse.json()).toEqual({ error: "invalid_hub_event_query", field: "limit" });
  });

  it("returns one event and a next cursor for limit=1", async () => {
    const response = await injectHubEvents("/v1/hub-events?limit=1");

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: HubEvent[]; nextCursor?: string };

    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBeDefined();
  });
  it("uses the injected hub event read port for public list, detail, and summary routes", async () => {
    const event: HubEvent = {
      id: "injected-public-event",
      category: "online_goods",
      participationMode: "online",
      status: "announced",
      title: "Injected Public Event",
      generationId: "official",
      sourceUrl: "https://example.com/injected-public-event",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      announcedAt: "2026-06-03T00:00:00.000Z",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    };
    const calls: string[] = [];
    const app = await buildApp({
      appRoutes: {
        dependencies: {
          hubEvents: {
            async list(filters) {
              calls.push(`list:${filters?.limit ?? "default"}`);
              return { items: [event] };
            },
            async getById(id) {
              calls.push(`get:${id}`);
              return id === event.id ? event : undefined;
            },
            async summary() {
              calls.push("summary");
              return {
                openCount: 1,
                upcomingCount: 0,
                closingSoonCount: 0,
                preview: [event]
              };
            }
          }
        }
      }
    });

    const listResponse = await app.inject({ method: "GET", url: "/v1/hub-events?limit=7" });
    expect(listResponse.statusCode).toBe(200);
    expect((listResponse.json() as { items: HubEvent[] }).items).toEqual([event]);

    const detailResponse = await app.inject({ method: "GET", url: `/v1/hub-events/${event.id}` });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({ id: event.id, title: "Injected Public Event" });

    const missingResponse = await app.inject({ method: "GET", url: "/v1/hub-events/missing" });
    expect(missingResponse.statusCode).toBe(404);

    const summaryResponse = await app.inject({ method: "GET", url: "/v1/hub-events/summary" });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json()).toMatchObject({ openCount: 1, preview: [{ id: event.id }] });
    expect(calls).toEqual(["list:7", `get:${event.id}`, "get:missing", "summary"]);

    await app.close();
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

  it("allows drafts without a date window but rejects publish without any date", () => {
    expect(validateHubEventForAdmin(hubEvent(), catalog, "draft")).toEqual({ valid: true, errors: [] });
    expect(validateHubEventForAdmin(hubEvent(), catalog, "publish")).toEqual({
      valid: false,
      errors: [
        {
          field: "dateWindow",
          reason: "date_window_required",
          message: "A published hub event requires announcedAt, startsAt, or endsAt."
        }
      ]
    });
  });

  it("rejects invalid admin date windows", () => {
    const result = validateHubEventForAdmin(
      hubEvent({
        startsAt: "2026-06-20T00:00:00.000Z",
        endsAt: "2026-06-10T00:00:00.000Z"
      }),
      catalog,
      "publish"
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "endsAt",
      reason: "date_window_invalid",
      message: "endsAt must be greater than or equal to startsAt."
    });
  });

  it("rejects non-https admin URLs", () => {
    const result = validateHubEventForAdmin(
      hubEvent({
        announcedAt: "2026-06-03T00:00:00.000Z",
        sourceUrl: "http://example.com/source",
        purchaseUrl: "http://example.com/store",
        ticketUrl: "http://example.com/ticket"
      }),
      catalog,
      "publish"
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "sourceUrl", reason: "url_not_https" }),
        expect.objectContaining({ field: "purchaseUrl", reason: "url_not_https" }),
        expect.objectContaining({ field: "ticketUrl", reason: "url_not_https" })
      ])
    );
  });

  it("rejects official YouTube live admin inputs", () => {
    const result = validateHubEventForAdmin(
      hubEvent({
        announcedAt: "2026-06-03T00:00:00.000Z",
        generationId: "official",
        sourceType: "official",
        sourceUrl: "https://www.youtube.com/live/live-video-id"
      }),
      catalog,
      "publish"
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "sourceUrl",
      reason: "official_youtube_live_excluded",
      message: "Official YouTube live scheduled, started, and ended events are excluded."
    });
  });
});
