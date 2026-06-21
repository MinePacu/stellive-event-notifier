import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import { HubEventRepository } from "../src/hub-events/hubEventRepository.js";
import { HubEventService } from "../src/hub-events/hubEventService.js";
import type { HubEvent } from "../src/types.js";

const now = new Date("2026-06-20T12:00:00.000Z");

function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: "event-1",
    category: "online_goods",
    participationMode: "online",
    status: "upcoming",
    title: "공식 굿즈 판매",
    generationId: "official",
    memberId: "stellive-official",
    sourceUrl: "https://example.com/hub-events/event-1",
    sourceLabel: "공식 공지",
    sourceType: "official",
    notificationEligible: true,
    announcedAt: "2026-06-10T00:00:00.000Z",
    startsAt: "2026-06-20T00:00:00.000Z",
    endsAt: "2026-06-30T00:00:00.000Z",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

function hubEventRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "event-1",
    category: "online_goods",
    participationMode: "online",
    status: "upcoming",
    title: "공식 굿즈 판매",
    summary: null,
    memberId: "stellive-official",
    generationId: "official",
    sourceUrl: "https://example.com/hub-events/event-1",
    sourceLabel: "공식 공지",
    sourceType: "official",
    notificationEligible: true,
    purchaseUrl: null,
    ticketUrl: null,
    venueName: null,
    venueAddress: null,
    image: null,
    publishedAt: new Date("2026-06-10T00:00:00.000Z"),
    cancelledAt: null,
    deactivatedAt: null,
    deletedAt: null,
    publicationState: "published",
    revision: 1,
    createdBy: "admin",
    updatedBy: "admin",
    announcedAt: new Date("2026-06-10T00:00:00.000Z"),
    startsAt: new Date("2026-06-20T00:00:00.000Z"),
    endsAt: new Date("2026-06-30T00:00:00.000Z"),
    createdAt: new Date("2026-06-10T00:00:00.000Z"),
    updatedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...overrides
  };
}

describe("HubEvent status transitions", () => {
  it("returns open when an upcoming event has reached its start time", async () => {
    const service = new HubEventService(new CatalogService(), [hubEvent()]);

    const response = await service.list({ status: "open" }, now);

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.status).toBe("open");
  });

  it("returns ended when an active event has passed its end time", async () => {
    const service = new HubEventService(new CatalogService(), [
      hubEvent({
        status: "open",
        startsAt: "2026-06-19T00:00:00.000Z",
        endsAt: "2026-06-20T00:00:00.000Z"
      })
    ]);

    const response = await service.list({ status: "ended" }, now);

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.status).toBe("ended");
  });

  it("keeps start-only event open during its KST start date", async () => {
    const service = new HubEventService(new CatalogService(), [
      hubEvent({
        status: "open",
        startsAt: "2026-06-20T10:00:00.000Z",
        endsAt: undefined
      })
    ]);

    const response = await service.list({ status: "open" }, new Date("2026-06-20T14:59:59.000Z"));

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.status).toBe("open");
  });

  it("returns ended for start-only event after KST date rolls over", async () => {
    const service = new HubEventService(new CatalogService(), [
      hubEvent({
        status: "open",
        startsAt: "2026-06-20T10:00:00.000Z",
        endsAt: undefined
      })
    ]);

    const response = await service.list({ status: "ended" }, new Date("2026-06-20T15:00:00.000Z"));

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.status).toBe("ended");
  });

  it("applies time-based status transitions to Prisma-backed list and detail reads", async () => {
    const record = hubEventRecord();
    const repository = new HubEventRepository({
      hubEvent: {
        findMany: async (_args: unknown) => [record],
        findFirst: async (_args: unknown) => record
      }
    });

    const list = await repository.list({ status: "open" }, now);
    const detail = await repository.getById("event-1");

    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.status).toBe("open");
    expect(detail?.status).toBe("open");
  });
});
