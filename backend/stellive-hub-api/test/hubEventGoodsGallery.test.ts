import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { CatalogService } from "../src/catalog/catalog.js";
import { loadEnv } from "../src/config/env.js";
import { HubEventAdminService } from "../src/hub-events/hubEventAdminService.js";
import {
  isAllowedGoodsGalleryImageHost,
  maxHubEventGoodsListImages,
  validateHubEventGoodsListImages,
  normalizeGoodsListImages,
  withPublicGoodsListImages
} from "../src/hub-events/hubEventGoodsGalleryPolicy.js";
import { validateHubEventForAdmin } from "../src/hub-events/hubEventPolicy.js";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";
import { HubEventService } from "../src/hub-events/hubEventService.js";
import type { HubEvent, HubEventGoodsListImage, HubEventImage } from "../src/types.js";

type Row = Record<string, unknown> & { id: string };

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  ADMIN_CONSOLE_ENABLED: "true",
  ADMIN_CONSOLE_TOKEN: "admin-token",
  INTERNAL_API_TOKEN: "internal-token"
};
const auth = { authorization: "Bearer admin-token" };
const EVENT_ID = "popup-1";

function image(page: number, overrides: Partial<HubEventGoodsListImage> = {}): HubEventGoodsListImage {
  return {
    policyState: "official_runtime_url",
    url: `https://stellive.me/placeholder/md-list-${String(page).padStart(2, "0")}.png`,
    sourceLabel: "공식 공지",
    sourceUrl: "https://stellive.me/news/0",
    altText: `MD 리스트 ${page}`,
    ...overrides
  };
}

function urls(list: unknown): string[] {
  return (list as HubEventImage[]).map((entry) => entry.url ?? "");
}

describe("HUB_EVENT_GOODS_GALLERY_ENABLED", () => {
  it("defaults to true and only an explicit false disables the gallery", () => {
    const base = { DATABASE_URL: env.DATABASE_URL };
    expect(loadEnv(base).HUB_EVENT_GOODS_GALLERY_ENABLED).toBe(true);
    expect(loadEnv({ ...base, HUB_EVENT_GOODS_GALLERY_ENABLED: "true" }).HUB_EVENT_GOODS_GALLERY_ENABLED).toBe(true);
    expect(loadEnv({ ...base, HUB_EVENT_GOODS_GALLERY_ENABLED: "false" }).HUB_EVENT_GOODS_GALLERY_ENABLED).toBe(false);
  });
});

describe("HUB_EVENT_GOODS_GALLERY_LAYOUT", () => {
  const base = { DATABASE_URL: env.DATABASE_URL };

  it("defaults to split, accepts single, and falls back to split on invalid values without crashing", () => {
    expect(loadEnv(base).HUB_EVENT_GOODS_GALLERY_LAYOUT).toBe("split");
    expect(loadEnv({ ...base, HUB_EVENT_GOODS_GALLERY_LAYOUT: "split" }).HUB_EVENT_GOODS_GALLERY_LAYOUT).toBe("split");
    expect(loadEnv({ ...base, HUB_EVENT_GOODS_GALLERY_LAYOUT: "single" }).HUB_EVENT_GOODS_GALLERY_LAYOUT).toBe("single");
    for (const value of ["grid", "", "  ", "SINGLE2"]) {
      expect(loadEnv({ ...base, HUB_EVENT_GOODS_GALLERY_LAYOUT: value }).HUB_EVENT_GOODS_GALLERY_LAYOUT, value).toBe("split");
    }
  });
});

