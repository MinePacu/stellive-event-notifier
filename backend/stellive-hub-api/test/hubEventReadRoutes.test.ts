import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { HubEvent } from "../src/types.js";
import type { HubEventFilters, HubEventReadPort } from "../src/hub-events/hubEventService.js";

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: "official-goods-1",
    category: "online_goods",
    participationMode: "online",
    status: "open",
    title: "공식 굿즈 판매",
    summary: "이미지 없이 표시 가능한 공식 굿즈 판매",
    generationId: "official",
    memberId: "stellive-official",
    sourceUrl: "https://example.com/hub-events/official-goods-1",
    sourceLabel: "공식 공지",
    sourceType: "official",
    announcedAt: "2026-06-10T00:00:00.000Z",
    startsAt: "2026-06-12T00:00:00.000Z",
    endsAt: "2026-06-19T14:59:59.000Z",
    notificationEligible: true,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides,
  };
}

function createHubEvents(events: HubEvent[]): HubEventReadPort {
  return {
    async list(filters: HubEventFilters = {}) {
      const filtered = events.filter((event) => {
        if (filters.category && event.category !== filters.category) return false;
        if (filters.participationMode && event.participationMode !== filters.participationMode) return false;
        if (filters.status && event.status !== filters.status) return false;
        if (filters.generationId && event.generationId !== filters.generationId) return false;
        if (filters.memberId && event.memberId !== filters.memberId) return false;
        return true;
      });
      const limit = filters.limit ?? 25;

      return {
        items: filtered.slice(0, limit),
        nextCursor: filtered.length > limit ? "cursor-1" : undefined,
      };
    },
    async getById(id: string) {
      return events.find((event) => event.id === id);
    },
    async summary() {
      return {
        openCount: 1,
        upcomingCount: 0,
        closingSoonCount: 0,
        preview: events.slice(0, 3),
      };
    },
  };
}

async function buildRouteApp(events: HubEvent[]) {
  return buildApp({
    env: routeEnv,
    useProcessEnv: false,
    appRoutes: {
      dependencies: {
        hubEvents: createHubEvents(events),
      },
    },
  });
}

describe("HubEvent read routes", () => {
  it("returns public HubEvent list DTOs", async () => {
    const app = await buildRouteApp([hubEvent(), hubEvent({ id: "official-goods-2" })]);
    const response = await app.inject({ method: "GET", url: "/v1/hub-events?limit=1" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [expect.objectContaining({ id: "official-goods-1", generationId: "official", sourceType: "official" })],
      nextCursor: expect.any(String),
    });
  });

  it("filters HubEvents by category, status, generationId, and memberId", async () => {
    const app = await buildRouteApp([
      hubEvent({ id: "official-goods-1", category: "online_goods", status: "open", generationId: "official", memberId: "stellive-official" }),
      hubEvent({ id: "gen3-popup-1", category: "offline_popup", status: "upcoming", generationId: "gen3", memberId: "member-gen3" }),
    ]);
    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events?category=offline_popup&status=upcoming&generationId=gen3&memberId=member-gen3",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([expect.objectContaining({ id: "gen3-popup-1" })]);
  });

  it("returns HubEvent detail by id", async () => {
    const app = await buildRouteApp([hubEvent({ id: "detail-event" })]);
    const response = await app.inject({ method: "GET", url: "/v1/hub-events/detail-event" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "detail-event", title: "공식 굿즈 판매" });
  });

  it("returns 404 for unknown HubEvent detail ids", async () => {
    const app = await buildRouteApp([]);
    const response = await app.inject({ method: "GET", url: "/v1/hub-events/missing-event" });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "hub_event_not_found" });
  });

  it("rejects invalid HubEvent enum filters", async () => {
    const app = await buildRouteApp([hubEvent()]);
    const response = await app.inject({ method: "GET", url: "/v1/hub-events?category=livestream" });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_hub_event_query", field: "category" });
  });

  it("rejects invalid HubEvent date ranges", async () => {
    const app = await buildRouteApp([hubEvent()]);
    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events?from=2026-06-20T00:00:00.000Z&to=2026-06-01T00:00:00.000Z",
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_hub_event_query", field: "date_range" });
  });

  it("returns calendar entries grouped for the requested timezone", async () => {
    const app = await buildRouteApp([hubEvent({ id: "calendar-event" })]);
    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const entries = body.days.flatMap((day: { entries: unknown[] }) => day.entries);
    expect(body).toMatchObject({
      timezone: "Asia/Seoul",
      from: expect.any(String),
      to: expect.any(String),
    });
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: "calendar-event",
          appDeepLink: "stellivehub://hub-events/calendar-event",
          platformUrl: "https://example.com/hub-events/official-goods-1",
        }),
      ]),
    );
  });

  it("returns widget snapshot entries with freshness metadata", async () => {
    const app = await buildRouteApp([
      hubEvent({ id: "widget-1" }),
      hubEvent({ id: "widget-2", startsAt: "2026-06-13T00:00:00.000Z" }),
    ]);
    const response = await app.inject({ method: "GET", url: "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=1" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      generatedAt: expect.any(String),
      timezone: "Asia/Seoul",
      entries: [expect.objectContaining({ eventId: expect.any(String), appDeepLink: expect.stringContaining("stellivehub://hub-events/") })],
      staleAfter: expect.any(String),
    });
    expect(response.json().entries).toHaveLength(1);
  });

  it("does not synthesize livestream, upload, ordinary post, or fan-hosted events in HubEvent reads", async () => {
    const app = await buildRouteApp([hubEvent({ id: "official-goods-1" })]);
    const response = await app.inject({ method: "GET", url: "/v1/hub-events" });
    await app.close();

    const body = response.json();
    const ids = body.items.map((event: HubEvent) => event.id).join(" ");
    const allowedGenerationIds = new Set(["gen1", "gen2", "gen3", "gamja", "official", "gen4-upcoming"]);
    expect(ids).not.toContain("livestream");
    expect(ids).not.toContain("upload");
    expect(ids).not.toContain("fan-hosted");
    expect(body.items.every((event: HubEvent) => allowedGenerationIds.has(event.generationId))).toBe(true);
    expect(body.items[0]).not.toHaveProperty("imageUrl");
    expect(body.items[0]).toMatchObject({ title: expect.any(String), sourceUrl: expect.any(String) });
  });
});
