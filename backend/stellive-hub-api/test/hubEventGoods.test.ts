import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CatalogService } from "../src/catalog/catalog.js";
import { HubEventAdminService } from "../src/hub-events/hubEventAdminService.js";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";
import { HubEventService } from "../src/hub-events/hubEventService.js";

type Row = Record<string, unknown> & { id: string };

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  ADMIN_CONSOLE_ENABLED: "true",
  ADMIN_CONSOLE_TOKEN: "admin-token",
  INTERNAL_API_TOKEN: "internal-token"
};
const auth = { authorization: "Bearer admin-token" };
const EVENT_ID = "popup-1";
const OTHER_EVENT_ID = "popup-2";

function eventRow(id: string, overrides: Record<string, unknown> = {}): Row {
  return {
    id,
    category: "offline_popup",
    tags: [],
    participationMode: "offline",
    status: "open",
    scheduleMode: "timeline",
    title: `Popup ${id}`,
    summary: null,
    memberId: null,
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "Stellive Official",
    sourceType: "official",
    announcedAt: null,
    startsAt: new Date("2026-06-01T00:00:00Z"),
    endsAt: new Date("2099-06-01T00:00:00Z"),
    purchaseUrl: null,
    ticketUrl: null,
    venueName: null,
    venueAddress: null,
    image: null,
    notificationEligible: true,
    publicationState: "published",
    publishedAt: new Date("2026-06-01T00:00:00Z"),
    cancelledAt: null,
    deactivatedAt: null,
    deletedAt: null,
    revision: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    links: [],
    scheduleItems: [scheduleRow(`${id}-sched`, id)],
    ...overrides
  };
}

function scheduleRow(id: string, hubEventId: string): Row {
  return {
    id,
    hubEventId,
    kind: "main_window",
    title: "Main",
    label: "Main",
    description: null,
    startsAt: new Date("2026-06-01T00:00:00Z"),
    endsAt: new Date("2099-06-01T00:00:00Z"),
    timePrecision: "datetime",
    timezone: "Asia/Seoul",
    actionUrl: null,
    sourceUrl: null,
    sourceLabel: null,
    notificationEligible: true,
    isPrimary: true,
    sortOrder: 0,
    cancelledAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    links: []
  };
}

/** In-memory stand-in for the Prisma delegates HubEventRepository touches. */
function createFakePrisma() {
  const events = new Map<string, Row>([
    [EVENT_ID, eventRow(EVENT_ID)],
    [OTHER_EVENT_ID, eventRow(OTHER_EVENT_ID)]
  ]);
  const goods: Row[] = [];
  const audits: Row[] = [];
  const calls: string[] = [];
  let goodsSeq = 0;
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 6, 1, 0, 0, tick++));

  function withRelations(event: Row, include: Record<string, unknown> | undefined): Row {
    const record: Row = { ...event };
    const goodsInclude = include?.goodsItems as { where?: { cancelledAt?: null } } | undefined;
    if (goodsInclude) {
      record.goodsItems = goods
        .filter((item) => item.hubEventId === event.id && (goodsInclude.where?.cancelledAt !== null || item.cancelledAt === null))
        .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number) || a.id.localeCompare(b.id))
        .map((item) => ({ ...item }));
    }
    if (include?._count) {
      record._count = { goodsItems: goods.filter((item) => item.hubEventId === event.id && item.cancelledAt === null).length };
    }
    return record;
  }

  const prisma = {
    hubEvent: {
      async findFirst(args: { where: Row; include?: Record<string, unknown> }) {
        const event = events.get(args.where.id);
        if (!event) return null;
        if (args.where.publicationState && event.publicationState !== args.where.publicationState) return null;
        return withRelations(event, args.include);
      },
      async findMany(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        return [...events.values()]
          .filter((event) => !args.where.publicationState || event.publicationState === args.where.publicationState)
          .map((event) => withRelations(event, args.include));
      },
      async updateMany(args: { where: { id: string; revision: number }; data: Record<string, unknown> }) {
        calls.push("hubEvent.updateMany");
        const event = events.get(args.where.id);
        if (!event || event.revision !== args.where.revision) return { count: 0 };
        event.revision = (event.revision as number) + 1;
        event.updatedBy = args.data.updatedBy;
        event.updatedAt = now();
        return { count: 1 };
      }
    },
    hubEventGoodsItem: {
      async findMany(args: { where: { hubEventId: string } }) {
        return goods.filter((item) => item.hubEventId === args.where.hubEventId).map((item) => ({ id: item.id }));
      },
      async create(args: { data: Record<string, unknown> }) {
        calls.push("goods.create");
        const row = { ...args.data, id: `goods-${++goodsSeq}`, createdAt: now(), updatedAt: now() } as Row;
        if (row.image === Prisma.DbNull) row.image = null;
        goods.push(row);
        return row;
      },
      async update(args: { where: { id: string }; data: Record<string, unknown> }) {
        calls.push("goods.update");
        const row = goods.find((item) => item.id === args.where.id)!;
        Object.assign(row, args.data, { updatedAt: now() });
        if (row.image === Prisma.DbNull) row.image = null;
        return row;
      },
      async deleteMany(args: { where: { id: { in: string[] }; hubEventId: string } }) {
        calls.push("goods.deleteMany");
        let count = 0;
        for (let index = goods.length - 1; index >= 0; index -= 1) {
          if (args.where.id.in.includes(goods[index].id) && goods[index].hubEventId === args.where.hubEventId) {
            goods.splice(index, 1);
            count += 1;
          }
        }
        return { count };
      }
    },
    hubEventAuditLog: {
      async create(args: { data: Row }) {
        audits.push(args.data);
        return args.data;
      },
      async findMany() {
        return [];
      }
    }
  };
  return { prisma, events, goods, audits, calls };
}