describe("goodsListImages kind", () => {
  it("accepts md, bonus and an absent kind", () => {
    expect(
      validateHubEventGoodsListImages({ goodsListImages: [image(1, { kind: "md" }), image(2, { kind: "bonus" }), image(3)] })
    ).toEqual([]);
  });

  it("rejects an unknown, non-string or null kind with the indexed field", () => {
    const errors = validateHubEventGoodsListImages({
      goodsListImages: [
        image(1),
        image(2, { kind: "extra" as never }),
        image(3, { kind: 7 as never }),
        image(4, { kind: null as never }),
        image(5, { kind: "MD" as never })
      ]
    });
    expect(errors.map((error) => `${error.field}:${error.reason}`)).toEqual([
      "goodsListImages.1.kind:goods_list_image_kind_invalid",
      "goodsListImages.2.kind:goods_list_image_kind_invalid",
      "goodsListImages.3.kind:goods_list_image_kind_invalid",
      "goodsListImages.4.kind:goods_list_image_kind_invalid"
    ]);
  });

  it("reports an invalid kind alongside other image errors on the same entry", () => {
    const errors = validateHubEventGoodsListImages({
      goodsListImages: [image(1, { url: "http://stellive.me/a.png", kind: "x" as never })]
    });
    expect(errors.map((error) => `${error.field}:${error.reason}`).sort()).toEqual([
      "goodsListImages.0.kind:goods_list_image_kind_invalid",
      "goodsListImages.0.url:image_url_not_https"
    ]);
  });

  it("normalizes and projects kind, keeping absent kind absent and dropping unknown stored kinds", () => {
    const normalized = normalizeGoodsListImages([
      image(1, { kind: "md" }),
      image(2, { kind: "bonus" }),
      image(3),
      { ...image(4), kind: "junk" }
    ]);
    expect(normalized?.map((entry) => entry.kind)).toEqual(["md", "bonus", undefined, undefined]);
    expect(normalized?.map((entry) => "kind" in entry)).toEqual([true, true, false, false]);

    const projected = withPublicGoodsListImages(
      hubEvent({ goodsListImages: [image(1, { kind: "bonus" }), image(2), image(3, { policyState: "blocked", kind: "md" })] })
    );
    expect(projected.goodsListImages).toEqual([image(1, { kind: "bonus" }), image(2)]);
    expect("kind" in projected.goodsListImages![1]!).toBe(false);
  });
});

