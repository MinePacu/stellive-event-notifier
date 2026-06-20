import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";
import type { HubCalendarSpecialDay, HubEvent } from "../src/types.js";
import type { HubEventFilters, HubEventReadPort } from "../src/hub-events/hubEventService.js";
import type { SpecialDayOccurrence } from "../src/hub-events/hubCalendarSpecialDayMaterializer.js";

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

async function buildRouteApp(
  events: HubEvent[],
  specialDays: HubCalendarSpecialDay[] = [],
  specialDayOccurrences?: {
    listRange(filters: { from: Date; to: Date; generationId?: string; memberId?: string; kind?: string }): Promise<SpecialDayOccurrence[]>;
  }
) {
  return buildApp({
    env: routeEnv,
    useProcessEnv: false,
    appRoutes: {
      dependencies: {
        hubEvents: createHubEvents(events),
        hubCalendarSpecialDays: specialDays,
        hubCalendarSpecialDayOccurrences: specialDayOccurrences
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

  it("returns allowed image metadata on list and detail responses", async () => {
    const image = {
      policyState: "official_runtime_url" as const,
      url: "https://example.com/event.jpg",
      sourceLabel: "공식 공지",
      sourceUrl: "https://example.com/notice",
      altText: "공식 굿즈 이미지"
    };
    const app = await buildRouteApp([hubEvent({ id: "image-event", image })]);

    const listResponse = await app.inject({ method: "GET", url: "/v1/hub-events" });
    const detailResponse = await app.inject({ method: "GET", url: "/v1/hub-events/image-event" });

    await app.close();
    expect(listResponse.statusCode).toBe(200);
    expect(detailResponse.statusCode).toBe(200);
    expect(listResponse.json().items[0].image).toEqual(image);
    expect(detailResponse.json().image).toEqual(image);
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

  it("returns ended status for past special-day calendar entries", async () => {
    const app = await buildRouteApp(
      [hubEvent({ id: "calendar-event" })],
      [
        {
          id: "birthday:member-yuni",
          kind: "member_birthday",
          title: "아야츠노 유니 생일",
          generationId: "gen1",
          memberId: "member-yuni",
          month: 5,
          day: 21,
          activeStatus: "active",
          catalogRole: "member",
          sourceLabel: "카탈로그",
          policyState: "catalog_verified"
        }
      ]
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z&timezone=Asia/Seoul"
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const entries = response.json().days.flatMap((day: { entries: Array<{ entryKind: string }> }) => day.entries);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "birthday:member-yuni:2026-05-21",
          entryKind: "member_birthday",
          status: "ended"
        })
      ])
    );
  });

  it("returns materialized special-day occurrences from calendar routes", async () => {
    const occurrence: SpecialDayOccurrence = {
      id: "special-day-occurrence:birthday:ayatsuno-yuni:2026",
      specialDayId: "birthday:ayatsuno-yuni",
      kind: "member_birthday",
      displayYear: 2026,
      displayDate: "2026-05-21",
      title: "아야츠노 유니 생일",
      specialDayLabel: "생일",
      generationId: "gen1",
      memberId: "ayatsuno-yuni",
      startsAt: new Date("2026-05-20T15:00:00.000Z"),
      endsAt: new Date("2026-05-21T15:00:00.000Z"),
      sourceLabel: "카탈로그",
      policyState: "catalog_verified"
    };
    const listRange = async () => [occurrence];
    const app = await buildRouteApp([], [], { listRange });

    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z&timezone=Asia/Seoul"
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const entries = response.json().days.flatMap((day: { entries: unknown[] }) => day.entries);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "birthday:ayatsuno-yuni:2026-05-21",
          entryKind: "member_birthday",
          startsAt: "2026-05-20T15:00:00.000Z",
          endsAt: "2026-05-21T15:00:00.000Z"
        })
      ])
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

  it("keeps calendar HubEvent entries when optional special-day occurrence storage is missing", async () => {
    const app = await buildRouteApp(
      [
        hubEvent({
          id: "calendar-event",
          startsAt: "2026-07-11T09:00:00.000Z",
          endsAt: "2026-07-11T12:00:00.000Z"
        })
      ],
      [],
      {
        async listRange() {
          throw Object.assign(new Error("missing table"), { code: "P2021" });
        }
      }
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z&timezone=Asia/Seoul"
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const entries = response.json().days.flatMap((day: { entries: unknown[] }) => day.entries);
    expect(entries).toEqual([expect.objectContaining({ eventId: "calendar-event", entryKind: "hub_event" })]);
  });

  it("keeps widget HubEvent entries when optional special-day occurrence storage is missing", async () => {
    const app = await buildRouteApp(
      [
        hubEvent({
          id: "widget-event",
          startsAt: "2026-07-11T09:00:00.000Z",
          endsAt: "2026-07-11T12:00:00.000Z"
        })
      ],
      [],
      {
        async listRange() {
          throw Object.assign(new Error("missing table"), { code: "P2021" });
        }
      }
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=1"
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().entries).toEqual([
      expect.objectContaining({ eventId: "widget-event", entryKind: "hub_event" })
    ]);
  });

  it("propagates non-missing-table special-day occurrence errors", async () => {
    const app = await buildRouteApp(
      [
        hubEvent({
          id: "calendar-event",
          startsAt: "2026-07-11T09:00:00.000Z",
          endsAt: "2026-07-11T12:00:00.000Z"
        })
      ],
      [],
      {
        async listRange() {
          throw Object.assign(new Error("database unavailable"), { code: "P1001" });
        }
      }
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z&timezone=Asia/Seoul"
    });
    await app.close();

    expect(response.statusCode).toBe(500);
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

  it("does not expose image metadata on calendar or widget entries", async () => {
    const image = {
      policyState: "official_runtime_url" as const,
      url: "https://example.com/event.jpg",
      sourceLabel: "공식 공지",
      sourceUrl: "https://example.com/notice"
    };
    const app = await buildRouteApp([hubEvent({ id: "compact-image-event", image })]);

    const calendarResponse = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul"
    });
    const widgetResponse = await app.inject({ method: "GET", url: "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=1" });

    await app.close();
    expect(calendarResponse.statusCode).toBe(200);
    expect(widgetResponse.statusCode).toBe(200);
  expect(calendarResponse.json().days[0].entries[0]).not.toHaveProperty("image");
  expect(widgetResponse.json().entries[0]).not.toHaveProperty("image");
});

it("includes verified special days in calendar responses", async () => {
  const app = await buildRouteApp(
    [hubEvent({ id: "calendar-event" })],
    [
      {
        id: "birthday:member-yuni",
        kind: "member_birthday",
        title: "아야츠노 유니 생일",
        generationId: "gen1",
        memberId: "member-yuni",
        month: 6,
        day: 12,
        activeStatus: "active",
        catalogRole: "member",
        sourceLabel: "카탈로그",
        policyState: "catalog_verified"
      }
    ]
  );
  const response = await app.inject({
    method: "GET",
    url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul"
  });
  await app.close();

  expect(response.statusCode).toBe(200);
  const entries = response.json().days.flatMap((day: { entries: unknown[] }) => day.entries);
  expect(entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "birthday:member-yuni:2026-06-12",
        entryKind: "member_birthday",
        specialDayKind: "member_birthday",
        displayTimeText: "종일"
      })
    ])
  );
});