function setup() {
  const fake = createFakePrisma();
  const repository = new HubEventRepository(fake.prisma as never);
  const service = new HubEventAdminService({
    catalog: new CatalogService(),
    repository,
    platformEvents: { async createIfNotExists() { return { created: false }; } },
    notificationJobs: { async enqueue() { return undefined; } },
    now: () => new Date("2026-07-01T12:00:00.000Z")
  });
  const appPromise = buildApp({
    env,
    useProcessEnv: false,
    adminHubEventRoutes: { dependencies: { service } },
    appRoutes: { dependencies: { hubEvents: repository } }
  });
  return { ...fake, appPromise };
}

const goodsBody = (overrides: Record<string, unknown> = {}) => ({
  expectedRevision: 1,
  name: "아크릴 스탠드",
  groupLabel: "아크릴",
  memberIds: ["tenko-shibuki"],
  priceKrw: 12000,
  salesChannel: "onsite",
  purchaseLimit: 3,
  isBonus: false,
  ...overrides
});

async function adminGet(app: Awaited<ReturnType<typeof buildApp>>, id = EVENT_ID) {
  const response = await app.inject({ method: "GET", url: `/v1/admin/hub-events/${id}`, headers: auth });
  return response.json();
}

describe("hub event goods items (admin API, real service + repository over a fake Prisma)", () => {
  it("creates a goods item, bumps revision and writes a goods_create audit log", async () => {
    const { appPromise, audits } = setup();
    const app = await appPromise;

    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/hub-events/${EVENT_ID}/goods-items`,
      headers: auth,
      payload: { ...goodsBody(), changeReason: "notice 13930" }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.revision).toBe(2);
    expect(body.goodsItems).toHaveLength(1);
    expect(body.goodsItems[0]).toMatchObject({
      name: "아크릴 스탠드",
      memberIds: ["tenko-shibuki"],
      priceKrw: 12000,
      salesChannel: "onsite",
      purchaseLimit: 3,
      isBonus: false,
      sortOrder: 0
    });
    expect(body.goodsItems[0].id).toEqual(expect.any(String));
    expect(audits).toEqual([expect.objectContaining({ hubEventId: EVENT_ID, action: "goods_create", actorId: "admin", reason: "notice 13930" })]);
  });

  it("rejects invalid single-item writes with field errors and changes nothing", async () => {
    const { appPromise, audits, goods, events } = setup();
    const app = await appPromise;

    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/hub-events/${EVENT_ID}/goods-items`,
      headers: auth,
      payload: goodsBody({ purchaseUrl: "http://example.com", availability: "sold_out", scheduleItemId: `${OTHER_EVENT_ID}-sched` })
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().errors.map((error: { field: string }) => error.field).sort()).toEqual([
      "availability",
      "purchaseUrl",
      "scheduleItemId"
    ]);
    expect(goods).toHaveLength(0);
    expect(audits).toHaveLength(0);
    expect(events.get(EVENT_ID)!.revision).toBe(1);
  });

  it("accepts a scheduleItemId that belongs to the same event", async () => {
    const { appPromise } = setup();
    const app = await appPromise;

    const response = await app.inject({
      method: "POST",
      url: `/v1/admin/hub-events/${EVENT_ID}/goods-items`,
      headers: auth,
      payload: goodsBody({ scheduleItemId: `${EVENT_ID}-sched` })
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(response.json().goodsItems[0].scheduleItemId).toBe(`${EVENT_ID}-sched`);
  });

  it("returns 409 on a stale revision and 404 for unknown events or goods items", async () => {
    const { appPromise } = setup();
    const app = await appPromise;

    const stale = await app.inject({
      method: "POST",
      url: `/v1/admin/hub-events/${EVENT_ID}/goods-items`,
      headers: auth,
      payload: goodsBody({ expectedRevision: 7 })
    });
    const unknownEvent = await app.inject({
      method: "POST",
      url: "/v1/admin/hub-events/nope/goods-items",
      headers: auth,
      payload: goodsBody()
    });
    const unknownItem = await app.inject({
      method: "PATCH",
      url: `/v1/admin/hub-events/${EVENT_ID}/goods-items/missing`,
      headers: auth,
      payload: { expectedRevision: 1, priceKrw: 1 }
    });
    await app.close();

    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ expectedRevision: 7, currentRevision: 1 });
    expect(unknownEvent.statusCode).toBe(404);
    expect(unknownItem.statusCode).toBe(404);
    expect(unknownItem.json()).toEqual({ error: "hub_event_goods_item_not_found" });
  });

  it("patches, cancels (soft delete), restores and reorders goods items with a revision bump and audit each", async () => {
    const { appPromise, audits } = setup();
    const app = await appPromise;
    const url = `/v1/admin/hub-events/${EVENT_ID}/goods-items`;

    await app.inject({ method: "POST", url, headers: auth, payload: goodsBody({ name: "A" }) });
    await app.inject({ method: "POST", url, headers: auth, payload: goodsBody({ name: "B", expectedRevision: 2 }) });
    const created = await adminGet(app);
    const [a, b] = created.goodsItems;
    expect(created.revision).toBe(3);

    const patched = await app.inject({ method: "PATCH", url: `${url}/${a.id}`, headers: auth, payload: { expectedRevision: 3, priceKrw: 15000, priceNote: "랜덤 1종", purchaseLimit: null } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().revision).toBe(4);
    expect(patched.json().goodsItems.find((item: { id: string }) => item.id === a.id)).toMatchObject({ name: "A", priceKrw: 15000, priceNote: "랜덤 1종" });
    expect(patched.json().goodsItems.find((item: { id: string }) => item.id === a.id)).not.toHaveProperty("purchaseLimit");

    const invalidPatch = await app.inject({ method: "PATCH", url: `${url}/${a.id}`, headers: auth, payload: { expectedRevision: 4, priceKrw: -1 } });
    expect(invalidPatch.statusCode).toBe(400);
    expect(invalidPatch.json().errors).toEqual([expect.objectContaining({ field: "priceKrw", reason: "goods_price_invalid" })]);

    const cancelled = await app.inject({ method: "DELETE", url: `${url}/${b.id}`, headers: auth, payload: { expectedRevision: 4 } });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().revision).toBe(5);
    expect(cancelled.json().goodsItems.find((item: { id: string }) => item.id === b.id).cancelledAt).toBe("2026-07-01T12:00:00.000Z");
    // admin GET still lists the cancelled item (flagged)
    expect((await adminGet(app)).goodsItems).toHaveLength(2);

    const restored = await app.inject({ method: "POST", url: `${url}/${b.id}/restore`, headers: auth, payload: { expectedRevision: 5 } });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().revision).toBe(6);
    expect(restored.json().goodsItems.find((item: { id: string }) => item.id === b.id)).not.toHaveProperty("cancelledAt");

    const reordered = await app.inject({ method: "PUT", url: `${url}/order`, headers: auth, payload: { expectedRevision: 6, goodsItemIds: [b.id, a.id] } });
    expect(reordered.statusCode).toBe(200);
    expect(reordered.json().revision).toBe(7);
    expect(reordered.json().goodsItems.map((item: { id: string }) => item.id)).toEqual([b.id, a.id]);

    const badOrder = await app.inject({ method: "PUT", url: `${url}/order`, headers: auth, payload: { expectedRevision: 7, goodsItemIds: [a.id] } });
    expect(badOrder.statusCode).toBe(400);
    await app.close();

    expect(audits.map((audit) => audit.action)).toEqual([
      "goods_create",
      "goods_create",
      "goods_update",
      "goods_cancel",
      "goods_restore",
      "goods_reorder"
    ]);
  });

  it("bulk replaces the goods list in one revision bump and one audit entry", async () => {
    const { appPromise, audits, goods, calls } = setup();
    const app = await appPromise;
    const url = `/v1/admin/hub-events/${EVENT_ID}/goods-items`;
    await app.inject({ method: "POST", url, headers: auth, payload: goodsBody({ name: "keep" }) });
    await app.inject({ method: "POST", url, headers: auth, payload: goodsBody({ name: "drop", expectedRevision: 2 }) });
    const before = await adminGet(app);
    const keepId = before.goodsItems[0].id;
    audits.length = 0;
    calls.length = 0;

    const response = await app.inject({
      method: "PUT",
      url,
      headers: auth,
      payload: {
        expectedRevision: 3,
        items: [
          { name: "신규 특전", salesChannel: "both", isBonus: true, memberIds: [] },
          { id: keepId, name: "keep v2", salesChannel: "online", priceKrw: 9000, purchaseUrl: "https://example.com/g" }
        ]
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.revision).toBe(4);
    expect(body.goodsItems.map((item: { name: string }) => item.name)).toEqual(["신규 특전", "keep v2"]);
    expect(body.goodsItems[0]).toMatchObject({ isBonus: true, sortOrder: 0 });
    expect(body.goodsItems[1]).toMatchObject({ id: keepId, sortOrder: 1, priceKrw: 9000, purchaseUrl: "https://example.com/g" });
    expect(goods).toHaveLength(2);
    expect(calls.filter((call) => call === "hubEvent.updateMany")).toHaveLength(1);
    expect(audits).toEqual([expect.objectContaining({ action: "goods_replace" })]);
  });

  it("bulk replace failure returns per-item index errors and writes nothing", async () => {
    const { appPromise, audits, goods, events, calls } = setup();
    const app = await appPromise;
    const url = `/v1/admin/hub-events/${EVENT_ID}/goods-items`;
    await app.inject({ method: "POST", url, headers: auth, payload: goodsBody({ name: "existing" }) });
    audits.length = 0;
    calls.length = 0;

    const response = await app.inject({
      method: "PUT",
      url,
      headers: auth,
      payload: {
        expectedRevision: 2,
        items: [
          { name: "ok", salesChannel: "online" },
          { name: "bad price", salesChannel: "online", priceKrw: -1 },
          { name: "bad url", salesChannel: "online", purchaseUrl: "http://example.com" },
          { name: "former member", salesChannel: "online", memberIds: ["no-such-member"] },
          { name: "binary", salesChannel: "online", image: { policyState: "none", base64: "AAAA" } }
        ]
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ valid: false });
    expect(response.json().errors.map((error: { field: string }) => error.field)).toEqual([
      "items[1].priceKrw",
      "items[2].purchaseUrl",
      "items[3].memberIds[0]",
      "items[4].image.base64"
    ]);
    expect(goods.map((item) => item.name)).toEqual(["existing"]);
    expect(events.get(EVENT_ID)!.revision).toBe(2);
    expect(audits).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it("bulk replace rejects ids that do not belong to the event", async () => {
    const { appPromise } = setup();
    const app = await appPromise;

    const response = await app.inject({
      method: "PUT",
      url: `/v1/admin/hub-events/${EVENT_ID}/goods-items`,
      headers: auth,
      payload: { expectedRevision: 1, items: [{ id: "someone-elses", name: "x", salesChannel: "online" }] }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toEqual([expect.objectContaining({ field: "items[0].id" })]);
  });

  it("requires admin authentication", async () => {
    const { appPromise } = setup();
    const app = await appPromise;

    const response = await app.inject({ method: "PUT", url: `/v1/admin/hub-events/${EVENT_ID}/goods-items`, payload: { expectedRevision: 1, items: [] } });
    await app.close();

    expect(response.statusCode).toBe(401);
  });
});

describe("hub event goods items (public API)", () => {
  async function seedGoods(app: Awaited<ReturnType<typeof buildApp>>) {
    const url = `/v1/admin/hub-events/${EVENT_ID}/goods-items`;
    const displayable = { policyState: "official_runtime_url", url: "https://example.com/a.png", sourceLabel: "공식", sourceUrl: "https://example.com" };
    const response = await app.inject({
      method: "PUT",
      url,
      headers: auth,
      payload: {
        expectedRevision: 1,
        items: [
          { name: "third", salesChannel: "online", sortOrder: 2, image: { policyState: "blocked", url: "https://example.com/b.png" } },
          { name: "first", salesChannel: "onsite", sortOrder: 0, image: displayable },
          { name: "cancelled soon", salesChannel: "both", sortOrder: 1 },
          { name: "second", salesChannel: "both", sortOrder: 1, isBonus: true }
        ]
      }
    });
    expect(response.statusCode).toBe(200);
    const cancelId = response.json().goodsItems.find((item: { name: string }) => item.name === "cancelled soon").id;
    const cancel = await app.inject({ method: "DELETE", url: `${url}/${cancelId}`, headers: auth, payload: { expectedRevision: 2 } });
    expect(cancel.statusCode).toBe(200);
  }

  it("detail includes non-cancelled goods sorted by sortOrder and drops undisplayable images", async () => {
    const { appPromise } = setup();
    const app = await appPromise;
    await seedGoods(app);

    const response = await app.inject({ method: "GET", url: `/v1/hub-events/${EVENT_ID}` });
    await app.close();

    expect(response.statusCode).toBe(200);
    const goodsItems = response.json().goodsItems;
    expect(goodsItems.map((item: { name: string }) => item.name)).toEqual(["first", "second", "third"]);
    expect(goodsItems[0].image).toMatchObject({ policyState: "official_runtime_url", url: "https://example.com/a.png" });
    expect(goodsItems[2]).not.toHaveProperty("image");
    expect(goodsItems.some((item: Record<string, unknown>) => "cancelledAt" in item)).toBe(false);
  });

  it("list adds goodsCount only when positive and never carries goodsItems; calendar, widget-snapshot and summary omit goods", async () => {
    const { appPromise } = setup();
    const app = await appPromise;
    await seedGoods(app);

    const list = await app.inject({ method: "GET", url: "/v1/hub-events" });
    const calendar = await app.inject({ method: "GET", url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z&includeSpecialDays=false" });
    const widget = await app.inject({ method: "GET", url: "/v1/hub-events/widget-snapshot?includeSpecialDays=false" });
    const summary = await app.inject({ method: "GET", url: "/v1/hub-events/summary" });
    await app.close();

    const items = list.json().items as Array<Record<string, unknown>>;
    const withGoods = items.find((item) => item.id === EVENT_ID)!;
    const withoutGoods = items.find((item) => item.id === OTHER_EVENT_ID)!;
    expect(withGoods.goodsCount).toBe(3);
    expect(withGoods).not.toHaveProperty("goodsItems");
    expect(withoutGoods).not.toHaveProperty("goodsCount");
    expect(withoutGoods).not.toHaveProperty("goodsItems");

    expect(calendar.statusCode).toBe(200);
    expect(calendar.body).toContain(EVENT_ID);
    expect(calendar.body).not.toContain("goodsItems");
    expect(widget.statusCode).toBe(200);
    expect(widget.body).toContain(EVENT_ID);
    expect(widget.body).not.toContain("goodsItems");
    expect(summary.body).not.toContain("goodsItems");
  });

  it("detail of an event without goods has no goodsItems field", async () => {
    const { appPromise } = setup();
    const app = await appPromise;

    const response = await app.inject({ method: "GET", url: `/v1/hub-events/${OTHER_EVENT_ID}` });
    await app.close();

    expect(response.json()).not.toHaveProperty("goodsItems");
  });
});

describe("hub event goods items (memory mode seed)", () => {
  it("serves seeded goods on detail only, with goodsCount on list and summary", () => {
    const service = new HubEventService(new CatalogService());

    const detail = service.getById("gen3-collab-popup");
    expect(detail?.goodsItems?.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    expect(detail?.goodsItems?.every((item) => !("image" in item))).toBe(true);
    const listed = service.list().items.find((event) => event.id === "gen3-collab-popup")!;
    expect(listed.goodsCount).toBe(3);
    expect(listed).not.toHaveProperty("goodsItems");
    expect(service.list().items.find((event) => event.id === "official-reservation-goods")).not.toHaveProperty("goodsCount");
    expect(JSON.stringify(service.summary())).not.toContain("goodsItems");
  });

  it("only seeds catalog members and HTTPS-free, asset-free items", () => {
    const catalog = new CatalogService();
    const detail = new HubEventService(catalog).getById("gen3-collab-popup")!;

    for (const item of detail.goodsItems ?? []) {
      expect(item.memberIds.every((memberId) => catalog.getMember(memberId))).toBe(true);
      expect(item.image).toBeUndefined();
      expect(item.purchaseUrl).toBeUndefined();
    }
  });
});