describe("goodsListImages validation policy", () => {
  it("accepts a valid ordered list, absent and null", () => {
    expect(validateHubEventGoodsListImages({ goodsListImages: [image(1), image(2)] })).toEqual([]);
    expect(validateHubEventGoodsListImages({})).toEqual([]);
    expect(validateHubEventGoodsListImages({ goodsListImages: null })).toEqual([]);
    expect(validateHubEventGoodsListImages({ goodsListImages: [] })).toEqual([]);
  });

  it("accepts exactly the maximum and rejects more", () => {
    const max = Array.from({ length: maxHubEventGoodsListImages }, (_, index) => image(index + 1));
    expect(validateHubEventGoodsListImages({ goodsListImages: max })).toEqual([]);
    const errors = validateHubEventGoodsListImages({ goodsListImages: [...max, image(21)] });
    expect(errors).toEqual([expect.objectContaining({ field: "goodsListImages", reason: "goods_list_images_too_many" })]);
  });

  it("rejects non-array values and non-object entries", () => {
    expect(validateHubEventGoodsListImages({ goodsListImages: image(1) })).toEqual([
      expect.objectContaining({ field: "goodsListImages", reason: "goods_list_images_invalid" })
    ]);
    expect(validateHubEventGoodsListImages({ goodsListImages: "x" })[0]?.reason).toBe("goods_list_images_invalid");
    const errors = validateHubEventGoodsListImages({ goodsListImages: [image(1), null, "x", []] });
    expect(errors.map((error) => error.field)).toEqual(["goodsListImages.1", "goodsListImages.2", "goodsListImages.3"]);
  });

  it("reuses the event image policy with indexed paths (binary fields, http, source metadata)", () => {
    const errors = validateHubEventGoodsListImages({
      goodsListImages: [
        image(1),
        image(2, { url: "http://stellive.me/placeholder/md-list-02.png" }),
        { ...image(3), base64: "AAAA", bytes: [1] },
        image(4, { sourceLabel: undefined }),
        { policyState: "weird", url: "https://stellive.me/x.png" }
      ]
    });
    expect(errors.map((error) => `${error.field}:${error.reason}`).sort()).toEqual([
      "goodsListImages.1.url:image_url_not_https",
      "goodsListImages.2.base64:image_asset_fields_not_allowed",
      "goodsListImages.2.bytes:image_asset_fields_not_allowed",
      "goodsListImages.3.source:image_source_required",
      "goodsListImages.4.policyState:image_policy_state_not_allowed"
    ]);
  });

  it("limits official_runtime_url hosts to stellive.me, its subdomains and pbs.twimg.com", () => {
    for (const url of [
      "https://stellive.me/a.png",
      "https://sub.stellive.me/a.png",
      "https://a.b.stellive.me/a.png",
      "https://STELLIVE.ME/a.png",
      "https://pbs.twimg.com/media/abc.jpg?format=jpg&name=large"
    ]) {
      expect(validateHubEventGoodsListImages({ goodsListImages: [image(1, { url })] }), url).toEqual([]);
    }
    for (const url of [
      "https://fanding.kr/a.png",
      "https://cdn.example.com/a.png",
      "https://evil-stellive.me/a.png",
      "https://stellive.me.evil.com/a.png",
      "https://stellive.me@evil.com/a.png",
      "https://twimg.com/a.png",
      "https://abs.twimg.com/a.png"
    ]) {
      expect(validateHubEventGoodsListImages({ goodsListImages: [image(1, { url })] }), url).toEqual([
        expect.objectContaining({ field: "goodsListImages.0.url", reason: "goods_list_image_host_not_allowed" })
      ]);
    }
    expect(isAllowedGoodsGalleryImageHost("pbs.twimg.com")).toBe(true);
    expect(isAllowedGoodsGalleryImageHost("notstellive.me")).toBe(false);
  });

  it("does not restrict the host of the existing event image", () => {
    const result = validateHubEventForAdmin(
      {
        category: "online_goods",
        status: "announced",
        sourceUrl: "https://example.com/source",
        sourceLabel: "공식",
        sourceType: "official",
        generationId: "official",
        announcedAt: "2026-06-12T00:00:00.000Z",
        image: image(1, { url: "https://cdn.example.com/event.png" })
      },
      new CatalogService(),
      "draft"
    );
    expect(result.valid).toBe(true);
  });
});

function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: "gallery-event",
    category: "offline_popup",
    tags: [],
    participationMode: "offline",
    status: "open",
    title: "Gallery Event",
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "Stellive Official",
    sourceType: "official",
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2099-06-01T00:00:00Z",
    notificationEligible: true,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    ...overrides
  };
}

describe("goodsListImages public projection", () => {
  it("keeps only displayable images in notice order and omits the field when none remain", () => {
    const mixed = hubEvent({
      goodsListImages: [
        image(1),
        image(2, { policyState: "blocked" }),
        image(3, { policyState: "verify_required" }),
        { policyState: "none" },
        image(5, { url: "http://stellive.me/placeholder/md-list-05.png" }),
        image(6),
        image(4)
      ]
    });
    expect(urls(withPublicGoodsListImages(mixed).goodsListImages)).toEqual([image(1).url, image(6).url, image(4).url]);

    const none = withPublicGoodsListImages(hubEvent({ goodsListImages: [image(2, { policyState: "blocked" })] }));
    expect("goodsListImages" in none).toBe(false);
    expect("goodsListImages" in withPublicGoodsListImages(hubEvent({ goodsListImages: [] }))).toBe(false);
    expect(withPublicGoodsListImages(hubEvent())).toEqual(hubEvent());
  });
});