it("filters calendar responses by entryKind", async () => {
  const app = await buildRouteApp(
    [hubEvent({ id: "calendar-event" })],
    [
      {
        id: "birthday:member-yuni",
        kind: "member_birthday",
        title: "아야츠노 유니 생일",
        generationId: "gen1",
        memberId: "member-yuni",
        month: 6,
        day: 12,
        activeStatus: "active",
        catalogRole: "member",
        sourceLabel: "카탈로그",
        policyState: "catalog_verified"
      }
    ]
  );
  const response = await app.inject({
    method: "GET",
    url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul&entryKind=member_birthday"
  });
  await app.close();

  expect(response.statusCode).toBe(200);
  const entries = response.json().days.flatMap((day: { entries: Array<{ entryKind: string }> }) => day.entries);
  expect(entries).toHaveLength(1);
  expect(entries[0].entryKind).toBe("member_birthday");
});

describe("HubEvent Prisma-backed public reads", () => {
  it("exposes published non-deleted admin events through public list, detail, and calendar routes", async () => {
    const published = {
      id: "published-prisma-event",
      category: "online_goods",
      participationMode: "online",
      status: "open",
      title: "게시된 공식 굿즈",
      summary: null,
      memberId: "stellive-official",
      generationId: "official",
      sourceUrl: "https://example.com/published-prisma-event",
      sourceLabel: "공식 공지",
      sourceType: "official",
      announcedAt: new Date("2026-06-10T00:00:00.000Z"),
      startsAt: new Date("2026-06-18T00:00:00.000Z"),
      endsAt: new Date("2026-06-30T23:59:59.999Z"),
      purchaseUrl: null,
      ticketUrl: null,
      venueName: null,
      venueAddress: null,
      image: null,
      notificationEligible: true,
      publicationState: "published",
      publishedAt: new Date("2026-06-10T00:00:00.000Z"),
      cancelledAt: null,
      deactivatedAt: null,
      deletedAt: null,
      revision: 1,
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    };
    const findManyArgs: unknown[] = [];
    const findFirstArgs: unknown[] = [];
    const repository = new HubEventRepository({
      hubEvent: {
        async findMany(args: unknown) {
          findManyArgs.push(args);
          return [published];
        },
        async findFirst(args: unknown) {
          findFirstArgs.push(args);
          return published;
        },
      },
    });
    const app = await buildApp({
      useProcessEnv: false,
      env: {
        NODE_ENV: "test",
        HUB_EVENTS_STORAGE_MODE: "prisma",
        DATABASE_URL: routeEnv.DATABASE_URL,
      },
      appRoutes: { dependencies: { hubEvents: repository } },
    });

    const listResponse = await app.inject({ method: "GET", url: "/v1/hub-events" });
    const detailResponse = await app.inject({ method: "GET", url: "/v1/hub-events/published-prisma-event" });
    const calendarResponse = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul",
    });

    await app.close();

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().items.map((event: HubEvent) => event.id)).toEqual(["published-prisma-event"]);
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().id).toBe("published-prisma-event");
    expect(calendarResponse.statusCode).toBe(200);
    expect(calendarResponse.json().days.flatMap((day: { entries: unknown[] }) => day.entries)).toContainEqual(
      expect.objectContaining({ eventId: "published-prisma-event", entryKind: "hub_event" }),
    );
    expect(findManyArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: expect.objectContaining({ publicationState: "published", deletedAt: null }),
        }),
      ]),
    );
    expect(findFirstArgs).toEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          id: "published-prisma-event",
          publicationState: "published",
          deletedAt: null,
        }),
      }),
    ]);
  });
});
});