async function getJson(app: Awaited<ReturnType<typeof buildApp>>, url: string, headers: Record<string, string> = {}) {
  const response = await app.inject({ method: "GET", url, headers });
  return { status: response.statusCode, body: response.json(), text: response.body };
}

describe("goodsListImages over the public routes (memory mode)", () => {
  const galleryEvent = hubEvent({
    goodsListImages: [image(1), image(2, { policyState: "blocked" }), image(3)]
  });
  const plainEvent = hubEvent({ id: "plain-event", title: "Plain Event" });

  function buildWith(overrides: Record<string, string> = {}) {
    return buildApp({
      env: { ...env, ...overrides },
      useProcessEnv: false,
      appRoutes: { dependencies: { hubEvents: new HubEventService(new CatalogService(), [galleryEvent, plainEvent]) } }
    });
  }

  it("serves the filtered gallery on detail and nothing on events without it", async () => {
    const app = await buildWith();
    const detail = await getJson(app, "/v1/hub-events/gallery-event");
    const plain = await getJson(app, "/v1/hub-events/plain-event");
    await app.close();

    expect(detail.status).toBe(200);
    expect(urls(detail.body.goodsListImages)).toEqual([image(1).url, image(3).url]);
    expect(plain.status).toBe(200);
    expect("goodsListImages" in plain.body).toBe(false);
    expect(plain.body).toEqual(expect.not.objectContaining({ goodsListImages: expect.anything() }));
  });

  it("never includes goodsListImages in list, summary, calendar or widget payloads", async () => {
    const app = await buildWith();
    const list = await getJson(app, "/v1/hub-events");
    const summary = await getJson(app, "/v1/hub-events/summary");
    const calendar = await getJson(
      app,
      "/v1/hub-events/calendar?from=2026-10-01T00:00:00.000Z&to=2026-10-31T23:59:59.999Z&timezone=Asia/Seoul"
    );
    const widget = await getJson(app, "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=10");
    await app.close();

    expect(list.body.items.map((item: HubEvent) => item.id).sort()).toEqual(["gallery-event", "plain-event"]);
    expect(summary.body.preview.length).toBeGreaterThan(0);
    expect(calendar.text).toContain("gallery-event");
    expect(widget.body.entries.length).toBeGreaterThan(0);
    for (const response of [list, summary, calendar, widget]) {
      expect(response.status).toBe(200);
      expect(response.text).not.toContain("goodsListImages");
      expect(response.text).not.toContain("goodsListLayout");
    }
  });

  it("omits goodsListImages on detail when HUB_EVENT_GOODS_GALLERY_ENABLED=false", async () => {
    const app = await buildWith({ HUB_EVENT_GOODS_GALLERY_ENABLED: "false" });
    const detail = await getJson(app, "/v1/hub-events/gallery-event");
    await app.close();

    expect(detail.status).toBe(200);
    expect(detail.text).not.toContain("goodsListImages");
    expect(detail.text).not.toContain("goodsListLayout");
    expect(detail.body.id).toBe("gallery-event");
  });

  it("adds goodsListLayout (default split) to detail only when the gallery is present", async () => {
    const app = await buildWith();
    const detail = await getJson(app, "/v1/hub-events/gallery-event");
    const plain = await getJson(app, "/v1/hub-events/plain-event");
    await app.close();

    expect(detail.body.goodsListLayout).toBe("split");
    expect("goodsListLayout" in plain.body).toBe(false);
  });

  it("serves goodsListLayout single when HUB_EVENT_GOODS_GALLERY_LAYOUT=single and falls back to split when invalid", async () => {
    const single = await buildWith({ HUB_EVENT_GOODS_GALLERY_LAYOUT: "single" });
    const singleDetail = await getJson(single, "/v1/hub-events/gallery-event");
    await single.close();
    const invalid = await buildWith({ HUB_EVENT_GOODS_GALLERY_LAYOUT: "carousel" });
    const invalidDetail = await getJson(invalid, "/v1/hub-events/gallery-event");
    await invalid.close();

    expect(singleDetail.body.goodsListLayout).toBe("single");
    expect(urls(singleDetail.body.goodsListImages)).toEqual([image(1).url, image(3).url]);
    expect(invalidDetail.status).toBe(200);
    expect(invalidDetail.body.goodsListLayout).toBe("split");
  });

  it("omits goodsListLayout when every gallery image is filtered out or the kill switch is off", async () => {
    const blockedOnly = hubEvent({ id: "blocked-event", goodsListImages: [image(1, { policyState: "blocked" })] });
    const app = await buildApp({
      env,
      useProcessEnv: false,
      appRoutes: { dependencies: { hubEvents: new HubEventService(new CatalogService(), [blockedOnly]) } }
    });
    const filtered = await getJson(app, "/v1/hub-events/blocked-event");
    await app.close();
    const off = await buildWith({ HUB_EVENT_GOODS_GALLERY_ENABLED: "false", HUB_EVENT_GOODS_GALLERY_LAYOUT: "single" });
    const killed = await getJson(off, "/v1/hub-events/gallery-event");
    await off.close();

    expect(filtered.status).toBe(200);
    expect(filtered.text).not.toContain("goodsListLayout");
    expect(filtered.text).not.toContain("goodsListImages");
    expect(killed.text).not.toContain("goodsListLayout");
    expect(killed.text).not.toContain("goodsListImages");
  });

  it("ships placeholder gallery entries on the gen3-collab-popup seed event only on detail", async () => {
    const app = await buildApp({ env, useProcessEnv: false });
    const detail = await getJson(app, "/v1/hub-events/gen3-collab-popup");
    const other = await getJson(app, "/v1/hub-events/official-reservation-goods");
    const list = await getJson(app, "/v1/hub-events");
    await app.close();

    expect(detail.body.goodsListImages).toEqual([
      ...[1, 2].map((page) => ({
        policyState: "official_runtime_url",
        url: `https://stellive.me/placeholder/md-list-0${page}.png`,
        sourceLabel: "공식 공지",
        sourceUrl: "https://stellive.me/news/0",
        altText: `MD 리스트 ${page}`,
        kind: "md"
      })),
      {
        policyState: "official_runtime_url",
        url: "https://stellive.me/placeholder/bonus-list-01.png",
        sourceLabel: "공식 공지",
        sourceUrl: "https://stellive.me/news/0",
        altText: "특전 리스트 1",
        kind: "bonus"
      }
    ]);
    expect(detail.body.goodsListLayout).toBe("split");
    expect("goodsListImages" in other.body).toBe(false);
    expect("goodsListLayout" in other.body).toBe(false);
    expect(list.text).not.toContain("goodsListImages");
  });
});

/** In-memory stand-in for the Prisma delegates HubEventRepository touches (single event, no schedule items). */
function createFakePrisma() {
  const baseRow: Row = {
    id: EVENT_ID,
    category: "offline_popup",
    tags: [],
    participationMode: "offline",
    status: "open",
    scheduleMode: "single_window",
    title: "Popup",
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
    goodsListImages: null,
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
    scheduleItems: []
  };
  const events = new Map<string, Row>([[EVENT_ID, baseRow]]);
  const audits: Row[] = [];
  const writes: Record<string, unknown>[] = [];

  const prisma = {
    hubEvent: {
      async findFirst(args: { where: Row }) {
        const event = events.get(args.where.id);
        if (!event) return null;
        if (args.where.publicationState && event.publicationState !== args.where.publicationState) return null;
        return { ...event };
      },
      async findMany() {
        return [...events.values()].map((event) => ({ ...event }));
      },
      async updateMany(args: { where: { id: string; revision: number }; data: Record<string, unknown> }) {
        const event = events.get(args.where.id);
        if (!event || event.revision !== args.where.revision) return { count: 0 };
        writes.push(args.data);
        const { revision: _revision, ...data } = args.data;
        for (const [key, value] of Object.entries(data)) event[key] = value === Prisma.DbNull ? null : value;
        event.revision = (event.revision as number) + 1;
        return { count: 1 };
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
  return { prisma, events, audits, writes };
}

function setup(envOverrides: Record<string, string> = {}) {
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
    env: { ...env, ...envOverrides },
    useProcessEnv: false,
    adminHubEventRoutes: { dependencies: { service } },
    appRoutes: { dependencies: { hubEvents: repository } }
  });
  return { ...fake, appPromise };
}

async function put(app: Awaited<ReturnType<typeof buildApp>>, payload: Record<string, unknown>) {
  const response = await app.inject({
    method: "PUT",
    url: `/v1/admin/hub-events/${EVENT_ID}`,
    headers: auth,
    payload: { expectedRevision: 1, ...payload }
  });
  return { status: response.statusCode, body: response.json() };
}

describe("goodsListImages admin write path (real service + repository over a fake Prisma)", () => {
  it("persists the gallery, bumps revision, writes an update audit and serves the public filtered list", async () => {
    const { appPromise, events, audits } = setup();
    const app = await appPromise;
    const gallery = [image(1), image(2, { policyState: "blocked" }), image(3)];

    const updated = await put(app, { goodsListImages: gallery, changeReason: "notice 13930" });
    const adminGet = await getJson(app, `/v1/admin/hub-events/${EVENT_ID}`, auth);
    const publicDetail = await getJson(app, `/v1/hub-events/${EVENT_ID}`);
    const publicList = await getJson(app, "/v1/hub-events");
    await app.close();

    expect(updated.status).toBe(200);
    expect(updated.body.revision).toBe(2);
    expect(urls(updated.body.goodsListImages)).toEqual([image(1).url, image(2).url, image(3).url]);
    expect(events.get(EVENT_ID)!.goodsListImages).toEqual(gallery);
    expect(audits).toEqual([expect.objectContaining({ hubEventId: EVENT_ID, action: "update" })]);
    expect(adminGet.body.goodsListImages).toHaveLength(3);
    expect(urls(publicDetail.body.goodsListImages)).toEqual([image(1).url, image(3).url]);
    expect(publicList.text).not.toContain("goodsListImages");
  });

  it("persists kind, returns it on admin and public responses, and keeps layout off admin responses", async () => {
    const { appPromise, events } = setup({ HUB_EVENT_GOODS_GALLERY_LAYOUT: "single" });
    const app = await appPromise;
    const gallery = [image(1, { kind: "md" }), image(2, { kind: "bonus" }), image(3)];

    const updated = await put(app, { goodsListImages: gallery });
    const adminGet = await getJson(app, `/v1/admin/hub-events/${EVENT_ID}`, auth);
    const publicDetail = await getJson(app, `/v1/hub-events/${EVENT_ID}`);
    await app.close();

    expect(updated.status).toBe(200);
    expect(events.get(EVENT_ID)!.goodsListImages).toEqual(gallery);
    expect("kind" in (events.get(EVENT_ID)!.goodsListImages as object[])[2]!).toBe(false);
    expect(updated.body.goodsListImages.map((entry: HubEventGoodsListImage) => entry.kind)).toEqual(["md", "bonus", undefined]);
    expect(adminGet.body.goodsListImages.map((entry: HubEventGoodsListImage) => entry.kind)).toEqual(["md", "bonus", undefined]);
    expect(publicDetail.body.goodsListImages.map((entry: HubEventGoodsListImage) => entry.kind)).toEqual(["md", "bonus", undefined]);
    expect(publicDetail.body.goodsListLayout).toBe("single");
    expect("goodsListLayout" in adminGet.body).toBe(false);
    expect("goodsListLayout" in updated.body).toBe(false);
  });

  it("rejects an invalid kind with the indexed field and changes nothing", async () => {
    const { appPromise, events, audits } = setup();
    const app = await appPromise;
    const response = await put(app, { goodsListImages: [image(1), image(2, { kind: "extra" as never })] });
    await app.close();

    expect(response.status).toBe(400);
    expect(
      response.body.errors.map((error: { field: string; reason: string }) => `${error.field}:${error.reason}`)
    ).toContain("goodsListImages.1.kind:goods_list_image_kind_invalid");
    expect(audits).toEqual([]);
    expect(events.get(EVENT_ID)!.goodsListImages).toBeNull();
  });

  it("clears the column with null (Prisma.DbNull) and with an empty list, and leaves it alone when omitted", async () => {
    const { appPromise, events, writes } = setup();
    const app = await appPromise;

    expect((await put(app, { goodsListImages: [image(1)] })).status).toBe(200);
    const untouched = await put(app, { expectedRevision: 2, title: "Renamed" });
    expect(untouched.status).toBe(200);
    expect(untouched.body.goodsListImages).toHaveLength(1);
    expect("goodsListImages" in writes[1]).toBe(false);

    const cleared = await put(app, { expectedRevision: 3, goodsListImages: null });
    expect(cleared.status).toBe(200);
    expect("goodsListImages" in cleared.body).toBe(false);
    expect(writes[2].goodsListImages).toBe(Prisma.DbNull);
    expect(events.get(EVENT_ID)!.goodsListImages).toBeNull();

    expect((await put(app, { expectedRevision: 4, goodsListImages: [image(2)] })).status).toBe(200);
    const emptied = await put(app, { expectedRevision: 5, goodsListImages: [] });
    await app.close();
    expect(emptied.status).toBe(200);
    expect(writes[4].goodsListImages).toBe(Prisma.DbNull);
    expect(events.get(EVENT_ID)!.goodsListImages).toBeNull();
  });

  it("rejects invalid galleries with indexed field errors and changes nothing", async () => {
    const { appPromise, events, audits } = setup();
    const app = await appPromise;

    const rejected = await put(app, {
      goodsListImages: [image(1), image(2, { url: "https://fanding.kr/a.png" }), { ...image(3), base64: "AAAA" }]
    });
    const notArray = await put(app, { goodsListImages: "nope" });
    const tooMany = await put(app, {
      goodsListImages: Array.from({ length: maxHubEventGoodsListImages + 1 }, (_, index) => image(index + 1))
    });
    await app.close();

    expect(rejected.status).toBe(400);
    expect(rejected.body.errors.map((error: { field: string; reason: string }) => `${error.field}:${error.reason}`).sort()).toEqual([
      "goodsListImages.1.url:goods_list_image_host_not_allowed",
      "goodsListImages.2.base64:image_asset_fields_not_allowed"
    ]);
    expect(notArray.status).toBe(400);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.errors[0].reason).toBe("goods_list_images_too_many");
    expect(events.get(EVENT_ID)!.goodsListImages).toBeNull();
    expect(events.get(EVENT_ID)!.revision).toBe(1);
    expect(audits).toHaveLength(0);
  });

  it("keeps admin GET and admin writes working while the kill switch hides the gallery publicly", async () => {
    const { appPromise, events } = setup({ HUB_EVENT_GOODS_GALLERY_ENABLED: "false" });
    const app = await appPromise;

    const updated = await put(app, { goodsListImages: [image(1), image(2)] });
    const adminGet = await getJson(app, `/v1/admin/hub-events/${EVENT_ID}`, auth);
    const publicDetail = await getJson(app, `/v1/hub-events/${EVENT_ID}`);
    await app.close();

    expect(updated.status).toBe(200);
    expect(events.get(EVENT_ID)!.goodsListImages).toEqual([image(1), image(2)]);
    expect(adminGet.body.goodsListImages).toHaveLength(2);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.text).not.toContain("goodsListImages");
  });
});
